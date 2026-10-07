const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function monitor() {
  try {
    // 현재 가격
    const priceResult = await pool.query(
      `SELECT CAST(close AS NUMERIC) as price, timestamp FROM price_snapshots 
       WHERE code = '005930' ORDER BY timestamp DESC LIMIT 1`
    );
    
    // 최근 72개 저점
    const lowResult = await pool.query(`
      SELECT MIN(CAST(close AS NUMERIC)) as min_price
      FROM (
        SELECT close FROM price_snapshots 
        WHERE code = '005930'
        ORDER BY timestamp DESC LIMIT 72
      ) as recent
    `);

    // 거래 기록
    const tradesResult = await pool.query(
      `SELECT id, code, name, quantity, entry_price, status, created_at 
       FROM trade_positions ORDER BY created_at DESC LIMIT 1`
    );

    const price = priceResult.rows[0].price;
    const time = priceResult.rows[0].timestamp;
    const minPrice = lowResult.rows[0].min_price;
    const buyPrice = minPrice * 1.008;
    const gap = price - buyPrice;

    console.log(`\n⏰ ${time}`);
    console.log(`💹 현재가: ${price.toLocaleString()}원`);
    console.log(`📉 저점: ${minPrice.toLocaleString()}원`);
    console.log(`🎯 매수기준: ${buyPrice.toLocaleString()}원`);
    console.log(`📊 차이: ${gap >= 0 ? `✅ +${gap.toFixed(0)}원 (매수!)` : `❌ ${gap.toFixed(0)}원 (${Math.abs(gap).toFixed(0)}원 모자람)`}`);

    if (tradesResult.rows.length > 0) {
      const trade = tradesResult.rows[0];
      console.log(`\n✅ 거래 발생!`);
      console.log(`  [${trade.code}] ${trade.name}`);
      console.log(`  ${trade.quantity}주 @ ${trade.entry_price}원`);
      console.log(`  상태: ${trade.status}`);
      console.log(`  시간: ${trade.created_at}`);
    } else {
      console.log(`\n⏳ 거래: 아직 없음`);
    }

    await pool.end();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

monitor();
