const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const p = await pool.query(`SELECT CAST(close AS NUMERIC) as p, timestamp AT TIME ZONE 'Asia/Seoul' as t FROM price_snapshots WHERE code='005930' AND CAST(close AS NUMERIC) > 0 ORDER BY timestamp DESC LIMIT 1`);
    const l = await pool.query(`SELECT MIN(CAST(close AS NUMERIC)) as min FROM price_snapshots WHERE code='005930' AND CAST(close AS NUMERIC) > 0`);
    const h = await pool.query(`SELECT COUNT(*) as h FROM trade_positions WHERE status='holding'`);

    const price = p.rows[0].p;
    const time = p.rows[0].t;
    const minPrice = l.rows[0].min;
    const buyPrice = minPrice * 1.01;
    const holding = h.rows[0].h;

    console.log(`⏰ ${time}`);
    console.log(`💹 현재가: ${price.toLocaleString()}원`);
    console.log(`📉 저점: ${minPrice.toLocaleString()}원`);
    console.log(`🎯 매수기준: ${buyPrice.toLocaleString()}원`);
    console.log(`${price >= buyPrice ? `✅ 매수신호!` : `❌ ${(buyPrice-price).toFixed(0)}원 모자람`}`);
    console.log(`\n${holding > 0 ? `✅ 거래됨!` : `⏳ 아직`}`);

    await pool.end();
  } catch (e) {
    process.exit(1);
  }
}

check();
