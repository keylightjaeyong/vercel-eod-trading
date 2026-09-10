import { NextRequest, NextResponse } from 'next/server';

async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  return pool;
}

// POST: 테스트 모드 토글
export async function POST(req: NextRequest) {
  try {
    const pool = await connectPostgres();

    // 현재 설정 조회
    const result = await pool.query('SELECT config_json FROM config_backup WHERE id = 1');

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '설정이 없습니다' },
        { status: 404 }
      );
    }

    const config = JSON.parse(result.rows[0].config_json);

    // test_mode 토글
    config.global_settings.test_mode = !config.global_settings.test_mode;

    // 저장
    const config_json = JSON.stringify(config, null, 2);
    await pool.query(
      'UPDATE config_backup SET config_json=$1 WHERE id=1',
      [config_json]
    );

    await pool.end();

    return NextResponse.json({
      success: true,
      message: `테스트 모드가 ${config.global_settings.test_mode ? '활성화' : '비활성화'}되었습니다`,
      test_mode: config.global_settings.test_mode,
    });
  } catch (error) {
    console.error('❌ 토글 실패:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
