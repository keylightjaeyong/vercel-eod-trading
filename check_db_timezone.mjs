import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    // 1. 데이터베이스 타임존 설정 확인
    const tz = await pool.query(`SHOW timezone`);
    console.log('데이터베이스 timezone:', tz.rows[0]);
    
    // 2. 최근 데이터 시간 확인 (다양한 형식)
    const data = await pool.query(`
      SELECT 
        created_at as raw_time,
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as text_utc,
        EXTRACT(EPOCH FROM created_at) as epoch_seconds
      FROM price_snapshots
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (data.rows.length > 0) {
      const row = data.rows[0];
      console.log('\n최신 데이터:');
      console.log('  raw_time:', row.raw_time);
      console.log('  text_utc:', row.text_utc);
      console.log('  epoch:', row.epoch_seconds);
      
      // 자바스크립트에서 계산
      const epochMs = row.epoch_seconds * 1000;
      const jsDate = new Date(epochMs);
      console.log('\n자바스크립트 해석:');
      console.log('  new Date(epoch):', jsDate.toISOString());
      console.log('  getUTCHours():', jsDate.getUTCHours());
      
      // + 9시간
      const kstDate = new Date(epochMs + 9*60*60*1000);
      console.log('\n+ 9시간:');
      console.log('  KST 시간:', kstDate.toISOString());
      console.log('  getUTCHours():', kstDate.getUTCHours());
    }
    
  } catch (err) {
    console.error('❌ 에러:', err.message);
  } finally {
    await pool.end();
  }
}

check();
