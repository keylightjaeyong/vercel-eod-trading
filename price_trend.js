const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function trend() {
  try {
    // 최근 10개 가격
    const result = await pool.query(`
      SELECT CAST(close AS NUMERIC) as price, 
             timestamp,
             ROW_NUMBER() OVER (ORDER BY timestamp DESC) as seq
      FROM price_snapshots 
      WHERE code = '005930'
      ORDER BY timestamp DESC LIMIT 10
    `);

    const prices = result.rows.reverse();
    
    console.log('📊 최근 10개 가격 추이:\n');
    let direction = '';
    prices.forEach((p, i) => {
      if (i > 0) {
        const change = p.price - prices[i-1].price;
        const badge = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
        console.log(`${i}. ${p.price.toLocaleString()}원 ${badge} (${change > 0 ? '+' : ''}${change.toFixed(0)}원)`);
      } else {
        console.log(`${i}. ${p.price.toLocaleString()}원`);
      }
    });

    const first = prices[0].price;
    const last = prices[prices.length - 1].price;
    const totalChange = last - first;
    const trend = totalChange > 0 ? '📈 상승' : totalChange < 0 ? '📉 하락' : '➡️ 횡보';

    console.log(`\n현재 추세: ${trend}`);
    console.log(`변화: ${totalChange > 0 ? '+' : ''}${totalChange.toFixed(0)}원`);

    await pool.end();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

trend();
