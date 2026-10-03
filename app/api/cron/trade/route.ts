import { NextRequest, NextResponse } from 'next/server';
import { KISApi } from '@/lib/kis/api';
import { HybridTrading } from '@/lib/patterns/hybrid-trading';
import { getExchangeCode, isTradingTime } from '@/lib/utils/exchange';
import { nowInSeoul, getKSTTimeInfo } from '@/lib/utils/timezone';
import { getPostgresPool } from '@/lib/db/pool';
import { calculateADX, calculatePlusDI, calculateMinusDI } from '@/lib/indicators/adx';
import { getMarketRegime, getRisePercent, getStopLossPct, getTrailingStopPct, getRegimeConfig } from '@/lib/patterns/market-regime';

// ⏱️ Vercel 함수 실행 제한 설정 (최대 30초)
// 10개 종목을 2~3초씩 순차 처리 가능 (30초 / 10개 = 3초/종목)
export const maxDuration = 30;

/**
 * 손절매 워처: -2% 이상 손실되면 즉시 매도
 * 우선순위 1 (가장 먼저 실행)
 */
async function checkStopLoss(pool: any, kis: any) {
  try {
    const positions = await pool.query(
      `SELECT id, code, name, entry_price, stop_loss_pct FROM trade_positions WHERE status = 'holding'`
    );

    for (const pos of positions.rows) {
      try {
        const currentPrice = await kis.retryGetPrice(pos.code, 'NX');
        const price = currentPrice.current || 0;

        if (price <= 0) continue;

        const lossPct = ((price - pos.entry_price) / pos.entry_price) * 100;
        const stopLoss = pos.stop_loss_pct || -2.0;

        if (lossPct <= stopLoss) {
          console.log(`🔴 손절매: ${pos.name} @ ${price}원 (손실: ${lossPct.toFixed(2)}%)`);

          // 매도 실행
          await kis.sell(pos.code, 1);

          // DB 업데이트
          await pool.query(
            `UPDATE trade_positions
             SET status = 'sold', exit_price = $1, exit_time = NOW(),
                 profit_loss = $2, updated_at = NOW()
             WHERE id = $3`,
            [price, (price - pos.entry_price) * 1, pos.id]
          );

          return; // 한 번에 하나만 처리
        }
      } catch (err) {
        console.warn(`⚠️ 손절매 체크 오류 (${pos.name}):`, err);
      }
    }
  } catch (err) {
    console.warn('⚠️ 손절매 워처 오류:', err);
  }
}

/**
 * 동적 추적 손절: 고점에서 일정% 하락하면 매도
 * 우선순위 2
 */
async function checkTrailingStop(pool: any, kis: any) {
  try {
    const positions = await pool.query(
      `SELECT id, code, name, entry_price, highest_price, trailing_pct FROM trade_positions WHERE status = 'holding'`
    );

    for (const pos of positions.rows) {
      try {
        const currentPrice = await kis.retryGetPrice(pos.code, 'NX');
        const price = currentPrice.current || 0;

        if (price <= 0) continue;

        // 최고가 업데이트
        const highestPrice = pos.highest_price || pos.entry_price;
        if (price > highestPrice) {
          await pool.query(
            `UPDATE trade_positions SET highest_price = $1 WHERE id = $2`,
            [price, pos.id]
          );
        }

        // 동적 추적 손절 확인
        const trailingStopPrice = highestPrice * (1 - (pos.trailing_pct || 0.3) / 100);
        if (price <= trailingStopPrice) {
          const profitPct = ((price - pos.entry_price) / pos.entry_price) * 100;
          console.log(`📊 추적손절: ${pos.name} (고점: ${highestPrice.toFixed(0)}원, 현재: ${price.toFixed(0)}원, 수익: ${profitPct.toFixed(2)}%)`);

          // 매도 실행
          await kis.sell(pos.code, 1);

          // DB 업데이트
          await pool.query(
            `UPDATE trade_positions
             SET status = 'sold', exit_price = $1, exit_time = NOW(),
                 profit_loss = $2, updated_at = NOW()
             WHERE id = $3`,
            [price, (price - pos.entry_price) * 1, pos.id]
          );

          return; // 한 번에 하나만 처리
        }
      } catch (err) {
        console.warn(`⚠️ 추적손절 체크 오류 (${pos.name}):`, err);
      }
    }
  } catch (err) {
    console.warn('⚠️ 동적 추적 손절 오류:', err);
  }
}

