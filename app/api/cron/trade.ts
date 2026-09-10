import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/cron/trade
 * Heroku APScheduler에서 5분마다 호출
 *
 * 동작:
 * 1. Postgres에서 토큰 로드
 * 2. KIS API 호출 (현재가, 캔들)
 * 3. 거래 신호 생성 (무릎/어깨 패턴)
 * 4. 포지션 / 거래 관리
 * 5. Postgres 저장
 */

export const runtime = 'nodejs';
export const maxDuration = 60; // 60초 제한

interface KISTokenData {
  access_token: string;
  expires_at: number;
}

interface TradeResult {
  success: boolean;
  message: string;
  trades?: any[];
  errors?: string[];
}

// Postgres 연결
async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  return pool;
}

// Postgres에서 토큰 로드
async function loadTokenFromDB(): Promise<KISTokenData | null> {
  try {
    const pool = await connectPostgres();
    const result = await pool.query(
      'SELECT access_token, expires_at FROM kis_tokens WHERE id = 1'
    );
    await pool.end();

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const now = Math.floor(Date.now() / 1000);

      // 토큰이 유효한가?
      if (row.access_token && now < row.expires_at - 60) {
        console.log(`✅ 토큰 로드: ${row.expires_at - now}초 유효`);
        return {
          access_token: row.access_token,
          expires_at: row.expires_at,
        };
      }
    }
    return null;
  } catch (error) {
    console.error('❌ 토큰 로드 실패:', error);
    return null;
  }
}

// KIS API 호출 (현재가)
async function getCurrentPrice(code: string, token: string): Promise<number> {
  try {
    const response = await fetch(
      'https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price',
      {
        method: 'GET',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'authorization': `Bearer ${token}`,
          'appkey': process.env.KIS_APPKEY!,
          'appsecret': process.env.KIS_SECRET!,
          'tr_id': 'FHKST01010100',
        },
        body: null,
      }
    );

    const data = await response.json() as any;

    if (data.rt_cd === '0') {
      const price = parseFloat(data.output.stck_prpr);
      console.log(`✅ ${code} 현재가: ${price.toLocaleString()} KRW`);
      return price;
    } else {
      console.error(`❌ 현재가 조회 실패: ${data.msg1}`);
      return 0;
    }
  } catch (error) {
    console.error(`❌ 현재가 조회 오류: ${error}`);
    return 0;
  }
}

// 데이터베이스에서 설정 로드
async function loadConfigFromDB() {
  try {
    const pool = await connectPostgres();
    const result = await pool.query(
      'SELECT config_json FROM config_backup WHERE id = 1'
    );
    await pool.end();

    if (result.rows.length > 0) {
      return JSON.parse(result.rows[0].config_json);
    }
  } catch (error) {
    console.error('❌ Config 로드 실패:', error);
  }
  return null;
}

// 거래 실행 (간단한 버전)
async function executeTrade(config: any, token: string): Promise<TradeResult> {
  const trades: any[] = [];
  const errors: string[] = [];

  try {
    const stocks = config.stocks || [];
    const enabled = config.global_settings?.enabled ?? false;

    if (!enabled) {
      return {
        success: true,
        message: '거래 비활성화됨',
        trades: [],
      };
    }

    // 각 종목별로 거래 로직 실행
    for (const stock of stocks) {
      try {
        const price = await getCurrentPrice(stock.code, token);
        if (price > 0) {
          // 여기에 실제 거래 로직 추가 가능
          console.log(`✅ ${stock.name}: 현재가 ${price} 확인`);
        }
      } catch (error) {
        errors.push(`${stock.name} 거래 실패: ${error}`);
      }
    }

    return {
      success: true,
      message: '거래 사이클 완료',
      trades,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    return {
      success: false,
      message: `거래 실행 실패: ${error}`,
    };
  }
}

// 메인 핸들러
export default async function handler(req: NextRequest) {
  console.log('🔄 거래 사이클 시작:', new Date().toISOString());

  // 요청 검증
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  // 인증 확인
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.API_SECRET}`) {
    console.error('❌ 인증 실패');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // 1. Postgres에서 토큰 로드
    const tokenData = await loadTokenFromDB();
    if (!tokenData) {
      throw new Error('토큰을 찾을 수 없습니다');
    }

    // 2. Config 로드
    const config = await loadConfigFromDB();
    if (!config) {
      throw new Error('설정을 찾을 수 없습니다');
    }

    // 3. 거래 실행
    const result = await executeTrade(config, tokenData.access_token);

    console.log('✅ 거래 사이클 완료:', result.message);

    return NextResponse.json(
      {
        success: true,
        message: '거래 사이클 완료',
        result,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ 거래 실패:', error);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
