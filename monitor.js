const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function monitor() {
  try {
    const [price, holding, low] = await Promise.all([
      pool.query(`SELECT CAST(close AS NUMERIC) as p, timestamp AT TIME ZONE 'Asia/Seoul' as t FROM price_snapshots WHERE code='005930' ORDER BY timestamp DESC LIMIT 1`),
      pool.query(`SELECT COUNT(*) as h FROM trade_positions WHERE status='holding'`),
      pool.query(`SELECT MIN(CAST(close AS NUMERIC)) as min FROM price_snapshots WHERE code='005930' AND DATE(timestamp AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE AT TIME ZONE 'Asia/Seoul' AND CAST(close AS NUMERIC) > 0`)
    ]);

    const p = price.rows[0].p;
    const t = price.rows[0].t;
    const h = holding.rows[0].h;
    const minPrice = low.rows[0].min;
    const buyPrice = minPrice * 1.01;

    console.log(`⏰ ${t}`);
    console.log(`💹 현재가: ${p.toLocaleString()}원`);
    console.log(`📉 오늘 저점: ${minPrice.toLocaleString()}원`);
    console.log(`🎯 매수기준: ${buyPrice.toLocaleString()}원`);
    console.log(`${p >= buyPrice ? `✅ 매수 신호!` : `❌ ${(buyPrice - p).toFixed(0)}원 모자람`}`);
    console.log(`\n${h > 0 ? `✅ 거래 성공! (${h}개 포지션)` : '⏳ 거래 대기'}`);

    await pool.end();
  } catch (e) {
    process.exit(1);
  }
}

monitor();
