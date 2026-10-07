import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    // 1. 최근 가격 데이터 (최근 10개)
    console.log('📊 최근 가격 데이터:');
    const prices = await pool.query(`
      SELECT code, close, created_at AT TIME ZONE 'Asia/Seoul' as kst_time
      FROM price_snapshots
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (prices.rows.length > 0) {
      console.log(`✅ 수집된 가격: ${prices.rows.length}개`);
      prices.rows.forEach((r, i) => {
        const kst = new Date(r.kst_time).toISOString().split('T')[1].split('.')[0];
        console.log(`   ${i+1}. ${r.close}원 @ ${kst}`);
      });
    } else {
      console.log('❌ 가격 데이터 없음');
    }
    
    // 2. 최근 72개 데이터 통계
    console.log('\n📈 최근 72개 가격 통계:');
    const stats = await pool.query(`
      SELECT 
        MIN(CAST(close as INTEGER)) as min_price,
        MAX(CAST(close as INTEGER)) as max_price,
        COUNT(*) as count
      FROM (
        SELECT close FROM price_snapshots
        WHERE code = '005930'
        ORDER BY created_at DESC
        LIMIT 72
      ) t
    `);
    
    if (stats.rows.length > 0) {
      const s = stats.rows[0];
      console.log(`   최저: ${s.min_price}원`);
      console.log(`   최고: ${s.max_price}원`);
      console.log(`   개수: ${s.count}개`);
      if (s.max_price && s.min_price) {
        const rise = ((s.max_price - s.min_price) / s.min_price * 100).toFixed(2);
        console.log(`   상승률: ${rise}%`);
      }
    }
    
    // 3. 최근 거래 기록
    console.log('\n💰 최근 거래 기록:');
    const trades = await pool.query(`
      SELECT 
        action, quantity, price, status,
        created_at AT TIME ZONE 'Asia/Seoul' as kst_time
      FROM trade_history
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (trades.rows.length > 0) {
      trades.rows.forEach((t, i) => {
        const kst = new Date(t.kst_time).toISOString().split('T')[1].split('.')[0];
        console.log(`   ${i+1}. [${t.action}] ${t.quantity}주 @ ${t.price}원 (${t.status}) - ${kst}`);
      });
    } else {
      console.log('   거래 기록 없음');
    }
    
    // 4. 현재 포지션
    console.log('\n🎯 보유 포지션:');
    const pos = await pool.query(`
      SELECT 
        code, name, quantity, entry_price, status,
        created_at AT TIME ZONE 'Asia/Seoul' as kst_time
      FROM trade_positions
      WHERE code = '005930' AND status = 'holding'
    `);
    
    if (pos.rows.length > 0) {
      pos.rows.forEach(p => {
        const kst = new Date(p.kst_time).toISOString().split('T')[1].split('.')[0];
        console.log(`   📍 ${p.name}: ${p.quantity}주 @ ${p.entry_price}원 (진입: ${kst})`);
      });
    } else {
      console.log('   보유 포지션 없음');
    }
    
  } catch (err) {
    console.error('❌ 에러:', err.message);
  } finally {
    await pool.end();
  }
}

check();
