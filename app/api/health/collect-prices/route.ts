import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/db/pool';

export const runtime = 'nodejs';

/**
 * GET /api/health/collect-prices
 * GitHub Actions가 Vercel의 collect-prices 실행 여부 확인용
 *
 * 응답:
 * - status: 'ok' (5분 이내 데이터 수집됨)
 * - status: 'failed' (5분 이상 데이터 없음)
 */
export async function GET(req: NextRequest) {
  try {
    const pool = getPostgresPool();

    // 최근 5분 내 가격 데이터가 있는지 확인
    const result = await pool.query(`
      SELECT
        code,
        MAX(created_at) as latest_time,
        COUNT(*) as count
      FROM price_snapshots
      WHERE created_at > NOW() - INTERVAL '5 minutes'
      GROUP BY code
      LIMIT 10
    `);

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    if (result.rows.length === 0) {
      // 5분 내 데이터 없음 (collect-prices 미실행)
      console.warn(`⚠️ 지난 5분 내 수집 데이터 없음`);
      return NextResponse.json({
        status: 'failed',
        message: 'No data collected in the last 5 minutes',
        timestamp: now.toISOString(),
        healthy: false,
      });
    }

    // 5분 내 데이터 있음 (collect-prices 정상 실행)
    const totalCount = result.rows.reduce((sum, r) => sum + r.count, 0);
    console.log(`✅ 5분 내 수집됨: ${result.rows.length}개 종목, 총 ${totalCount}개 데이터`);

    return NextResponse.json({
      status: 'ok',
      message: `Last collection: ${result.rows[0].latest_time}`,
      stocks_collected: result.rows.length,
      total_data_points: totalCount,
      timestamp: now.toISOString(),
      healthy: true,
    });
  } catch (err: any) {
    console.error('❌ 헬스 체크 오류:', err.message);
    return NextResponse.json(
      {
        status: 'error',
        error: err.message,
        healthy: false,
      },
      { status: 500 }
    );
  }
}
