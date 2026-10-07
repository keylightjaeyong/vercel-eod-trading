const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    console.log('📊 오늘 데이터 수집 시간대:\n');

    // 08:00 ~ 16:00 데이터만
    const data = await pool.query(`
      SELECT EXTRACT(HOUR FROM timestamp AT TIME ZONE 'Asia/Seoul')::INTEGER as hour,
             COUNT(*) as cnt
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(close AS NUMERIC) > 0
      AND timestamp AT TIME ZONE 'Asia/Seoul' >= '2026-10-07 08:00:00'
      GROUP BY hour
      ORDER BY hour
    `);

    console.log('시간별 데이터 개수:');
    for (let h = 8; h <= 16; h++) {
      const row = data.rows.find(r => r.hour === h);
      const cnt = row ? row.cnt : 0;
      console.log(`${String(h).padStart(2, '0')}시: ${cnt}개 ${cnt === 0 ? '❌' : '✅'}`);
    }

    // 08:20 데이터
    console.log('\n🔍 08:20경 데이터:');
    const check = await pool.query(`
      SELECT COUNT(*) as cnt, 
             MIN(CAST(close AS NUMERIC)) as min,
             MAX(CAST(close AS NUMERIC)) as max,
             MIN(timestamp AT TIME ZONE 'Asia/Seoul') as first,
             MAX(timestamp AT TIME ZONE 'Asia/Seoul') as last
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(close AS NUMERIC) > 0
      AND timestamp AT TIME ZONE 'Asia/Seoul' >= '2026-10-07 08:00:00'
      AND timestamp AT TIME ZONE 'Asia/Seoul' <= '2026-10-07 09:00:00'
    `);

    const c = check.rows[0];
    console.log(`08:00~09:00 데이터: ${c.cnt}개`);
    if (c.cnt > 0) {
      console.log(`  범위: ${c.first} ~ ${c.last}`);
      console.log(`  가격: ${c.min.toLocaleString()}원 ~ ${c.max.toLocaleString()}원`);
    } else {
      console.log('  ❌ 08:00 이후 데이터 없음!');
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
  }
}

check();
