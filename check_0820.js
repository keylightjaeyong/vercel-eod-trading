const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const result = await pool.query(`
      SELECT CAST(close AS NUMERIC) as p, timestamp AT TIME ZONE 'Asia/Seoul' as t
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(close AS NUMERIC) > 0
      AND timestamp AT TIME ZONE 'Asia/Seoul' >= '2026-10-07 08:00:00'
      ORDER BY timestamp ASC
    `);

    console.log('📊 오늘 08:00 이후 데이터:\n');
    if (result.rows.length === 0) {
      console.log('❌ 08:00 이후 데이터 없음!');
    } else {
      console.log(`✅ 총 ${result.rows.length}개\n`);
      result.rows.slice(0, 15).forEach(r => {
        console.log(`${r.p.toLocaleString()}원 @ ${r.t}`);
      });
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
  }
}

check();
