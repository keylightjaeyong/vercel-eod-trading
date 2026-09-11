const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function createTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔄 Vercel Postgres에 연결 중...');
    const client = await pool.connect();
    console.log('✅ 연결 성공!');

    // 1. stocks 테이블
    console.log('📊 stocks 테이블 생성 중...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS stocks (
        code VARCHAR(10) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        allocation_pct FLOAT DEFAULT 0.0
      )
    `);
    console.log('✅ stocks 테이블 생성 완료');

    // 2. kis_tokens 테이블
    console.log('🔑 kis_tokens 테이블 생성 중...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS kis_tokens (
        id SERIAL PRIMARY KEY,
        access_token TEXT NOT NULL,
        expires_at BIGINT NOT NULL
      )
    `);
    console.log('✅ kis_tokens 테이블 생성 완료');

    // 3. trades 테이블
    console.log('💹 trades 테이블 생성 중...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        stock_code VARCHAR(10),
        stock_name VARCHAR(50),
        entry_price FLOAT,
        exit_price FLOAT,
        quantity INT,
        profit_pct FLOAT,
        profit_amount FLOAT,
        entry_time TIMESTAMP,
        exit_time TIMESTAMP,
        reason TEXT,
        duration_min INT
      )
    `);
    console.log('✅ trades 테이블 생성 완료');

    // 4. trading_status 테이블
    console.log('📈 trading_status 테이블 생성 중...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS trading_status (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT NOW(),
        total_capital FLOAT DEFAULT 0.0
      )
    `);
    console.log('✅ trading_status 테이블 생성 완료');

    // 5. trading_config 테이블
    console.log('⚙️ trading_config 테이블 생성 중...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS trading_config (
        id SERIAL PRIMARY KEY,
        enabled BOOLEAN DEFAULT true,
        test_mode BOOLEAN DEFAULT false
      )
    `);
    console.log('✅ trading_config 테이블 생성 완료');

    // 초기 데이터 삽입
    console.log('\n📝 초기 데이터 삽입 중...');

    // stocks 초기 데이터
    await client.query(`
      INSERT INTO stocks (code, name, enabled, allocation_pct)
      VALUES ('000660', 'SK하이닉스', true, 50)
      ON CONFLICT (code) DO NOTHING
    `);
    await client.query(`
      INSERT INTO stocks (code, name, enabled, allocation_pct)
      VALUES ('005930', '삼성전자', true, 30)
      ON CONFLICT (code) DO NOTHING
    `);
    console.log('✅ stocks 초기 데이터 삽입 완료');

    // trading_status 초기 데이터
    await client.query(`
      INSERT INTO trading_status (id, timestamp, total_capital)
      VALUES (1, NOW(), 300000)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ trading_status 초기 데이터 삽입 완료');

    // trading_config 초기 데이터
    await client.query(`
      INSERT INTO trading_config (id, enabled, test_mode)
      VALUES (1, true, false)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ trading_config 초기 데이터 삽입 완료');

    console.log('\n═══════════════════════════════════════');
    console.log('✅ 모든 테이블 생성 및 초기 데이터 삽입 완료!');
    console.log('═══════════════════════════════════════\n');

    client.release();
  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTables();
