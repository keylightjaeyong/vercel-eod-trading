import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import { getKisApi } from '@/lib/kis/api';
import { telegramBot } from '@/lib/telegram/bot';
import { configStore } from '@/lib/database/config';

interface Position {
  date: string;
  stock: string;
  phase: number;
  entry_time: string;
  entry_price: number;
  quantity: number;
  entry_amount: number;
  market: string;
  timestamp: string;
}

interface Exit {
  timestamp: string;
  exit_time: string;
  stock: string;
  exit_price: number;
  quantity: number;
  exit_amount: number;
  profit_loss: number;
  profit_rate: number;
  reason: string;
}

const POSITIONS_FILE = '/tmp/positions.json';
const EXITS_FILE = '/tmp/exits.json';

/**
 * GET /api/sell - 자동 매도 모니터링
 * Cron: 08:00, 08:05, 08:10, ... 11:30
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const config = configStore.getAll();

    // 거래 활성화 확인
    if (!config.enabled || !config.sell.enabled) {
      return NextResponse.json(
        {
          success: true,
          message: '거래가 비활성화됨',
        },
        { status: 200 }
      );
    }

    // 현재 시간 확인
    const now = new Date();
    const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const currentTime = kstTime.toTimeString().slice(0, 5);

    console.log(`📍 매도 체크: ${currentTime}`);

    // 매도 일정 확인
    const sellSchedule = config.sell.schedule;

    // 시간 범위 확인
    const [startHour, startMin] = sellSchedule.start_time.split(':').map(Number);
    const [endHour, endMin] = sellSchedule.end_time.split(':').map(Number);
    const [currentHour, currentMin] = currentTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const currentMinutes = currentHour * 60 + currentMin;

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return NextResponse.json(
        {
          success: true,
          message: `현재 시간(${currentTime})은 매도 시간 외 (${sellSchedule.start_time}~${sellSchedule.end_time})`,
        },
        { status: 200 }
      );
    }

    // 포지션 조회
    const positions = readPositions();

    if (positions.length === 0) {
      console.log('⚠️ 보유 포지션 없음');
      return NextResponse.json(
        {
          success: true,
          message: '보유 포지션 없음',
        },
        { status: 200 }
      );
    }

    // 포지션별 손익 계산 및 매도 판정
    const results = [];

    for (const position of positions) {
      try {
        // 현재가 조회
        const kapi = getKisApi();
        const quote = await kapi.getPrice(position.stock, 'KOSPI');

        // 평단가 계산 (모든 포지션의 가중평균)
        const avgPrice = calculateAvgPrice(positions);

        // 수익률 계산
        const profitLoss = quote.current - avgPrice;
        const profitRate = (profitLoss / avgPrice) * 100;

        console.log(
          `📊 ${position.stock}: 현재가 ${quote.current}원, 평단가 ${avgPrice}원, 수익률 ${profitRate.toFixed(2)}%`
        );

        // 매도 조건 확인
        let shouldSell = false;
        let exitReason = '';

        // 1. 익절 조건 (+4%)
        if (profitRate >= config.sell.schedule.conditions[0].threshold) {
          shouldSell = true;
          exitReason = 'TAKE_PROFIT';
        }
        // 2. 손절 조건 (-2%)
        else if (profitRate <= config.sell.schedule.conditions[1].threshold) {
          shouldSell = true;
          exitReason = 'STOP_LOSS';
        }
        // 3. 강제 청산 (11:30)
        else if (currentTime === sellSchedule.end_time) {
          shouldSell = true;
          exitReason = 'TIME_END';
        }

        // 매도 실행
        if (shouldSell) {
          const totalQuantity = positions
            .filter((p) => p.stock === position.stock)
            .reduce((sum, p) => sum + p.quantity, 0);

          // KIS API로 매도 주문
          const order = await kapi.sell(position.stock, totalQuantity);

          // 매도 기록
          const exit: Exit = {
            timestamp: new Date().toISOString(),
            exit_time: currentTime,
            stock: position.stock,
            exit_price: quote.current,
            quantity: totalQuantity,
            exit_amount: quote.current * totalQuantity,
            profit_loss: (quote.current - avgPrice) * totalQuantity,
            profit_rate: profitRate,
            reason: exitReason,
          };

          saveExit(exit);

          // 텔레그램 알림
          await telegramBot.notifySell(
            position.stock,
            totalQuantity,
            quote.current,
            exit.profit_loss,
            profitRate,
            exitReason
          );

          results.push({
            stock: position.stock,
            quantity: totalQuantity,
            price: quote.current,
            profit: exit.profit_loss,
            profit_rate: profitRate,
            reason: exitReason,
            success: true,
          });

          // 포지션에서 제거
          removePosition(position.stock);
        }
      } catch (error) {
        console.error(`❌ ${position.stock} 매도 실패:`, error);

        await telegramBot.notifyError(
          `${position.stock} 매도 실패`,
          error instanceof Error ? error.message : 'Unknown error'
        );

        results.push({
          stock: position.stock,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 결과 반환
    const totalProfit = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.profit || 0), 0);

    return NextResponse.json(
      {
        success: true,
        message: `매도 모니터링 완료 (${currentTime})`,
        time: currentTime,
        total_profit: totalProfit,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    await telegramBot.notifyError('자동 매도 실패', errorMsg);

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
 * 평단가 계산
 */
