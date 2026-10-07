import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('📅 실제 데이터 시간 확인 (UTC 기준)\n');
    
    const latest = await pool.query(`
      SELECT 
        id, close, created_at,
        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') as utc_time,
        TO_CHAR(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') as kst_time
      FROM price_snapshots
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log('최근 10개 데이터 (정확한 시간):');
    latest.rows.forEach((r, i) => {
      console.log(`${i+1}. ${r.close}원 | UTC: ${r.utc_time} | KST: ${r.kst_time}`);
    });
    
    // 날짜별로 그룹화
    console.log('\n📊 날짜별 데이터 개수:');
    const byDate = await pool.query(`
      SELECT DATE(created_at AT TIME ZONE 'Asia/Seoul') as date,
             COUNT(*) as count
      FROM price_snapshots
      WHERE code = '005930'
      GROUP BY DATE(created_at AT TIME ZONE 'Asia/Seoul')
      ORDER BY date DESC
      LIMIT 3
    `);
    
    byDate.rows.forEach(r => {
      console.log(`   ${r.date}: ${r.count}개`);
    });
    
  } catch (err) {
    console.error('❌ 에러:', err.message);
  } finally {
    await pool.end();
  }
}

check();
