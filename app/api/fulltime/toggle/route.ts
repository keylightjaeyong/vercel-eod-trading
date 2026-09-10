import { NextRequest, NextResponse } from 'next/server';

const HEROKU_API = process.env.HEROKU_API_URL || 'https://eod-trading-backend.herokuapp.com';

export async function POST(req: NextRequest) {
  try {
    const response = await fetch(`${HEROKU_API}/api/fulltime/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error('Heroku 요청 실패');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 토글 실패:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
