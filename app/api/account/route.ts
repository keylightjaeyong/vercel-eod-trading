import { NextRequest, NextResponse } from 'next/server';
import { kisApi } from '@/lib/kis/api';
import { telegramBot } from '@/lib/telegram/bot';

/**
 * GET /api/account - 계좌 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 환경변수 확인
    const hasAppKey = !!process.env.KIS_APPKEY;
    const hasSecret = !!process.env.KIS_SECRET;

    console.log('📋 KIS 환경변수 상태:', {
      appkey: hasAppKey ? '✅' : '❌',
      secret: hasSecret ? '✅' : '❌'
    });

    if (!hasAppKey || !hasSecret) {
      return NextResponse.json(
        {
          success: false,
          error: '❌ KIS API 환경변수가 설정되지 않았습니다',
          details: {
            appkey: hasAppKey,
            secret: hasSecret
          }
        },
        { status: 400 }
      );
    }

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
    console.error('❌ 계좌 조회 에러:', errorMsg);

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
