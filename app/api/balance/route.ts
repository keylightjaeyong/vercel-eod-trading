import { NextRequest, NextResponse } from 'next/server';
import { getKisApi } from '@/lib/kis/api';

export async function GET(request: NextRequest) {
  try {
    const kisApi = getKisApi();
    const balance = await kisApi.getBalance();

    return NextResponse.json({
      success: true,
      data: balance,
    });
  } catch (error: any) {
    console.error('Balance API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to get balance',
      },
      { status: error?.response?.status || 500 }
    );
  }
}
