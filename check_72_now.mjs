import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  const timeResult = await pool.query(`
    SELECT NOW() AT TIME ZONE 'Asia/Seoul' as current_time
  `);
  const current_time = timeResult.rows[0].current_time;
  console.log(`\n⏰ 현재 시간: ${current_time}`);
  
  const countResult = await pool.query(`SELECT COUNT(*) as total FROM price_snapshots`);
  console.log(`📊 총 가격 데이터: ${countResult.rows[0].total}개\n`);
  
  const recent = await pool.query(`
    SELECT * FROM price_snapshots ORDER BY created_at DESC LIMIT 5
  `);
  
  if (recent.rows.length > 0) {
    console.log(`✅ 최신 데이터 (5개):`);
    recent.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.created_at}`);
    });
  }
  
  const last72 = await pool.query(`
    SELECT COUNT(*) as count FROM price_snapshots 
    ORDER BY created_at DESC LIMIT 72
  `);
  console.log(`\n✅ 최근 72개봉: ${last72.rows[0].count}개 확보됨`);
  
  await pool.end();
} catch (error) {
  console.error(`❌ 에러: ${error.message}`);
  process.exit(1);
}
