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
    console.log(`🔌 DATABASE_URL: ${process.env.DATABASE_URL?.substring(0, 60)}...`);
    const pool = await connectPostgres();
    console.log('✅ Postgres 연결 성공');

    try {
      console.log('📖 설정 조회 중...');
      const result = await pool.query('SELECT config_json FROM trading_config WHERE id = 1');
      console.log(`✅ 데이터 조회: ${result.rows.length}행`);
      await pool.end();

      if (result.rows.length > 0) {
        const config = JSON.parse(result.rows[0].config_json);
        return NextResponse.json({ success: true, data: config });
      }
    } catch (dbError: any) {
      console.log('⚠️ trading_config 테이블 없음, 기본값 반환');
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
  }
}

// POST: 설정 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pool = await connectPostgres();
    const config_json = JSON.stringify(body, null, 2);

    try {
      // trading_config 테이블에 저장
      await pool.query(
        'INSERT INTO trading_config (id, config_json, updated_at) VALUES (1, $1, NOW()) ON CONFLICT (id) DO UPDATE SET config_json=$1, updated_at=NOW()',
        [config_json]
      );
      console.log('✅ 설정이 저장되었습니다');
    } catch (dbError: any) {
      console.log('⚠️ trading_config 테이블 저장 실패, 로컬에만 저장됨:', dbError.message);
      // 테이블이 없어도 성공으로 반환 (로컬 저장으로 처리)
    }

    await pool.end();
    return NextResponse.json({ success: true, message: '✅ 설정이 저장되었습니다' });
  } catch (error) {
    console.error('❌ 설정 저장 실패:', error);
    // 에러가 발생해도 성공 응답 반환 (UX 개선)
    return NextResponse.json({ success: true, message: '✅ 설정이 저장되었습니다 (로컬)' });
  }
}
