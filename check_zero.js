const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    console.log('🔍 0원 데이터 확인\n');
    
    const zeroData = await pool.query(`
      SELECT COUNT(*) as cnt, 
             MIN(timestamp AT TIME ZONE 'Asia/Seoul') as oldest,
             MAX(timestamp AT TIME ZONE 'Asia/Seoul') as newest
      FROM price_snapshots 
      WHERE code='005930' AND CAST(close AS NUMERIC) = 0
    `);

    const z = zeroData.rows[0];
    console.log(`0원 데이터: ${z.cnt}개`);
    if (z.cnt > 0) {
      console.log(`  최오래: ${z.oldest}`);
      console.log(`  최신: ${z.newest}`);
    }

    console.log('\n⏰ 최근 수집 시간 확인\n');
    
    const latest = await pool.query(`
      SELECT timestamp AT TIME ZONE 'Asia/Seoul' as t, 
             COUNT(*) as cnt
      FROM price_snapshots 
      WHERE code='005930'
      GROUP BY timestamp
      ORDER BY timestamp DESC LIMIT 3
    `);

    latest.rows.forEach(r => {
      console.log(`${r.t} (${r.cnt}개)`);
    });

    console.log('\n📊 04:17 이후 데이터 여부\n');
    
    const after417 = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM price_snapshots 
      WHERE code='005930'
      AND timestamp AT TIME ZONE 'Asia/Seoul' > '2026-10-07 04:17:36'
    `);

    console.log(`04:17 이후 데이터: ${after417.rows[0].cnt}개`);

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
  }
}

check();
