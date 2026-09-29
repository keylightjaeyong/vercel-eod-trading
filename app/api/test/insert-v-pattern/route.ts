import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/db/pool';
import { nowInSeoul } from '@/lib/utils/timezone';

/**
 * POST /api/test/insert-v-pattern
 * 테스트용 V자 패턴 데이터 30개 삽입
 * TRADING_ENABLED=false 상태에서만 사용!
 */
export async function POST(req: NextRequest) {
  const pool = getPostgresPool();

  try {
    // 테이블 확인
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_snapshots (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        close DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // V자 패턴 데이터 생성
    const priceData = [
      // 하강 구간 (1단계 - 5개)
      { price: 273000, minutesAgo: 140 },
      { price: 272600, minutesAgo: 135 },
      { price: 272200, minutesAgo: 130 },
      { price: 271800, minutesAgo: 125 },
      { price: 271400, minutesAgo: 120 },

      // 하강 구간 (2단계 - 5개)
      { price: 271000, minutesAgo: 115 },
      { price: 270600, minutesAgo: 110 },
      { price: 270300, minutesAgo: 105 },
      { price: 270100, minutesAgo: 100 },
      { price: 270000, minutesAgo: 95 },

      // 저점 (1개)
      { price: 270000, minutesAgo: 90 },

      // 반등 구간 (1단계 - 5개)
      { price: 270300, minutesAgo: 85 },
      { price: 270600, minutesAgo: 80 },
      { price: 270900, minutesAgo: 75 },
      { price: 271200, minutesAgo: 70 },
      { price: 271500, minutesAgo: 65 },

      // 반등 구간 (2단계 - 5개)
      { price: 271800, minutesAgo: 60 },
      { price: 272000, minutesAgo: 55 },
      { price: 272100, minutesAgo: 50 },
      { price: 272200, minutesAgo: 45 },
      { price: 272300, minutesAgo: 40 },

      // 계속 상승 (5개)
      { price: 272400, minutesAgo: 35 },
      { price: 272500, minutesAgo: 30 },
      { price: 272600, minutesAgo: 25 },
      { price: 272700, minutesAgo: 20 },
      { price: 272800, minutesAgo: 15 },
    ];

    let insertCount = 0;

    for (const data of priceData) {
      const timestamp = new Date(Date.now() - data.minutesAgo * 60000);

      const result = await pool.query(
        `INSERT INTO price_snapshots (code, timestamp, close, created_at)
         VALUES ($1, $2, $3, ${nowInSeoul()})`,
        ['005930', timestamp, data.price]
      );

      if (result.rowCount && result.rowCount > 0) {
        insertCount++;
      }
    }

    // 확인
    const verifyResult = await pool.query(
      `SELECT COUNT(*) as count,
              MIN(CAST(close as INTEGER)) as min_price,
              MAX(CAST(close as INTEGER)) as max_price
       FROM price_snapshots
       WHERE code = '005930'`
    );

    const stats = verifyResult.rows[0];

    return NextResponse.json({
      success: true,
      message: `✅ V자 패턴 데이터 ${insertCount}개 삽입 완료`,
      data: {
        inserted: insertCount,
        total_count: stats.count,
        min_price: stats.min_price,
        max_price: stats.max_price,
        drop_pct: ((273000 - stats.min_price) / 273000 * 100).toFixed(2) + '%',
        rise_pct: ((stats.max_price - stats.min_price) / stats.min_price * 100).toFixed(2) + '%',
      },
    });
  } catch (err: any) {
    console.error('❌ V자 패턴 데이터 삽입 실패:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
