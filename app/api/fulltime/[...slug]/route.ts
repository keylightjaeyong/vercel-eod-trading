import { NextRequest, NextResponse } from 'next/server';

const HEROKU_BACKEND_URL = process.env.HEROKU_BACKEND_URL || 'http://localhost:5000';

async function buildUrl(request: NextRequest, params: any) {
  let slug: string[] = [];

  if (params.slug) {
    // params이 Promise일 수 있음 (Next.js 16+)
    const resolvedParams = await Promise.resolve(params.slug);
    slug = Array.isArray(resolvedParams) ? resolvedParams : [resolvedParams];
  }

  const slugPath = slug.join('/');
  const queryString = request.nextUrl.search;
  return `${HEROKU_BACKEND_URL}/api/fulltime/${slugPath}${queryString}`;
}

export async function GET(request: NextRequest, context: any) {
  try {
    const url = await buildUrl(request, context.params);

    console.log('🔗 Full URL:', url);
    console.log('📌 HEROKU_BACKEND_URL:', HEROKU_BACKEND_URL);
    console.log('📌 params:', context.params);

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
    const url = await buildUrl(request, context.params);
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
    const url = await buildUrl(request, context.params);
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
    const url = await buildUrl(request, context.params);

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
