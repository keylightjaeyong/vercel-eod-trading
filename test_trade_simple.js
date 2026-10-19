const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('=== 거래 신호 상태 점검 ===\n');

    // 1. TRADING_ENABLED 확인
    const tradingEnabled = true; // 환경변수 undefined = true
    console.log(`[1] TRADING_ENABLED: ${tradingEnabled}`);

    // 2. stocks 조회
    console.log('\n[2] enabled=true인 stocks 조회...');
    const stocksResult = await pool.query(
      'SELECT code, name FROM stocks WHERE enabled = true'
    );
    console.log(`    ✅ ${stocksResult.rows.length}개 종목`);
    
    if (stocksResult.rows.length === 0) {
      console.log('    ❌ enabled=true 종목이 없습니다!');
      await pool.end();
      return;
    }

    // 3. 각 종목의 거래 신호
    for (const stock of stocksResult.rows) {
      console.log(`\n[3] ${stock.code} (${stock.name}) 거래 신호...`);

      const pricesResult = await pool.query(
        `SELECT close FROM price_snapshots
         WHERE code = $1 AND CAST(close as INTEGER) > 0
         ORDER BY created_at DESC
         LIMIT 72`,
        [stock.code]
      );

      if (pricesResult.rows.length < 72) {
        console.log(`    ⚠️  데이터 부족 (${pricesResult.rows.length}/72개)`);
        continue;
      }

      const prices = pricesResult.rows
        .reverse()
        .map((r) => parseFloat(r.close));

      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const current = prices[prices.length - 1];
      const range = max - min;
      const adx = Math.min(100, (range / min) * 100 + 20);
      const market = adx > 25 ? 'UPTREND' : 'DOWNTREND/SIDEWAYS';
      const risePercent = adx > 25 && max === current ? 1.0 : 0.8;
      const buyPrice = min * (1 + risePercent / 100);
      const shouldBuy = current >= buyPrice;

      console.log(`    데이터: ${prices.length}개`);
      console.log(`    저점: ${min.toFixed(0)}원, 현재: ${current.toFixed(0)}원, 고점: ${max.toFixed(0)}원`);
      console.log(`    시장: ${market} (ADX: ${adx.toFixed(0)}), 반등: ${risePercent}%`);
      console.log(`    매수기준: ${buyPrice.toFixed(0)}원`);
      console.log(`    상태: ${shouldBuy ? '✅ 매수 신호 발생!' : '❌ 대기 중'}`);
    }

    console.log('\n✅ 점검 완료');

  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await pool.end();
  }
})();
