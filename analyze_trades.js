const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  자동 거래 이력 분석                                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 모든 포지션 조회
    const posResult = await pool.query(`
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
        market_regime,
        highest_price,
        created_at,
        updated_at
      FROM trade_positions
      ORDER BY updated_at DESC
      LIMIT 100
    `);

    console.log(`📊 [1] 전체 거래 현황: ${posResult.rows.length}개 포지션\n`);

    // 상태별 집계
    const statusGroups = {};
    posResult.rows.forEach(pos => {
      if (!statusGroups[pos.status]) statusGroups[pos.status] = [];
      statusGroups[pos.status].push(pos);
    });

    Object.keys(statusGroups).forEach(status => {
      const count = statusGroups[status].length;
      const icon = status === 'holding' ? '🟢' : status === 'sold' ? '🔴' : '🟡';
      console.log(`${icon} ${status}: ${count}개`);
    });

    console.log('\n📋 [2] 청산된 거래 상세 (손실 큰 순)');
    console.log('─────────────────────────────────────────────────────────────\n');

    const soldPositions = statusGroups.sold || [];
    const trades = soldPositions.map(pos => {
      const buyCost = parseFloat(pos.entry_price) * pos.quantity;
      const sellRevenue = parseFloat(pos.exit_price) * pos.quantity;
      const pl = sellRevenue - buyCost;
      const plPercent = (pl / buyCost * 100).toFixed(2);
      
      return {
        code: pos.code,
        name: pos.name,
        quantity: pos.quantity,
        entryPrice: parseFloat(pos.entry_price),
        exitPrice: parseFloat(pos.exit_price),
        buyCost,
        sellRevenue,
        pl,
        plPercent: parseFloat(plPercent),
        marketRegime: pos.market_regime,
        highestPrice: parseFloat(pos.highest_price),
        reentryThreshold: pos.reentry_threshold ? parseFloat(pos.reentry_threshold) : null,
        lastReferenceLow: pos.last_reference_low ? parseFloat(pos.last_reference_low) : null,
        updatedAt: new Date(pos.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      };
    }).sort((a, b) => a.pl - b.pl);

    trades.forEach((trade, idx) => {
      const icon = trade.pl > 0 ? '✅' : trade.pl < 0 ? '❌' : '➖';
      console.log(`[${idx + 1}] ${trade.code} | ${trade.name}`);
      console.log(`    매수: ${parseInt(trade.entryPrice).toLocaleString()}원 × ${trade.quantity}주 = ${parseInt(trade.buyCost).toLocaleString()}원`);
      console.log(`    매도: ${parseInt(trade.exitPrice).toLocaleString()}원 × ${trade.quantity}주 = ${parseInt(trade.sellRevenue).toLocaleString()}원`);
      console.log(`    ${icon} 손익: ${parseInt(trade.pl).toLocaleString()}원 (${trade.plPercent}%)`);
      console.log(`    시장: ${trade.marketRegime || 'N/A'}`);
      if (trade.highestPrice) console.log(`    최고: ${parseInt(trade.highestPrice).toLocaleString()}원`);
      console.log(`    시간: ${trade.updatedAt}`);
      console.log('');
    });

    // 손익 분석
    console.log('\n📈 [3] 손익 통계');
    console.log('─────────────────────────────────────────────────────────────\n');

    const totalBuyCost = trades.reduce((sum, t) => sum + t.buyCost, 0);
    const totalSellRevenue = trades.reduce((sum, t) => sum + t.sellRevenue, 0);
    const totalPL = totalSellRevenue - totalBuyCost;
    const winCount = trades.filter(t => t.pl > 0).length;
    const loseCount = trades.filter(t => t.pl < 0).length;

    console.log(`총 거래: ${trades.length}개`);
    console.log(`총 매수액: ${parseInt(totalBuyCost).toLocaleString()}원`);
    console.log(`총 매도액: ${parseInt(totalSellRevenue).toLocaleString()}원`);
    console.log(`\n총 손익: ${totalPL > 0 ? '✅' : '❌'} ${parseInt(totalPL).toLocaleString()}원`);
    console.log(`손익률: ${(totalPL / totalBuyCost * 100).toFixed(2)}%\n`);

    console.log(`✅ 수익 거래: ${winCount}개 (${(winCount / trades.length * 100).toFixed(1)}%)`);
    console.log(`❌ 손실 거래: ${loseCount}개 (${(loseCount / trades.length * 100).toFixed(1)}%)\n`);

    // 상세 분석
    console.log('🔍 [4] 손실 원인 분석');
    console.log('─────────────────────────────────────────────────────────────\n');

    const losses = trades.filter(t => t.pl < 0);
    const wins = trades.filter(t => t.pl > 0);

    if (losses.length > 0) {
      const totalLoss = losses.reduce((sum, t) => sum + t.pl, 0);
      const avgLoss = totalLoss / losses.length;
      console.log(`손실 거래:`);
      console.log(`  총손실: ${parseInt(totalLoss).toLocaleString()}원`);
      console.log(`  평균: ${parseInt(avgLoss).toLocaleString()}원`);
      console.log(`  최대: ${parseInt(Math.min(...losses.map(t => t.pl))).toLocaleString()}원\n`);
    }

    if (wins.length > 0) {
      const totalWin = wins.reduce((sum, t) => sum + t.pl, 0);
      const avgWin = totalWin / wins.length;
      console.log(`수익 거래:`);
      console.log(`  총수익: ${parseInt(totalWin).toLocaleString()}원`);
      console.log(`  평균: ${parseInt(avgWin).toLocaleString()}원`);
      console.log(`  최대: ${parseInt(Math.max(...wins.map(t => t.pl))).toLocaleString()}원\n`);
    }

    // 문제점
    console.log('⚠️  핵심 문제:\n');
    
    if (loseCount > winCount * 2) {
      console.log(`1️⃣ 손실 거래가 수익의 ${(loseCount / Math.max(winCount, 1)).toFixed(1)}배`);
      console.log(`   → 진입 신호의 정확도 문제\n`);
    }

    const reentries = trades.filter(t => t.reentryThreshold);
    if (reentries.filter(t => t.pl < 0).length > 0) {
      console.log(`2️⃣ 재진입 후 손실: ${reentries.filter(t => t.pl < 0).length}개`);
      console.log(`   → 극강저점 재진입이 오히려 손실 확대\n`);
    }

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
