import { NextRequest, NextResponse } from 'next/server';

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

    const result = await pool.query(
      'SELECT stock_code, stock_name, entry_price, exit_price, quantity, profit_pct, profit_amount, entry_time, exit_time, reason, duration_min FROM trades ORDER BY exit_time DESC LIMIT 100'
    );

    await pool.end();

    const trades = result.rows.map((row) => ({
      stock_code: row.stock_code,
      stock_name: row.stock_name,
      entry_price: row.entry_price,
      exit_price: row.exit_price,
      quantity: row.quantity,
      profit_pct: row.profit_pct,
      profit_amount: row.profit_amount,
      entry_time: row.entry_time,
      exit_time: row.exit_time,
      reason: row.reason || '자동 매도',
      duration_min: row.duration_min || 0,
    }));

    return NextResponse.json({ success: true, data: trades });
  } catch (error) {
    console.error('❌ 거래 이력 조회 실패:', error);
    return NextResponse.json({ success: true, data: [] });
  }
}
