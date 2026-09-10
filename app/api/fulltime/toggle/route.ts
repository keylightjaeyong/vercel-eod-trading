import { NextRequest, NextResponse } from 'next/server';

async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  return pool;
}

export async function POST(req: NextRequest) {
  try {
    const pool = await connectPostgres();

    const result = await pool.query('SELECT config_json FROM config_backup WHERE id = 1');
    if (result.rows.length === 0) {
      await pool.end();
      return NextResponse.json({ success: false, error: '설정 없음' }, { status: 404 });
    }

    const config = JSON.parse(result.rows[0].config_json);
    config.global_settings.test_mode = !config.global_settings.get('test_mode', false);

    const config_json = JSON.stringify(config, null, 2);
    await pool.query('UPDATE config_backup SET config_json=$1 WHERE id=1', [config_json]);

    await pool.end();

    return NextResponse.json({
      success: true,
      message: `테스트 모드: ${config.global_settings.test_mode}`,
      test_mode: config.global_settings.test_mode,
    });
  } catch (error) {
    console.error('❌ 토글 실패:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
