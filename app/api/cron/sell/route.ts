import { NextRequest, NextResponse } from 'next/server';
import { KISApi } from '@/lib/kis/api';
import { KneeShoulderPattern } from '@/lib/patterns/knee-shoulder';
import { getExchangeCode, isTradingTime } from '@/lib/utils/exchange';
import { nowInSeoul, getKSTTimeInfo } from '@/lib/utils/timezone';
import { getPostgresPool } from '@/lib/db/pool';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/cron/sell
 * 매시 정각 실행 (06:00-15:30)
 * 보유 포지션의 매도 신호 판정
 */
export async function POST(req: NextRequest) {
  const timeInfo = getKSTTimeInfo();
  console.log(`📤 매도 처리 시작 (5분 주기) - KST ${timeInfo.hour}:${String(timeInfo.minute).padStart(2, '0')}`);

  const pool = getPostgresPool();

  try {
    // 자동 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stocks (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trade_history (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        name VARCHAR(100) NOT NULL,
        action VARCHAR(10) NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        analysis TEXT,
        pattern_signal TEXT,
        pattern_confidence INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (code) REFERENCES stocks(code) ON DELETE CASCADE
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_snapshots (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        close DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (code) REFERENCES stocks(code) ON DELETE CASCADE
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trade_positions (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        name VARCHAR(50),
        quantity INT NOT NULL,
        entry_price DECIMAL(10, 2) NOT NULL,
        entry_time TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'holding',
        exit_price DECIMAL(10, 2),
        exit_time TIMESTAMP,
        profit_loss DECIMAL(15, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.log('⚠️ 테이블 생성 시도:', err);
  }

  // 🕐 실행 시간 확인 (08:00-20:00 KST)
  if (!isTradingTime(timeInfo.hour)) {
    console.log(`⏸️ 거래 시간 아님 (현재: ${timeInfo.hour}:${String(timeInfo.minute).padStart(2, '0')} - 08:00-20:00만 실행)`);
    // 커넥션풀 사용 → pool.end() 호출 안 함
    return NextResponse.json({
      success: true,
      message: '거래 시간 아님 (08:00-20:00만 실행)',
      results: [],
    });
  }

  // 🛑 손절매는 계속 작동하되, 새로운 신호는 무시
  let tradingEnabled = true;
  try {
    const statusResult = await pool.query(
      'SELECT trading_enabled, stopped_reason FROM trading_status WHERE id = 1'
    );
    const status = statusResult.rows[0];
    if (status) {
      tradingEnabled = status.trading_enabled;
      if (!tradingEnabled) {
        console.log(`⚠️ 거래 중단 상태 (손절매는 계속 작동). 사유: ${status.stopped_reason || '알 수 없음'}`);
      }
    }
  } catch (err) {
    console.warn('⚠️ 거래 상태 조회 실패, 계속 진행:', err);
  }

  try {
    // 1. 설정 조회
    let config: any = {
      global_settings: {
        sell: {
          target_profit_pct: 2.0,
          stop_loss_pct: 5.0,
          max_hold_hours: 24,
          trailing_stop_loss_pct: 0.2,
        },
        knee_shoulder: {
          search_window: 10,
        },
      },
    };

    try {
      const configResult = await pool.query(
        'SELECT config_json FROM trading_config WHERE id = 1'
      );
      if (configResult.rows.length > 0) {
        const dbConfig = JSON.parse(configResult.rows[0].config_json);
        config = dbConfig;
        console.log('✅ DB에서 설정 조회');
      }
    } catch (err: any) {
      console.log('⚠️ 설정 조회 실패, 기본값 사용');
    }

    const sellConfig = config.global_settings.sell || {};
    const patternConfig = config.global_settings.knee_shoulder || {};

    // 2. 현재 보유 포지션 조회 (trade_positions 테이블에서)
    const positionsResult = await pool.query(
      `SELECT id, code, name, quantity, entry_price, entry_time
       FROM trade_positions
       WHERE status = 'holding'
       ORDER BY entry_time ASC`
    );

    if (positionsResult.rows.length === 0) {
      console.log('📭 보유 포지션 없음');
      // 커넥션풀 사용 → pool.end() 호출 안 함
      return NextResponse.json({
        success: true,
        message: '보유 포지션 없음',
        results: [],
      });
    }

    console.log(`💼 보유 포지션: ${positionsResult.rows.length}개`);

    // 3. KIS API 초기화
    const kis = new KISApi();
    kis.updateEnv();

    const results = [];
    let sellCount = 0;
    const exchangeCode = getExchangeCode(timeInfo.hour, timeInfo.minute);
    console.log(`🔄 현재 거래소: ${exchangeCode} (${timeInfo.hour}:${String(timeInfo.minute).padStart(2, '0')})`);

    // 4. 각 포지션별 매도 판정
    for (const position of positionsResult.rows) {
      try {
        const { id, code, name, quantity, entry_price, entry_time } = position;

        console.log(`\n💼 [${name}(${code})] 포지션 분석 시작`);
        console.log(`   진입가: ${entry_price.toLocaleString()}원, 수량: ${quantity}주`);

        // 현재가 조회 (재시도 로직 포함)
        const priceData = await kis.retryGetPrice(code, exchangeCode);
        const currentPrice = priceData.current;

        console.log(`   현재가: ${currentPrice.toLocaleString()}원`);

        // 수익률 계산
        const profitPct =
          ((currentPrice - entry_price) / entry_price) * 100;

        console.log(`   수익률: ${profitPct.toFixed(2)}%`);

        // 최근 10개 가격 이력 조회 (어깨 탐색용)
        let recentPrices: number[] = [currentPrice];
        try {
          const priceHistoryResult = await pool.query(
            `SELECT close FROM price_snapshots
             WHERE code = $1
             ORDER BY timestamp DESC
             LIMIT 10`,
            [code]
          );
          if (priceHistoryResult.rows.length > 0) {
            const prices = priceHistoryResult.rows
              .reverse()
              .map(r => parseFloat(r.close));
            recentPrices = [...prices, currentPrice];
          }
        } catch (err) {
          console.log(`⚠️ 가격 이력 조회 실패`);
        }

        // 매도 신호 판정
        let shouldSell = false;
        let sellReason = '';
        let sellPrice = currentPrice;

        // 1️⃣ 10봉(50분) 내 어깨 감지 → 즉시 매도
        const entryPriceIndex = Math.max(0, recentPrices.length - 11);
        const kneeIndex = entryPriceIndex;
        const shoulderIndex = KneeShoulderPattern.detectShoulder(
          recentPrices,
          kneeIndex,
          entry_price,
          10 // 10봉 탐색
        );

        if (shoulderIndex !== null && shoulderIndex > kneeIndex) {
          shouldSell = true;
          sellReason = `어깨 패턴 감지 (10봉 내 반등) → 즉시 매도`;
          console.log(`👉 ${sellReason}`);
        }

        // 2️⃣ 손절매 (설정값에서 읽음)
        // -1.0% 손절매 (사용자 요구사항)
        const stopLossPct = sellConfig.stop_loss_pct || -1.0;
        if (!shouldSell && profitPct <= stopLossPct) {
          shouldSell = true;
          sellReason = `${stopLossPct}% 손절매`;
          console.log(`⛔ ${sellReason}`);
        }

        // 3️⃣ 동적 손절매: 최고가에서 올라간 수익의 20% 손실 시
        if (!shouldSell && recentPrices.length > 1) {
          const highestPrice = Math.max(...recentPrices);

          // 진입 이후 올라간 수익
          const profitFromEntry = highestPrice - entry_price;

          // 최고가에서 수익의 20% 손실 후 손절
          const dynamicStopLoss = Math.max(
            entry_price, // 항상 진입가 이상
            highestPrice - profitFromEntry * 0.2
          );

          if (currentPrice <= dynamicStopLoss) {
            const lossFromHighest =
              ((highestPrice - currentPrice) / highestPrice) * 100;
            shouldSell = true;
            sellReason = `동적 손절 (최고가 ${highestPrice.toLocaleString()}에서 수익의 20% 손실)`;
            console.log(`⛔ ${sellReason}`);
          }
        }

        if (shouldSell) {
          console.log(`🎯 [${name}] 매도 신호 감지: ${sellReason}`);

          try {
            // KIS API로 매도 주문 (재시도 로직 포함)
            let sellResponse = null;
            let sellAttempt = 0;
            const maxSellRetries = 3;

            while (sellAttempt < maxSellRetries) {
              try {
                sellResponse = await kis.sell(code, quantity);
                console.log(`✅ [${name}] 매도 주문 성공: ${sellPrice}원`);
                break;
              } catch (err: any) {
                sellAttempt++;
                if (sellAttempt < maxSellRetries) {
                  console.warn(
                    `⚠️ [${name}] 매도 실패 (${sellAttempt}회): ${err.message}, 1초 후 재시도...`
                  );
                  // 지수백오프: 1초, 2초, 3초
                  await new Promise((resolve) =>
                    setTimeout(resolve, 1000 * sellAttempt)
                  );
                } else {
                  console.error(
                    `❌ [${name}] 매도 최종 실패 (${maxSellRetries}회 초과): ${err.message}`
                  );
                  throw err;
                }
              }
            }

            // 매도 성공 후 DB 업데이트
            if (sellResponse) {
              console.log(
                `✅ [${name}] 매도 완료: ${quantity}주 @ ${sellPrice}원 (수익: ${profitPct.toFixed(2)}%)`
              );

              // 거래 이력 저장
              try {
                await pool.query(
                  `INSERT INTO trade_history (code, name, action, quantity, price, analysis, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, ${nowInSeoul()})`,
                  [
                    code,
                    name,
                    'SELL',
                    quantity,
                    sellPrice,
                    JSON.stringify({
                      sellReason,
                      profitPct: profitPct.toFixed(2),
                      entryPrice: entry_price,
                    }),
                  ]
                );
              } catch (saveErr: any) {
                console.log(`⚠️ [${name}] trade_history 저장 실패: ${saveErr.message}`);
              }

              // trade_positions 업데이트
              try {
                await pool.query(
                  `UPDATE trade_positions
                   SET status = 'sold', exit_price = $1, exit_time = ${nowInSeoul()},
                       profit_loss = $2, updated_at = ${nowInSeoul()}
                   WHERE id = $3`,
                  [sellPrice, sellPrice - entry_price, id]
                );
                console.log(`✅ [${name}] trade_positions 업데이트 완료`);
              } catch (updateErr: any) {
                console.error(`❌ [${name}] trade_positions 업데이트 실패: ${updateErr.message}`);
              }

              sellCount++;
              results.push({
                code,
                name,
                action: 'SELL',
                quantity,
                entryPrice: entry_price,
                sellPrice,
                profitPct: profitPct.toFixed(2),
                sellReason,
                status: '✅ 매도 완료',
              });
            }
          } catch (sellErr: any) {
            console.error(`❌ [${name}] 매도 실패: ${sellErr.message}`);
            results.push({
              code,
              name,
              error: sellErr.message,
              profitPct: profitPct.toFixed(2),
              status: '❌ 매도 실패',
            });
          }
        } else {
          console.log(`⏳ [${name}] 보유 중...`);
          results.push({
            code,
            name,
            currentPrice,
            entryPrice: entry_price,
            profitPct: profitPct.toFixed(2),
            status: '⏳ 보유 중',
          });
        }
      } catch (err: any) {
        console.error(`❌ [${position.name}] 매도 처리 오류: ${err.message}`);
        results.push({
          code: position.code,
          name: position.name,
          error: err.message,
          status: '❌ 오류',
        });
      }
    }

    // 커넥션풀 사용 → pool.end() 호출 안 함

    console.log(`\n✅ 매도 처리 완료: ${sellCount}개 매도`);

    return NextResponse.json({
      success: true,
      message: `매도 처리 완료: ${sellCount}개 매도`,
      results,
    });
  } catch (err: any) {
    console.error('❌ 매도 중 오류:', err);
    // 커넥션풀 사용 → pool.end() 호출 안 함
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
