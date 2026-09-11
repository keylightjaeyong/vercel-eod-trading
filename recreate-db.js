const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    console.log('🗑️ 기존 테이블 삭제...');
    await pool.query('DROP TABLE IF EXISTS trading_config');
    
    console.log('📊 테이블 재생성...');
    await pool.query(`
      CREATE TABLE trading_config (
        id INTEGER PRIMARY KEY,
        config_json TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('✅ 테이블 생성 완료');
    
    console.log('📝 샘플 데이터 삽입...');
    const sampleConfig = {
      global_settings: {
        min_drop: 1.0,
        min_rise: 0.5,
        search_window: 10,
        trailing_stop_loss_pct: 0.2,
        search_candles_limit: 10,
        test_mode: false,
        enabled: true,
      },
      stocks: [
        { code: '000660', name: 'SK하이닉스', enabled: true, allocation_pct: 50 },
        { code: '005930', name: '삼성전자', enabled: true, allocation_pct: 30 },
      ],
    };
    
    await pool.query(
      'INSERT INTO trading_config (id, config_json) VALUES (1, $1)',
      [JSON.stringify(sampleConfig, null, 2)]
    );
    
    console.log('✅ 샘플 데이터 삽입 완료');
    
    const result = await pool.query('SELECT * FROM trading_config');
    console.log('✅ 저장된 설정:', result.rows[0]);
    
  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await pool.end();
  }
})();
