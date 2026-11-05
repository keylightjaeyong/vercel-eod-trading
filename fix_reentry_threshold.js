const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  재진입 기준값 수정 (0원 → 올바른 값)                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 마지막 청산 포지션 찾기
    const lastSoldResult = await pool.query(`
      SELECT id, code, name, exit_price, reentry_threshold, updated_at
      FROM trade_positions
      WHERE status = 'sold' AND reentry_threshold = 0
      ORDER BY exit_time DESC
      LIMIT 1
    `);

    if (lastSoldResult.rows.length > 0) {
      const lastSold = lastSoldResult.rows[0];
      const exitPrice = parseInt(lastSold.exit_price);
      const correctThreshold = Math.floor(exitPrice * 1.01);

      console.log(`📊 수정할 포지션:`);
      console.log(`   코드: ${lastSold.code} - ${lastSold.name}`);
      console.log(`   매도가: ${exitPrice.toLocaleString()}원`);
      console.log(`   현재값: ${lastSold.reentry_threshold}원 ❌`);
      console.log(`   수정값: ${correctThreshold.toLocaleString()}원 ✅\n`);

      // 수정
      await pool.query(
        `UPDATE trade_positions 
         SET reentry_threshold = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [correctThreshold, lastSold.id]
      );

      console.log(`✅ 수정 완료!`);
      console.log(`   재진입 기준: ${correctThreshold.toLocaleString()}원\n`);
    } else {
      console.log('✅ 재진입 기준값이 0원인 포지션이 없습니다.\n');
    }

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
