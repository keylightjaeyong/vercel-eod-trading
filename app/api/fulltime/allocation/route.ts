import { NextRequest, NextResponse } from 'next/server';

async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  return pool;
}

// GET: 할당 데이터 조회
export async function GET(req: NextRequest) {
  try {
    const pool = await connectPostgres();

    // stocks 테이블에서 할당 데이터 조회
    const result = await pool.query(
      'SELECT code, name, allocation_pct FROM stocks WHERE enabled=true ORDER BY allocation_pct DESC'
    );
    await pool.end();

    const allocations: Record<string, any> = {};
    result.rows.forEach((row) => {
      allocations[row.code] = {
        name: row.name,
        pct: row.allocation_pct,
        amount: Math.round((300000 * row.allocation_pct) / 100),
      };
    });

    // 데이터 없으면 기본값
    if (Object.keys(allocations).length === 0) {
      allocations['000660'] = {
        name: 'SK하이닉스',
        pct: 50,
        amount: 150000,
      };
      allocations['005930'] = {
        name: '삼성전자',
        pct: 30,
        amount: 90000,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        total_capital: 300000,
        allocations,
      },
    });
  } catch (error) {
    console.error('❌ 할당 조회 실패:', error);
    return NextResponse.json({
      success: true,
      data: {
        total_capital: 300000,
        allocations: {
          '000660': {
            name: 'SK하이닉스',
            pct: 50,
            amount: 150000,
          },
          '005930': {
            name: '삼성전자',
            pct: 30,
            amount: 90000,
          },
        },
      },
    });
  }
}

// POST: 할당 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as any;
    const { total_capital, allocations } = body;

    const pool = await connectPostgres();

    // 각 종목의 할당 비율 업데이트
    for (const [code, data] of Object.entries(allocations)) {
      const { pct } = data as any;
      await pool.query(
        'UPDATE stocks SET allocation_pct=$1 WHERE code=$2',
        [pct, code]
      );
    }

    await pool.end();

    return NextResponse.json({
      success: true,
      message: '할당이 저장되었습니다',
    });
  } catch (error) {
    console.error('❌ 할당 저장 실패:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
