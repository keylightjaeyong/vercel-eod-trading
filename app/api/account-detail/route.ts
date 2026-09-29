import { NextRequest, NextResponse } from 'next/server';
import { KISApi } from '@/lib/kis/api';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  try {
    const kis = new KISApi();
    kis.updateEnv();

    console.log('📊 계좌 상세 정보 조회 중...');

    // 1. 계좌 잔액 조회 (CTRP6548R)
    const accountData = await kis.getAccount();
    console.log('✅ getAccount() 완료:', JSON.stringify(accountData, null, 2));

    // 2. 주식잔고조회 (TTTC8434R) - 더 자세한 정보
    const balanceData = await kis.getBalance();
    console.log('✅ getBalance() 완료:', JSON.stringify(balanceData, null, 2));

    return NextResponse.json({
      success: true,
      data: {
        account: accountData,
        balance: balanceData,
        summary: {
          description: '계좌 상세 정보',
          account_balance: accountData.balance,
          account_evaluating: accountData.evaluating,
          account_profit_loss: accountData.profit_loss,
          holdings_count: balanceData.holdings.length,
          total_asset: balanceData.tot_asst_amt,
          dnca_tot_amt: balanceData.dnca_tot_amt,
          evlu_amt_smtl: balanceData.evlu_amt_smtl,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ 계좌 조회 실패:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.response?.data || {},
      },
      { status: 500 }
    );
  }
}
