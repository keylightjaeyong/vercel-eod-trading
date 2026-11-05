const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

async function addColumns() {
  try {
    console.log('🔨 trading_status 테이블에 컬럼 추가 중...\n');

    // 1. trading_enabled 컬럼 추가
    await pool.query(`
      ALTER TABLE trading_status 
      ADD COLUMN IF NOT EXISTS trading_enabled BOOLEAN DEFAULT true
    `);
    console.log('✅ trading_enabled 컬럼 추가');

    // 2. stopped_reason 컬럼 추가
    await pool.query(`
      ALTER TABLE trading_status 
      ADD COLUMN IF NOT EXISTS stopped_reason TEXT
    `);
    console.log('✅ stopped_reason 컬럼 추가');

    // 3. 기본값 설정 (id=1이 없으면 생성)
    await pool.query(`
      INSERT INTO trading_status (id, trading_enabled, timestamp)
      VALUES (1, true, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ 기본값 설정');

    // 4. 스키마 확인
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'trading_status'
      ORDER BY ordinal_position
    `);

    console.log('\n✅ 최종 스키마:');
    result.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n✨ 완료!');

  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await pool.end();
  }
}

addColumns();
