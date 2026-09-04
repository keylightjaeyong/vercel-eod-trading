import { NextRequest, NextResponse } from 'next/server';
import { getKisApi } from '@/lib/kis/api';

export async function GET(request: NextRequest) {
  try {
    const kisApi = getKisApi();
    const holdings = await kisApi.getHoldings();

    return NextResponse.json({
      success: true,
      data: holdings,
    });
  } catch (error: any) {
    console.error('Holdings API error:', error);

    // 권한 부족 에러
    if (error.message?.includes('권한')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          requiresAuth: true,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to get holdings',
      },
      { status: error?.response?.status || 500 }
    );
  }
}
