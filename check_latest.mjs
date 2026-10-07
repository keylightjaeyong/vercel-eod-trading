import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const latest = await pool.query(`
      SELECT 
        close,
        created_at,
        created_at AT TIME ZONE 'Asia/Seoul' as kst_time
      FROM price_snapshots
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('최근 5개 데이터:');
    latest.rows.forEach((r, i) => {
      const utc = new Date(r.created_at).toISOString();
      const kst = new Date(r.kst_time).toISOString();
      console.log(`${i+1}. ${r.close}원 | UTC: ${utc} | KST: ${kst}`);
    });
    
  } catch (err) {
    console.error('❌ 에러:', err.message);
  } finally {
    await pool.end();
  }
}

check();
