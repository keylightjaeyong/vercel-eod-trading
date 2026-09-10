import { NextRequest, NextResponse } from 'next/server';

async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  return pool;
}

// PUT: 종목 활성화/비활성화
export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { code } = params;
    const body = await req.json() as any;
    const { enabled } = body;

    const pool = await connectPostgres();
    await pool.query('UPDATE stocks SET enabled=$1 WHERE code=$2', [enabled, code]);
    await pool.end();

    return NextResponse.json({
      success: true,
      message: '종목 상태가 변경되었습니다',
    });
  } catch (error) {
    console.error('❌ 종목 상태 변경 실패:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// DELETE: 종목 삭제
export async function DELETE(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { code } = params;

    const pool = await connectPostgres();
    await pool.query('DELETE FROM stocks WHERE code=$1', [code]);
    await pool.end();

    return NextResponse.json({
      success: true,
      message: '종목이 삭제되었습니다',
    });
  } catch (error) {
    console.error('❌ 종목 삭제 실패:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
