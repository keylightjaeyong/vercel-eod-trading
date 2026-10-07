const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    // 최근 72개 데이터 범위
    const result = await pool.query(`
      SELECT 
        COUNT(*) as cnt,
        MIN(timestamp AT TIME ZONE 'Asia/Seoul') as oldest,
        MAX(timestamp AT TIME ZONE 'Asia/Seoul') as newest,
        MIN(CAST(close AS NUMERIC)) as min_price,
        MAX(CAST(close AS NUMERIC)) as max_price,
        COUNT(DISTINCT DATE(timestamp AT TIME ZONE 'Asia/Seoul')) as days
      FROM (
        SELECT close, timestamp FROM price_snapshots 
        WHERE code='005930'
        AND CAST(close AS NUMERIC) > 0
        ORDER BY timestamp DESC LIMIT 72
      ) as recent
    `);

    const r = result.rows[0];
    console.log('📊 최근 72개 데이터 분석:');
    console.log(`  개수: ${r.cnt}개`);
    console.log(`  최오래: ${r.oldest}`);
    console.log(`  최신: ${r.newest}`);
    console.log(`  저점: ${r.min_price.toLocaleString()}원`);
    console.log(`  고점: ${r.max_price.toLocaleString()}원`);
    console.log(`  날짜: ${r.days}일\n`);

    if (r.days > 1) {
      console.log('⚠️ 문제 발견! 72개가 2일 이상의 데이터를 포함하고 있습니다!');
      console.log('   → 오늘 데이터만으로 72개를 채우지 못했다는 의미');
    } else if (r.days === 1) {
      console.log('✅ 정상: 72개가 모두 오늘 데이터입니다!');
    }

    // 각 날짜별 개수
    const byDate = await pool.query(`
      SELECT DATE(timestamp AT TIME ZONE 'Asia/Seoul') as date, COUNT(*) as cnt
      FROM (
        SELECT timestamp FROM price_snapshots 
        WHERE code='005930'
        AND CAST(close AS NUMERIC) > 0
        ORDER BY timestamp DESC LIMIT 72
      ) as recent
      GROUP BY DATE(timestamp AT TIME ZONE 'Asia/Seoul')
      ORDER BY date DESC
    `);

    console.log('\n📅 날짜별 분포:');
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
