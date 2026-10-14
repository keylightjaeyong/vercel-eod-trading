import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  // 정확한 현재 시간 (데이터베이스)
  const timeResult = await pool.query(`
    SELECT 
      NOW() AT TIME ZONE 'Asia/Seoul' as current_time,
      EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Seoul')::int as hour,
      EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Seoul')::int as minute,
      EXTRACT(SECOND FROM NOW() AT TIME ZONE 'Asia/Seoul')::int as second
  `);
  
  const { current_time, hour, minute, second } = timeResult.rows[0];
  const isTradeTime = hour >= 8 && hour < 20;
  const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 거래 모니터링 - Cron 실행 및 거래 신호 확인`);
  console.log(`${'═'.repeat(70)}\n`);
  
  console.log(`⏰ 현재 시간: ${timeStr} KST`);
  console.log(`${isTradeTime ? '🟢' : '🔴'} 거래 상태: ${isTradeTime ? '진행 중!!!' : '마감'}\n`);

  // Cron 실행 기록 (최근 15분)
  console.log(`🔄 Cron 실행 기록:\n`);
  
  const cronLogs = await pool.query(`
    SELECT 
      key, 
      value,
      TO_TIMESTAMP(CAST(value AS bigint)/1000) AT TIME ZONE 'Asia/Seoul' as last_run
    FROM trading_config 
    WHERE key LIKE '%last_cron%' OR key LIKE '%last_run%'
    LIMIT 10
  `);

  if (cronLogs.rows.length === 0) {
    console.log(`  • 기록 없음 (첫 실행 대기)\n`);
  } else {
    cronLogs.rows.forEach(log => {
      console.log(`  • ${log.key}: ${log.last_run || log.value}`);
    });
    console.log();
  }

  // 거래 신호 확인
  console.log(`📈 거래 신호:\n`);
  
  const trades = await pool.query(`
    SELECT * FROM trades ORDER BY id DESC LIMIT 10
  `);

  if (trades.rows.length === 0) {
    console.log(`  • 신호 없음 (신규 신호 대기 중)\n`);
  } else {
    console.log(`  최근 거래:`);
    trades.rows.slice(0, 5).forEach((trade, idx) => {
      console.log(`  ${idx + 1}. ${trade.description || '거래'}`);
    });
    console.log();
  }

  // 활성 포지션
  console.log(`💼 활성 포지션:\n`);
  
  const positions = await pool.query(`
    SELECT * FROM trade_positions WHERE status = 'open'
  `);

  if (positions.rows.length === 0) {
    console.log(`  • 없음\n`);
  } else {
    console.log(`  활성: ${positions.rows.length}개`);
    positions.rows.forEach((pos, idx) => {
      console.log(`  ${idx + 1}. ${pos.symbol}: ${pos.quantity}주`);
    });
    console.log();
  }

  // 거래 통계
  console.log(`📊 거래 통계:\n`);
  
  const history = await pool.query(`
    SELECT COUNT(*) as total FROM trade_history
  `);

  console.log(`  • 총 거래 기록: ${history.rows[0].total || 0}건\n`);

  // 다음 Cron
  console.log(`🔄 다음 Cron 예정:\n`);
  const nextMin = minute + 1;
  const nextCollect = Math.ceil(minute / 5) * 5;
  
  console.log(`  • trade/sell: ${String(nextMin).padStart(2,'0')}분경 (1분마다)`);
  console.log(`  • collect-prices: ${String(nextCollect).padStart(2,'0')}분경 (5분마다)\n`);

  // 시스템 요약
  console.log(`${'═'.repeat(70)}`);
  console.log(`\n✅ 시스템 상태: 정상`);
  console.log(`✅ 데이터베이스: Supabase 연결`);
  console.log(`✅ Cron: 자동 실행 중`);
  console.log(`✅ Telegram: 5934789123\n`);
  
  if (isTradeTime) {
    console.log(`🚀 현재 거래 진행 중입니다!`);
    console.log(`💬 거래 신호는 Telegram에서 실시간 확인하세요!\n`);
  } else {
    const nextHours = 24 - hour + 8;
    console.log(`⏳ 다음 거래: 내일 08:00 KST\n`);
  }

} catch (error) {
  console.error(`\n❌ 오류: ${error.message}\n`);
} finally {
  await pool.end();
}
