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
        const globalSettings = config.global_settings || {};
        const sellConfig = globalSettings.sell || {};

        const stocks = config.stocks || [
          { code: '000660', name: 'SK하이닉스', enabled: false, allocation_pct: 0 },
          { code: '003550', name: 'LG', enabled: false, allocation_pct: 0 },
          { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 100 },
        ];

        return NextResponse.json({
          success: true,
          data: {
            ...config,
            stocks,
            global_settings: {
              min_rise: globalSettings.min_rise ?? 0.5,
              stop_loss_pct: sellConfig.stop_loss_pct ?? 3.0,
              trailing_stop_loss_pct: sellConfig.trailing_stop_loss_pct ?? 0.2,
              test_mode: globalSettings.test_mode ?? false,
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
          min_rise: 0.5,
          stop_loss_pct: 3.0,
          trailing_stop_loss_pct: 0.2,
          test_mode: false,
          enabled: tradingEnabled,
        },
        stocks: [
          { code: '000660', name: 'SK하이닉스', enabled: false, allocation_pct: 0 },
          { code: '003550', name: 'LG', enabled: false, allocation_pct: 0 },
          { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 100 },
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
          min_rise: 0.5,
          stop_loss_pct: 3.0,
          trailing_stop_loss_pct: 0.2,
          test_mode: false,
          enabled: tradingEnabled,
        },
        stocks: [
          { code: '000660', name: 'SK하이닉스', enabled: false, allocation_pct: 0 },
          { code: '003550', name: 'LG', enabled: false, allocation_pct: 0 },
          { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 100 },
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

    // ✅ UI에서 받은 파라미터를 nested 객체로 변환
    const globalSettings = body.global_settings || {};
    const kneeShoulderConfig = {
      min_drop_pct: globalSettings.min_drop ?? 1.0,  // UI의 min_drop을 내부적으로 사용
      min_rise_pct: globalSettings.min_rise ?? 0.5,
      search_window: globalSettings.search_window ?? 10,
      confidence_threshold: globalSettings.knee_shoulder_confidence_threshold ?? 30,
      max_history_points: 30,
      trailing_stop_loss_pct: globalSettings.trailing_stop_loss_pct ?? 0.2,
      stop_loss_multiplier: 0.2,
    };

    // ✅ 손절 관련 설정
    const sellConfig = {
      stop_loss_pct: globalSettings.stop_loss_pct ?? 5.0,
      trailing_stop_loss_pct: globalSettings.trailing_stop_loss_pct ?? 0.2,
    };

    // enabled는 환경변수에서만 제어, 저장되는 값에는 무시
    const bodyToSave = {
      ...body,
      global_settings: {
        ...body.global_settings,
        enabled: tradingEnabled,
        knee_shoulder: kneeShoulderConfig,
        sell: sellConfig,
      },
    };

    console.log('💾 저장할 설정:', {
      min_drop: globalSettings.min_drop,
      stop_loss_pct: globalSettings.stop_loss_pct,
      trailing_stop_loss_pct: globalSettings.trailing_stop_loss_pct,
      confidence_threshold: globalSettings.knee_shoulder_confidence_threshold,
    });

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
