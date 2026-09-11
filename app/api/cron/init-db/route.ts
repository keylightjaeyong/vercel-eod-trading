import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

async function connectPostgres() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

export async function POST(req: NextRequest) {
  const pool = await connectPostgres();

  try {
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (code) REFERENCES stocks(code) ON DELETE CASCADE
      )
    `);
    console.log('✅ trade_history 테이블 생성/확인됨');

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

    await pool.end();
    return NextResponse.json({
      success: true,
      message: '데이터베이스 초기화 완료',
    });
  } catch (err: any) {
    console.error('❌ DB 초기화 실패:', err);
    await pool.end();
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
