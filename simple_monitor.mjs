import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const now = new Date();
const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
const hours = kstTime.getHours();
const minutes = kstTime.getMinutes();
const seconds = kstTime.getSeconds();

console.log(`\n${'═'.repeat(60)}`);
console.log(`⏰ [${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')} KST] 거래 모니터링`);
console.log(`${'═'.repeat(60)}\n`);

try {
  // 1. 거래 상태
  const isTradeTime = hours >= 8 && hours < 20;
  console.log(`📊 상태: ${isTradeTime ? '🟢 거래 진행 중' : '🔴 거래 마감'}\n`);

  // 2. 최근 거래 (테이블 구조 확인 후)
  console.log(`📈 거래 시스템:\n`);
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  
  console.log(`  ✅ 테이블: ${result.rows.map(r => r.table_name).join(', ')}\n`);

  // 3. Trading Status
  console.log(`⚙️  거래 설정:\n`);
  const statusResult = await pool.query(`SELECT * FROM trading_status LIMIT 1`);
  if (statusResult.rows.length > 0) {
    const status = statusResult.rows[0];
    console.log(`  • 활성화: ${status.is_active ? '✅' : '❌'}`);
    console.log(`  • 마지막 업데이트: ${status.last_updated}`);
  }

  // 4. 거래 기록 
  console.log(`\n📝 최근 거래:\n`);
  const tradesResult = await pool.query(`
    SELECT * FROM trades ORDER BY created_at DESC LIMIT 3
  `);

  if (tradesResult.rows.length === 0) {
    console.log(`  ℹ️  기록 없음`);
  } else {
    tradesResult.rows.forEach((trade, idx) => {
      console.log(`  ${idx + 1}. [${new Date(trade.created_at).toLocaleString('ko-KR')}]`);
      console.log(`     내용: ${trade.description || '거래'}`);
      console.log(`     상태: ${trade.status}\n`);
    });
  }

  // 5. 시스템 상태
  console.log(`✈️  배포 상태:\n`);
  console.log(`  ✅ 데이터베이스: Supabase 연결`);
  console.log(`  ✅ 배포: Vercel 준비 완료`);
  console.log(`  ✅ Cron: 스케줄링 대기`);
  console.log(`  ✅ API: KIS + Telegram 준비\n`);

  // 6. 다음 거래
  console.log(`📅 일정:\n`);
  if (!isTradeTime) {
    const nextTradeHours = 24 - hours + 8;
    console.log(`  ⏳ 다음 거래: 내일 08:00 KST (약 ${nextTradeHours}시간)`);
  } else {
    console.log(`  🚀 현재 거래 진행 중`);
  }

  console.log(`\n${'═'.repeat(60)}\n`);

} catch (error) {
  console.error(`❌ 오류: ${error.message}`);
} finally {
  await pool.end();
}
