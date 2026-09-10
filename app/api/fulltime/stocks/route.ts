import { NextRequest, NextResponse } from 'next/server';

const HEROKU_API = process.env.HEROKU_API_URL || 'https://eod-trading-backend.herokuapp.com';

// GET: 종목 목록 조회
export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${HEROKU_API}/api/fulltime/stocks`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error('Heroku 요청 실패');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 종목 조회 실패:', error);
    return NextResponse.json({
      success: true,
      data: [
        { code: '000660', name: 'SK하이닉스', enabled: true, allocation_pct: 50 },
        { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 30 },
      ],
    });
  }
}

// POST: 종목 추가
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const response = await fetch(`${HEROKU_API}/api/fulltime/stocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error('Heroku 요청 실패');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 종목 추가 실패:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

