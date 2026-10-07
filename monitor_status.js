const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function monitor() {
  try {
    const time = await pool.query(`SELECT NOW() AT TIME ZONE 'Asia/Seoul' as kst_time`);
    const price = await pool.query(`SELECT CAST(close AS NUMERIC) as price FROM price_snapshots WHERE code = '005930' ORDER BY timestamp DESC LIMIT 1`);
    const trades = await pool.query(`SELECT COUNT(*) as cnt FROM trade_positions`);
    const holding = await pool.query(`SELECT COUNT(*) as cnt FROM trade_positions WHERE status = 'holding'`);

    const now = time.rows[0].kst_time;
    const current = price.rows[0].price;
    const tradeCount = trades.rows[0].cnt;
    const holdingCount = holding.rows[0].cnt;

    console.log(`\n⏰ ${now}`);
    console.log(`💹 현재가: ${current.toLocaleString()}원`);
    console.log(`📊 총 거래: ${tradeCount}건`);
    console.log(`🏠 보유 중: ${holdingCount}건\n`);

    if (holdingCount > 0) {
      console.log(`✅ 거래 성공! ${holdingCount}개 포지션 보유 중`);
    } else {
      console.log(`⏳ 매수 대기 중...`);
    }

    await pool.end();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

monitor();
