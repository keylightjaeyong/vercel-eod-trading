const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const result = await pool.query(`
      SELECT timestamp AT TIME ZONE 'Asia/Seoul' as t, COUNT(*) as cnt
      FROM price_snapshots 
      WHERE code='005930'
      GROUP BY timestamp
      ORDER BY timestamp DESC LIMIT 5
    `);

    console.log('📊 최근 5개 수집 시간:\n');
    result.rows.forEach(r => {
      console.log(`${r.t} (${r.cnt}개)`);
    });

    const latest = result.rows[0];
    const now = new Date();
    const latestTime = new Date(latest.t);
    const diffMin = Math.floor((now - latestTime) / 60000);

    console.log(`\n⏰ 현재: ${now.toISOString()}`);
    console.log(`📈 최신: ${latest.t}`);
    console.log(`⏱️ 차이: ${diffMin}분 전`);

    if (diffMin > 10) {
      console.log(`\n⚠️ ${diffMin}분 동안 데이터 수집 안 됨!`);
    } else {
      console.log('\n✅ 데이터 수집 진행 중!');
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
  }
}

check();
