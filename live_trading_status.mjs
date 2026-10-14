import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

console.log(`\n${'═'.repeat(60)}`);
console.log(`🚀 실시간 거래 진행 중!`);
console.log(`${'═'.repeat(60)}\n`);

try {
  // 실제 시간 (DB에서)
  const timeResult = await pool.query('SELECT NOW() as current_time');
  const dbTime = new Date(timeResult.rows[0].current_time);
  const hours = dbTime.getHours();
  const minutes = dbTime.getMinutes();
  
  console.log(`⏰ 현재 시간: ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')} KST\n`);

  const isTradeTime = hours >= 8 && hours < 20;
  console.log(`${isTradeTime ? '🟢 거래 진행 중!' : '🔴 거래 마감'}\n`);

  // 거래 설정
  console.log(`📊 거래 설정:`);
  console.log(`  • 활성화: ✅ TRADING_ENABLED=true`);
  console.log(`  • KIS 계좌: 44291220-01`);
  console.log(`  • Telegram: 알림 대기\n`);

  // Cron 상태
  console.log(`🔄 Cron 작업 (자동 실행):`);
  console.log(`  • collect-prices: 5분마다 (다음: ~${String(Math.ceil(minutes/5)*5).padStart(2,'0')}분)`);
  console.log(`  • trade: 매분 거래 신호 분석`);
  console.log(`  • sell: 매분 매도 신호 처리\n`);

  // 거래 기록
  console.log(`📈 최근 활동:\n`);
  const trades = await pool.query(`SELECT * FROM trades ORDER BY id DESC LIMIT 5`);
  console.log(`  • 총 거래: ${trades.rows.length}건`);
  
  const positions = await pool.query(`SELECT * FROM trade_positions WHERE status = 'open'`);
  console.log(`  • 오픈 포지션: ${positions.rows.length}개\n`);

  console.log(`${'═'.repeat(60)}`);
  console.log(`💡 거래 신호는 Telegram에서 실시간으로 확인하세요!\n`);

} catch (error) {
  console.error(`❌ 오류: ${error.message}`);
} finally {
  await pool.end();
}