function calculateAvgPrice(positions: Position[]): number {
  const totalAmount = positions.reduce((sum, p) => sum + p.entry_amount, 0);
  const totalQuantity = positions.reduce((sum, p) => sum + p.quantity, 0);

  return totalQuantity > 0 ? totalAmount / totalQuantity : 0;
}

/**
 * 매도 기록 저장
 */
function saveExit(exit: Exit): void {
  try {
    let exits: Exit[] = [];

    if (fs.existsSync(EXITS_FILE)) {
      const data = fs.readFileSync(EXITS_FILE, 'utf-8');
      exits = JSON.parse(data);
    }

    exits.push(exit);
    fs.writeFileSync(EXITS_FILE, JSON.stringify(exits, null, 2), 'utf-8');

    // CSV도 저장
    saveToCsv(exit);
  } catch (error) {
    console.error('매도 기록 저장 실패:', error);
  }
}

/**
 * CSV 저장
 */
function saveToCsv(exit: Exit): void {
  try {
    const date = new Date(exit.timestamp).toISOString().split('T')[0];
    const csvPath = `/tmp/eod_exits_${date}.csv`;

    let csvContent = '';

    if (!fs.existsSync(csvPath)) {
      csvContent =
        'timestamp,exit_time,stock,exit_price,quantity,exit_amount,profit_loss,profit_rate,reason\n';
    } else {
      csvContent = fs.readFileSync(csvPath, 'utf-8');
    }

    csvContent += `${exit.timestamp},${exit.exit_time},${exit.stock},${exit.exit_price},${exit.quantity},${exit.exit_amount},${exit.profit_loss},${exit.profit_rate},${exit.reason}\n`;

    fs.writeFileSync(csvPath, csvContent, 'utf-8');
  } catch (error) {
    console.error('CSV 저장 실패:', error);
  }
}

/**
 * 포지션 읽기
 */
function readPositions(): Position[] {
  try {
    if (fs.existsSync(POSITIONS_FILE)) {
      const data = fs.readFileSync(POSITIONS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('포지션 읽기 실패:', error);
  }

  return [];
}

/**
 * 포지션 제거
 */
function removePosition(stock: string): void {
  try {
    let positions: Position[] = [];

    if (fs.existsSync(POSITIONS_FILE)) {
      const data = fs.readFileSync(POSITIONS_FILE, 'utf-8');
      positions = JSON.parse(data);
    }

    // 해당 종목의 포지션 제거
    positions = positions.filter((p) => p.stock !== stock);

    fs.writeFileSync(POSITIONS_FILE, JSON.stringify(positions, null, 2), 'utf-8');
  } catch (error) {
    console.error('포지션 제거 실패:', error);
  }
}
