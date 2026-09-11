import { NextRequest, NextResponse } from 'next/server';

async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

// GET: 설정 조회
export async function GET(req: NextRequest) {
  try {
    // 환경변수에서 거래 활성화 상태 확인
    const tradingEnabled = process.env.TRADING_ENABLED !== 'false';

    console.log(`🔌 DATABASE_URL 확인: ${process.env.DATABASE_URL ? '있음' : '없음'}`);
    const pool = await connectPostgres();

    try {
      console.log('📖 DB에서 설정 조회 중...');
      const result = await pool.query('SELECT config_json FROM trading_config WHERE id = 1');
      console.log(`✅ 데이터 조회: ${result.rows.length}행`);
      await pool.end();

      if (result.rows.length > 0) {
        const config = JSON.parse(result.rows[0].config_json);
        return NextResponse.json({
          success: true,
          data: {
            ...config,
            global_settings: {
              ...config.global_settings,
              enabled: tradingEnabled,
            },
          },
        });
      }
    } catch (dbError: any) {
      console.log('⚠️ DB 조회 실패, 기본값 반환:', dbError.message);
      await pool.end();
    }

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
          enabled: tradingEnabled,
        },
        stocks: [
          { code: '000660', name: 'SK하이닉스', enabled: true, allocation_pct: 50 },
          { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 30 },
        ],
      },
    });
  } catch (error) {
    console.error('❌ 설정 조회 실패:', error);
    const tradingEnabled = process.env.TRADING_ENABLED !== 'false';
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
          enabled: tradingEnabled,
        },
        stocks: [
          { code: '000660', name: 'SK하이닉스', enabled: true, allocation_pct: 50 },
          { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 30 },
        ],
      },
    });
  }
}

// POST: 설정 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 환경변수에서 거래 활성화 상태 확인
    const tradingEnabled = process.env.TRADING_ENABLED !== 'false';

    // enabled는 환경변수에서만 제어, 저장되는 값에는 무시
    const bodyToSave = {
      ...body,
      global_settings: {
        ...body.global_settings,
        enabled: tradingEnabled,
      },
    };

    console.log('💾 설정 저장 시도:', { enabled: tradingEnabled });

    // DB 저장 시도
    let dbSaved = false;
    try {
      console.log('🔌 DB 연결 중...');
      const pool = await connectPostgres();
      const config_json = JSON.stringify(bodyToSave, null, 2);
      console.log('✅ DB 연결 성공, 쿼리 실행 중...');

      try {
        // 기존 데이터 삭제
        console.log('📝 DELETE 실행 중...');
        await pool.query('DELETE FROM trading_config WHERE id = 1');
        console.log('✅ DELETE 완료');

        // 새 데이터 삽입
        console.log('📝 INSERT 실행 중...');
        await pool.query(
          'INSERT INTO trading_config (id, config_json, updated_at) VALUES (1, $1, NOW())',
          [config_json]
        );
        console.log('✅ INSERT 완료');

        dbSaved = true;
        console.log('✅ DB에 저장됨:', { enabled: body.global_settings?.enabled });
      } finally {
        console.log('🔌 DB 연결 종료 중...');
        await pool.end();
        console.log('✅ DB 연결 종료됨');
      }
    } catch (dbError: any) {
      console.error('❌ DB 저장 실패:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        severity: dbError.severity,
        position: dbError.position,
        line: dbError.line,
        routine: dbError.routine,
        file: dbError.file,
        stack: dbError.stack?.split('\n').slice(0, 3).join(' | ')
      });
    }

    if (!dbSaved) {
      console.error('❌ 데이터베이스 저장 실패 - 클라이언트에 오류 전달');
      return NextResponse.json(
        { success: false, error: 'Database save failed. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '✅ 설정이 저장되었습니다',
      data: bodyToSave,
    });
  } catch (error: any) {
    console.error('❌ 설정 저장 실패:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
