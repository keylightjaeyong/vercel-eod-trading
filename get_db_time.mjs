import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  // 방법 1: 데이터베이스의 KST 시간
  const result1 = await pool.query(`
    SELECT NOW() AT TIME ZONE 'Asia/Seoul' as korea_time
  `);
  
  console.log(`\n✅ 데이터베이스 KST 시간:`);
  console.log(`   ${result1.rows[0].korea_time}\n`);

  // 방법 2: UTC 시간과 KST 시간 모두 표시
  const result2 = await pool.query(`
    SELECT 
      NOW() as utc_time,
      NOW() AT TIME ZONE 'Asia/Seoul' as korea_time,
      EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Seoul') as hour,
      EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Seoul') as minute,
      EXTRACT(SECOND FROM NOW() AT TIME ZONE 'Asia/Seoul') as second
  `);
  
  const data = result2.rows[0];
  console.log(`UTC 시간: ${data.utc_time}`);
  console.log(`KST 시간: ${data.korea_time}`);
  console.log(`시:분:초 = ${String(Math.floor(data.hour)).padStart(2,'0')}:${String(Math.floor(data.minute)).padStart(2,'0')}:${String(Math.floor(data.second)).padStart(2,'0')}\n`);

} catch (error) {
  console.error(`❌ 오류: ${error.message}`);
} finally {
  await pool.end();
}
