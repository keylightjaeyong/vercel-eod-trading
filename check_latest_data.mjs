import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await pool.query(`
    SELECT created_at, updated_at FROM price_snapshots ORDER BY id DESC LIMIT 1
  `);
  
  if (result.rows.length > 0) {
    console.log(`\n✅ 최신 데이터: ${result.rows[0].created_at}`);
  }
  
  await pool.end();
} catch (error) {
  console.error(`❌ 에러: ${error.message}`);
  process.exit(1);
}
