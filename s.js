const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function s() {
  try {
    const [t, p, h] = await Promise.all([
      pool.query(`SELECT NOW() AT TIME ZONE 'Asia/Seoul' as t`),
      pool.query(`SELECT CAST(close AS NUMERIC) as p FROM price_snapshots WHERE code='005930' ORDER BY timestamp DESC LIMIT 1`),
      pool.query(`SELECT COUNT(*) as h FROM trade_positions WHERE status='holding'`)
    ]);

    console.log(`⏰ ${t.rows[0].t} | 💹 ${p.rows[0].p.toLocaleString()}원 | ${h.rows[0].h > 0 ? '✅ 거래!' : '⏳ 대기'}`);

    await pool.end();
  } catch (e) {
    process.exit(1);
  }
}

s();
