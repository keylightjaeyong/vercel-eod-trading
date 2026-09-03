import { NextRequest, NextResponse } from 'next/server';
import { kisApi } from '@/lib/kis/api';
import { telegramBot } from '@/lib/telegram/bot';

/**
 * GET /api/account - 계좌 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const account = await kisApi.getAccount();

    return NextResponse.json(
      {
        success: true,
        data: {
          account_id: account.account_id,
          balance: account.balance,
          evaluating: account.evaluating,
          profit_loss: account.profit_loss,
          profit_rate: account.profit_rate,
          total_assets: account.balance + account.evaluating,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    await telegramBot.notifyError('계좌 정보 조회 실패', errorMsg);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
