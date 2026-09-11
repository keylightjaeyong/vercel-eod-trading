const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ0b2tlbiIsImF1ZCI6IjdjYzZmMzQ0LTUzMDUtNDBlMy05MmM2LTNhZjhlODAyNzc1YSIsInByZHRfY2QiOiIiLCJpc3MiOiJ1bm9ndyIsImV4cCI6MTc4OTE5ODg5OSwiaWF0IjoxNzg5MTEyNDk5LCJqdGkiOiJQU3I5OEFWTWtHTWx5OUVPZGRVVXZVNzZsMlRVYlB1czdHTW4ifQ.hSQLdqt3Tn47IlC37IDTrtJsjwMCHIKuc2Wl4C6vdVnO84lXKtPuPdrk7vb5NuUr0Czz8b-US36FoDrzE_Layg';
    const expiresAt = new Date('2026-09-12 16:41:39');
    
    await pool.query(
      `INSERT INTO kis_tokens (id, token_value, expires_at)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE
       SET token_value = $1, expires_at = $2`,
      [token, expiresAt]
    );
    
    console.log('✅ 토큰 DB 저장 완료');
    console.log('📝 토큰:', token.substring(0, 50) + '...');
    console.log('⏰ 만료:', expiresAt.toISOString());
  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await pool.end();
  }
})();
