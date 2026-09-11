import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

async function connectPostgres() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

// PUT: 종목 활성화/비활성화
export async function PUT(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  let pool: any = null;
  try {
    const params = await context.params;
    const { code } = params;
    const body = await req.json();
    const { enabled } = body;

    pool = await connectPostgres();
    await pool.query('UPDATE stocks SET enabled=$1 WHERE code=$2', [enabled, code]);

    return NextResponse.json({ success: true, message: '종목 상태가 변경되었습니다' });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        // 무시
      }
    }
  }
}

// DELETE: 종목 삭제
export async function DELETE(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  let pool: any = null;
  try {
    const params = await context.params;
    const { code } = params;

    pool = await connectPostgres();
    await pool.query('DELETE FROM stocks WHERE code=$1', [code]);

    return NextResponse.json({ success: true, message: '종목이 삭제되었습니다' });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        // 무시
      }
    }
  }
}
