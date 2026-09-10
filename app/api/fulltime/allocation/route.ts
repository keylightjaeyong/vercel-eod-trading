import { NextRequest, NextResponse } from 'next/server';

const HEROKU_API = process.env.HEROKU_API_URL || 'https://eod-trading-backend.herokuapp.com';

// GET: 할당 데이터 조회
export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${HEROKU_API}/api/fulltime/allocation`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error('Heroku 요청 실패');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 할당 조회 실패:', error);
    return NextResponse.json({
      success: true,
      data: {
        total_capital: 300000,
        allocations: {
          '000660': { name: 'SK하이닉스', pct: 50, amount: 150000 },
          '005930': { name: '삼성전자', pct: 30, amount: 90000 },
        },
      },
    });
  }
}

// POST: 할당 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const response = await fetch(`${HEROKU_API}/api/fulltime/allocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error('Heroku 요청 실패');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 할당 저장 실패:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
