import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { KISApi } from '@/lib/kis/api';

async function connectPostgres() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

export async function POST(req: NextRequest) {
  console.log('🔄 자동 거래 시작 (Heroku에서 호출됨)');
  const pool = await connectPostgres();

  try {
    // 1. 설정 조회 (없으면 기본값 사용)
    let config = {
      global_settings: {
        enabled: true,
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
        config = JSON.parse(configResult.rows[0].config_json);
      }
    } catch (dbErr: any) {
      console.log('⚠️ trading_config 테이블 없음, 기본값 사용');
    }

    const { enabled } = config.global_settings;

    if (!enabled) {
      console.log('⏸️ 거래 비활성화됨');
      await pool.end();
      return NextResponse.json({ success: true, message: '거래 비활성화' });
    }

    // 2. 종목 조회
    const stocksResult = await pool.query(
      'SELECT code, name FROM stocks WHERE enabled = true LIMIT 10'
    );

    if (stocksResult.rows.length === 0) {
      console.log('📭 활성화된 종목 없음');
      await pool.end();
      return NextResponse.json({ success: true, message: '종목 없음' });
    }

    console.log(`🚀 거래 시작: ${stocksResult.rows.length}개 종목`);

    // 3. KIS API 초기화
    const kis = new KISApi();
    kis.updateEnv();

    let buyCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    const { min_drop } = config.global_settings;

    // 4. 각 종목별 매수/매도 로직
    for (const stock of stocksResult.rows) {
      try {
        const { code, name } = stock;

        // 가격 조회
        const priceData = await kis.getPrice(code, 'NX');
        const currentPrice = priceData.current;

        console.log(`📊 [${name}] 현재가: ${currentPrice}`);

        // 이전 가격 조회
        let previousPrice = currentPrice;
        try {
          const priceHistoryResult = await pool.query(
            `SELECT price FROM trade_history
             WHERE code = $1 AND action = 'BUY'
             ORDER BY created_at DESC LIMIT 1`,
            [code]
          );
          if (priceHistoryResult.rows.length > 0) {
            previousPrice = priceHistoryResult.rows[0].price;
          }
        } catch {
          console.log(`⚠️ [${name}] 이전 가격 조회 실패`);
        }

        // 낙폭 계산
        const dropPct = ((previousPrice - currentPrice) / previousPrice) * 100;
        const shouldBuy = dropPct >= (min_drop || 1.0);

        console.log(
          `📈 [${name}] 낙폭: ${dropPct.toFixed(2)}% (기준: ${min_drop}%)`
        );

        if (shouldBuy) {
          console.log(`🎯 [${name}] 매수 신호 감지!`);

          try {
            // 매수 실행
            const quantity = 1; // 기본 1주
            const orderResult = await kis.buy(code, quantity);

            if (orderResult) {
              console.log(
                `✅ [${name}] 매수 완료: ${quantity}주 @ ${currentPrice}`
              );

              // 거래 이력 저장
              try {
                await pool.query(
                  `INSERT INTO trade_history (code, name, action, quantity, price, analysis, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                  [
                    code,
                    name,
                    'BUY',
                    quantity,
                    currentPrice,
                    JSON.stringify({
                      dropPct: dropPct.toFixed(2),
                      previousPrice,
                    }),
                  ]
                );
              } catch (saveErr: any) {
                console.log(`⚠️ [${name}] 이력 저장 실패: ${saveErr.message}`);
              }

              buyCount++;
              results.push({
                code,
                name,
                action: 'BUY',
                quantity,
                price: currentPrice,
                dropPct: dropPct.toFixed(2),
                status: '✅ 매수 완료',
              });
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
            `⏭️ [${name}] 매수 신호 없음 (낙폭 ${dropPct.toFixed(2)}%)`
          );
          results.push({
            code,
            name,
            price: currentPrice,
            dropPct: dropPct.toFixed(2),
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

    await pool.end();
    return NextResponse.json({
      success: true,
      message: `${results.length}개 종목 처리 (매수: ${buyCount}건, 오류: ${errorCount}건)`,
      results,
    });
  } catch (err: any) {
    console.error('❌ 거래 오류:', err);
    await pool.end();
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
