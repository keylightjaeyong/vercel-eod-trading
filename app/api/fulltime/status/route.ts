import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/fulltime/status
 * 프론트엔드에서 거래 상태 조회
 * Postgres에서 trading_status 데이터 읽기
 */

export const runtime = 'nodejs';
export const maxDuration = 10;

async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

export async function GET(req: NextRequest) {
  try {
    const pool = await connectPostgres();

    // 1. 상태 조회
    const result = await pool.query(
      'SELECT timestamp, total_capital FROM trading_status WHERE id = 1'
    );

    let total_capital = 300000;
    let timestamp = new Date().toISOString();

    if (result.rows.length > 0) {
      const row = result.rows[0];
      timestamp = row.timestamp || timestamp;
      total_capital = row.total_capital || 300000;
      console.log(`✅ Status: 잔고 ${total_capital.toLocaleString()}원`);
    } else {
      console.log('⚠️ Status: Postgres에 데이터 없음');
    }

    // 2. 활성화된 종목 수 조회
    let stocks_enabled = 0;
    try {
      const stocksResult = await pool.query(
        'SELECT COUNT(*) as count FROM stocks WHERE enabled = true'
      );
      stocks_enabled = parseInt(stocksResult.rows[0]?.count) || 0;
      console.log(`📊 활성화된 종목: ${stocks_enabled}개`);
    } catch (e) {
      console.log('⚠️ 종목 조회 실패:', e);
    }

    // 3. 거래 기록에서 보유 포지션 계산
    let active_positions = 0;
    try {
      const positionsResult = await pool.query(
        'SELECT COUNT(DISTINCT code) as count FROM trade_history WHERE action = \'BUY\' AND code NOT IN (SELECT code FROM trade_history WHERE action = \'SELL\' ORDER BY created_at DESC)'
      );
      active_positions = parseInt(positionsResult.rows[0]?.count) || 0;
      console.log(`💼 보유 포지션: ${active_positions}개`);
    } catch (e) {
      console.log('⚠️ 포지션 조회 실패:', e);
    }

    // 4. 일일 손익 계산
    let daily_pnl = {
      date: new Date().toISOString().split('T')[0],
      trades: 0,
      profit_pct: 0.0,
      profit_amount: 0,
      win_rate: 0.0,
    };
    try {
      const today = new Date().toISOString().split('T')[0];
      const tradesResult = await pool.query(
        `SELECT COUNT(*) as count FROM trade_history WHERE DATE(created_at) = $1`,
        [today]
      );
      daily_pnl.trades = parseInt(tradesResult.rows[0]?.count) || 0;
      console.log(`📈 오늘 거래: ${daily_pnl.trades}건`);
    } catch (e) {
      console.log('⚠️ 거래 기록 조회 실패:', e);
    }

    await pool.end();

    const statusData = {
      timestamp,
      enabled: true,
      test_mode: false,
      total_capital: parseInt(total_capital.toString()),
      active_positions,
      stocks_enabled,
      daily_pnl,
      monthly_profit: 0,
    };

    return NextResponse.json(
      {
        success: true,
        data: statusData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Status 조회 실패:', error);

    return NextResponse.json(
      {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          enabled: true,
          test_mode: false,
          total_capital: 300000,
          active_positions: 0,
          stocks_enabled: 0,
          daily_pnl: {
            date: new Date().toISOString().split('T')[0],
            trades: 0,
            profit_pct: 0.0,
            profit_amount: 0,
            win_rate: 0.0,
          },
          monthly_profit: 0,
        },
      },
      { status: 200 }
    );
  }
}
