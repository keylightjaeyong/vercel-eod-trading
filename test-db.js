const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    console.log('🔌 데이터베이스 연결 테스트...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ 연결 성공:', result.rows[0]);
    
    console.log('\n📋 테이블 확인...');
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('테이블:', tables.rows.map(r => r.table_name));
    
    console.log('\n✍️ trading_config 테이블 구조...');
    const schema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'trading_config'
    `);
    console.log('컬럼:', schema.rows);
    
    console.log('\n📊 저장된 데이터...');
    const data = await pool.query('SELECT * FROM trading_config LIMIT 1');
    console.log('데이터:', data.rows);
    
  } catch (err) {
    console.error('❌ 오류:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint
    });
  } finally {
    await pool.end();
  }
})();
