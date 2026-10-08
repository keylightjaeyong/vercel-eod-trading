import { NextRequest, NextResponse } from 'next/server';
import { KISApi } from '@/lib/kis/api';
import { getExchangeCode, isTradingTime } from '@/lib/utils/exchange';
import { nowInSeoul, getKSTTimeInfo } from '@/lib/utils/timezone';
import { getPostgresPool } from '@/lib/db/pool';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    console.log(`📊 모드: 순수 실시간 수집 (부트스트랩 비활성화)`);

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
        console.log(`🔄 [${name}] KIS API 호출 시작...`);
        const priceData = await kis.retryGetPrice(code, 'NX');
        const currentPrice = priceData.current;

        console.log(`✅ [${name}] 현재가: ${currentPrice.toLocaleString()}원`);

        // 중복 방지: 최근 3분 내 같은 가격 확인
        const recentPrice = await pool.query(
          `SELECT close FROM price_snapshots
           WHERE code = $1 AND created_at > NOW() - INTERVAL '3 minutes'
           ORDER BY created_at DESC LIMIT 1`,
          [code]
        );

        if (recentPrice.rows.length > 0 && recentPrice.rows[0].close == currentPrice) {
          console.log(`⏭️ [${name}] 같은 가격 (중복 방지, 저장 스킵): ${currentPrice}원`);
          successCount++;
          results.push({
            code,
            name,
            price: currentPrice,
            status: '⏭️ 중복 방지 (저장 안 함)',
          });
          continue;
        }

        // price_snapshots에 저장 (현재 close 가격만 필수)
        const insertResult = await pool.query(
          `INSERT INTO price_snapshots
           (code, timestamp, close, created_at)
           VALUES ($1, CURRENT_TIMESTAMP, $2, CURRENT_TIMESTAMP)`,
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
