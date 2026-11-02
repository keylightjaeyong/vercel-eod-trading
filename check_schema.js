const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  데이터베이스 스키마 확인                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // kis_tokens 테이블
    const tokenSchema = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'kis_tokens'
      ORDER BY ordinal_position
    `);

    console.log('📋 kis_tokens 테이블:');
    if (tokenSchema.rows.length > 0) {
      tokenSchema.rows.forEach(col => {
        console.log(`   ${col.column_name.padEnd(20)} | ${col.data_type}`);
      });
    } else {
      console.log('   테이블 없음');
    }

    // kis_tokens 데이터 확인
    const tokenData = await pool.query(`SELECT * FROM kis_tokens LIMIT 1`);
    console.log(`\n   레코드: ${tokenData.rows.length}개\n`);

    // price_snapshots 테이블
    const priceSchema = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'price_snapshots'
      ORDER BY ordinal_position
      LIMIT 5
    `);

    console.log('📋 price_snapshots 테이블:');
    if (priceSchema.rows.length > 0) {
      priceSchema.rows.forEach(col => {
        console.log(`   ${col.column_name.padEnd(20)} | ${col.data_type}`);
      });
    }

    // price_snapshots 데이터
    const priceData = await pool.query(`
      SELECT COUNT(*) as count FROM price_snapshots
    `);
    console.log(`\n   레코드: ${priceData.rows[0].count}개\n`);

    // trade_history 테이블
    const historySchema = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'trade_history'
      ORDER BY ordinal_position
      LIMIT 5
    `);

    console.log('📋 trade_history 테이블:');
    if (historySchema.rows.length > 0) {
      historySchema.rows.forEach(col => {
        console.log(`   ${col.column_name.padEnd(20)} | ${col.data_type}`);
      });
    }

    // trade_history 데이터
    const historyData = await pool.query(`
      SELECT COUNT(*) as count FROM trade_history
    `);
    console.log(`\n   레코드: ${historyData.rows[0].count}개\n`);

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
