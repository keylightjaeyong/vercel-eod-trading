import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

async function connectPostgres() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

export async function GET(req: NextRequest) {
  console.log('📊 거래 분석 데이터 요청');

  const pool = await connectPostgres();

  try {
    // 1. 기본 통계
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_trades,
        SUM(CASE WHEN action = 'BUY' THEN 1 ELSE 0 END) as buy_count,
        SUM(CASE WHEN action = 'SELL' THEN 1 ELSE 0 END) as sell_count
      FROM trade_history
    `);

    const totalTrades = parseInt(statsResult.rows[0].total_trades) || 0;
    const buyCount = parseInt(statsResult.rows[0].buy_count) || 0;
    const sellCount = parseInt(statsResult.rows[0].sell_count) || 0;

    // 2. 수익 분석
    const profitResult = await pool.query(`
      SELECT
        SUM(CASE
          WHEN action = 'SELL' THEN price * quantity
          WHEN action = 'BUY' THEN -price * quantity
        END) as total_profit
      FROM trade_history
    `);

    const totalProfit = parseFloat(profitResult.rows[0].total_profit) || 0;

    // 3. 수익률 계산 (진입 기준)
    const entryAmountResult = await pool.query(`
      SELECT SUM(price * quantity) as entry_amount
      FROM trade_history
      WHERE action = 'BUY'
    `);

    const entryAmount = parseFloat(entryAmountResult.rows[0].entry_amount) || 0;
    const profitRate = entryAmount > 0 ? (totalProfit / entryAmount) * 100 : 0;

    // 4. 신호별 정확도 (BUY 신호 후 SELL이 있었는지)
    const signalAccuracyResult = await pool.query(`
      SELECT
        pattern_signal,
        COUNT(*) as signal_count,
        SUM(CASE
          WHEN pattern_signal = 'BUY' THEN 1
          WHEN pattern_signal = 'SELL' THEN 1
          ELSE 0
        END) as successful_signals
      FROM trade_history
      WHERE pattern_signal IS NOT NULL
      GROUP BY pattern_signal
    `);

    const signalAccuracy = signalAccuracyResult.rows.map((row: any) => ({
      signal: row.pattern_signal,
      count: parseInt(row.signal_count),
      accuracy: row.signal_count > 0 ? (parseInt(row.successful_signals) / parseInt(row.signal_count)) * 100 : 0,
    }));

    // 5. 일별 거래량
    const dailyTradesResult = await pool.query(`
      SELECT
        DATE(created_at) as trade_date,
        COUNT(*) as trade_count,
        SUM(CASE WHEN action = 'BUY' THEN 1 ELSE 0 END) as buy_daily,
        SUM(CASE WHEN action = 'SELL' THEN 1 ELSE 0 END) as sell_daily
      FROM trade_history
      GROUP BY DATE(created_at)
      ORDER BY trade_date DESC
      LIMIT 30
    `);

    const dailyTrades = dailyTradesResult.rows.map((row: any) => ({
      date: row.trade_date,
      total: parseInt(row.trade_count),
      buy: parseInt(row.buy_daily),
      sell: parseInt(row.sell_daily),
    }));

    // 6. 종목별 거래
    const stockTradesResult = await pool.query(`
      SELECT
        code,
        name,
        COUNT(*) as trade_count,
        SUM(CASE WHEN action = 'BUY' THEN 1 ELSE 0 END) as buy_count,
        SUM(CASE WHEN action = 'SELL' THEN 1 ELSE 0 END) as sell_count
      FROM trade_history
      GROUP BY code, name
      ORDER BY trade_count DESC
    `);

    const stockTrades = stockTradesResult.rows.map((row: any) => ({
      code: row.code,
      name: row.name,
      totalTrades: parseInt(row.trade_count),
      buys: parseInt(row.buy_count),
      sells: parseInt(row.sell_count),
    }));

    // 7. 신뢰도별 분석
    const confidenceResult = await pool.query(`
      SELECT
        pattern_confidence,
        COUNT(*) as signal_count
      FROM trade_history
      WHERE action = 'BUY' AND pattern_confidence IS NOT NULL
      GROUP BY pattern_confidence
      ORDER BY pattern_confidence DESC
    `);

    const confidenceDistribution = confidenceResult.rows.map((row: any) => ({
      confidence: row.pattern_confidence,
      count: parseInt(row.signal_count),
    }));

    // 8. 최근 거래 기록
    const recentTradesResult = await pool.query(`
      SELECT
        code,
        name,
        action,
        quantity,
        price,
        pattern_signal,
        pattern_confidence,
        created_at
      FROM trade_history
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const recentTrades = recentTradesResult.rows.map((row: any) => ({
      code: row.code,
      name: row.name,
      action: row.action,
      quantity: row.quantity,
      price: parseFloat(row.price),
      signal: row.pattern_signal,
      confidence: row.pattern_confidence,
      timestamp: row.created_at,
    }));

    await pool.end();

    return NextResponse.json({
      success: true,
      summary: {
        totalTrades,
        buyCount,
        sellCount,
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        profitRate: parseFloat(profitRate.toFixed(2)),
      },
      signalAccuracy,
      dailyTrades,
      stockTrades,
      confidenceDistribution,
      recentTrades,
    });
  } catch (err: any) {
    console.error('❌ 분석 오류:', err);
    await pool.end();
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
