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
    // price_snapshots 테이블의 모든 데이터 조회
    const result = await pool.query(`
      SELECT
        id, code, timestamp, close, created_at,
        EXTRACT(YEAR FROM created_at) as year,
        EXTRACT(MONTH FROM created_at) as month,
        EXTRACT(DAY FROM created_at) as day
      FROM price_snapshots
      ORDER BY created_at DESC
      LIMIT 50
    `);

    // 집계 통계
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_count,
        MIN(created_at) as earliest,
        MAX(created_at) as latest,
        COUNT(DISTINCT DATE(created_at)) as days_count,
        COUNT(DISTINCT code) as codes_count
      FROM price_snapshots
    `);

    const stats = statsResult.rows[0];

    await pool.end();

    return NextResponse.json({
      success: true,
      debug: {
        database_url_exists: !!process.env.DATABASE_URL,
        total_records: result.rows.length,
        stats: {
          total_count: stats.total_count,
          earliest: stats.earliest,
          latest: stats.latest,
          days_count: stats.days_count,
          codes_count: stats.codes_count,
        },
        records: result.rows,
      },
    });
  } catch (err: any) {
    await pool.end();
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack,
    });
  }
}
