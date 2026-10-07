const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const range = await pool.query(`
      SELECT 
        MIN(timestamp AT TIME ZONE 'Asia/Seoul') as earliest,
        MAX(timestamp AT TIME ZONE 'Asia/Seoul') as latest,
        COUNT(*) as total,
        COUNT(DISTINCT DATE(timestamp AT TIME ZONE 'Asia/Seoul')) as days
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(close AS NUMERIC) > 0
    `);

    const r = range.rows[0];
    console.log('📊 데이터 범위:');
    console.log(`  최초: ${r.earliest}`);
    console.log(`  최신: ${r.latest}`);
    console.log(`  총 개수: ${r.total}개`);
    console.log(`  날짜 수: ${r.days}일\n`);

    // 날짜별 데이터
    const byDate = await pool.query(`
      SELECT DATE(timestamp AT TIME ZONE 'Asia/Seoul') as date, COUNT(*) as cnt
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(close AS NUMERIC) > 0
      GROUP BY DATE(timestamp AT TIME ZONE 'Asia/Seoul')
      ORDER BY date DESC
      LIMIT 5
    `);

    console.log('📅 최근 5일 데이터:');
    byDate.rows.forEach(d => {
      console.log(`  ${d.date}: ${d.cnt}개`);
    });

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

check();
