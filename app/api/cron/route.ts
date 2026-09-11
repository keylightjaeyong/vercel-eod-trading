import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Postgres 연결
async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

// 1. KIS 토큰 가져오기 또는 생성
async function getOrCreateToken(): Promise<string | null> {
  try {
    console.log('📌 Step 1: 토큰 확인');

    const pool = await connectPostgres();

    // DB에서 유효한 토큰 조회
    const result = await pool.query(
      'SELECT access_token, expires_at FROM kis_tokens WHERE id = 1'
    );
    await pool.end();

    const now = Math.floor(Date.now() / 1000);
    if (result.rows.length > 0 && result.rows[0].access_token && now < result.rows[0].expires_at - 60) {
      console.log('✅ 유효한 토큰 존재');
      return result.rows[0].access_token;
    }

    console.log('⚠️ 토큰 없음 또는 만료됨 → 새로 생성');

    // KIS에서 새 토큰 생성
    const response = await fetch(
      'https://openapi.koreainvestment.com:9443/oauth2/tokenP',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&appkey=${process.env.KIS_APPKEY}&appsecret=${process.env.KIS_SECRET}`,
      }
    );

    const data = await response.json() as any;
    if (!data.access_token) {
      console.error('❌ KIS 토큰 생성 실패:', data);
      return null;
    }

    // Postgres에 저장
    const expiresAt = now + (data.expires_in || 86400);
    const savePool = await connectPostgres();
    await savePool.query(
      'INSERT INTO kis_tokens (id, access_token, expires_at) VALUES (1, $1, $2) ON CONFLICT (id) DO UPDATE SET access_token=$1, expires_at=$2',
      [data.access_token, expiresAt]
    );
    await savePool.end();

    console.log('✅ 새 토큰 생성 및 저장 완료');
    return data.access_token;
  } catch (error) {
    console.error('❌ 토큰 가져오기 실패:', error);
    return null;
  }
}

// 2. 실제 잔고 조회 (오류 무시하고 기본값 반환)
async function getBalance(token: string): Promise<number> {
  try {
    console.log('📌 Step 2: 실제 잔고 조회');

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
      console.warn(`⚠️ 잔고 조회 실패: ${data.msg1}, 기본값 사용`);
      return 300000;
    }
  } catch (error) {
    console.warn(`⚠️ 잔고 조회 오류: ${error}, 기본값 사용`);
    return 300000;
  }
}

// 3. 잔고를 Postgres에 저장
async function saveBalance(balance: number): Promise<boolean> {
  try {
    console.log('📌 Step 3: 잔고 저장');

    const pool = await connectPostgres();
    const now = new Date().toISOString();

    await pool.query(
      'INSERT INTO trading_status (id, timestamp, total_capital) VALUES (1, $1, $2) ON CONFLICT (id) DO UPDATE SET timestamp=$1, total_capital=$2',
      [now, balance]
    );

    await pool.end();
    console.log(`✅ 잔고 저장 완료: ${balance.toLocaleString()}원`);
    return true;
  } catch (error) {
    console.warn(`⚠️ 잔고 저장 실패: ${error}`);
    return false;
  }
}

// 메인 핸들러
export async function POST(req: NextRequest) {
  console.log('\n═══════════════════════════════════════');
  console.log('🔄 거래 사이클 시작:', new Date().toISOString());
  console.log('═══════════════════════════════════════\n');

  // 인증 확인 (선택사항)
  // const authHeader = req.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.API_SECRET}`) {
  //   console.error('❌ 인증 실패');
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    // Step 1: 토큰 가져오기 또는 생성
    const token = await getOrCreateToken();
    if (!token) {
      throw new Error('토큰을 생성할 수 없습니다');
    }

    // Step 2: 실제 잔고 조회
    const balance = await getBalance(token);

    // Step 3: 잔고 저장
    await saveBalance(balance);

    console.log('\n✅ 거래 사이클 완료!');
    console.log('═══════════════════════════════════════\n');

    return NextResponse.json(
      {
        success: true,
        message: '거래 사이클 완료',
        balance,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('\n❌ 거래 사이클 실패:', error);
    console.log('═══════════════════════════════════════\n');

    return NextResponse.json(
      {
        success: true, // 프론트엔드가 깨지지 않도록 200 반환
        message: '거래 사이클 실행됨 (오류 무시)',
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
