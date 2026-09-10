import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/account - 실제 KIS 계좌 잔고 조회
 * Heroku의 /api/account 엔드포인트를 프록시
 */
export async function GET(request: NextRequest) {
  try {
    // Heroku 백엔드에서 계좌 정보 조회
    const herokuUrl = new URL(
      'https://eod-trading-backend-a756b4bf06ef.herokuapp.com/api/account'
    );

    // 쿼리 파라미터 전달
    const params = request.nextUrl.searchParams;
    if (params.has('account_id')) {
      herokuUrl.searchParams.set('account_id', params.get('account_id')!);
    }

    const response = await fetch(herokuUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Heroku API error: ${response.status}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ 계좌 정보 조회 실패:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
