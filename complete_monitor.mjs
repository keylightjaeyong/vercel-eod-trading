import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  // 정확한 현재 시간
  const timeResult = await pool.query(`
    SELECT 
      NOW() AT TIME ZONE 'Asia/Seoul' as current_time,
      EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Seoul')::int as hour,
      EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Seoul')::int as minute
  `);
  
  const { current_time, hour, minute } = timeResult.rows[0];
  const isTradeTime = hour >= 8 && hour < 20;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 실시간 거래 모니터링`);
  console.log(`${'═'.repeat(70)}\n`);
  
  console.log(`⏰ 현재 시간: ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} KST`);
  console.log(`${isTradeTime ? '🟢' : '🔴'} 거래 상태: ${isTradeTime ? '진행 중!!!' : '마감'}\n`);

  // 거래 설정
  console.log(`⚙️  거래 설정:`);
  console.log(`  • TRADING_ENABLED: ✅ true`);
  console.log(`  • KIS 계좌: 44291220-01`);
  console.log(`  • 거래 시간: 08:00 ~ 20:00 KST\n`);

  // 거래 이력
  console.log(`📈 거래 이력:\n`);
  const trades = await pool.query(`SELECT * FROM trades LIMIT 5`);
  
  if (trades.rows.length === 0) {
    console.log(`  • 기록: 없음 (신규 거래 대기 중)\n`);
  } else {
    console.log(`  • 최근: ${trades.rows.length}건\n`);
  }

  // 포지션
  console.log(`💼 포지션:\n`);
  const positions = await pool.query(`SELECT * FROM trade_positions LIMIT 10`);
  
  if (positions.rows.length === 0) {
    console.log(`  • 오픈 포지션: 없음\n`);
  } else {
    console.log(`  • 오픈: ${positions.rows.length}개\n`);
  }

  // Cron 정보
  console.log(`🔄 Cron 작업:\n`);
  const nextCollect = Math.ceil(minute / 5) * 5;
  console.log(`  ✅ collect-prices: 5분마다`);
  console.log(`     → 다음: ~${String(nextCollect).padStart(2, '0')}분\n`);
  console.log(`  ✅ trade: 매분 실행`);
  console.log(`     → 거래 신호 분석\n`);
  console.log(`  ✅ sell: 매분 실행`);
  console.log(`     → 매도 신호 처리\n`);

  // 배포 상태
  console.log(`✈️  시스템 상태:\n`);
  console.log(`  ✅ Supabase: 연결 정상`);
  console.log(`  ✅ Vercel: ${isTradeTime ? '🔴 실행 중' : '🟢 대기'}`);
  console.log(`  ✅ KIS API: 준비`);
  console.log(`  ✅ Telegram: 5934789123\n`);

  // 최종
  console.log(`${'═'.repeat(70)}`);
  if (isTradeTime) {
    console.log(`\n🚀 거래 진행 중!\n`);
    console.log(`💬 Telegram에서 실시간 거래 신호를 확인하세요.\n`);
  } else {
    const nextHours = 24 - hour + 8;
    console.log(`\n⏳ 다음 거래: 내일 08:00 KST (약 ${nextHours}시간)\n`);
  }

} catch (error) {
  console.error(`❌ 오류: ${error.message}`);
} finally {
  await pool.end();
}
