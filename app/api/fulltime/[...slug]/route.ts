import { NextRequest, NextResponse } from 'next/server';

const HEROKU_BACKEND_URL = process.env.HEROKU_BACKEND_URL || 'http://localhost:5000';

async function buildUrl(request: NextRequest, context: any) {
  // params이 Promise로 감싸져 있을 수 있음
  const params = await context.params;
  const slug = Array.isArray(params?.slug) ? params.slug : [];
  const slugPath = slug.join('/');
  const queryString = request.nextUrl.search;
  const url = `${HEROKU_BACKEND_URL}/api/fulltime/${slugPath}${queryString}`;

  console.log('📌 params:', params);
  console.log('📌 slug:', slug);
  console.log('🔗 Full URL:', url);

  return url;
}

export async function GET(request: NextRequest, context: any) {
  try {
    const url = await buildUrl(request, context);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json({ status: 'error', error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: any) {
  try {
    const url = await buildUrl(request, context);
    const body = await request.json();

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json({ status: 'error', error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: any) {
  try {
    const url = await buildUrl(request, context);
    const body = await request.json();

    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json({ status: 'error', error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: any) {
  try {
    const url = await buildUrl(request, context);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json({ status: 'error', error: String(error) }, { status: 500 });
  }
}
