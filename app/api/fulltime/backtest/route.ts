import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { KneeShoulderPattern } from '@/lib/patterns/knee-shoulder';

async function connectPostgres() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

export async function GET(req: NextRequest) {
  const pool = await connectPostgres();

  try {
    // Force redeploy - confidence_threshold: 0
    // 최근 24시간 가격 데이터 조회
    const priceData = await pool.query(`
      SELECT
        code,
        close,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY code ORDER BY created_at ASC) as idx
      FROM price_snapshots
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY code, created_at ASC
    `);

    const pricesByCode: any = {};
    for (const row of priceData.rows) {
      if (!pricesByCode[row.code]) {
        pricesByCode[row.code] = [];
      }
      pricesByCode[row.code].push({
        price: parseFloat(row.close),
        time: row.created_at,
        idx: row.idx,
      });
    }

    // 백테스팅 파라미터 (현재 설정)
    const config = {
      min_drop: 0.05,
      min_rise: 0.05,
      search_window: 15,
      confidence_threshold: 0, // 신뢰도 필터 제거
    };

    const backtest_results: any = {};

    // 각 종목별 백테스팅
    for (const [code, prices] of Object.entries(pricesByCode)) {
      const priceArray = (prices as any[]).map(p => p.price);

      if (priceArray.length < 20) {
        continue; // 데이터 부족
      }

      let buySignal = null;
      let buyPrice = 0;
      let maxPrice = 0;
      let sellSignal = null;
      let sellPrice = 0;
      let profit = 0;
      let profitRate = 0;

      // 시뮬레이션: 각 포인트에서 매수/매도 체크
      for (let i = 20; i < priceArray.length; i++) {
        const windowPrices = priceArray.slice(Math.max(0, i - 30), i + 1);

        // 패턴 분석
        const signal = KneeShoulderPattern.generateTradingSignal(
          windowPrices,
          config
        );

        // 매수 신호
        if (!buySignal && signal.signal === 'BUY') {
          buySignal = signal;
          buyPrice = priceArray[i];
          maxPrice = buyPrice;
          console.log(`📈 [${code}] 매수 신호: ${buyPrice}원, 신뢰도: ${signal.confidence}%`);
        }

        // 매도 신호 (수익 5% 이상 또는 손실 2% 이상)
        if (buySignal) {
          const currentPrice = priceArray[i];
          maxPrice = Math.max(maxPrice, currentPrice);
          const pctChange = ((currentPrice - buyPrice) / buyPrice) * 100;

          // 3가지 매도 조건
          if (
            pctChange >= 5 ||           // 수익 5% 이상
            pctChange <= -2 ||          // 손실 2% 이상
            (i === priceArray.length - 1) // 마지막 가격
          ) {
            sellSignal = 'SELL';
            sellPrice = currentPrice;
            profit = sellPrice - buyPrice;
            profitRate = pctChange;
            console.log(`📉 [${code}] 매도: ${sellPrice}원, 수익률: ${profitRate.toFixed(2)}%`);
            break;
          }
        }
      }

      backtest_results[code] = {
        prices_count: priceArray.length,
        buy_signal: buySignal ? 'YES' : 'NO',
        buy_price: buyPrice,
        buy_confidence: buySignal?.confidence || 0,
        sell_signal: sellSignal ? 'YES' : 'NO',
        sell_price: sellPrice,
        profit_amount: profit,
        profit_rate: profitRate.toFixed(2) + '%',
        max_price_during_hold: maxPrice,
      };
    }

    await pool.end();

    return NextResponse.json({
      success: true,
      config,
      results: backtest_results,
    });
  } catch (err: any) {
    console.error('❌ 백테스팅 오류:', err);
    await pool.end();
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
