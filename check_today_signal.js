const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  오늘 가격 데이터 & 매수 신호 분석                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 오늘 가격 데이터 조회
    const priceResult = await pool.query(`
      SELECT 
        close,
        created_at
      FROM price_snapshots
      WHERE code = '005930'
        AND DATE(created_at AT TIME ZONE 'Asia/Seoul') = '2026-11-02'
      ORDER BY created_at ASC
    `);

    console.log(`📊 오늘 가격 데이터: ${priceResult.rows.length}개\n`);

    if (priceResult.rows.length === 0) {
      console.log('❌ 오늘 가격 데이터 없음');
    } else {
      const prices = priceResult.rows.map(r => parseFloat(r.close));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];
      const changeAmount = lastPrice - firstPrice;
      const changePercent = (changeAmount / firstPrice * 100).toFixed(2);

      console.log(`첫가격: ${parseInt(firstPrice).toLocaleString()}원`);
      console.log(`저점: ${parseInt(minPrice).toLocaleString()}원`);
      console.log(`고점: ${parseInt(maxPrice).toLocaleString()}원`);
      console.log(`종가: ${parseInt(lastPrice).toLocaleString()}원`);
      console.log(`변동: ${changeAmount > 0 ? '📈' : '📉'} ${parseInt(changeAmount).toLocaleString()}원 (${changePercent}%)\n`);

      // 매수 신호 계산
      console.log('💡 [매수 신호 분석]');
      console.log('─────────────────────────────────────────────────────────────\n');

      const marketRegimes = ['UPTREND', 'SIDEWAYS', 'DOWNTREND'];
      const risePercents = [1.0, 0.8, 0.5]; // UPTREND, SIDEWAYS, DOWNTREND

      marketRegimes.forEach((regime, idx) => {
        const risePercent = risePercents[idx];
        const buyPrice = minPrice * (1 + risePercent / 100);
        const shouldBuy = lastPrice >= buyPrice;
        const signalIcon = shouldBuy ? '✅' : '❌';

        console.log(`${signalIcon} ${regime} (상승률: ${risePercent}%)`);
        console.log(`   저점 ${parseInt(minPrice).toLocaleString()}원 + ${risePercent}% = ${parseInt(buyPrice).toLocaleString()}원`);
        console.log(`   현재 ${parseInt(lastPrice).toLocaleString()}원 ${shouldBuy ? '>=' : '<'} ${parseInt(buyPrice).toLocaleString()}원`);
        console.log(`   → ${shouldBuy ? '✅ 매수 신호 발생!' : '❌ 매수 신호 없음'}\n`);
      });

      // 보유 포지션 확인
      console.log('\n📋 [현재 보유 포지션]');
      console.log('─────────────────────────────────────────────────────────────\n');

      const holdingResult = await pool.query(`
        SELECT 
          id,
          code,
          name,
          quantity,
          entry_price,
          status
        FROM trade_positions
        WHERE status IN ('holding', 'waiting_reentry')
        ORDER BY created_at DESC
      `);

      if (holdingResult.rows.length === 0) {
        console.log('⭕ 보유 포지션 없음\n');
      } else {
        console.log(`보유: ${holdingResult.rows.length}개\n`);
        holdingResult.rows.forEach(pos => {
          console.log(`${pos.code} - ${pos.name} | ${pos.status}`);
          console.log(`  수량: ${pos.quantity}주, 진입가: ${parseInt(pos.entry_price).toLocaleString()}원\n`);
        });
      }

      // 마지막 매도 정보
      console.log('\n📊 [마지막 매도 정보]');
      console.log('─────────────────────────────────────────────────────────────\n');

      const lastSellResult = await pool.query(`
        SELECT 
          id,
          code,
          name,
          quantity,
          entry_price,
          exit_price,
          status,
          reentry_threshold,
          last_reference_low,
          updated_at
        FROM trade_positions
        WHERE status = 'sold'
        ORDER BY updated_at DESC
        LIMIT 1
      `);

      if (lastSellResult.rows.length > 0) {
        const lastSell = lastSellResult.rows[0];
        const date = new Date(lastSell.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const reentryThreshold = parseInt(lastSell.reentry_threshold || 0);

        console.log(`마지막 매도: ${date}`);
        console.log(`  매도가: ${parseInt(lastSell.exit_price).toLocaleString()}원`);
        console.log(`  재진입 기준: ${reentryThreshold.toLocaleString()}원`);
        console.log(`  현재가: ${parseInt(lastPrice).toLocaleString()}원`);
        
        if (lastPrice >= reentryThreshold) {
          console.log(`  → ✅ 재진입 조건 만족! (${parseInt(lastPrice).toLocaleString()} >= ${reentryThreshold.toLocaleString()})\n`);
        } else {
          console.log(`  → ❌ 재진입 조건 미충족 (${parseInt(lastPrice).toLocaleString()} < ${reentryThreshold.toLocaleString()})\n`);
        }
      }
    }

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
