import { NextRequest, NextResponse } from 'next/server';

const HEROKU_API = process.env.HEROKU_API_URL || 'https://eod-trading-backend.herokuapp.com';

// GET: 설정 조회
export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${HEROKU_API}/api/fulltime/config`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error('Heroku 요청 실패');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 설정 조회 실패:', error);
    return NextResponse.json({
      success: true,
      data: {
        global_settings: {
          min_drop: 1.0, min_rise: 0.5, search_window: 10,
          trailing_stop_loss_pct: 0.2, search_candles_limit: 10,
          test_mode: false, enabled: true,
        },
        stocks: [
          { code: '000660', name: 'SK하이닉스', enabled: true, allocation_pct: 50 },
          { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 30 },
        ],
      },
    });
  }
}

// POST: 설정 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const response = await fetch(`${HEROKU_API}/api/fulltime/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error('Heroku 요청 실패');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 설정 저장 실패:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
