import { NextRequest, NextResponse } from 'next/server';
import { KISApi } from '@/lib/kis/api';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/cron/refresh-token
 * 매일 6시간마다 KIS Access Token 갱신
 * (KIS 정책: 토큰 유효기간 1일, 갱신 가능 6시간 초과)
 */
export async function POST(req: NextRequest) {
  const timeInfo = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`🔄 토큰 갱신 시작 - ${timeInfo}`);

  try {
    const kis = new KISApi();
    kis.updateEnv();

    // 새 토큰 요청 (기존 토큰 무시하고 강제 갱신)
    console.log('📝 새 Access Token 요청 중...');
    const token = await kis.getToken();

    if (token) {
      console.log(`✅ 토큰 갱신 성공: ${new Date().toISOString()}`);
      return NextResponse.json({
        success: true,
        message: '토큰 갱신 완료',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error(`❌ 토큰 갱신 실패:`, error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
