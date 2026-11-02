const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  오늘 거래 상세 분석 - ${now}                  ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 오늘 거래 이력 (모든 기록)
    console.log('📋 [1] 오늘 거래 이력 (2026-10-22)');
    console.log('─────────────────────────────────────────────────────────────\n');

    const historyResult = await pool.query(`
      SELECT
        id,
        code,
        name,
        action,
        quantity,
        price,
        pattern_signal,
        pattern_confidence,
        created_at
      FROM trade_history
      WHERE DATE(created_at AT TIME ZONE 'Asia/Seoul') = '2026-10-22'
      ORDER BY created_at DESC
    `);

    if (historyResult.rows.length > 0) {
      let totalBuyCost = 0;
      let totalSellRevenue = 0;
      const trades = [];

      historyResult.rows.forEach((trade, i) => {
        const date = new Date(trade.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const icon = trade.action === 'BUY' ? '🟢' : '🔴';
        const totalAmount = parseInt(trade.price) * trade.quantity;
        
        trades.push({
          date,
          icon,
          code: trade.code,
          name: trade.name,
          action: trade.action,
          quantity: trade.quantity,
          price: parseInt(trade.price),
          totalAmount,
          signal: trade.pattern_signal,
          confidence: trade.pattern_confidence
        });

        if (trade.action === 'BUY') {
          totalBuyCost += totalAmount;
        } else {
          totalSellRevenue += totalAmount;
        }

        console.log(`[${i+1}] ${date}`);
        console.log(`   ${icon} ${trade.code} - ${trade.name} ${trade.action === 'BUY' ? '매수' : '매도'}`);
        console.log(`   ${trade.quantity}주 @ ${parseInt(trade.price).toLocaleString()}원 = ${totalAmount.toLocaleString()}원`);
        if (trade.pattern_signal) {
          console.log(`   신호: ${trade.pattern_signal} (확신도: ${trade.pattern_confidence}%)`);
        }
        console.log('');
      });

      // 손익 계산
      console.log('\n📊 [2] 오늘 거래 손익 분석');
      console.log('─────────────────────────────────────────────────────────────\n');

      const profitLoss = totalSellRevenue - totalBuyCost;
      const profitLossPercent = totalBuyCost > 0 ? ((profitLoss / totalBuyCost) * 100).toFixed(2) : 0;

      console.log(`총 매수액: ${totalBuyCost.toLocaleString()}원`);
      console.log(`총 매도액: ${totalSellRevenue.toLocaleString()}원`);
      console.log(`─────────────────────────────────────────`);
      
      if (profitLoss > 0) {
        console.log(`✅ 수익: +${profitLoss.toLocaleString()}원 (+${profitLossPercent}%)`);
      } else if (profitLoss < 0) {
        console.log(`❌ 손실: ${profitLoss.toLocaleString()}원 (${profitLossPercent}%)`);
      } else {
        console.log(`➖ 손익: 0원 (0%)`);
      }

      // 거래별 손익
      console.log('\n📈 [3] 거래별 손익');
      console.log('─────────────────────────────────────────────────────────────\n');

      // 코드별로 매수/매도 연결
      const tradesByCode = {};
      trades.forEach(trade => {
        if (!tradesByCode[trade.code]) {
          tradesByCode[trade.code] = { buys: [], sells: [] };
        }
        if (trade.action === 'BUY') {
          tradesByCode[trade.code].buys.push(trade);
        } else {
          tradesByCode[trade.code].sells.push(trade);
        }
      });

      Object.keys(tradesByCode).forEach((code, idx) => {
        const trades = tradesByCode[code];
        const buyTrades = trades.buys;
        const sellTrades = trades.sells;

        console.log(`[${idx + 1}] ${code}`);
        
        buyTrades.forEach(buy => {
          console.log(`   🟢 매수: ${buy.quantity}주 @ ${buy.price.toLocaleString()}원 = ${buy.totalAmount.toLocaleString()}원`);
        });

        sellTrades.forEach(sell => {
          console.log(`   🔴 매도: ${sell.quantity}주 @ ${sell.price.toLocaleString()}원 = ${sell.totalAmount.toLocaleString()}원`);
        });

        // 간단한 손익 (FIFO 가정)
        const totalBuyQty = buyTrades.reduce((sum, t) => sum + t.quantity, 0);
        const totalSellQty = sellTrades.reduce((sum, t) => sum + t.quantity, 0);
        const totalBuyAmount = buyTrades.reduce((sum, t) => sum + t.totalAmount, 0);
        const totalSellAmount = sellTrades.reduce((sum, t) => sum + t.totalAmount, 0);

        if (totalBuyQty > 0 && totalSellQty > 0) {
          const avgBuyPrice = totalBuyAmount / totalBuyQty;
          const avgSellPrice = totalSellAmount / totalSellQty;
          const tradeProfitLoss = totalSellAmount - totalBuyAmount;
          const tradeProfitLossPercent = ((tradeProfitLoss / totalBuyAmount) * 100).toFixed(2);
          
          if (tradeProfitLoss > 0) {
            console.log(`   ✅ 손익: +${tradeProfitLoss.toLocaleString()}원 (+${tradeProfitLossPercent}%)\n`);
          } else {
            console.log(`   ❌ 손익: ${tradeProfitLoss.toLocaleString()}원 (${tradeProfitLossPercent}%)\n`);
          }
        }
      });

    } else {
      console.log('⚠️  오늘 거래 이력: 없음\n');
      
      // 최근 거래 확인
      console.log('📋 최근 거래 (최근 10개)');
      console.log('─────────────────────────────────────────────────────────────\n');

      const recentResult = await pool.query(`
        SELECT
          id,
          code,
          name,
          action,
          quantity,
          price,
          created_at
        FROM trade_history
        ORDER BY created_at DESC
        LIMIT 10
      `);

      if (recentResult.rows.length > 0) {
        recentResult.rows.forEach((trade, i) => {
          const date = new Date(trade.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
          console.log(`[${i+1}] ${date} - ${trade.code} ${trade.action === 'BUY' ? '매수' : '매도'}`);
        });
      } else {
        console.log('❌ 전체 거래 이력 없음');
      }
    }

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
