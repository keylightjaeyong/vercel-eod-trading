const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const [t, p, h] = await Promise.all([
      pool.query(`SELECT NOW() AT TIME ZONE 'Asia/Seoul' as t`),
      pool.query(`SELECT CAST(close AS NUMERIC) as p FROM price_snapshots WHERE code='005930' ORDER BY timestamp DESC LIMIT 1`),
      pool.query(`SELECT COUNT(*) as h FROM trade_positions WHERE status='holding'`)
    ]);

    const time = t.rows[0].t;
    const price = p.rows[0].p;
    const holding = h.rows[0].h;

    console.log(`⏰ ${time}`);
    console.log(`💹 ${price.toLocaleString()}원`);
    console.log(`${holding > 0 ? '✅ 거래 완료!' : '⏳ 대기 중'}`);

    await pool.end();
  } catch (e) {
    process.exit(1);
  }
}

check();
