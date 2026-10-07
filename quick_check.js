const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const [time, price, holding] = await Promise.all([
      pool.query(`SELECT NOW() AT TIME ZONE 'Asia/Seoul' as kst_time`),
      pool.query(`SELECT CAST(close AS NUMERIC) as price FROM price_snapshots WHERE code = '005930' ORDER BY timestamp DESC LIMIT 1`),
      pool.query(`SELECT COUNT(*) as cnt FROM trade_positions WHERE status = 'holding'`)
    ]);

    console.log(`⏰ ${time.rows[0].kst_time}`);
    console.log(`💹 ${price.rows[0].price.toLocaleString()}원`);
    console.log(`${holding.rows[0].cnt > 0 ? '✅ 거래 성공!' : '⏳ 대기 중'}`);

    await pool.end();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

check();
