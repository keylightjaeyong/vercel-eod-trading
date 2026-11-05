const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

async function checkSchema() {
  try {
    console.log('🔍 trading_status 테이블 스키마 확인\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'trading_status'
      ORDER BY ordinal_position
    `);

    if (result.rows.length === 0) {
      console.log('❌ trading_status 테이블이 없습니다!');
    } else {
      console.log('✅ trading_status 테이블 컬럼:');
      result.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    console.log('\n🔍 다른 테이블들:\n');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 공개 테이블 목록:');
    tables.rows.forEach(t => console.log(`   - ${t.table_name}`));

  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
