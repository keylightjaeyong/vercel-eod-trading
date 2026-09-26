const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const config = {
  global_settings: {
    min_drop: 0.05,
    min_rise: 0.05,
    search_window: 15,
    confidence_threshold: 60,
    test_mode: false,
    enabled: true
  }
};

pool.query(
  'INSERT INTO trading_config (id, config_json) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET config_json = $2',
  [1, JSON.stringify(config)],
  (err, res) => {
    if (err) {
      console.error('❌ 오류:', err.message);
    } else {
      console.log('✅ 설정 업데이트 완료!');
      console.log('업데이트된 값:');
      console.log(JSON.stringify(config, null, 2));
    }
    pool.end();
  }
);
