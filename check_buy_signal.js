const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const p = await pool.query(`SELECT CAST(close AS NUMERIC) as p FROM price_snapshots WHERE code='005930' AND CAST(close AS NUMERIC) > 0 ORDER BY timestamp DESC LIMIT 1`);
    const l72 = await pool.query(`SELECT MIN(CAST(close AS NUMERIC)) as min FROM (SELECT close FROM price_snapshots WHERE code='005930' AND CAST(close AS NUMERIC) > 0 ORDER BY timestamp DESC LIMIT 72) as recent`);
    const lall = await pool.query(`SELECT MIN(CAST(close AS NUMERIC)) as min FROM price_snapshots WHERE code='005930' AND CAST(close AS NUMERIC) > 0`);

    const price = p.rows[0].p;
    const min72 = l72.rows[0].min;
    const minAll = lall.rows[0].min;

    console.log(`💹 현재가: ${price.toLocaleString()}원\n`);
    console.log('📊 매수 신호 비교:\n');
    
    const buy72 = min72 * 1.01;
    const buyAll = minAll * 1.01;

    console.log(`방법1) 최근 72개 저점: ${min72.toLocaleString()}원`);
    console.log(`  매수기준: ${buy72.toLocaleString()}원`);
    console.log(`  상태: ${price >= buy72 ? `✅ 신호!` : `❌ ${(buy72-price).toFixed(0)}원 모자람`}\n`);

    console.log(`방법2) 전체 저점: ${minAll.toLocaleString()}원`);
    console.log(`  매수기준: ${buyAll.toLocaleString()}원`);
    console.log(`  상태: ${price >= buyAll ? `✅ 신호!` : `❌ ${(buyAll-price).toFixed(0)}원 모자람`}`);

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
  }
}

check();
