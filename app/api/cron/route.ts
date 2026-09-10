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

// KIS에서 새로운 토큰 생성
async function getNewToken(): Promise<KISTokenData | null> {
  try {
    console.log('🔄 KIS에서 새로운 토큰 요청 중...');
    const response = await fetch(
      'https://openapi.koreainvestment.com:9443/oauth2/tokenP',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&appkey=${process.env.KIS_APPKEY}&appsecret=${process.env.KIS_SECRET}`,
      }
    );

    const data = await response.json() as any;
    if (data.access_token) {
      const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 86400);
      console.log(`✅ 새 토큰 생성: ${expiresAt - Math.floor(Date.now() / 1000)}초 유효`);
      return { access_token: data.access_token, expires_at: expiresAt };
    }
    console.error('❌ KIS 토큰 생성 실패:', data);
    return null;
  } catch (error) {
    console.error('❌ KIS 토큰 요청 오류:', error);
    return null;
  }
}

// Postgres에 토큰 저장
async function saveTokenToDB(tokenData: KISTokenData): Promise<boolean> {
  try {
    const pool = await connectPostgres();
    await pool.query(
      'INSERT INTO kis_tokens (id, access_token, expires_at) VALUES (1, $1, $2) ON CONFLICT (id) DO UPDATE SET access_token=$1, expires_at=$2',
      [tokenData.access_token, tokenData.expires_at]
    );
    await pool.end();
    console.log('✅ 토큰 저장 완료');
    return true;
  } catch (error) {
    console.error('❌ 토큰 저장 실패:', error);
    return false;
  }
}

// Postgres에서 토큰 로드 (없으면 자동 생성)
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

      if (row.access_token && now < row.expires_at - 60) {
        console.log(`✅ 토큰 로드: ${row.expires_at - now}초 유효`);
        return { access_token: row.access_token, expires_at: row.expires_at };
      }
    }

    // 토큰 없음 → 새로 생성
    console.log('⚠️ 저장된 토큰 없음 → KIS에서 새로 생성');
    const newToken = await getNewToken();
    if (newToken) {
      await saveTokenToDB(newToken);
      return newToken;
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

// KIS API 호출 (실제 잔고)
async function getBalance(token: string): Promise<number> {
  try {
    const account = process.env.KIS_ACCOUNT || '55049812';
    const cano = account.substring(0, 8);
    const acntPrdtCd = account.substring(8, 10);

    const url = new URL('https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/trading/inquire-balance');
    url.searchParams.append('CANO', cano);
    url.searchParams.append('ACNT_PRDT_CD', acntPrdtCd);
    url.searchParams.append('AFHR_FLPR_YN', 'N');
    url.searchParams.append('OFL_YN', '');
    url.searchParams.append('INQR_DVSN', '02');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'authorization': `Bearer ${token}`,
        'appkey': process.env.KIS_APPKEY!,
        'appsecret': process.env.KIS_SECRET!,
        'tr_id': 'TTTC8434R',
      },
    });

    const data = await response.json() as any;
    if (data.rt_cd === '0' && data.output2) {
      const cash = data.output2[0]?.dnca_tot_amt || '0';
      const balance = parseInt(cash, 10);
      console.log(`✅ 실제 잔고: ${balance.toLocaleString()} KRW`);
      return balance;
    } else {
      console.error(`❌ 잔고 조회 실패: ${data.msg1 || JSON.stringify(data)}`);
      return 0;
    }
  } catch (error) {
    console.error(`❌ 잔고 조회 오류: ${error}`);
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

// 실제 잔고를 Postgres에 저장
async function saveStatusToDB(balance: number): Promise<boolean> {
  try {
    const pool = await connectPostgres();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO trading_status (id, timestamp, total_capital) VALUES (1, $1, $2) ON CONFLICT (id) DO UPDATE SET timestamp=$1, total_capital=$2',
      [now, balance]
    );
    await pool.end();
    console.log(`✅ 상태 저장: 잔고 ${balance.toLocaleString()}원`);
    return true;
  } catch (error) {
    console.error('❌ 상태 저장 실패:', error);
    return false;
  }
}

// 거래 실행 (간단한 버전)
async function executeTrade(config: any, token: string): Promise<TradeResult> {
  const trades: any[] = [];
  const errors: string[] = [];

  try {
    const stocks = config.stocks || [];
    const enabled = config.global_settings?.enabled ?? false;

    // 실제 잔고 조회 (거래 활성화 여부와 무관하게)
    try {
      const balance = await getBalance(token);
      if (balance > 0) {
        await saveStatusToDB(balance);
      }
    } catch (e) {
      console.error('⚠️ 잔고 조회 오류 (무시):', e);
      // 잔고 조회 실패해도 계속 진행
    }

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
export async function POST(req: NextRequest) {
  console.log('🔄 거래 사이클 시작:', new Date().toISOString());

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
    console.log('📌 Step 1: 토큰 로드 중...');
    const tokenData = await loadTokenFromDB();
    if (!tokenData) {
      console.error('❌ 토큰 없음');
      throw new Error('토큰을 찾을 수 없습니다');
    }
    console.log('✅ 토큰 로드 완료');

    // 2. Config 로드
    console.log('📌 Step 2: Config 로드 중...');
    const config = await loadConfigFromDB();
    if (!config) {
      console.error('❌ Config 없음');
      throw new Error('설정을 찾을 수 없습니다');
    }
    console.log('✅ Config 로드 완료');

    // 3. 거래 실행
    console.log('📌 Step 3: 거래 실행 중...');
    const result = await executeTrade(config, tokenData.access_token);
    console.log('✅ 거래 실행 완료:', result.message);

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
    console.error('Stack:', (error as Error).stack);

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
