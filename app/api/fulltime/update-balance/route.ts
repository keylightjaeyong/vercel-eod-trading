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

/**
 * POST /api/fulltime/update-balance
 * KIS API에서 실제 현금 잔고를 조회하고 DB에 저장
 */
export async function POST(req: NextRequest) {
  try {
    console.log('📊 KIS API에서 현금 잔고 조회 중...');

    const kis = new KISApi();
    kis.updateEnv();

    // KIS API 호출
    const accountData = await kis.getAccount();

    const cashBalance = accountData.balance;
    const evaluatingAmount = accountData.evaluating;
    const totalAsset = cashBalance + evaluatingAmount;

    console.log('✅ KIS API 조회 성공:');
    console.log(`  - 현금 잔고: ${cashBalance.toLocaleString()}원`);
    console.log(`  - 평가금액: ${evaluatingAmount.toLocaleString()}원`);
    console.log(`  - 총 자산: ${totalAsset.toLocaleString()}원`);

    // DB에 저장
    const pool = await connectPostgres();

    try {
      await pool.query(
        `UPDATE trading_status SET total_capital = $1, timestamp = NOW() WHERE id = 1`,
        [cashBalance]
      );

      console.log(`💾 DB 저장 완료: ${cashBalance.toLocaleString()}원`);
    } finally {
      await pool.end();
    }

    return NextResponse.json({
      success: true,
      message: '현금 잔고가 업데이트되었습니다',
      data: {
        cash_balance: cashBalance,
        evaluating_amount: evaluatingAmount,
        total_asset: totalAsset,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ 잔고 업데이트 실패:', error.message);

    return NextResponse.json(
      {
        success: false,
        error: error.message || '잔고 조회 실패',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
