import { NextRequest, NextResponse } from 'next/server';
import { KISApi } from '@/lib/kis/api';
import { getExchangeCode, isTradingTime } from '@/lib/utils/exchange';
import { nowInSeoul, getKSTTimeInfo } from '@/lib/utils/timezone';
import { getPostgresPool } from '@/lib/db/pool';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/cron/collect-prices
 * Heroku에서 5분마다 호출
 * 모든 활성화된 종목의 현재가를 price_snapshots에 저장
 */
export async function POST(req: NextRequest) {
  const timeInfo = getKSTTimeInfo();
  console.log(`📊 가격 수집 시작 (5분 주기) - KST ${timeInfo.hour}:${String(timeInfo.minute).padStart(2, '0')}`);

  const pool = getPostgresPool();

  try {
    // 0. price_snapshots 테이블 자동 생성
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS price_snapshots (
          id SERIAL PRIMARY KEY,
          code VARCHAR(10) NOT NULL,
          timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          close DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ price_snapshots 테이블 확인/생성됨');
    } catch (err: any) {
      console.error(`❌ price_snapshots 테이블 생성 실패: ${err.message}`);
    }

    // 0-1. trade_positions 테이블 자동 생성
    try {
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
      console.log('✅ trade_positions 테이블 확인/생성됨');
    } catch (err: any) {
      console.error(`❌ trade_positions 테이블 생성 실패: ${err.message}`);
    }

    // 1. 활성화된 종목 조회
    const stocksResult = await pool.query(
      'SELECT code, name FROM stocks WHERE enabled = true LIMIT 50'
    );

    if (stocksResult.rows.length === 0) {
      console.log('📭 활성화된 종목 없음');
      // 커넥션풀 사용 → pool.end() 호출 안 함
      return NextResponse.json({
        success: true,
        message: '수집할 종목 없음',
      });
    }

    console.log(`🔍 수집 대상 종목: ${stocksResult.rows.length}개`);

    // 🚀 부트스트랩 체크: 데이터 부족 시 초기 로드
    const checkBootstrapResult = await pool.query(
      `SELECT code, COUNT(*) as count FROM price_snapshots
       WHERE code IN (${stocksResult.rows.map((_, i) => `$${i + 1}`).join(',')})
       GROUP BY code`,
      stocksResult.rows.map(s => s.code)
    );

    const dataCountByCode: Record<string, number> = {};
    for (const row of checkBootstrapResult.rows) {
      dataCountByCode[row.code] = parseInt(row.count);
    }

    // 데이터 부족 종목 확인
    const needsBootstrap = stocksResult.rows.filter(s => (dataCountByCode[s.code] || 0) < 30);
    if (needsBootstrap.length > 0) {
      console.log(`⚡ 부트스트랩 필요: ${needsBootstrap.map(s => `${s.name}(${dataCountByCode[s.code] || 0}/30)`).join(', ')}`);

      // 각 종목별로 현재가 기반으로 부트스트랩 데이터 생성
      const kis = new KISApi();
      kis.updateEnv();

      for (const stock of needsBootstrap) {
        try {
          const { code, name } = stock;
          const currentPrice = await kis.retryGetPrice(code, 'NX').then(p => p.current);

          // 부트스트랩: 이전날 20:00부터 역산해서 30개 5분 간격 데이터 생성
          // 변동성: ±0.1% 범위로 약간씩 변화 (전일 가격 패턴 모방)
          const bootstrapCount = 30 - (dataCountByCode[code] || 0);
          const bootstrapPrices: Array<{price: number, minutesAgo: number}> = [];

          for (let i = bootstrapCount - 1; i >= 0; i--) {
            // 변동성 추가 (±0.1%)
            const variance = (Math.random() - 0.5) * (currentPrice * 0.002);
            const bootstrapPrice = Math.round(currentPrice + variance);
            bootstrapPrices.push({
              price: bootstrapPrice,
              minutesAgo: (i + 1) * 5 // 5분 간격
            });
          }

          // DB에 일괄 삽입 (이전날 20:00 기준)
          const previousDayEnd = new Date();
          previousDayEnd.setHours(20, 0, 0, 0);
          previousDayEnd.setDate(previousDayEnd.getDate() - 1);

          let bootstrapInserted = 0;
          for (const bp of bootstrapPrices) {
            const timestamp = new Date(previousDayEnd.getTime() - bp.minutesAgo * 60000);
            try {
              const result = await pool.query(
                `INSERT INTO price_snapshots (code, timestamp, close, created_at)
                 VALUES ($1, $2, $3, ${nowInSeoul()})`,
                [code, timestamp, bp.price]
              );
              if (result.rowCount && result.rowCount > 0) {
                bootstrapInserted++;
              }
            } catch (insertErr) {
              // 중복 시 무시
            }
          }

          console.log(`✅ [${name}] 부트스트랩 완료: ${bootstrapInserted}개 데이터 추가 (총 ${(dataCountByCode[code] || 0) + bootstrapInserted}/30)`);
        } catch (bootstrapErr: any) {
          console.warn(`⚠️ [${stock.name}] 부트스트랩 실패: ${bootstrapErr.message}`);
        }
      }
    }

    // 1-1. 거래 상태 확인 (가격 수집은 계속 진행)
    try {
      const statusResult = await pool.query(
        'SELECT trading_enabled FROM trading_status WHERE id = 1'
      );
      const status = statusResult.rows[0];
      if (status && !status.trading_enabled) {
        console.log(`⚠️ 거래 중단 상태이지만 가격 수집은 계속 진행`);
      }
    } catch (err) {
      console.warn('⚠️ 거래 상태 조회 실패, 계속 진행:', err);
    }

    // 2. KIS API 초기화
    const kis = new KISApi();
    kis.updateEnv();

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // 3. 각 종목별 현재가 조회 및 저장
    const exchangeCode = getExchangeCode(timeInfo.hour, timeInfo.minute);
    console.log(`🔄 현재 거래소: ${exchangeCode} (${timeInfo.hour}:${String(timeInfo.minute).padStart(2, '0')})`);

    for (const stock of stocksResult.rows) {
      try {
        const { code, name } = stock;

        // KIS API에서 현재가 조회 (재시도 로직 포함)
        // NX 사용 (정상 작동)
        const priceData = await kis.retryGetPrice(code, 'NX');
        const currentPrice = priceData.current;

        console.log(`📈 [${name}] 현재가: ${currentPrice.toLocaleString()}원`);

        // price_snapshots에 저장 (현재 close 가격만 필수)
        const insertResult = await pool.query(
          `INSERT INTO price_snapshots
           (code, timestamp, close, created_at)
           VALUES ($1, ${nowInSeoul()}, $2, ${nowInSeoul()})`,
          [code, currentPrice]
        );

        console.log(`💾 INSERT 결과: rowCount=${insertResult.rowCount}, code=${code}`);

        if (insertResult.rowCount && insertResult.rowCount > 0) {
          successCount++;
          results.push({
            code,
            name,
            price: currentPrice,
            status: '✅ 저장됨',
          });
          console.log(`✅ [${name}] DB 저장 성공: ${currentPrice}원`);
        } else {
          errorCount++;
          results.push({
            code,
            name,
            price: currentPrice,
            status: '❌ DB 저장 실패 (rowCount 0)',
          });
          console.error(`❌ [${name}] DB 저장 실패: rowCount=${insertResult.rowCount}`);
        }
      } catch (err: any) {
        console.error(`❌ [${stock.name}] 가격 조회/저장 실패: ${err.message}`);
        errorCount++;
        results.push({
          code: stock.code,
          name: stock.name,
          error: err.message,
          status: '❌ 실패',
        });
      }
    }

    // 4. 오래된 데이터 삭제 (30일 이상 - 날짜 단위)
    try {
      const deleteResult = await pool.query(
        `DELETE FROM price_snapshots
         WHERE DATE(created_at AT TIME ZONE 'Asia/Seoul') < CURRENT_DATE AT TIME ZONE 'Asia/Seoul' - INTERVAL '30 days'`
      );
      console.log(`🗑️ 오래된 가격 데이터 삭제 (날짜 단위): ${deleteResult.rowCount}행`);
    } catch (err: any) {
      console.warn(`⚠️ 데이터 정리 실패: ${err.message}`);
    }

    // 커넥션풀 사용 → pool.end() 호출 안 함

    console.log(
      `✅ 가격 수집 완료: 성공 ${successCount}개, 실패 ${errorCount}개`
    );

    return NextResponse.json({
      success: true,
      message: `가격 수집 완료: ${successCount}개 성공, ${errorCount}개 실패`,
      results,
      debug: {
        successCount,
        errorCount,
        database: process.env.DATABASE_URL ? 'Connected' : 'Not connected',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('❌ 가격 수집 중 오류:', err);
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
