import { NextRequest, NextResponse } from 'next/server';
import { configStore } from '@/lib/database/config';
import { getConfigValue, setConfigValue, getConfigJSON, setConfigJSON } from '@/lib/database/supabase';

/**
 * GET /api/config - 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    const config = configStore.getAll();

    // 쿠키에서 enabled 상태 확인 (가장 신뢰할 수 있는 소스)
    const cookieValue = request.cookies.get('trading_enabled')?.value;
    if (cookieValue !== undefined) {
      config.enabled = cookieValue === 'true';
      console.log('🍪 쿠키에서 상태 로드:', cookieValue);
    }

    return NextResponse.json(
      {
        success: true,
        data: config,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ GET /api/config 에러:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config - 설정 업데이트
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 전체 설정 업데이트
    if (body.action === 'update_all') {
      configStore.update(body.data);
      return NextResponse.json(
        {
          success: true,
          message: '설정이 업데이트되었습니다',
          data: configStore.getAll(),
        },
        { status: 200 }
      );
    }

    // 활성화 상태 변경
    if (body.action === 'set_enabled') {
      configStore.setEnabled(body.enabled);

      // Supabase에 상태 저장
      await setConfigValue('trading_enabled', body.enabled.toString());

      const response = NextResponse.json(
        {
          success: true,
          message: `거래가 ${body.enabled ? '활성화' : '비활성화'}되었습니다`,
          data: {
            enabled: body.enabled
          }
        },
        { status: 200 }
      );

      // 쿠키에도 상태 저장 (캐싱용)
      response.cookies.set('trading_enabled', body.enabled.toString(), {
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });

      return response;
    }

    // 종목 활성화 상태 변경
    if (body.action === 'set_stock_enabled') {
      configStore.setStockEnabled(body.code, body.enabled);
      return NextResponse.json(
        {
          success: true,
          message: `${body.code} 거래가 ${body.enabled ? '활성화' : '비활성화'}되었습니다`,
        },
        { status: 200 }
      );
    }

    // 매수 일정 업데이트
    if (body.action === 'update_buy_schedule') {
      configStore.updateBuySchedule(body.schedule);
      return NextResponse.json(
        {
          success: true,
          message: '매수 일정이 업데이트되었습니다',
        },
        { status: 200 }
      );
    }

    // 매도 조건 업데이트
    if (body.action === 'update_sell_conditions') {
      configStore.updateSellConditions(body.conditions);
      return NextResponse.json(
        {
          success: true,
          message: '매도 조건이 업데이트되었습니다',
        },
        { status: 200 }
      );
    }

    // 계좌ID 저장
    if (body.action === 'set_account_id') {
      const accountId = body.accountId?.trim();
      if (!accountId) {
        return NextResponse.json(
          {
            success: false,
            error: '계좌ID는 필수입니다',
          },
          { status: 400 }
        );
      }

      console.log('💾 계좌ID 저장 시작:', accountId);

      await setConfigValue('account_id', accountId);

      const response = NextResponse.json(
        {
          success: true,
          message: '계좌ID가 저장되었습니다',
          data: { accountId }
        },
        { status: 200 }
      );

      // 쿠키에도 저장
      response.cookies.set('kis_account_id', accountId, {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      {
        success: false,
        error: '알 수 없는 액션입니다',
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
