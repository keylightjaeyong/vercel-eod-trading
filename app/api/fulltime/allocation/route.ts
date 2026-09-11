import { NextRequest, NextResponse } from 'next/server';
import { KISApi } from '@/lib/kis/api';

async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

// GET: 할당 데이터 조회
export async function GET(req: NextRequest) {
  try {
    // 1. KIS API에서 실제 잔고 조회
    let total_capital = 300000;

    try {
      const kis = new KISApi();
      kis.updateEnv();

      console.log('📊 KIS API에서 계좌 정보 조회 중...');
      const accountData = await kis.getAccount();

      total_capital = accountData.balance + accountData.evaluating;
      console.log(`✅ KIS API 조회 성공: ${total_capital.toLocaleString()}원`);
    } catch (kisError: any) {
      console.warn(`⚠️ KIS API 조회 실패: ${kisError.message}, 기본값 사용`);
    }

    const pool = await connectPostgres();

    const result = await pool.query('SELECT code, name, allocation_pct FROM stocks WHERE enabled=true ORDER BY allocation_pct DESC');
    await pool.end();

    const allocations: Record<string, any> = {};
    result.rows.forEach((row) => {
      const pct = typeof row.allocation_pct === 'string'
        ? parseFloat(row.allocation_pct)
        : (row.allocation_pct || 0);
      allocations[row.code] = {
        name: row.name,
        pct: Number(pct) || 0,
        amount: Math.round((total_capital * Number(pct || 0)) / 100),
        current_price: 0,
        possible_quantity: 0,
      };
    });

    if (Object.keys(allocations).length === 0) {
      allocations['000660'] = {
        name: 'SK하이닉스',
        pct: 50,
        amount: Math.round((total_capital * 50) / 100),
        current_price: 0,
        possible_quantity: 0,
      };
      allocations['005930'] = {
        name: '삼성전자',
        pct: 30,
        amount: Math.round((total_capital * 30) / 100),
        current_price: 0,
        possible_quantity: 0,
      };
    }

    return NextResponse.json({
      success: true,
      data: { total_capital, allocations },
    });
  } catch (error) {
    console.error('❌ 할당 조회 실패:', error);

    const total_capital = 300000;
    return NextResponse.json({
      success: true,
      data: {
        total_capital,
        allocations: {
          '000660': {
            name: 'SK하이닉스',
            pct: 50,
            amount: Math.round((total_capital * 50) / 100),
            current_price: 0,
            possible_quantity: 0,
          },
          '005930': {
            name: '삼성전자',
            pct: 30,
            amount: Math.round((total_capital * 30) / 100),
            current_price: 0,
            possible_quantity: 0,
          },
        },
      },
    });
  }
}

// POST: 할당 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { allocations } = body;

    const pool = await connectPostgres();

    for (const [code, value] of Object.entries(allocations)) {
      // allocations는 { code: percentage } 형태
      const pct = typeof value === 'object' ? (value as any).pct : Number(value);
      console.log(`💾 저장: ${code} = ${pct}%`);

      await pool.query('UPDATE stocks SET allocation_pct=$1 WHERE code=$2', [pct, code]);
    }

    await pool.end();

    return NextResponse.json({ success: true, message: '할당이 저장되었습니다' });
  } catch (error) {
    console.error('❌ 할당 저장 실패:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
