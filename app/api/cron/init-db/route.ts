import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/db/pool';

export async function POST(req: NextRequest) {
  const pool = getPostgresPool();

  try {
    // 0. trading_config 테이블 생성 (거래 설정)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trading_config (
        id INTEGER PRIMARY KEY,
        config_json TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ trading_config 테이블 생성/확인됨');

    // 1. stocks 테이블 생성 (종목 목록)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stocks (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ stocks 테이블 생성/확인됨');

    // 2. trade_history 테이블 생성 (거래 이력)
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
    console.log('✅ trade_history 테이블 생성/확인됨');

    // 2-1. price_snapshots 테이블 생성 (5분마다 가격 저장)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_snapshots (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        open DECIMAL(10, 2),
        high DECIMAL(10, 2),
        low DECIMAL(10, 2),
        close DECIMAL(10, 2) NOT NULL,
        volume BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (code) REFERENCES stocks(code) ON DELETE CASCADE
      )
    `);
    console.log('✅ price_snapshots 테이블 생성/확인됨');

    // 2-2. price_snapshots 인덱스 생성 (조회 성능)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_price_snapshots_code_time
      ON price_snapshots(code, timestamp DESC)
    `);
    console.log('✅ price_snapshots 인덱스 생성/확인됨');

    // 2-3. kis_tokens 테이블 생성 (KIS API 토큰 캐싱)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kis_tokens (
        id SERIAL PRIMARY KEY,
        access_token VARCHAR(500) NOT NULL,
        refresh_token VARCHAR(500),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ kis_tokens 테이블 생성/확인됨');

    // 2-4. kis_tokens 인덱스 생성 (토큰 조회 성능)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_kis_tokens_id
      ON kis_tokens(id)
    `);
    console.log('✅ kis_tokens 인덱스 생성/확인됨');

    // 3. 기본 종목 데이터 삽입 (없으면)
    const stocksCheck = await pool.query(
      'SELECT COUNT(*) as count FROM stocks'
    );

    if (stocksCheck.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO stocks (code, name, enabled)
        VALUES
          ('000660', 'SK하이닉스', true),
          ('005930', '삼성전자', true)
      `);
      console.log('✅ 기본 종목 데이터 삽입됨');
    }

    // 레거시 시스템 비활성화 알림
    console.log(
      '⚠️ 레거시 /api/buy, /api/sell은 비활성화됨. /api/cron/trade, /api/cron/sell 사용'
    );

    // 커넥션풀 사용 → pool.end() 호출 안 함
    return NextResponse.json({
      success: true,
      message: '데이터베이스 초기화 완료',
    });
  } catch (err: any) {
    console.error('❌ DB 초기화 실패:', err);
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
