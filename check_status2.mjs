import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    // 최근 72개 가격 조회
    console.log('📊 최근 가격 데이터 상세:');
    const recent72 = await pool.query(`
      SELECT close, created_at AT TIME ZONE 'Asia/Seoul' as kst_time
      FROM price_snapshots
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 72
    `);
    
    if (recent72.rows.length > 0) {
      const prices = recent72.rows.map(r => parseInt(r.close));
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const current = prices[0];
      const rise = ((max - min) / min * 100).toFixed(2);
      
      console.log(`✅ 최근 72개 데이터:`);
      console.log(`   현재가: ${current}원`);
      console.log(`   최저: ${min}원`);
      console.log(`   최고: ${max}원`);
      console.log(`   상승률: ${rise}%`);
      console.log(`   데이터 개수: ${recent72.rows.length}개`);
      
      // 저점 기준 매수가 계산
      const risePercent = 1.0; // UPTREND에서 1%
      const buyPrice = min * (1 + risePercent / 100);
      const shouldBuy = current >= buyPrice;
      
      console.log(`\n🎯 매수 신호 판단:`);
      console.log(`   저점: ${min}원`);
      console.log(`   매수 기준가: ${buyPrice.toFixed(2)}원 (저점 × 1.01)`);
      console.log(`   현재가: ${current}원`);
      console.log(`   매수 신호: ${shouldBuy ? '✅ YES' : '❌ NO'}`);
      if (shouldBuy) {
        console.log(`   차이: +${(current - min).toLocaleString()}원 (+${((current - min) / min * 100).toFixed(2)}%)`);
      } else {
        console.log(`   부족: ${(buyPrice - current).toLocaleString()}원`);
      }
    }
    
    // 최근 거래 기록
    console.log('\n💰 최근 거래 기록:');
    const trades = await pool.query(`
      SELECT 
        action, quantity, price,
        created_at AT TIME ZONE 'Asia/Seoul' as kst_time
      FROM trade_history
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (trades.rows.length > 0) {
      console.log(`✅ 거래 기록: ${trades.rows.length}개`);
      trades.rows.forEach((t, i) => {
        const kst = new Date(t.kst_time).toISOString().split('T')[1].split('.')[0];
        console.log(`   ${i+1}. [${t.action}] ${t.quantity}주 @ ${t.price}원 (${kst})`);
      });
    } else {
      console.log('   거래 기록 없음');
    }
    
    // 포지션
    console.log('\n🎯 보유 포지션:');
    const pos = await pool.query(`
      SELECT 
        code, name, quantity, entry_price, status,
        created_at AT TIME ZONE 'Asia/Seoul' as kst_time
      FROM trade_positions
      WHERE code = '005930'
    `);
    
    if (pos.rows.length > 0) {
      pos.rows.forEach(p => {
        const kst = new Date(p.kst_time).toISOString().split('T')[1].split('.')[0];
        console.log(`   [${p.status}] ${p.name}: ${p.quantity}주 @ ${p.entry_price}원 (${kst})`);
      });
    } else {
      console.log('   포지션 없음');
    }
    
  } catch (err) {
    console.error('❌ 에러:', err.message);
  } finally {
    await pool.end();
  }
}

check();
