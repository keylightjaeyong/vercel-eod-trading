import { NextRequest, NextResponse } from 'next/server';
import { KISApi } from '@/lib/kis/api';

async function connectPostgres() {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

// GET: 할당 데이터 조회
export async function GET(req: NextRequest) {
  try {
    // 1. KIS API에서 실제 잔고 조회
    let total_capital = 300000;

    try {
      const kis = new KISApi();
      kis.updateEnv();

      console.log('📊 KIS API에서 계좌 정보 조회 중...');
      const accountData = await kis.getAccount();

      // 현금 잔고만 사용 (평가금액 제외)
      total_capital = accountData.balance;
      console.log(`✅ KIS API 조회 성공: ${total_capital.toLocaleString()}원`);
    } catch (kisError: any) {
      const errorMsg = kisError.message || String(kisError);
      const errorDetail = kisError?.response?.data?.msg || '';
      console.warn(`⚠️ KIS API 조회 실패: ${errorMsg}${errorDetail ? ` (상세: ${errorDetail})` : ''}`);
      console.log(`💡 현재는 기본값 300,000원 사용. 실제 잔고는 KIS 포탈에서 확인하세요.`);

      // 토큰 만료 에러이면 DB 토큰 삭제 및 강제 갱신 시도
      const isTokenError = errorMsg?.includes('token') || errorDetail?.includes('token');
      if (isTokenError) {
        try {
          console.log('🔄 토큰 강제 갱신 절차:');

          // 1) DB의 만료된 토큰 삭제
          console.log('  1️⃣ DB의 만료된 토큰 삭제...');
          const { Pool } = await import('pg');
          const dbPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
          });

          await dbPool.query('DELETE FROM kis_tokens WHERE id = 1');
          await dbPool.end();
          console.log('  ✅ DB 토큰 삭제 완료');

          // 2) 새 토큰 강제 발급
          console.log('  2️⃣ 새 토큰 발급 요청...');
          const kis2 = new KISApi();
          kis2.updateEnv();
          await kis2.getToken(true);
          console.log('  ✅ 토큰 강제 갱신 완료 (다음 요청부터 적용)');
        } catch (e: any) {
          console.error('❌ 토큰 강제 갱신 실패:', e.message || e);
        }
      }
    }

    const pool = await connectPostgres();

    const result = await pool.query('SELECT code, name, allocation_pct FROM stocks WHERE enabled=true ORDER BY allocation_pct DESC');
    await pool.end();

    const allocations: Record<string, any> = {};

    // KIS API에서 가격 조회
    for (const row of result.rows) {
      const pct = typeof row.allocation_pct === 'string'
        ? parseFloat(row.allocation_pct)
        : (row.allocation_pct || 0);

      const amount = Math.round((total_capital * Number(pct || 0)) / 100);
      let current_price = 0;
      let possible_quantity = 0;

      // KIS API에서 현재가 조회
      try {
        const kis = new KISApi();
        kis.updateEnv();
        const priceData = await kis.getPrice(row.code, 'NX');
        current_price = priceData.current;

        // 구매 가능 수량 = 할당금액 / 현재가
        if (current_price > 0) {
          possible_quantity = Math.floor(amount / current_price);
        }

        console.log(`📊 [${row.name}] 현재가: ${current_price}원, 구매가능: ${possible_quantity}주`);
      } catch (e) {
        console.log(`⚠️ [${row.name}] 가격 조회 실패: ${e instanceof Error ? e.message : String(e)}`);
      }

      allocations[row.code] = {
        name: row.name,
        pct: Number(pct) || 0,
        amount,
        current_price,
        possible_quantity,
      };
    }

    if (Object.keys(allocations).length === 0) {
      const defaultStocks = [
        { code: '000660', name: 'SK하이닉스', pct: 50 },
        { code: '005930', name: '삼성전자', pct: 30 },
      ];

      for (const stock of defaultStocks) {
        const amount = Math.round((total_capital * stock.pct) / 100);
        let current_price = 0;
        let possible_quantity = 0;

        try {
          const kis = new KISApi();
          kis.updateEnv();
          const priceData = await kis.getPrice(stock.code, 'NX');
          current_price = priceData.current;
          if (current_price > 0) {
            possible_quantity = Math.floor(amount / current_price);
          }
        } catch (e) {
          console.log(`⚠️ [${stock.name}] 가격 조회 실패`);
        }

        allocations[stock.code] = {
          name: stock.name,
          pct: stock.pct,
          amount,
          current_price,
          possible_quantity,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: { total_capital, allocations },
    });
  } catch (error) {
    console.error('❌ 할당 조회 실패:', error);

    const total_capital = 300000;
    return NextResponse.json({
      success: true,
      data: {
        total_capital,
        allocations: {
          '000660': {
            name: 'SK하이닉스',
            pct: 50,
            amount: Math.round((total_capital * 50) / 100),
            current_price: 0,
            possible_quantity: 0,
          },
          '005930': {
            name: '삼성전자',
            pct: 30,
            amount: Math.round((total_capital * 30) / 100),
            current_price: 0,
            possible_quantity: 0,
          },
        },
      },
    });
  }
}

// POST: 할당 저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { allocations } = body;

    const pool = await connectPostgres();

    for (const [code, value] of Object.entries(allocations)) {
      // allocations는 { code: percentage } 형태
      const pct = typeof value === 'object' ? (value as any).pct : Number(value);
      console.log(`💾 저장: ${code} = ${pct}%`);

      await pool.query('UPDATE stocks SET allocation_pct=$1 WHERE code=$2', [pct, code]);
    }

    await pool.end();

    return NextResponse.json({ success: true, message: '할당이 저장되었습니다' });
  } catch (error) {
    console.error('❌ 할당 저장 실패:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
