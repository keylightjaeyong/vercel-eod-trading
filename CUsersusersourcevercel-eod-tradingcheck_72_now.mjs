import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  // 현재 시간 확인
  const timeResult = await pool.query(`
    SELECT 
      NOW() AT TIME ZONE 'Asia/Seoul' as current_time,
      EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Seoul')::int as hour,
      EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Seoul')::int as minute
  `);
  
  const { current_time, hour, minute } = timeResult.rows[0];
  console.log(`\n⏰ 현재 시간: ${current_time}`);
  console.log(`📍 시간대: ${hour}시 ${minute}분 KST\n`);
  
  // 72개봉 확인
  console.log(`📊 72개봉 데이터 확인:\n`);
  
  const prices = await pool.query(`
    SELECT 
      id, symbol, timestamp, close_price, volume,
      ROW_NUMBER() OVER (ORDER BY timestamp DESC) as row_num
    FROM price_snapshots
    ORDER BY timestamp DESC
    LIMIT 72
  `);
  
  console.log(`✅ 총 ${prices.rows.length}개봉 확보됨\n`);
  
  if (prices.rows.length > 0) {
    console.log(`📈 최신 데이터 (상위 5개):`);
    prices.rows.slice(0, 5).forEach((row) => {
      console.log(`  ${row.row_num}. ${row.symbol}: ${row.timestamp} | ${row.close_price} | Vol: ${row.volume}`);
    });
    
    console.log(`\n📉 가장 오래된 데이터 (하위 5개):`);
    prices.rows.slice(-5).reverse().forEach((row) => {
      console.log(`  ${row.row_num}. ${row.symbol}: ${row.timestamp} | ${row.close_price} | Vol: ${row.volume}`);
    });
    
    // 시간 간격 확인
    const newestTime = new Date(prices.rows[0].timestamp);
    const oldestTime = new Date(prices.rows[prices.rows.length - 1].timestamp);
    const diffMinutes = (newestTime - oldestTime) / (1000 * 60);
    console.log(`\n⏱️  데이터 시간 범위: ${diffMinutes}분 (약 ${Math.round(diffMinutes / 60)}시간)`);
  } else {
    console.log(`⚠️  데이터가 없습니다!`);
  }
  
  console.log(`\n✅ 72개봉 데이터 확인 완료!\n`);
  
  await pool.end();
} catch (error) {
  console.error(`❌ 에러: ${error.message}`);
  await pool.end();
  process.exit(1);
}
