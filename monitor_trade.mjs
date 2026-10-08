import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function monitor() {
  try {
    const now = new Date();
    const kst = new Date(now.getTime() + 9*60*60*1000);
    const kstTime = kst.toISOString().split('T')[1].split('.')[0];
    
    console.log(`\n⏰ [${kstTime} KST] 거래 상태 모니터링\n`);
    
    // 1. 최근 가격 (최근 5개)
    const prices = await pool.query(`
      SELECT close, created_at
      FROM price_snapshots
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (prices.rows.length > 0) {
      console.log('📊 최근 가격 데이터:');
      prices.rows.forEach((r, i) => {
        // UTC → KST 변환 (+ 9시간)
        const kstTime = new Date(new Date(r.created_at).getTime() + 9*60*60*1000);
        const h = kstTime.getUTCHours().toString().padStart(2, '0');
        const m = kstTime.getUTCMinutes().toString().padStart(2, '0');
        const s = kstTime.getUTCSeconds().toString().padStart(2, '0');
        const time = `${h}:${m}:${s}`;
        console.log(`   ${i+1}. ${parseInt(r.close).toLocaleString()}원 (${time})`);
      });
    } else {
      console.log('❌ 가격 데이터 없음');
    }
    
    // 2. 144개 통계 (6시간 범위)
    const stats = await pool.query(`
      SELECT
        MIN(CAST(close as INTEGER)) as min_price,
        MAX(CAST(close as INTEGER)) as max_price,
        COUNT(*) as count,
        (SELECT CAST(close as INTEGER) FROM price_snapshots WHERE code='005930' ORDER BY created_at DESC LIMIT 1) as latest
      FROM (
        SELECT close FROM price_snapshots
        WHERE code = '005930' AND CAST(close as INTEGER) > 0
        ORDER BY created_at DESC
        LIMIT 144
      ) t
    `);
    
    if (stats.rows.length > 0 && stats.rows[0].count > 0) {
      const s = stats.rows[0];

      // ⚠️ 데이터 검증 (0원은 쿼리에서 자동 제외)
      if (s.count !== 144) {
        console.warn(`⚠️ 데이터 부족 경고: ${s.count}개만 있음 (144개 필요) - 범위: ~${(s.count * 2.5 / 60).toFixed(1)}시간`);
      }

      if (s.latest <= 0) {
        console.error(`❌ 오류: 현재가가 0원 이하 (${s.latest}원)`);
      } else {
        // ✅ 0원 데이터는 쿼리에서 자동 제외됨
        const rise = ((s.max_price - s.min_price) / s.min_price * 100).toFixed(2);
        const buyPrice = Math.floor(s.min_price * 1.01);
        const diff = s.latest - buyPrice;
        const diffPct = (diff / buyPrice * 100).toFixed(2);

        console.log(`\n📈 144개 데이터 분석 (6시간 범위):`);
        console.log(`   데이터: ${s.count}개 ${s.count === 144 ? '✅' : '⚠️'}`);
        console.log(`   최저: ${s.min_price.toLocaleString()}원`);
        console.log(`   최고: ${s.max_price.toLocaleString()}원`);
        console.log(`   현재: ${s.latest.toLocaleString()}원`);
        console.log(`   상승률: ${rise}%`);

        console.log(`\n🎯 매수 신호 (저점 기준 1% 상승):`);
        console.log(`   기준가: ${buyPrice.toLocaleString()}원`);
        if (diff >= 0) {
          console.log(`   ✅ 매수 신호! (+${diff.toLocaleString()}원, +${diffPct}%)`);
        } else {
          console.log(`   ❌ 대기 중 (${diff.toLocaleString()}원 부족, ${diffPct}%)`);
        }
      }
    }
    
    // 3. 거래 기록 (최근 3개)
    const trades = await pool.query(`
      SELECT
        action, quantity, price,
        created_at
      FROM trade_history
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    if (trades.rows.length > 0) {
      console.log(`\n💰 최근 거래:`);
      trades.rows.forEach((t, i) => {
        // UTC → KST 변환 (+ 9시간)
        const kstTime = new Date(new Date(t.created_at).getTime() + 9*60*60*1000);
        const h = kstTime.getUTCHours().toString().padStart(2, '0');
        const m = kstTime.getUTCMinutes().toString().padStart(2, '0');
        const s = kstTime.getUTCSeconds().toString().padStart(2, '0');
        const time = `${h}:${m}:${s}`;
        console.log(`   ${i+1}. [${t.action}] ${t.quantity}주 @ ${t.price}원 (${time})`);
      });
    }
    
    // 4. 포지션
    const pos = await pool.query(`
      SELECT quantity, entry_price, status FROM trade_positions
      WHERE code = '005930' AND status = 'holding'
    `);
    
    if (pos.rows.length > 0) {
      console.log(`\n🎯 보유 포지션:`);
      pos.rows.forEach(p => {
        console.log(`   [${p.status}] ${p.quantity}주 @ ${p.entry_price}원`);
      });
    }
    
  } catch (err) {
    console.error('❌ 모니터링 오류:', err.message);
  } finally {
    await pool.end();
  }
}

monitor();
