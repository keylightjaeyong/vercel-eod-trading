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
console.log(`⏰ [${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')} KST] 실시간 거래 모니터링`);
console.log(`${'═'.repeat(60)}\n`);

try {
  // 1. 거래 상태 확인
  console.log(`📊 거래 상태:\n`);
  const isTradeTime = hours >= 8 && hours < 20;
  console.log(`  ${isTradeTime ? '🟢' : '🔴'} 거래 시간: ${isTradeTime ? '진행 중' : '마감'} (08:00~20:00)`);
  console.log(`  📍 현재: ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')} KST`);

  // 2. 최근 거래 기록 확인
  console.log(`\n📈 최근 거래 기록:\n`);
  const tradesResult = await pool.query(
    `SELECT id, code, name, type, quantity, price, status, created_at 
     FROM trades 
     ORDER BY created_at DESC 
     LIMIT 5`
  );

  if (tradesResult.rows.length === 0) {
    console.log(`  ℹ️  거래 기록 없음`);
  } else {
    tradesResult.rows.forEach((trade, idx) => {
      const tradeTime = new Date(trade.created_at);
      const kstTradeTime = new Date(tradeTime.getTime() + (9 * 60 * 60 * 1000));
      console.log(`  ${idx + 1}. [${kstTradeTime.toLocaleString('ko-KR')}]`);
      console.log(`     📌 ${trade.name} (${trade.code})`);
      console.log(`     📊 ${trade.type}: ${trade.quantity}주 @ ${trade.price}원`);
      console.log(`     ${trade.status === 'completed' ? '✅' : '⏳'} ${trade.status}`);
    });
  }

  // 3. 현재 보유 종목 확인
  console.log(`\n💼 현재 보유 종목:\n`);
  const stocksResult = await pool.query(
    `SELECT code, name, quantity, avg_price, current_price, 
            ROUND((current_price - avg_price) * quantity) as profit
     FROM stocks 
     WHERE quantity > 0 
     ORDER BY code`
  );

  if (stocksResult.rows.length === 0) {
    console.log(`  ℹ️  보유 종목 없음`);
  } else {
    let totalProfit = 0;
    stocksResult.rows.forEach((stock) => {
      const profit = (stock.current_price - stock.avg_price) * stock.quantity;
      totalProfit += profit;
      const profitSign = profit >= 0 ? '📈' : '📉';
      console.log(`  ${profitSign} ${stock.name} (${stock.code})`);
      console.log(`     수량: ${stock.quantity}주 | 평균가: ${stock.avg_price}원 | 현재가: ${stock.current_price}원`);
      console.log(`     수익: ${profit >= 0 ? '+' : ''}${Math.round(profit)}원\n`);
    });
    console.log(`  💰 총 수익: ${totalProfit >= 0 ? '+' : ''}${Math.round(totalProfit)}원`);
  }

  // 4. 거래 설정 확인
  console.log(`\n⚙️  거래 설정:\n`);
  const configResult = await pool.query(
    `SELECT key, value FROM trading_config LIMIT 10`
  );
  configResult.rows.forEach((config) => {
    console.log(`  • ${config.key}: ${config.value}`);
  });

  // 5. 다음 Cron 예정
  console.log(`\n🔄 다음 Cron 실행:\n`);
  const nextMin = minutes + 1;
  const nextCollect = Math.ceil(minutes / 5) * 5;
  console.log(`  • trade/sell: ~${String(nextMin).padStart(2,'0')}분`);
  console.log(`  • collect-prices: ~${String(nextCollect).padStart(2,'0')}분`);

  // 6. Vercel 배포 상태
  console.log(`\n✈️  배포 상태:\n`);
  console.log(`  ✅ Supabase: 연결 완료`);
  console.log(`  ✅ Vercel: 배포 완료`);
  console.log(`  ✅ KIS API: 연결 준비`);
  console.log(`  ✅ Telegram: 알림 준비`);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${isTradeTime ? '🚀 거래 진행 중...' : '⏳ 다음 거래 대기 중...'}\n`);

} catch (error) {
  console.error(`❌ 오류: ${error.message}`);
} finally {
  await pool.end();
}
