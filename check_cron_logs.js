const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  최근 Cron 실행 로그 확인                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // cron_logs 테이블 확인
    const logsResult = await pool.query(`
      SELECT 
        id,
        job_id,
        status,
        message,
        created_at
      FROM cron_logs
      WHERE created_at > NOW() - INTERVAL '1 day'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    console.log(`📋 최근 24시간 Cron 실행: ${logsResult.rows.length}개\n`);

    if (logsResult.rows.length === 0) {
      console.log('❌ Cron 로그 없음\n');
    } else {
      logsResult.rows.forEach((log, idx) => {
        const date = new Date(log.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const statusIcon = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⏳';
        console.log(`[${idx + 1}] ${date} | ${statusIcon} ${log.status}`);
        console.log(`    Job ID: ${log.job_id}`);
        console.log(`    메시지: ${log.message.substring(0, 80)}...\n`);
      });
    }

    // 거래 이력 최근 10개
    console.log('\n📊 [최근 거래 이력 (최근 10개)]');
    console.log('─────────────────────────────────────────────────────────────\n');

    const historyResult = await pool.query(`
      SELECT 
        id,
        code,
        name,
        action,
        quantity,
        price,
        created_at
      FROM trade_history
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (historyResult.rows.length === 0) {
      console.log('⭕ 거래 이력 없음\n');
    } else {
      historyResult.rows.forEach((hist, idx) => {
        const date = new Date(hist.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const icon = hist.action === 'BUY' ? '🟢' : '🔴';
        console.log(`[${idx + 1}] ${date}`);
        console.log(`    ${icon} ${hist.code} ${hist.action} ${hist.quantity}주 @ ${parseInt(hist.price).toLocaleString()}원\n`);
      });
    }

    // 포지션 상태 확인
    console.log('\n📈 [현재 포지션 상태]');
    console.log('─────────────────────────────────────────────────────────────\n');

    const posResult = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM trade_positions
      GROUP BY status
      ORDER BY status DESC
    `);

    posResult.rows.forEach(row => {
      const icons = {
        'holding': '🟢',
        'sold': '🔴',
        'waiting_reentry': '🟡'
      };
      console.log(`${icons[row.status] || '⭕'} ${row.status}: ${row.count}개`);
    });

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
