import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import KISApi from '@/lib/kis/api';

async function connectPostgres() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

// V자 패턴 분석
function analyzeVPattern(prices: number[], config: any) {
  if (prices.length < 3) return { signal: null };

  const n = prices.length;
  const minDropPct = config.min_drop || 1.0;
  const minRisePct = config.min_rise || 0.5;
  const searchWindow = config.search_window || 10;

  // 최근 N개 봉에서 최고가/최저가 찾기
  const recentPrices = prices.slice(Math.max(0, n - searchWindow));
  const maxPrice = Math.max(...recentPrices);
  const minPrice = Math.min(...recentPrices);
  const currentPrice = prices[n - 1];

  // 낙폭 계산
  const dropPct = ((maxPrice - minPrice) / maxPrice) * 100;

  // 상승폭 계산 (최저가에서 현재가까지)
  const risePct = ((currentPrice - minPrice) / minPrice) * 100;

  // V자 신호 확인
  if (dropPct >= minDropPct && risePct >= minRisePct) {
    return {
      signal: 'BUY',
      dropPct: dropPct.toFixed(2),
      risePct: risePct.toFixed(2),
      price: currentPrice,
    };
  }

  return { signal: null };
}

// 거래 실행
async function executeTrades() {
  const pool = await connectPostgres();
  let successCount = 0;
  let errorCount = 0;
  const trades: any[] = [];

  try {
    // 1. 설정 조회
    const configResult = await pool.query(
      'SELECT config_json FROM trading_config WHERE id = 1'
    );

    if (configResult.rows.length === 0) {
      return { success: false, error: '설정을 찾을 수 없습니다' };
    }

    const config = JSON.parse(configResult.rows[0].config_json);
    const { enabled, min_drop, min_rise, search_window } =
      config.global_settings;

    // 거래 비활성화 확인
    if (!enabled) {
      console.log('⏸️ 거래가 비활성화되었습니다');
      await pool.end();
      return { success: true, message: '거래 비활성화됨', trades: [] };
    }

    // 2. 종목 조회
    const stocksResult = await pool.query(
      'SELECT code, name FROM stocks WHERE enabled = true'
    );

    if (stocksResult.rows.length === 0) {
      console.log('📭 활성화된 종목이 없습니다');
      await pool.end();
      return { success: true, message: '활성화된 종목 없음', trades: [] };
    }

    console.log(`🚀 거래 시작: ${stocksResult.rows.length}개 종목 분석`);

    // 3. KIS API 초기화
    const kis = new KISApi();

    // 4. 각 종목별 거래 실행
    const tradePromises = stocksResult.rows.map(async (stock: any) => {
      try {
        const { code, name } = stock;

        // 종목 코드 변환
        const exchangeCode = kis.getExchangeCode(code);

        // 가격 조회
        const priceData = await kis.getPrice(code, exchangeCode);

        if (!priceData || priceData.length === 0) {
          console.log(`⚠️ [${name}] 가격 데이터 없음`);
          return { code, name, signal: null, error: '가격 조회 실패' };
        }

        // V자 패턴 분석
        const analysis = analyzeVPattern(priceData, config.global_settings);

        if (analysis.signal === 'BUY') {
          console.log(
            `📈 [${name}] V자 신호 감지! 낙폭: ${analysis.dropPct}%, 상승폭: ${analysis.risePct}%`
          );

          // 계좌 잔고 조회
          const account = await kis.getAccount();
          const availableCash = account.cash || 0;

          // 매수 가능 수량 계산 (잔고의 10% 사용)
          const tradeAmount = availableCash * 0.1;
          const quantity = Math.floor(tradeAmount / analysis.price);

          if (quantity > 0) {
            // 매수 주문
            const orderResult = await kis.buy(code, quantity, analysis.price);

            if (orderResult) {
              console.log(
                `✅ [${name}] 매수 완료: ${quantity}주 @ ${analysis.price}`
              );

              // 거래 이력 저장
              await pool.query(
                `INSERT INTO trade_history
                 (code, name, action, quantity, price, analysis, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [
                  code,
                  name,
                  'BUY',
                  quantity,
                  analysis.price,
                  JSON.stringify(analysis),
                ]
              );

              successCount++;
              return { code, name, signal: 'BUY', quantity, price: analysis.price, status: '매수 완료' };
            }
          } else {
            console.log(`💰 [${name}] 잔고 부족 (필요: ${tradeAmount})`);
            return { code, name, signal: 'BUY', error: '잔고 부족' };
          }
        } else {
          return { code, name, signal: null };
        }
      } catch (err: any) {
        errorCount++;
        console.error(
          `❌ [${stock.name}] 거래 실패: ${err.message}`
        );
        return { code: stock.code, name: stock.name, error: err.message };
      }
    });

    // 모든 거래 병렬 실행
    const results = await Promise.all(tradePromises);
    trades.push(...results);

    console.log(`✅ 거래 완료: 성공 ${successCount}, 실패 ${errorCount}`);

    await pool.end();
    return {
      success: true,
      message: `거래 완료: ${successCount}건 성공, ${errorCount}건 실패`,
      trades,
    };
  } catch (err: any) {
    console.error('❌ 거래 실행 중 오류:', err);
    await pool.end();
    return { success: false, error: err.message };
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('🔄 자동 거래 시작');
    const result = await executeTrades();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('❌ Cron job 오류:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// 로컬 테스트용
export async function GET(req: NextRequest) {
  return POST(req);
}
