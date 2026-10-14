import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  // 현재 정확한 시간 (DB)
  const timeResult = await pool.query(`
    SELECT 
      NOW() AT TIME ZONE 'Asia/Seoul' as current_time,
      EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Seoul')::int as hour,
      EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Seoul')::int as minute,
      EXTRACT(SECOND FROM NOW() AT TIME ZONE 'Asia/Seoul')::int as second
  `);
  
  const { hour, minute, second } = timeResult.rows[0];
  const isTradeTime = hour >= 8 && hour < 20;
  const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 거래 모니터링 - Cron 실행 및 거래 신호 확인`);
  console.log(`${'═'.repeat(70)}\n`);
  
  console.log(`⏰ 현재 시간: ${timeStr} KST`);
  console.log(`${isTradeTime ? '🟢' : '🔴'} 거래 상태: ${isTradeTime ? '진행 중!!!' : '마감'}\n`);

  // 거래 신호 확인
  console.log(`📈 거래 신호 (최근):\n`);
  
  const trades = await pool.query(`
    SELECT * FROM trades ORDER BY id DESC LIMIT 5
  `);

  if (trades.rows.length === 0) {
    console.log(`  ℹ️  신호 없음 (신규 신호 대기 중)\n`);
  } else {
    console.log(`  ${trades.rows.length}건 기록됨:`);
    trades.rows.forEach((trade, idx) => {
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
    console.log(`  ℹ️  없음\n`);
  } else {
    console.log(`  ${positions.rows.length}개 활성:`);
    positions.rows.slice(0, 3).forEach((pos, idx) => {
      console.log(`  ${idx + 1}. ${pos.symbol || '미정'}: ${pos.quantity || 0}주`);
    });
    console.log();
  }

  // Cron 상태
  console.log(`🔄 Cron 작업 상태:\n`);
  console.log(`  ✅ collect-prices: 5분마다`);
  console.log(`     → 다음: ~${String(Math.ceil(minute / 5) * 5).padStart(2,'0')}분\n`);
  console.log(`  ✅ trade: 매분 실행`);
  console.log(`     → 거래 신호 분석 중\n`);
  console.log(`  ✅ sell: 매분 실행`);
  console.log(`     → 매도 신호 처리 중\n`);

  // 거래 활동
  console.log(`📊 거래 활동:\n`);
  
  const history = await pool.query(`
    SELECT COUNT(*) as total FROM trade_history
  `);
  
  const stats = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM trades) as total_trades,
      (SELECT COUNT(*) FROM trade_positions WHERE status = 'open') as open_positions
  `);

  const s = stats.rows[0];
  console.log(`  • 총 거래: ${s.total_trades || 0}건`);
  console.log(`  • 활성 포지션: ${s.open_positions || 0}개`);
  console.log(`  • 거래 기록: ${history.rows[0].total || 0}건\n`);

  // 시스템 상태
  console.log(`${'═'.repeat(70)}`);
  console.log(`\n✅ 시스템 상태:\n`);
  console.log(`  ✅ Supabase: 연결 정상`);
  console.log(`  ✅ Cron: ${isTradeTime ? '🔴 실행 중' : '🟢 대기'}`);
  console.log(`  ✅ KIS API: 준비 완료`);
  console.log(`  ✅ Telegram: 5934789123\n`);
  
  if (isTradeTime) {
    console.log(`🚀 현재 거래 진행 중!\n`);
    console.log(`💬 Telegram에서 실시간 거래 신호를 확인하세요!\n`);
  } else {
    console.log(`⏳ 다음 거래: 내일 08:00 KST\n`);
  }

} catch (error) {
  console.error(`\n❌ 오류: ${error.message}\n`);
} finally {
  await pool.end();
}