export async function POST(req: NextRequest) {
  const timeInfo = getKSTTimeInfo();
  console.log(`🔄 자동 거래 시작 (5분 주기) - KST ${timeInfo.hour}:${String(timeInfo.minute).padStart(2, '0')}`);

  const pool = getPostgresPool();

  try {
    // 자동 테이블 생성 및 컬럼 추가
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stocks (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        allocation_pct DECIMAL(5,2) DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // trade_positions 테이블에 새 컬럼 추가 (없으면 추가)
    try {
      await pool.query(`ALTER TABLE trade_positions ADD COLUMN IF NOT EXISTS market_regime VARCHAR(20)`);
      await pool.query(`ALTER TABLE trade_positions ADD COLUMN IF NOT EXISTS stop_loss_pct DECIMAL(5, 2) DEFAULT -2.0`);
      await pool.query(`ALTER TABLE trade_positions ADD COLUMN IF NOT EXISTS trailing_pct DECIMAL(5, 2) DEFAULT 0.3`);
      await pool.query(`ALTER TABLE trade_positions ADD COLUMN IF NOT EXISTS highest_price DECIMAL(10, 2)`);
    } catch (alterErr) {
      console.log('⚠️ 테이블 컬럼 추가 시도:', alterErr);
    }
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
    await pool.query(`
      INSERT INTO stocks (code, name, enabled) VALUES
      ('005930', '삼성전자', true),
      ('000660', 'SK하이닉스', false),
      ('003550', 'LG', false)
      ON CONFLICT (code) DO NOTHING
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

  // 🛑 거래 활성화 상태 확인
  try {
    const statusResult = await pool.query(
      'SELECT trading_enabled, stopped_reason FROM trading_status WHERE id = 1'
    );
    const status = statusResult.rows[0];

    if (status && !status.trading_enabled) {
      console.log(`⚠️ 거래가 중단됨. 실행하지 않음. (사유: ${status.stopped_reason || '알 수 없음'})`);
      return NextResponse.json({
        success: true,
        message: '거래 중단 상태',
        results: [],
      });
    }
  } catch (err) {
    console.warn('⚠️ 거래 상태 조회 실패, 계속 진행:', err);
  }

  // 환경변수에서 거래 활성화 상태 확인
  const rawValue = process.env.TRADING_ENABLED;
  const tradingEnabled = rawValue !== 'false';
  console.log('📋 환경변수 TRADING_ENABLED (RAW):', JSON.stringify(rawValue), '→ type:', typeof rawValue, '→ enabled:', tradingEnabled);

  try {
    // 1. 설정 조회
    let config: any = {
      global_settings: {
        enabled: tradingEnabled,
        min_rise: 1.5,
        search_window: 10,
      },
      stocks: [],
    };

    try {
      const configResult = await pool.query(
        'SELECT config_json FROM trading_config WHERE id = 1'
      );

      if (configResult.rows.length > 0) {
        const dbConfig = JSON.parse(configResult.rows[0].config_json);
        // DB에서 min_drop 등의 설정은 읽되, enabled는 환경변수 사용
        config = {
          ...dbConfig,
          global_settings: {
            ...dbConfig.global_settings,
            enabled: tradingEnabled,
          },
        };
        console.log('✅ DB에서 설정 조회 (enabled은 환경변수 사용)');
      }
    } catch (dbErr: any) {
      console.log('⚠️ DB 조회 실패, 환경변수 기본값 사용');
    }

    const { enabled } = config.global_settings;

    if (!enabled) {
      console.log('🛑 매수 신호 중단 (거래 제어: 중지) - 손절매는 계속 작동');
      return NextResponse.json({ success: true, message: '매수만 중단 (손절매는 작동)' });
    }

    // 2. 종목 조회 (config에서 직접 읽음)
    const stocks = (config.stocks || []).filter((s: any) => s.enabled);

    if (stocks.length === 0) {
      console.log('📭 활성화된 종목 없음');
      // 커넥션풀 사용 → pool.end() 호출 안 함
      return NextResponse.json({
        success: true,
        message: '0개 종목 처리 (매수: 0건, 오류: 0건)',
        results: []
      });
    }

    console.log(`🚀 거래 시작: ${stocks.length}개 종목`);

    // 3. KIS API 초기화 및 계좌 정보 조회
    const kis = new KISApi();
    kis.updateEnv();

    let totalCapital = 300000; // 기본값
    let orderableAmount = 300000; // 기본값 (100% 공격적 전략)

    try {
      // 계좌 잔액 조회 (예수금액)
      const accountData = await kis.getAccount();
      totalCapital = accountData.balance;
      console.log(`💰 계좌 잔액: ${totalCapital.toLocaleString()}원`);
    } catch (err) {
      console.warn(`⚠️ 계좌 잔액 조회 실패, 기본값 300,000원 사용: ${err}`);
    }

    try {
      // 보유 포지션 조회 (주문 가능금액 추정)
      const balanceData = await kis.getBalance();
      orderableAmount = balanceData.estimated_order_amount || Math.floor(totalCapital * 0.85);
      console.log(`💵 주문 가능금액 추정: ${orderableAmount.toLocaleString()}원`);
    } catch (err) {
      console.warn(`⚠️ 보유 포지션 조회 실패, 기본값 사용: ${err}`);
      orderableAmount = totalCapital; // 100% 공격적 전략
    }

    let buyCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    const exchangeCode = getExchangeCode(timeInfo.hour, timeInfo.minute);
    console.log(`🔄 현재 거래소: ${exchangeCode} (${timeInfo.hour}:${String(timeInfo.minute).padStart(2, '0')})`);

    // 1️⃣ 손절매 워처 (우선순위 1)
    console.log('🔍 손절매 워처 실행...');
    await checkStopLoss(pool, kis);

    // 2️⃣ 동적 추적 손절 (우선순위 2)
    console.log('🔍 동적 추적 손절 체크...');
    await checkTrailingStop(pool, kis);

    // 3️⃣ 각 종목별 매수 신호 생성 (우선순위 3)
    // 4. 각 종목별 매수 로직
    for (const stock of stocks) {
      try {
        const { code, name } = stock;

        // 현재가 조회 (NX 사용 - 유일하게 작동하는 코드)
        const priceData = await kis.retryGetPrice(code, 'NX');
        const currentPrice = priceData.current || 0;

        console.log(`📊 [${name}] 현재가: ${currentPrice.toLocaleString()}원 (거래소코드: NX)`);

        // ⚠️ 현재가 0 체크 (kis.retryGetPrice 실패 시 0 반환 가능)
        if (currentPrice <= 0) {
          console.warn(`⚠️ [${name}] 현재가 조회 실패 (${currentPrice}원), 매수 스킵`);
          results.push({
            code,
            name,
            error: '현재가 조회 실패',
            status: '❌ 현재가 0원 - 매수 스킵',
          });
          continue;
        }

        // 📊 최근 72개 5분봉 조회 (6시간 거래 데이터)
        let prices: number[] = [];
        let marketRegime: any = 'SIDEWAYS';
        let risePercent: number = 0.8;
        let stopLossPct: number = -1.5;
        let trailingStopPct: number = -0.2;

        try {
          const priceHistoryResult = await pool.query(
            `SELECT close FROM price_snapshots
             WHERE code = $1
             ORDER BY timestamp DESC
             LIMIT 72`,
            [code]
          );

          if (priceHistoryResult.rows.length >= 72) {
            // 72개 이상 있으면 정렬 후 ADX 계산
            prices = priceHistoryResult.rows
              .reverse()
              .map(r => parseFloat(r.close));

            // ADX, ±DI 계산 (최근 14개 기반)
            const ADX = calculateADX(prices.slice(-14));
            const plusDI = calculatePlusDI(prices.slice(-14));
            const minusDI = calculateMinusDI(prices.slice(-14));

            // 시장 체제 판단
            marketRegime = getMarketRegime(ADX, plusDI, minusDI);
            risePercent = getRisePercent(marketRegime);
            stopLossPct = getStopLossPct(marketRegime);
            trailingStopPct = getTrailingStopPct(marketRegime);

            console.log(`📊 [${name}] ADX=${ADX.toFixed(2)}, +DI=${plusDI.toFixed(2)}, -DI=${minusDI.toFixed(2)}`);
            console.log(`🔍 시장 체제: ${marketRegime}, 반등: ${risePercent}%, 손절: ${stopLossPct}%, 추적: ${trailingStopPct}%`);
          } else if (priceHistoryResult.rows.length > 0) {
            // 72개 미만이면 사용 가능한 데이터로만 계산
            prices = priceHistoryResult.rows
              .reverse()
              .map(r => parseFloat(r.close));

            console.log(`⚠️ [${name}] 데이터 부족 (${priceHistoryResult.rows.length}/72개) - 횡보장으로 가정`);
          } else {
            console.log(`⚠️ [${name}] 가격 데이터 없음`);
            prices = [];
          }
        } catch (err) {
          console.log(`⚠️ [${name}] 가격 이력 조회 실패: ${err}`);
          prices = [];
        }

        // 데이터 부족하면 스킵
        if (prices.length < 14) {
          console.log(`❌ [${name}] 데이터 부족 (${prices.length}/14개), 매수 스킵`);
          results.push({
            code,
            name,
            price: currentPrice,
            status: '❌ 데이터 부족',
          });
          continue;
        }

        // 72개 저점 계산
        const lowestPrice = Math.min(...prices);
        const buyPrice = lowestPrice * (1 + risePercent / 100);

        // 매수 신호 판단
        let shouldBuy = currentPrice >= buyPrice;

        console.log(
          `💡 [${name}] 저점: ${lowestPrice.toFixed(0)}원 → 매수기준: ${buyPrice.toFixed(0)}원 → 현재: ${currentPrice.toFixed(0)}원`
        );
        console.log(`   시장: ${marketRegime}, 신호: ${shouldBuy ? '✅ 매수' : '❌ 대기'}`);

        if (shouldBuy) {
          console.log(`🎯 [${name}] 매수 신호! (시장: ${marketRegime})`);

          try {
            // 할당 비율 조회
            let allocationPct = 100; // 기본값
            try {
              const allocResult = await pool.query(
                'SELECT allocation_pct FROM stocks WHERE code = $1',
                [code]
              );
              if (allocResult.rows.length > 0) {
                allocationPct = parseFloat(allocResult.rows[0].allocation_pct) || 100;
              }
            } catch (err) {
              console.warn(`⚠️ 할당비율 조회 실패, 기본값 100% 사용: ${err}`);
            }

            // ✅ 실제 매수가능수량 조회 (공식 API - 증거금률, 수수료 반영)
            let actualBuyQty = 0;
            try {
              const orderableInfo = await kis.getOrderableAmount(code, currentPrice);
              actualBuyQty = Math.max(0, orderableInfo.nrcvb_buy_qty || 0); // 음수/null 방지
              console.log(`✅ [${name}] 실제 매수가능수량: ${actualBuyQty}주 (공식 API 확인)`);
            } catch (orderableErr) {
              console.warn(`⚠️ 매수가능조회 실패, 추정값으로 계산: ${orderableErr}`);
              // Fallback: 기존 추정 방식 사용
              const allocAmount = Math.floor(orderableAmount * (allocationPct / 100));
              actualBuyQty = Math.floor(allocAmount / currentPrice);
            }

            console.log(`💰 [${name}] 할당비율: ${allocationPct}% | 매수가능수량: ${actualBuyQty}주`);

            if (actualBuyQty > 0) {
              // 매수 실행 (재시도 로직 포함)
              let orderResult: any = null;
              let buyError: any = null;
              const maxBuyRetries = 3;

              for (let attempt = 0; attempt < maxBuyRetries; attempt++) {
                try {
                  console.log(`📊 [${name}] 매수 시도: ${code} x ${actualBuyQty}주 (${attempt + 1}/${maxBuyRetries})`);
                  const delay = Math.pow(2, attempt) * 100; // 지수백오프 (100ms, 200ms, 400ms)
                  if (attempt > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                  }
                  orderResult = await kis.buy(code, actualBuyQty);
                  break; // 성공하면 루프 탈출
                } catch (err) {
                  buyError = err;
                  if (attempt === maxBuyRetries - 1) {
                    throw buyError; // 마지막 시도 실패하면 예외 발생
                  }
                  console.warn(`⚠️ [${name}] 매수 시도 실패 (${attempt + 1}/${maxBuyRetries}): ${err instanceof Error ? err.message : String(err)}`);
                }
              }

              if (orderResult) {
              console.log(
                `✅ [${name}] 매수 완료: ${actualBuyQty}주 @ ${currentPrice}원`
              );

              // 거래 이력 저장 (ADX 정보 포함)
              try {
                await pool.query(
                  `INSERT INTO trade_history
                   (code, name, action, quantity, price, analysis, market_regime, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                  [
                    code,
                    name,
                    'BUY',
                    actualBuyQty,
                    currentPrice,
                    JSON.stringify({
                      marketRegime: marketRegime,
                      lowestPrice: lowestPrice,
                      buyPrice: buyPrice,
                      risePercent: risePercent,
                    }),
                    marketRegime,
                  ]
                );
              } catch (saveErr: any) {
                console.log(`⚠️ [${name}] trade_history 저장 실패: ${saveErr.message}`);
              }

              // trade_positions에 추가 (DB 통합)
              try {
                await pool.query(
                  `INSERT INTO trade_positions
                   (code, name, quantity, entry_price, entry_time, status, market_regime,
                    stop_loss_pct, trailing_pct, highest_price, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'holding', $5, $6, $7, $8,
                           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                  [code, name, actualBuyQty, currentPrice, marketRegime, stopLossPct, trailingStopPct, currentPrice]
                );
                console.log(`✅ [${name}] trade_positions에 등록됨 (시장: ${marketRegime})`);
              } catch (posErr: any) {
                console.error(`❌ [${name}] trade_positions 저장 실패: ${posErr.message}`);
              }

              buyCount++;
              results.push({
                code,
                name,
                action: 'BUY',
                quantity: actualBuyQty,
                price: currentPrice,
                marketRegime: marketRegime,
                risePercent: risePercent,
                status: '✅ 매수 완료',
              });
              }
            } else {
              console.log(`⚠️ [${name}] 실제 매수가능수량이 0주 이하라 매수 불가 (조회된 수량: ${actualBuyQty}주, 현재가: ${currentPrice}원)`);
            }
          } catch (buyErr: any) {
            console.error(`❌ [${name}] 매수 실패: ${buyErr.message}`);
            errorCount++;
            results.push({
              code,
              name,
              action: 'BUY',
              error: buyErr.message,
              status: '❌ 매수 실패',
            });
          }
        } else {
          console.log(
            `⏭️ [${name}] 매수 신호 없음 (시장: ${marketRegime}, 현재 ${currentPrice.toFixed(0)} < 기준 ${buyPrice.toFixed(0)})`
          );
          results.push({
            code,
            name,
            price: currentPrice,
            marketRegime: marketRegime,
            risePercent: risePercent,
            status: '⏭️ 신호 없음',
          });
        }
      } catch (err: any) {
        console.error(`❌ [${stock.name}] 처리 오류: ${err.message}`);
        errorCount++;
        results.push({
          code: stock.code,
          name: stock.name,
          error: err.message,
          status: '❌ 오류',
        });
      }
    }

    // 커넥션풀 사용 → pool.end() 호출 안 함
    return NextResponse.json({
      success: true,
      message: `${results.length}개 종목 처리 (매수: ${buyCount}건, 오류: ${errorCount}건)`,
      results,
    });
  } catch (err: any) {
    console.error('❌ 거래 오류:', err);
    // 커넥션풀 사용 → pool.end() 호출 안 함
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
