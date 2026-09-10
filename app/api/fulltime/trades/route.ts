import { NextRequest, NextResponse } from 'next/server';

const HEROKU_API = process.env.HEROKU_API_URL || 'https://eod-trading-backend.herokuapp.com';

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${HEROKU_API}/api/fulltime/trades`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error('Heroku 요청 실패');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 거래 이력 조회 실패:', error);
    return NextResponse.json({ success: true, data: [] });
  }
}
