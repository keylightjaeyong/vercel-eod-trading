const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    // 모든 테이블 목록
    const tables = ['trade_positions', 'trade_history', 'price_snapshots', 'stocks', 'kis_tokens'];
    
    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}'
        ORDER BY ordinal_position
      `);
      
      console.log(`\n📋 ${table}:`);
      if (res.rows.length === 0) {
        console.log('  (테이블 없음)');
      } else {
        res.rows.forEach(row => {
          console.log(`   ${row.column_name} (${row.data_type})`);
        });
      }
    }

    await pool.end();
  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
})();
