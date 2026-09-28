import { NextRequest, NextResponse } from 'next/server';
import { KISApi } from '@/lib/kis/api';
import { getPostgresPool } from '@/lib/db/pool';

/**
 * /api/fulltime/status
 * 프론트엔드에서 거래 상태 조회
 * KIS API에서 실제 잔고 조회 + DB에서 설정 읽기 + 거래 활성화 상태 조회
 */

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  try {
    const pool = getPostgresPool();

    // 1. KIS API에서 실제 잔고 조회
    let total_capital = 300000;
    let timestamp = new Date().toISOString();

    try {
      const kis = new KISApi();
      kis.updateEnv();

      console.log('📊 KIS API에서 계좌 정보 조회 중...');
      const accountData = await kis.getAccount();

      // 현금 잔고만 사용 (평가금액 제외)
      total_capital = accountData.balance;
      console.log(`✅ KIS API 조회 성공: ${total_capital.toLocaleString()}원 (현금: ${accountData.balance.toLocaleString()}원 + 평가: ${accountData.evaluating.toLocaleString()}원)`);
    } catch (kisError: any) {
      console.warn(`⚠️ KIS API 조회 실패: ${kisError.message}, 기본값 사용`);

      // KIS 실패 시 DB에서 읽기
      try {
        const result = await pool.query(
          'SELECT timestamp, total_capital FROM trading_status WHERE id = 1'
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          timestamp = row.timestamp || timestamp;
          total_capital = row.total_capital || 300000;
          console.log(`✅ DB에서 잔고 조회: ${total_capital.toLocaleString()}원`);
        }
      } catch (dbError) {
        console.log('⚠️ DB 조회도 실패, 기본값 사용');
      }
    }

    // 2. 활성화된 종목 수 조회
    let stocks_enabled = 0;
    try {
      const stocksResult = await pool.query(
        'SELECT COUNT(*) as count FROM stocks WHERE enabled = true'
      );
      stocks_enabled = parseInt(stocksResult.rows[0]?.count) || 0;
      console.log(`📊 활성화된 종목: ${stocks_enabled}개`);
    } catch (e) {
      console.log('⚠️ 종목 조회 실패:', e);
    }

    // 3. 거래 기록에서 보유 포지션 계산
    let active_positions = 0;
    try {
      const positionsResult = await pool.query(
        'SELECT COUNT(DISTINCT code) as count FROM trade_history WHERE action = \'BUY\' AND code NOT IN (SELECT code FROM trade_history WHERE action = \'SELL\' ORDER BY created_at DESC)'
      );
      active_positions = parseInt(positionsResult.rows[0]?.count) || 0;
      console.log(`💼 보유 포지션: ${active_positions}개`);
    } catch (e) {
      console.log('⚠️ 포지션 조회 실패:', e);
    }

    // 4. 거래 활성화 상태 조회
    let trading_enabled = true;
    let stopped_at = null;
    let stopped_reason = null;
    try {
      const statusResult = await pool.query(
        'SELECT trading_enabled, stopped_at, stopped_reason FROM trading_status WHERE id = 1'
      );
      if (statusResult.rows.length > 0) {
        const status = statusResult.rows[0];
        trading_enabled = status.trading_enabled;
        stopped_at = status.stopped_at;
        stopped_reason = status.stopped_reason;
        console.log(`🚦 거래 상태: ${trading_enabled ? '활성화' : '중단'}`);
      }
    } catch (e) {
      console.log('⚠️ 거래 상태 조회 실패:', e);
    }

    // 5. 일일 손익 계산
    let daily_pnl = {
      date: new Date().toISOString().split('T')[0],
      trades: 0,
      profit_pct: 0.0,
      profit_amount: 0,
      win_rate: 0.0,
    };
    try {
      const today = new Date().toISOString().split('T')[0];
      const tradesResult = await pool.query(
        `SELECT COUNT(*) as count FROM trade_history WHERE DATE(created_at) = $1`,
        [today]
      );
      daily_pnl.trades = parseInt(tradesResult.rows[0]?.count) || 0;
      console.log(`📈 오늘 거래: ${daily_pnl.trades}건`);
    } catch (e) {
      console.log('⚠️ 거래 기록 조회 실패:', e);
    }

    const statusData = {
      timestamp,
      enabled: trading_enabled,
      trading_enabled,
      stopped_at,
      stopped_reason,
      test_mode: false,
      total_capital: parseInt(total_capital.toString()),
      active_positions,
      stocks_enabled,
      daily_pnl,
      monthly_profit: 0,
    };

    return NextResponse.json(
      {
        success: true,
        data: statusData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Status 조회 실패:', error);

    return NextResponse.json(
      {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          enabled: true,
          trading_enabled: true,
          stopped_at: null,
          stopped_reason: null,
          test_mode: false,
          total_capital: 300000,
          active_positions: 0,
          stocks_enabled: 0,
          daily_pnl: {
            date: new Date().toISOString().split('T')[0],
            trades: 0,
            profit_pct: 0.0,
            profit_amount: 0,
            win_rate: 0.0,
          },
          monthly_profit: 0,
        },
      },
      { status: 200 }
    );
  }
}
