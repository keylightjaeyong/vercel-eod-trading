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
  });
  return pool;
}

export async function GET(req: NextRequest) {
  try {
    const pool = await connectPostgres();

    // Postgres에서 상태 조회
    const result = await pool.query(
      'SELECT timestamp, total_capital FROM trading_status WHERE id = 1'
    );
    await pool.end();

    let total_capital = 300000;
    let timestamp = new Date().toISOString();

    if (result.rows.length > 0) {
      const row = result.rows[0];
      timestamp = row.timestamp || timestamp;
      total_capital = row.total_capital || 300000;
      console.log(`✅ Status: 잔고 ${total_capital.toLocaleString()}원`);
    } else {
      // 데이터가 없으면 초기값 삽입
      console.log('⚠️ Status: Postgres에 데이터 없음, 초기값 삽입');
      try {
        await pool.query(
          'INSERT INTO trading_status (id, timestamp, total_capital) VALUES (1, $1, 300000) ON CONFLICT (id) DO NOTHING',
          [timestamp]
        );
      } catch (e) {
        console.log('⚠️ 초기값 삽입 실패:', e);
      }
    }

    // 프론트엔드가 기대하는 형식
    const statusData = {
      timestamp,
      enabled: true,
      test_mode: false,
      total_capital: parseInt(total_capital.toString()),
      active_positions: 0,
      stocks_enabled: 2,
      daily_pnl: {
        date: new Date().toISOString().split('T')[0],
        trades: 0,
        profit_pct: 0.0,
        profit_amount: 0,
        win_rate: 0.0,
      },
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

    // 에러가 발생해도 기본값 반환 (UI가 깨지지 않도록)
    return NextResponse.json(
      {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          enabled: true,
          test_mode: false,
          total_capital: 300000,
          active_positions: 0,
          stocks_enabled: 2,
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
