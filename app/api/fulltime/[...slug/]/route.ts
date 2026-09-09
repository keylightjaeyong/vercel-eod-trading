import { NextRequest, NextResponse } from 'next/server';

// Heroku 백엔드 URL
const HEROKU_BACKEND_URL = process.env.HEROKU_BACKEND_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname.replace('/api/fulltime', '');
    const queryString = request.nextUrl.search;
    const url = `${HEROKU_BACKEND_URL}/api/fulltime${path}${queryString}`;

    console.log('🔗 Heroku URL:', url);
    console.log('📌 HEROKU_BACKEND_URL:', HEROKU_BACKEND_URL);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Heroku 응답 에러: ${response.status}`);
      const text = await response.text();
      return NextResponse.json(
        {
          status: 'error',
          error: `Heroku error: ${response.status}`,
          details: text,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API 요청 실패:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: '백엔드 서버에 연결할 수 없습니다',
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname.replace('/api/fulltime', '');
    const body = await request.json();

    const response = await fetch(
      `${HEROKU_BACKEND_URL}/api/fulltime${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API 요청 실패:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: '백엔드 서버에 연결할 수 없습니다',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname.replace('/api/fulltime', '');
    const body = await request.json();

    const response = await fetch(
      `${HEROKU_BACKEND_URL}/api/fulltime${path}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API 요청 실패:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: '백엔드 서버에 연결할 수 없습니다',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname.replace('/api/fulltime', '');

    const response = await fetch(
      `${HEROKU_BACKEND_URL}/api/fulltime${path}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API 요청 실패:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: '백엔드 서버에 연결할 수 없습니다',
      },
      { status: 500 }
    );
  }
}
