const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    // trade_positions 스키마 확인
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'trade_positions'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 trade_positions 컬럼:');
    res.rows.forEach(row => {
      console.log(`   ${row.column_name} (${row.data_type})`);
    });

    await pool.end();
  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
})();
