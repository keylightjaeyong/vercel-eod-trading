import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/db/pool';

/**
 * GET /api/test/check-prices
 * 현재 DB의 가격 데이터 확인
 */
export async function GET(req: NextRequest) {
  const pool = getPostgresPool();

  try {
    // 최근 30개 가격 조회
    const result = await pool.query(
      `SELECT code, close, timestamp, created_at
       FROM price_snapshots
       WHERE code = '005930'
       ORDER BY timestamp DESC
       LIMIT 30`
    );

    const prices = result.rows.map(row => ({
      price: row.close,
      timestamp: row.timestamp,
      created_at: row.created_at,
    }));

    return NextResponse.json({
      success: true,
      count: prices.length,
      data: prices,
      summary: {
        최신가: prices.length > 0 ? prices[0].price : null,
        최저가: Math.min(...prices.map(p => parseFloat(p.price))),
        최고가: Math.max(...prices.map(p => parseFloat(p.price))),
      },
    });
  } catch (err: any) {
    console.error('❌ 가격 데이터 조회 실패:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
