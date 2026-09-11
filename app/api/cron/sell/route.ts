import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { KISApi } from '@/lib/kis/api';
import { KneeShoulderPattern } from '@/lib/patterns/knee-shoulder';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function connectPostgres() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

/**
 * POST /api/cron/sell
 * 매시 정각 실행 (06:00-15:30)
 * 보유 포지션의 매도 신호 판정
 */
export async function POST(req: NextRequest) {
  console.log('📤 매도 처리 시작');

  const pool = await connectPostgres();

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

    // 2. 현재 보유 포지션 조회
    const positionsResult = await pool.query(
      `SELECT DISTINCT ON (code) code, name, quantity, price as entry_price, created_at as entry_time
       FROM trade_history
       WHERE action = 'BUY'
       AND code NOT IN (SELECT code FROM trade_history WHERE action = 'SELL')
       ORDER BY code, created_at DESC`
    );

    if (positionsResult.rows.length === 0) {
      console.log('📭 보유 포지션 없음');
      await pool.end();
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

    // 4. 각 포지션별 매도 판정
    for (const position of positionsResult.rows) {
      try {
        const { code, name, quantity, entry_price, entry_time } = position;

        console.log(`\n💼 [${name}(${code})] 포지션 분석 시작`);
        console.log(`   진입가: ${entry_price.toLocaleString()}원, 수량: ${quantity}주`);

        // 현재가 조회
        const priceData = await kis.getPrice(code, 'NX');
        const currentPrice = priceData.current;

        console.log(`   현재가: ${currentPrice.toLocaleString()}원`);

        // 보유 시간 계산
        const entryDate = new Date(entry_time);
        const holdTimeMs = Date.now() - entryDate.getTime();
        const holdTimeHours = holdTimeMs / (60 * 60 * 1000);

        // 수익률 계산
        const profitPct =
          ((currentPrice - entry_price) / entry_price) * 100;

        console.log(
          `   수익률: ${profitPct.toFixed(2)}% | 보유시간: ${holdTimeHours.toFixed(1)}시간`
        );

        // 매도 신호 판정
        let shouldSell = false;
        let sellReason = '';
        let sellPrice = 0;

        // 1️⃣ 목표가 달성
        if (
          profitPct >= (sellConfig.target_profit_pct || 2.0)
        ) {
          shouldSell = true;
          sellReason = `목표 수익 ${sellConfig.target_profit_pct}% 달성`;
          sellPrice = currentPrice;
          console.log(`✅ 목표가 도달: ${sellReason}`);
        }
        // 2️⃣ 손절매
        else if (
          profitPct <= -(sellConfig.stop_loss_pct || 5.0)
        ) {
          shouldSell = true;
          sellReason = `손절매 기준 ${sellConfig.stop_loss_pct}% 손실`;
          sellPrice = currentPrice;
          console.log(`⛔ 손절매: ${sellReason}`);
        }
        // 3️⃣ 시간 초과
        else if (
          holdTimeHours >= (sellConfig.max_hold_hours || 24)
        ) {
          shouldSell = true;
          sellReason = `${sellConfig.max_hold_hours}시간 보유 완료`;
          sellPrice = currentPrice;
          console.log(`⏰ 시간 초과: ${sellReason}`);
        }

        if (shouldSell) {
          console.log(`🎯 [${name}] 매도 신호 감지: ${sellReason}`);

          try {
            // KIS API로 매도 주문
            const sellResult = await kis.sell(code, quantity);

            if (sellResult) {
              console.log(
                `✅ [${name}] 매도 완료: ${quantity}주 @ ${sellPrice}원 (수익: ${profitPct.toFixed(2)}%)`
              );

              // 거래 이력 저장
              try {
                await pool.query(
                  `INSERT INTO trade_history (code, name, action, quantity, price, analysis, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
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
                      holdTimeHours: holdTimeHours.toFixed(2),
                    }),
                  ]
                );
              } catch (saveErr: any) {
                console.log(`⚠️ [${name}] 이력 저장 실패: ${saveErr.message}`);
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
                holdTimeHours: holdTimeHours.toFixed(1),
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
            holdTimeHours: holdTimeHours.toFixed(1),
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

    await pool.end();

    console.log(`\n✅ 매도 처리 완료: ${sellCount}개 매도`);

    return NextResponse.json({
      success: true,
      message: `매도 처리 완료: ${sellCount}개 매도`,
      results,
    });
  } catch (err: any) {
    console.error('❌ 매도 중 오류:', err);
    await pool.end();
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
