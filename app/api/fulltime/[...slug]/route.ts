import { NextRequest, NextResponse } from 'next/server';

const HEROKU_BACKEND_URL = process.env.HEROKU_BACKEND_URL || 'http://localhost:5000';

export async function GET(request: NextRequest, { params }: any) {
  try {
    const slug = Array.isArray(params.slug) ? params.slug : [params.slug];
    const slugPath = slug.join('/');
    const queryString = request.nextUrl.search;
    const url = `${HEROKU_BACKEND_URL}/api/fulltime/${slugPath}${queryString}`;

    console.log('🔗 Heroku URL:', url);
    console.log('📌 HEROKU_BACKEND_URL:', HEROKU_BACKEND_URL);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error(`❌ Heroku error: ${response.status}`);
      const text = await response.text();
      return NextResponse.json({ status: 'error', error: `Heroku: ${response.status}`, details: text }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API failed:', error);
    return NextResponse.json({ status: 'error', error: '연결 실패', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: any) {
  try {
    const slug = Array.isArray(params.slug) ? params.slug : [params.slug];
    const slugPath = slug.join('/');
    const body = await request.json();
    const url = `${HEROKU_BACKEND_URL}/api/fulltime/${slugPath}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ status: 'error', error: `Heroku: ${response.status}`, details: text }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API failed:', error);
    return NextResponse.json({ status: 'error', error: '연결 실패', details: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: any) {
  try {
    const slug = Array.isArray(params.slug) ? params.slug : [params.slug];
    const slugPath = slug.join('/');
    const body = await request.json();
    const url = `${HEROKU_BACKEND_URL}/api/fulltime/${slugPath}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ status: 'error', error: `Heroku: ${response.status}`, details: text }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API failed:', error);
    return NextResponse.json({ status: 'error', error: '연결 실패', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: any) {
  try {
    const slug = Array.isArray(params.slug) ? params.slug : [params.slug];
    const slugPath = slug.join('/');
    const url = `${HEROKU_BACKEND_URL}/api/fulltime/${slugPath}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ status: 'error', error: `Heroku: ${response.status}`, details: text }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API failed:', error);
    return NextResponse.json({ status: 'error', error: '연결 실패', details: String(error) }, { status: 500 });
  }
}
