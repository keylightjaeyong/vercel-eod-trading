import { config } from 'dotenv';
config({ path: '.env.local' });

const now = new Date();
const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
const hours = kstTime.getHours();
const minutes = kstTime.getMinutes();
const seconds = kstTime.getSeconds();

console.log(`\n⏰ [${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')} KST] 거래 상태 모니터링\n`);

// 거래 시간 확인
const isTradeTime = hours >= 8 && hours < 20;
console.log(`${isTradeTime ? '✅' : '❌'} 거래 시간: ${isTradeTime ? '진행 중' : '마감'} (08:00~20:00)`);

// 환경 확인
console.log(`\n📊 거래 설정:`);
console.log(`  • TRADING_ENABLED: ${process.env.TRADING_ENABLED}`);
console.log(`  • KIS 계좌: ${process.env.KIS_ACCOUNT}`);
console.log(`  • Telegram: ${process.env.TELEGRAM_CHAT_ID ? '연결' : '미설정'}`);

// DB 상태
const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('prisma.io')) {
  console.log(`\n⚠️  데이터베이스: Prisma (planLimitReached - 작동 안 함)`);
  console.log(`    🔴 현재 모든 거래 기능 중단`);
} else if (dbUrl.includes('supabase')) {
  console.log(`\n✅ 데이터베이스: Supabase (정상)`);
} else {
  console.log(`\n❓ 데이터베이스: 미설정`);
}

// Cron 설정
console.log(`\n🔄 Cron 작업 설정:`);
console.log(`  • collect-prices: 5분마다 (다음: ~${String(minutes + 5).padStart(2,'0')}분)`);
console.log(`  • trade: 1분마다 (거래 신호 분석)`);
console.log(`  • sell: 1분마다 (매도 신호 처리)`);

console.log(`\n현재 상태: ${isTradeTime && process.env.TRADING_ENABLED === 'true' ? '🟢 거래 활성화' : '🔴 거래 중단'}\n`);
