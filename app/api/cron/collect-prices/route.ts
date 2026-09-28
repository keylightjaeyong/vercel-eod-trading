import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { KISApi } from '@/lib/kis/api';

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
 * POST /api/cron/collect-prices
 * Heroku에서 5분마다 호출
 * 모든 활성화된 종목의 현재가를 price_snapshots에 저장
 */
export async function POST(req: NextRequest) {
  console.log('📊 가격 수집 시작 (5분 주기)');

  const pool = await connectPostgres();

  try {
    // 0. price_snapshots 테이블 자동 생성 (Foreign Key 제거)
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

    // 1. 활성화된 종목 조회
    const stocksResult = await pool.query(
      'SELECT code, name FROM stocks WHERE enabled = true LIMIT 50'
    );

    if (stocksResult.rows.length === 0) {
      console.log('📭 활성화된 종목 없음');
      await pool.end();
      return NextResponse.json({
        success: true,
        message: '수집할 종목 없음',
      });
    }

    console.log(`🔍 수집 대상 종목: ${stocksResult.rows.length}개`);

    // 2. KIS API 초기화
    const kis = new KISApi();
    kis.updateEnv();

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // 3. 각 종목별 현재가 조회 및 저장
    for (const stock of stocksResult.rows) {
      try {
        const { code, name } = stock;

        // KIS API에서 현재가 조회
        const priceData = await kis.getPrice(code, 'NX');
        const currentPrice = priceData.current;

        console.log(`📈 [${name}] 현재가: ${currentPrice.toLocaleString()}원`);

        // price_snapshots에 저장 (현재 close 가격만 필수)
        const insertResult = await pool.query(
          `INSERT INTO price_snapshots
           (code, timestamp, close, created_at)
           VALUES ($1, NOW(), $2, NOW())`,
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

    // 4. 오래된 데이터 삭제 (30일 이상)
    try {
      const deleteResult = await pool.query(
        `DELETE FROM price_snapshots
         WHERE created_at < NOW() - INTERVAL '30 days'`
      );
      console.log(`🗑️ 오래된 가격 데이터 삭제: ${deleteResult.rowCount}행`);
    } catch (err: any) {
      console.warn(`⚠️ 데이터 정리 실패: ${err.message}`);
    }

    await pool.end();

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
