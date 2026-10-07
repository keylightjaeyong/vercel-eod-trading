import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('🔑 KIS 토큰 상태 확인...\n');
    
    const token = await pool.query(`
      SELECT access_token, expires_at 
      FROM kis_tokens 
      WHERE id = 1
    `);
    
    if (token.rows.length > 0) {
      const t = token.rows[0];
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = t.expires_at;
      const isExpired = now > expiresAt;
      const remaining = expiresAt - now;
      const remainingHours = Math.floor(remaining / 3600);
      const remainingMins = Math.floor((remaining % 3600) / 60);
      
      console.log('✅ 토큰 존재');
      console.log(`   현재: ${now}`);
      console.log(`   만료: ${expiresAt}`);
      console.log(`   상태: ${isExpired ? '❌ 만료됨' : '✅ 유효'}`);
      console.log(`   남은 시간: ${remainingHours}시간 ${remainingMins}분`);
    } else {
      console.log('❌ 토큰 없음 - 아직 한 번도 호출되지 않음');
    }
    
  } catch (err) {
    console.error('❌ 에러:', err.message);
  } finally {
    await pool.end();
  }
}

check();
