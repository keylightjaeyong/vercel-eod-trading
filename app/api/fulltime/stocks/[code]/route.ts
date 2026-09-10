import { NextRequest, NextResponse } from 'next/server';

const HEROKU_API = process.env.HEROKU_API_URL || 'https://eod-trading-backend.herokuapp.com';

// PUT: 종목 활성화/비활성화
export async function PUT(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const params = await context.params;
    const { code } = params;
    const body = await req.json();

    const response = await fetch(`${HEROKU_API}/api/fulltime/stocks/${code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error('Heroku 요청 실패');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 종목 상태 변경 실패:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// DELETE: 종목 삭제
export async function DELETE(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const params = await context.params;
    const { code } = params;

    const response = await fetch(`${HEROKU_API}/api/fulltime/stocks/${code}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error('Heroku 요청 실패');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 종목 삭제 실패:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
