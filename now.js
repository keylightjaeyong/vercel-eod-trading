const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const [p, h, l, t] = await Promise.all([
      pool.query(`SELECT CAST(close AS NUMERIC) as p FROM price_snapshots WHERE code='005930' AND CAST(close AS NUMERIC) > 0 ORDER BY timestamp DESC LIMIT 1`),
      pool.query(`SELECT COUNT(*) as h FROM trade_positions WHERE status='holding'`),
      pool.query(`SELECT MIN(CAST(close AS NUMERIC)) as min FROM price_snapshots WHERE code='005930' AND CAST(close AS NUMERIC) > 0`),
      pool.query(`SELECT NOW() AT TIME ZONE 'Asia/Seoul' as t`)
    ]);

    const price = p.rows[0].p;
    const holding = h.rows[0].h;
    const minPrice = l.rows[0].min;
    const buyPrice = minPrice * 1.01;
    const time = t.rows[0].t;

    console.log(`⏰ ${time}\n`);
    console.log(`💹 현재가: ${price.toLocaleString()}원`);
    console.log(`📉 저점: ${minPrice.toLocaleString()}원`);
    console.log(`🎯 매수기준: ${buyPrice.toLocaleString()}원`);
    console.log(`${price >= buyPrice ? `✅ 매수신호!` : `❌ ${(buyPrice-price).toFixed(0)}원`}\n`);
    console.log(`${holding > 0 ? `✅ 거래 완료! (${holding}개)` : `⏳ 아직 거래 없음`}`);

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
  }
}

check();
