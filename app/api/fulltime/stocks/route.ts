import { NextRequest, NextResponse } from 'next/server';

async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  return pool;
}

// GET: 종목 목록 조회
export async function GET(req: NextRequest) {
  try {
    const pool = await connectPostgres();

    // Postgres에서 종목 조회
    const result = await pool.query(
      'SELECT code, name, enabled, allocation_pct FROM stocks ORDER BY code'
    );
    await pool.end();

    // 데이터 없으면 기본값 반환
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [
          { code: '000660', name: 'SK하이닉스', enabled: true, allocation_pct: 50 },
          { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 30 },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      data: result.rows.map((row) => ({
        code: row.code,
        name: row.name,
        enabled: row.enabled ?? true,
        allocation_pct: row.allocation_pct ?? 0,
      })),
    });
  } catch (error) {
    console.error('❌ 종목 조회 실패:', error);
    return NextResponse.json(
      {
        success: true,
        data: [
          { code: '000660', name: 'SK하이닉스', enabled: true, allocation_pct: 50 },
          { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 30 },
        ],
      },
      { status: 200 }
    );
  }
}

// POST: 종목 추가
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as any;
    const { code, name, allocation_pct } = body;

    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: '코드와 이름은 필수입니다' },
        { status: 400 }
      );
    }

    const pool = await connectPostgres();

    await pool.query(
      'INSERT INTO stocks (code, name, enabled, allocation_pct) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO UPDATE SET name=$2, allocation_pct=$4',
      [code, name, true, allocation_pct || 0]
    );

    await pool.end();

    return NextResponse.json({
      success: true,
      message: '종목이 추가되었습니다',
    });
  } catch (error) {
    console.error('❌ 종목 추가 실패:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

