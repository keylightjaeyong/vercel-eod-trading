import { NextRequest, NextResponse } from 'next/server';

async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  return pool;
}

// GET: 설정 조회
export async function GET(req: NextRequest) {
  try {
    const pool = await connectPostgres();
    const result = await pool.query('SELECT config_json FROM config_backup WHERE id = 1');
    await pool.end();

    if (result.rows.length > 0) {
      const config = JSON.parse(result.rows[0].config_json);
      return NextResponse.json({
        success: true,
        data: config,
      });
    }

    // 기본값
    return NextResponse.json({
      success: true,
      data: {
        global_settings: {
          min_drop: 1.0,
          min_rise: 0.5,
          search_window: 10,
          trailing_stop_loss_pct: 0.2,
          search_candles_limit: 10,
          test_mode: false,
          enabled: true,
        },
        stocks: [
          { code: '000660', name: 'SK하이닉스', enabled: true, allocation_pct: 50 },
          { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 30 },
        ],
      },
    });
  } catch (error) {
    console.error('❌ 설정 조회 실패:', error);
    return NextResponse.json(
      {
        success: true,
        data: {
          global_settings: {
            min_drop: 1.0,
            min_rise: 0.5,
            search_window: 10,
            trailing_stop_loss_pct: 0.2,
            search_candles_limit: 10,
            test_mode: false,
            enabled: true,
          },
          stocks: [
            { code: '000660', name: 'SK하이닉스', enabled: true, allocation_pct: 50 },
            { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 30 },
          ],
        },
      },
      { status: 200 }
    );
  }
}

// POST: 설정 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as any;
    const config = body;

    const pool = await connectPostgres();
    const config_json = JSON.stringify(config, null, 2);

    await pool.query(
      'INSERT INTO config_backup (id, config_json) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET config_json=$1',
      [config_json]
    );

    await pool.end();

    return NextResponse.json({
      success: true,
      message: '설정이 저장되었습니다',
    });
  } catch (error) {
    console.error('❌ 설정 저장 실패:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
