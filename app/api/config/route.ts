import { NextRequest, NextResponse } from 'next/server';
import { configStore } from '@/lib/database/config';

/**
 * GET /api/config - 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    const config = configStore.getAll();

    return NextResponse.json(
      {
        success: true,
        data: config,
      },
      { status: 200 }
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
      return NextResponse.json(
        {
          success: true,
          message: `거래가 ${body.enabled ? '활성화' : '비활성화'}되었습니다`,
        },
        { status: 200 }
      );
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
