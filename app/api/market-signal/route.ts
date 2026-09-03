import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { telegramBot } from '@/lib/telegram/bot';
import { configStore } from '@/lib/database/config';

interface MarketData {
  nasdaq_change: number;
  sp500_change: number;
  usdkrw_rate: number;
  oil_price: number;
  signal: boolean;
}

/**
 * GET /api/market-signal - 미국 시장 신호 분석
 * 매일 15:40에 자동으로 실행됨
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const config = configStore.getAll();
    const usConfig = config.buy.us_market_signal;

    // 외부 API에서 미국 시장 데이터 조회
    // 참고: 실제 환경에서는 Alpha Vantage, IEX Cloud 등의 API 사용
    // 데모용으로는 하드코딩된 값 사용
    const marketData = await analyzeMarketSignal(usConfig);

    const analysis = `
📊 *미국 시장 신호 분석* (15:40)

🔴 나스닥: ${marketData.nasdaq_change > 0 ? '+' : ''}${marketData.nasdaq_change.toFixed(2)}% ${marketData.nasdaq_change >= usConfig.nasdaq_threshold ? '✅ 상승 신호' : '❌'}
🔴 S&P500: ${marketData.sp500_change > 0 ? '+' : ''}${marketData.sp500_change.toFixed(2)}% ${marketData.sp500_change >= usConfig.sp500_threshold ? '✅ 상승 신호' : '❌'}
💵 환율(USD/KRW): ${marketData.usdkrw_rate.toFixed(0)}원 ${marketData.usdkrw_rate >= usConfig.usdkrw_min && marketData.usdkrw_rate <= usConfig.usdkrw_max ? '✅ 정상 범위' : '⚠️ 범위 이탈'}
🛢️ 유가(WTI): $${marketData.oil_price.toFixed(2)} ${marketData.oil_price >= usConfig.oil_min && marketData.oil_price <= usConfig.oil_max ? '✅ 정상 범위' : '⚠️ 범위 이탈'}

📈 *종합 판정: ${marketData.signal ? '✅ GO - 매수 진행' : '❌ HOLD - 관망'}*
    `;

    // 텔레그램으로 분석 결과 알림
    await telegramBot.notifyInfo('미국 시장 신호', analysis);

    return NextResponse.json(
      {
        success: true,
        message: '미국 시장 신호 분석 완료',
        data: {
          nasdaq_change: marketData.nasdaq_change,
          sp500_change: marketData.sp500_change,
          usdkrw_rate: marketData.usdkrw_rate,
          oil_price: marketData.oil_price,
          signal: marketData.signal,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    await telegramBot.notifyError('미국 시장 신호 분석 실패', errorMsg);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}

/**
 * 미국 시장 신호 분석
 */
async function analyzeMarketSignal(usConfig: any): Promise<MarketData> {
  try {
    // Alpha Vantage API를 사용하면 좋지만, 여기서는 데모용으로 임의의 값 사용
    // 실제 환경에서는 여기에 실제 API 호출 추가

    // 임시 데이터 (실제로는 API에서 받아야 함)
    const nasdaq_change = 1.2;
    const sp500_change = 0.8;
    const usdkrw_rate = 1280;
    const oil_price = 95.5;

    // 신호 판정
    const signal =
      nasdaq_change >= usConfig.nasdaq_threshold &&
      sp500_change >= usConfig.sp500_threshold &&
      usdkrw_rate >= usConfig.usdkrw_min &&
      usdkrw_rate <= usConfig.usdkrw_max &&
      oil_price >= usConfig.oil_min &&
      oil_price <= usConfig.oil_max;

    return {
      nasdaq_change,
      sp500_change,
      usdkrw_rate,
      oil_price,
      signal,
    };
  } catch (error) {
    console.error('시장 신호 분석 실패:', error);
    throw error;
  }
}
