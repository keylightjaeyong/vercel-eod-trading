const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    console.log('📊 데이터 수집 시간대 분석:\n');

    // 모든 데이터 시간 확인
    const all = await pool.query(`
      SELECT timestamp AT TIME ZONE 'Asia/Seoul' as t, COUNT(*) as cnt
      FROM price_snapshots 
      WHERE code='005930'
      AND DATE(timestamp AT TIME ZONE 'Asia/Seoul') = '2026-10-07'
      AND CAST(close AS NUMERIC) > 0
      GROUP BY DATE(timestamp), EXTRACT(HOUR FROM timestamp)
      ORDER BY timestamp ASC
    `);

    console.log('오늘(10월 7일) 시간별 데이터:\n');
    all.rows.forEach(r => {
      const hour = new Date(r.t).getHours();
      console.log(`${String(hour).padStart(2, '0')}시: ${r.cnt}개`);
    });

    // 데이터 갭 확인
    console.log('\n📈 데이터 수집 현황:\n');
    
    const first = await pool.query(`
      SELECT timestamp AT TIME ZONE 'Asia/Seoul' as t
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(close AS NUMERIC) > 0
      ORDER BY timestamp ASC LIMIT 1
    `);

    const last = await pool.query(`
      SELECT timestamp AT TIME ZONE 'Asia/Seoul' as t
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(close AS NUMERIC) > 0
      ORDER BY timestamp DESC LIMIT 1
    `);

    console.log(`첫 수집: ${first.rows[0].t}`);
    console.log(`마지막 수집: ${last.rows[0].t}`);

    const firstTime = new Date(first.rows[0].t);
    const lastTime = new Date(last.rows[0].t);
    const gapHours = (lastTime - firstTime) / (1000 * 60 * 60);

    console.log(`기간: ${gapHours.toFixed(1)}시간`);

    // 08:20과 08:40 확인
    console.log('\n🔍 08:20과 08:40 데이터 확인:\n');
    const check0820 = await pool.query(`
      SELECT COUNT(*) as cnt, MIN(CAST(close AS NUMERIC)) as min, MAX(CAST(close AS NUMERIC)) as max
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(EXTRACT(HOUR FROM timestamp AT TIME ZONE 'Asia/Seoul') AS INTEGER) = 8
      AND CAST(EXTRACT(MINUTE FROM timestamp AT TIME ZONE 'Asia/Seoul') AS INTEGER) BETWEEN 15 AND 45
      AND CAST(close AS NUMERIC) > 0
    `);

    const c = check0820.rows[0];
    console.log(`08:15~08:45 데이터: ${c.cnt}개`);
    if (c.cnt > 0) {
      console.log(`  저점: ${c.min.toLocaleString()}원`);
      console.log(`  고점: ${c.max.toLocaleString()}원`);
    } else {
      console.log('  ❌ 데이터 없음!');
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
  }
}

check();
