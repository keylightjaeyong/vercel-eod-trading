const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  구 포지션 데이터 초기화 (옵션 1)                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 삭제 전 데이터 확인
    console.log('📊 [1] 삭제 전 데이터\n');

    const beforeSold = await pool.query('SELECT COUNT(*) as count FROM trade_positions WHERE status = "sold"');
    const beforeHistory = await pool.query('SELECT COUNT(*) as count FROM trade_history');

    console.log(`청산된 포지션: ${beforeSold.rows[0].count}개`);
    console.log(`거래 이력: ${beforeHistory.rows[0].count}개\n`);

    // 삭제
    console.log('🗑️  [2] 데이터 삭제 중...\n');

    await pool.query('DELETE FROM trade_positions WHERE status = \'sold\'');
    console.log('✅ 청산된 포지션 삭제 완료');

    await pool.query('DELETE FROM trade_history');
    console.log('✅ 거래 이력 삭제 완료\n');

    // 삭제 후 확인
    console.log('📊 [3] 삭제 후 데이터\n');

    const afterSold = await pool.query('SELECT COUNT(*) as count FROM trade_positions');
    const afterHistory = await pool.query('SELECT COUNT(*) as count FROM trade_history');

    console.log(`전체 포지션: ${afterSold.rows[0].count}개`);
    console.log(`거래 이력: ${afterHistory.rows[0].count}개\n`);

    console.log('═════════════════════════════════════════════════════════════\n');
    console.log('✅ 초기화 완료!\n');

    console.log('🎯 다음 단계:\n');
    console.log('1. 내일 거래 시간(08:00-20:00)에 크론 실행');
    console.log('2. 새로운 신호로 완전히 재시작');
    console.log('3. Vercel 로그에서 정확한 에러 원인 파악\n');

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
