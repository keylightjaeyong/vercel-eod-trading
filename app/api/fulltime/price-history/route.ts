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
  const pool = await connectPostgres();

  try {
    // 오늘 수집된 가격 데이터 (최근 24시간)
    const todayPrices = await pool.query(`
      SELECT
        code,
        close,
        created_at,
        EXTRACT(HOUR FROM created_at) as hour,
        EXTRACT(MINUTE FROM created_at) as minute
      FROM price_snapshots
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY code, created_at ASC
    `);

    // 코드별로 그룹화
    const pricesByCode: any = {};
    for (const row of todayPrices.rows) {
      if (!pricesByCode[row.code]) {
        pricesByCode[row.code] = [];
      }
      pricesByCode[row.code].push({
        price: parseFloat(row.close),
        time: `${String(row.hour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}`,
        timestamp: row.created_at,
      });
    }

    // 통계 계산
    const stats: any = {};
    for (const [code, prices] of Object.entries(pricesByCode)) {
      const priceArray = (prices as any[]).map(p => p.price);
      const min = Math.min(...priceArray);
      const max = Math.max(...priceArray);
      const first = priceArray[0];
      const last = priceArray[priceArray.length - 1];
      const change = last - first;
      const changePercent = (change / first) * 100;

      stats[code] = {
        count: priceArray.length,
        first,
        last,
        min,
        max,
        change,
        changePercent: parseFloat(changePercent.toFixed(2)),
        lowestPoint: min === first ? 0 : priceArray.indexOf(min),
        recoveryPercent: min < last ? ((last - min) / (last - min)) * 100 : 0,
      };
    }

    await pool.end();

    return NextResponse.json({
      success: true,
      date: new Date().toLocaleDateString('ko-KR'),
      pricesByCode,
      stats,
    });
  } catch (err: any) {
    console.error('❌ 가격 이력 조회 오류:', err);
    await pool.end();
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
