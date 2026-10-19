const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    // 1. 현재 enabled stocks 확인
    const stocks = await pool.query('SELECT code, name, enabled FROM stocks');
    console.log('=== 현재 stocks 설정 ===');
    stocks.rows.forEach(s => {
      console.log(`  ${s.code} (${s.name}): enabled=${s.enabled}`);
    });

    // 2. enabled=true인 종목 확인
    const enabled = await pool.query('SELECT code, name FROM stocks WHERE enabled = true');
    console.log(`\n✅ enabled=true 종목: ${enabled.rows.length}개`);
    enabled.rows.forEach(s => console.log(`    - ${s.code} (${s.name})`));

    // 3. 그 종목의 최근 가격 데이터 확인
    if (enabled.rows.length > 0) {
      for (const stock of enabled.rows) {
        const prices = await pool.query(
          'SELECT COUNT(*) as cnt FROM price_snapshots WHERE code = $1',
          [stock.code]
        );
        console.log(`\n[${stock.code}] 가격 데이터: ${prices.rows[0].cnt}개`);
      }
    } else {
      console.log('\n❌ enabled=true인 종목이 없습니다!');
    }

    await pool.end();
  } catch (err) {
    console.error('오류:', err.message);
  }
})();
