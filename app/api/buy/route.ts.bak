import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
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

const POSITIONS_FILE = '/tmp/positions.json';
const MARKET_SIGNAL_FILE = '/tmp/market_signal.json';

/**
 * GET /api/buy - 자동 매수 실행
 * Cron: 15:50, 19:00, 19:45
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const config = configStore.getAll();

    // 거래 활성화 확인
    if (!config.enabled || !config.buy.enabled) {
      return NextResponse.json(
        {
          success: true,
          message: '거래가 비활성화됨',
        },
        { status: 200 }
      );
    }

    // 현재 시간 확인 (한국 시간)
    const now = new Date();
    const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const currentTime = kstTime.toTimeString().slice(0, 5); // HH:MM 형식

    console.log(`📍 매수 체크: ${currentTime}`);

    // 해당하는 매수 일정 찾기
    const buySchedule = config.buy.schedule;
    const currentPhase = buySchedule.find((s: any) => s.time === currentTime);

    if (!currentPhase) {
      return NextResponse.json(
        {
          success: true,
          message: `현재 시간(${currentTime})에 해당하는 매수 일정 없음`,
        },
        { status: 200 }
      );
    }

    console.log(`🔔 Phase ${currentPhase.phase} 매수 시작 (${currentTime})`);

    // Phase 1: US 시장 신호 확인
    if (currentPhase.phase === 1 && currentPhase.us_signal_required) {
      const signal = readMarketSignal();
      if (!signal) {
        await telegramBot.notifyWarning(
          'Phase 1 매수 취소: 미국 시장 신호 미달성'
        );
        return NextResponse.json(
          {
            success: true,
            message: 'US 시장 신호 미달성으로 매수 취소',
          },
          { status: 200 }
        );
      }
    }

    // Phase 2/3: 가격 상승 조건 확인
    if (currentPhase.condition === 'price_up_5pct' || currentPhase.condition === 'price_up_8pct') {
      const threshold = currentPhase.condition === 'price_up_5pct' ? 0.05 : 0.08;
      const positions = readPositions();

      if (positions.length > 0) {
        const lastEntry = positions[positions.length - 1];
        const kisApi = getKisApi();
        const currentPrice = await kisApi.getPrice(lastEntry.stock, 'NX');

        const priceChange = (currentPrice.current - lastEntry.entry_price) / lastEntry.entry_price;

        if (priceChange < threshold) {
          await telegramBot.notifyWarning(
            `Phase ${currentPhase.phase} 매수 취소: 가격 상승 미달성 (${(priceChange * 100).toFixed(2)}%)`
          );
          return NextResponse.json(
            {
              success: true,
              message: `가격 상승 조건 미달성 (${(priceChange * 100).toFixed(2)}%)`,
            },
            { status: 200 }
          );
        }
      }
    }

    // 계좌 잔액 확인
    const kisApi = getKisApi();
    const account = await kisApi.getAccount();
    const availableBalance = account.balance;

    if (availableBalance < 100_000) {
      await telegramBot.notifyError(
        '잔액 부족',
        `사용 가능 잔액: ${availableBalance.toLocaleString()}원`
      );
      return NextResponse.json(
        {
          success: false,
          error: '잔액 부족',
        },
        { status: 400 }
      );
    }

    // 활성화된 종목 조회
    const enabledStocks = configStore.getEnabledStocks();

    if (enabledStocks.length === 0) {
      await telegramBot.notifyWarning('활성화된 종목이 없음');
      return NextResponse.json(
        {
          success: true,
          message: '활성화된 종목 없음',
        },
        { status: 200 }
      );
    }

    // 매수 실행
    const results = [];

    for (const stock of enabledStocks) {
      try {
        // 매수 수량 계산
        const buyAmount = Math.floor(availableBalance * currentPhase.ratio);
        const kapi = getKisApi();
        const quote = await kapi.getPrice(stock.code, currentPhase.market);

        if (quote.ask <= 0 || buyAmount < quote.ask * currentPhase.min_qty) {
          console.warn(
            `⚠️ ${stock.code} 매수 불가: 호가 부족 또는 자금 부족`
          );
          continue;
        }

        const quantity = Math.floor(buyAmount / quote.ask);

        if (quantity < currentPhase.min_qty) {
          console.warn(
            `⚠️ ${stock.code} 매수 불가: 최소 수량 미달 (${quantity}주 < ${currentPhase.min_qty}주)`
          );
          continue;
        }

        // KIS API로 매수 주문
        const order = await kapi.buy(stock.code, quantity);

        // 포지션 기록
        const position: Position = {
          date: kstTime.toISOString().split('T')[0],
          stock: stock.name,
          phase: currentPhase.phase,
          entry_time: currentTime,
          entry_price: quote.ask,
          quantity,
          entry_amount: quote.ask * quantity,
          market: currentPhase.market,
          timestamp: new Date().toISOString(),
        };

        savePosition(position);

        // 텔레그램 알림
        await telegramBot.notifyBuy(
          stock.name,
          quantity,
          quote.ask,
          currentPhase.phase
        );

        results.push({
          stock: stock.name,
          quantity,
          price: quote.ask,
          amount: quote.ask * quantity,
          success: true,
        });
      } catch (error) {
        console.error(`❌ ${stock.code} 매수 실패:`, error);

        await telegramBot.notifyError(
          `${stock.code} 매수 실패`,
          error instanceof Error ? error.message : 'Unknown error'
        );

        results.push({
          stock: stock.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Phase ${currentPhase.phase} 매수 완료`,
        phase: currentPhase.phase,
        time: currentTime,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    await telegramBot.notifyError('자동 매수 실패', errorMsg);

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
 * 포지션 저장
 */
function savePosition(position: Position): void {
  try {
    let positions: Position[] = [];

    if (fs.existsSync(POSITIONS_FILE)) {
      const data = fs.readFileSync(POSITIONS_FILE, 'utf-8');
      positions = JSON.parse(data);
    }

    positions.push(position);
    fs.writeFileSync(POSITIONS_FILE, JSON.stringify(positions, null, 2), 'utf-8');

    // CSV도 저장
    saveToCsv(position);
  } catch (error) {
    console.error('포지션 저장 실패:', error);
  }
}

/**
 * CSV 저장
 */
function saveToCsv(position: Position): void {
  try {
    const date = position.date;
    const csvPath = `/tmp/eod_entries_${date}.csv`;

    let csvContent = '';

    if (!fs.existsSync(csvPath)) {
      csvContent =
        'timestamp,phase,entry_time,stock,entry_price,quantity,entry_amount,market\n';
    } else {
      csvContent = fs.readFileSync(csvPath, 'utf-8');
    }

    csvContent += `${position.timestamp},${position.phase},${position.entry_time},${position.stock},${position.entry_price},${position.quantity},${position.entry_amount},${position.market}\n`;

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
 * 시장 신호 읽기
 */
function readMarketSignal(): boolean {
  try {
    if (fs.existsSync(MARKET_SIGNAL_FILE)) {
      const data = fs.readFileSync(MARKET_SIGNAL_FILE, 'utf-8');
      const signal = JSON.parse(data);
      return signal.signal === true;
    }
  } catch (error) {
    console.error('시장 신호 읽기 실패:', error);
  }

  return false;
}
