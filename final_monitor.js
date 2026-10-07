const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function monitor() {
  try {
    const time = await pool.query(`SELECT NOW() AT TIME ZONE 'Asia/Seoul' as kst_time`);
    const price = await pool.query(`SELECT CAST(close AS NUMERIC) as price FROM price_snapshots WHERE code = '005930' ORDER BY timestamp DESC LIMIT 1`);
    const trades = await pool.query(`SELECT id, name, quantity, entry_price, status FROM trade_positions ORDER BY created_at DESC LIMIT 1`);

    const now = time.rows[0].kst_time;
    const current = price.rows[0].price;
    const buyTarget = 272805; // 상승장 기준

    console.log(`\n⏰ ${now}`);
    console.log(`💹 현재가: ${current.toLocaleString()}원`);
    console.log(`🎯 매수기준: ${buyTarget.toLocaleString()}원`);
    console.log(`📊 차이: ${current >= buyTarget ? `✅ +${(current - buyTarget).toFixed(0)}원 (매수!)` : `❌ ${(current - buyTarget).toFixed(0)}원`}\n`);

    if (trades.rows.length > 0) {
      const t = trades.rows[0];
      console.log(`✅ 거래 발생!`);
      console.log(`  [${t.name}] ${t.quantity}주 @ ${t.entry_price}원`);
    } else {
      console.log(`⏳ 거래: 아직 없음\n`);
    }

    await pool.end();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

monitor();
