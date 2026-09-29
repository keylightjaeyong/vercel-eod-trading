import { NextRequest, NextResponse } from 'next/server';
import { KISApi } from '@/lib/kis/api';
import { KneeShoulderPattern } from '@/lib/patterns/knee-shoulder';
import { getExchangeCode, isTradingTime } from '@/lib/utils/exchange';
import { nowInSeoul, getKSTTimeInfo } from '@/lib/utils/timezone';
import { getPostgresPool } from '@/lib/db/pool';

// ⏱️ Vercel 함수 실행 제한 설정 (최대 30초)
// 10개 종목을 2~3초씩 순차 처리 가능 (30초 / 10개 = 3초/종목)
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const timeInfo = getKSTTimeInfo();
  console.log(`🔄 자동 거래 시작 (5분 주기) - KST ${timeInfo.hour}:${String(timeInfo.minute).padStart(2, '0')}`);

  const pool = getPostgresPool();

  try {
    // 자동 테이블 생성
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
        min_drop: 1.0,
        min_rise: 0.5,
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

    // 2. 종목 조회
    const stocksResult = await pool.query(
      'SELECT code, name FROM stocks WHERE enabled = true LIMIT 10'
    );

    if (stocksResult.rows.length === 0) {
      console.log('📭 활성화된 종목 없음');
      // 커넥션풀 사용 → pool.end() 호출 안 함
      return NextResponse.json({ success: true, message: '종목 없음' });
    }

    console.log(`🚀 거래 시작: ${stocksResult.rows.length}개 종목`);

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
    const { min_drop } = config.global_settings;
    // ✅ kneeConfig에 min_drop을 명시적으로 전달 (UI 설정값 반영)
    const kneeConfig = {
      ...config.global_settings.knee_shoulder,
      min_drop_pct: min_drop || 1.0, // UI의 min_drop을 knee_shoulder에 전달
    };
    const exchangeCode = getExchangeCode(timeInfo.hour, timeInfo.minute);
    console.log(`🔄 현재 거래소: ${exchangeCode} (${timeInfo.hour}:${String(timeInfo.minute).padStart(2, '0')})`);

    // 4. 각 종목별 매수/매도 로직
    for (const stock of stocksResult.rows) {
      try {
        const { code, name } = stock;

        // 현재가 조회 (NX 사용 - 유일하게 작동하는 코드)
        const priceData = await kis.retryGetPrice(code, 'NX');
        const currentPrice = priceData.current || 0;

        console.log(`📊 [${name}] 현재가: ${currentPrice.toLocaleString()}원 (거래소코드: NX)`);

        // 최근 30개 가격 이력 조회 (V자 패턴 분석용)
        let prices: number[] = [];
        try {
          const priceHistoryResult = await pool.query(
            `SELECT close FROM price_snapshots
             WHERE code = $1
             ORDER BY timestamp DESC
             LIMIT 30`,
            [code]
          );
          if (priceHistoryResult.rows.length > 0) {
            prices = priceHistoryResult.rows
              .reverse()
              .map(r => parseFloat(r.close));
            // 현재가 추가 (최신)
            prices.push(currentPrice);
          } else {
            // 가격 이력 없으면 trade_history에서 조회
            const tradeHistoryResult = await pool.query(
              `SELECT price FROM trade_history
               WHERE code = $1 AND action = 'BUY'
               ORDER BY created_at DESC
               LIMIT 1`,
              [code]
            );
            if (tradeHistoryResult.rows.length > 0) {
              prices = [
                parseFloat(tradeHistoryResult.rows[0].price),
                currentPrice,
              ];
            } else {
              prices = [currentPrice];
            }
          }
        } catch (err) {
          console.log(`⚠️ [${name}] 가격 이력 조회 실패`);
          prices = [currentPrice];
        }

        // V자 패턴 신호 생성
        const signal = KneeShoulderPattern.generateTradingSignal(
          prices,
          kneeConfig
        );

        let shouldBuy = signal.signal === 'BUY';

        // 기본 낙폭률 조건도 함께 확인 (보수적 접근)
        if (prices.length >= 2) {
          const dropPct =
            ((prices[prices.length - 2] - currentPrice) /
              prices[prices.length - 2]) *
            100;
          console.log(
            `📈 [${name}] 낙폭: ${dropPct.toFixed(2)}% (기준: ${min_drop}%) | 패턴: ${signal.reason}`
          );

          // 낙폭률이 기준 이상이면 추가로 매수 신호 (신뢰도 필터 제거)
          if (dropPct >= (min_drop || 1.0)) {
            shouldBuy = true;
          }
        }

        if (shouldBuy) {
          console.log(`🎯 [${name}] 매수 신호! (신뢰도: ${signal.confidence}%)`);

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
              actualBuyQty = orderableInfo.nrcvb_buy_qty; // 미수없는매수수량 사용
              console.log(`✅ [${name}] 실제 매수가능수량: ${actualBuyQty}주 (공식 API 확인)`);
            } catch (orderableErr) {
              console.warn(`⚠️ 매수가능조회 실패, 추정값으로 계산: ${orderableErr}`);
              // Fallback: 기존 추정 방식 사용
              const allocAmount = Math.floor(orderableAmount * (allocationPct / 100));
              actualBuyQty = Math.floor(allocAmount / currentPrice);
            }

            console.log(`💰 [${name}] 할당비율: ${allocationPct}% | 매수가능수량: ${actualBuyQty}주`);

            if (actualBuyQty > 0) {
              // 매수 실행
              const orderResult = await kis.buy(code, actualBuyQty);

              if (orderResult) {
              console.log(
                `✅ [${name}] 매수 완료: ${actualBuyQty}주 @ ${currentPrice}원`
              );

              // 거래 이력 저장 (패턴 정보 포함)
              try {
                await pool.query(
                  `INSERT INTO trade_history (code, name, action, quantity, price, analysis, pattern_signal, pattern_confidence, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${nowInSeoul()})`,
                  [
                    code,
                    name,
                    'BUY',
                    actualBuyQty,
                    currentPrice,
                    JSON.stringify({
                      signal: signal.signal,
                      reason: signal.reason,
                      targetPrice: signal.targetPrice,
                      stopLossPrice: signal.stopLossPrice,
                    }),
                    signal.signal,
                    signal.confidence,
                  ]
                );
              } catch (saveErr: any) {
                console.log(`⚠️ [${name}] trade_history 저장 실패: ${saveErr.message}`);
              }

              // trade_positions에 추가 (DB 통합)
              try {
                await pool.query(
                  `INSERT INTO trade_positions (code, name, quantity, entry_price, entry_time, status, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, ${nowInSeoul()}, 'holding', ${nowInSeoul()}, ${nowInSeoul()})`,
                  [code, name, actualBuyQty, currentPrice]
                );
                console.log(`✅ [${name}] trade_positions에 등록됨`);
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
                signal: signal.signal,
                confidence: signal.confidence,
                reason: signal.reason,
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
            `⏭️ [${name}] 매수 신호 없음 (${signal.reason})`
          );
          results.push({
            code,
            name,
            price: currentPrice,
            signal: signal.signal,
            confidence: signal.confidence,
            reason: signal.reason,
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
