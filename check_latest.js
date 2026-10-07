const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const result = await pool.query(`
      SELECT timestamp AT TIME ZONE 'Asia/Seoul' as time, CAST(close AS NUMERIC) as price
      FROM price_snapshots 
      WHERE code='005930'
      ORDER BY timestamp DESC LIMIT 20
    `);

    console.log('📈 최신 20개 데이터:\n');
    result.rows.forEach((r, i) => {
      console.log(`${i+1}. ${r.price.toLocaleString()}원 @ ${r.time}`);
    });

    const latest = result.rows[0];
    const now = new Date();
    const latestTime = new Date(latest.time);
    const diffMin = Math.floor((now - latestTime) / 60000);

    console.log(`\n현재 시간: ${now.toISOString()}`);
    console.log(`최신 데이터: ${latest.time}`);
    console.log(`차이: ${diffMin}분 전`);

    if (diffMin < 10) {
      console.log('\n✅ 데이터가 계속 수집되고 있습니다!');
    } else {
      console.log(`\n⚠️ ${diffMin}분 전부터 데이터가 없습니다.`);
      console.log('⚠️ Vercel Cron이 중단되었거나 KIS API 오류가 있을 수 있습니다.');
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

check();
