const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const time = await pool.query(`SELECT NOW() AT TIME ZONE 'Asia/Seoul' as kst_time`);
    const trades = await pool.query(`SELECT code, name, quantity, entry_price, status, created_at AT TIME ZONE 'Asia/Seoul' as trade_time FROM trade_positions ORDER BY created_at DESC LIMIT 5`);
    const price = await pool.query(`SELECT CAST(close AS NUMERIC) as price FROM price_snapshots WHERE code = '005930' ORDER BY timestamp DESC LIMIT 1`);

    console.log(`\n⏰ ${time.rows[0].kst_time}`);
    console.log(`💹 현재가: ${price.rows[0].price.toLocaleString()}원\n`);

    if (trades.rows.length === 0) {
      console.log('⏳ 거래 기록: 없음');
    } else {
      console.log('📊 거래 기록:');
      trades.rows.forEach((t, i) => {
        const badge = t.status === 'holding' ? '✅ 보유' : '✅ 매도';
        console.log(`${i+1}. ${badge} [${t.code}] ${t.name} | ${t.quantity}주 @ ${t.entry_price}원 (${t.trade_time})`);
      });
    }

    await pool.end();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

check();
