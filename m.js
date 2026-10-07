const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function m() {
  try {
    const p = await pool.query(`SELECT CAST(close AS NUMERIC) as p, timestamp AT TIME ZONE 'Asia/Seoul' as t FROM price_snapshots WHERE code='005930' ORDER BY timestamp DESC LIMIT 1`);
    const h = await pool.query(`SELECT COUNT(*) as h FROM trade_positions WHERE status='holding'`);
    const l = await pool.query(`SELECT MIN(CAST(close AS NUMERIC)) as min FROM price_snapshots WHERE code='005930' AND CAST(close AS NUMERIC) > 0 LIMIT 1`);

    const price = p.rows[0].p;
    const time = p.rows[0].t;
    const holding = h.rows[0].h;
    const minPrice = l.rows[0].min;
    const buy = minPrice * 1.01;

    console.log(`⏰ ${time}`);
    console.log(`💹 ${price.toLocaleString()}원 | 저점: ${minPrice.toLocaleString()}원`);
    console.log(`🎯 매수기준: ${buy.toLocaleString()}원`);
    console.log(`${price >= buy ? `✅ 매수신호!` : `❌ ${(buy-price).toFixed(0)}원`}`);
    console.log(`${holding > 0 ? `✅ 거래됨` : `⏳ 대기`}`);

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

m();
