const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  오늘 거래 분석 (2026-11-02) - ${now}        ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 오늘 거래 조회
    const todayResult = await pool.query(`
      SELECT 
        id,
        code,
        name,
        quantity,
        entry_price,
        exit_price,
        status,
        profit_loss,
        market_regime,
        updated_at
      FROM trade_positions
      WHERE DATE(updated_at AT TIME ZONE 'Asia/Seoul') = '2026-11-02'
      ORDER BY updated_at DESC
    `);

    console.log(`📊 오늘 거래: ${todayResult.rows.length}개\n`);

    if (todayResult.rows.length === 0) {
      console.log('⭕ 오늘 거래 없음');
    } else {
      let totalBuyCost = 0;
      let totalSellRevenue = 0;
      let totalPL = 0;
      let winCount = 0;
      let loseCount = 0;

      todayResult.rows.forEach((trade, idx) => {
        const buyCost = parseFloat(trade.entry_price) * trade.quantity;
        const sellRevenue = parseFloat(trade.exit_price) * trade.quantity;
        const pl = sellRevenue - buyCost;
        const plPercent = (pl / buyCost * 100).toFixed(2);

        totalBuyCost += buyCost;
        totalSellRevenue += sellRevenue;
        totalPL += pl;

        if (pl > 0) winCount++;
        else if (pl < 0) loseCount++;

        const icon = pl > 0 ? '✅' : pl < 0 ? '❌' : '➖';
        const date = new Date(trade.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

        console.log(`[${idx + 1}] ${trade.code} | ${date}`);
        console.log(`    매수: ${parseInt(trade.entry_price).toLocaleString()}원 × ${trade.quantity}주`);
        console.log(`    매도: ${parseInt(trade.exit_price).toLocaleString()}원 × ${trade.quantity}주`);
        console.log(`    ${icon} ${parseInt(pl).toLocaleString()}원 (${plPercent}%)`);
        console.log(`    시장: ${trade.market_regime || 'N/A'}\n`);
      });

      console.log('📈 [오늘 손익 합계]');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`총 매수액: ${parseInt(totalBuyCost).toLocaleString()}원`);
      console.log(`총 매도액: ${parseInt(totalSellRevenue).toLocaleString()}원`);
      console.log(`\n총 손익: ${totalPL > 0 ? '✅' : '❌'} ${parseInt(totalPL).toLocaleString()}원`);
      console.log(`손익률: ${(totalPL / totalBuyCost * 100).toFixed(2)}%`);
      console.log(`\n✅ 수익: ${winCount}개`);
      console.log(`❌ 손실: ${loseCount}개`);
      console.log(`승률: ${(winCount / (winCount + loseCount) * 100).toFixed(1)}%`);
    }

    // 누적 손익
    console.log('\n\n📊 [누적 손익]');
    console.log('─────────────────────────────────────────────────────────────');

    const allResult = await pool.query(`
      SELECT 
        id,
        code,
        name,
        quantity,
        entry_price,
        exit_price,
        status
      FROM trade_positions
      WHERE status = 'sold'
      ORDER BY updated_at DESC
    `);

    let allTotalPL = 0;
    let allWin = 0;
    let allLose = 0;

    allResult.rows.forEach(trade => {
      const pl = (parseFloat(trade.exit_price) - parseFloat(trade.entry_price)) * trade.quantity;
      allTotalPL += pl;
      if (pl > 0) allWin++;
      else if (pl < 0) allLose++;
    });

    console.log(`총 거래: ${allResult.rows.length}개`);
    console.log(`누적 손익: ${allTotalPL > 0 ? '✅' : '❌'} ${parseInt(allTotalPL).toLocaleString()}원`);
    console.log(`승률: ${(allWin / (allWin + allLose) * 100).toFixed(1)}% (${allWin}승 ${allLose}패)`);

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
