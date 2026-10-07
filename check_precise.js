const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    // 유효한 데이터만 (0원 제외)
    const validData = await pool.query(`
      SELECT CAST(close AS NUMERIC) as price, timestamp AT TIME ZONE 'Asia/Seoul' as time
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(close AS NUMERIC) > 0
      ORDER BY CAST(close AS NUMERIC) ASC LIMIT 10
    `);

    console.log('✅ 유효한 최저가 상위 10개:\n');
    validData.rows.forEach((r, i) => {
      console.log(`${i+1}. ${r.price.toLocaleString()}원 @ ${r.time}`);
    });

    const absoluteLowest = validData.rows[0].price;
    const buyPrice = absoluteLowest * 1.01;
    const currentPrice = 272000;

    console.log(`\n📊 분석:`);
    console.log(`  전체 최저가: ${absoluteLowest.toLocaleString()}원`);
    console.log(`  매수기준 (1%): ${buyPrice.toLocaleString()}원`);
    console.log(`  현재가: ${currentPrice.toLocaleString()}원`);
    console.log(`  현재 상태: ${currentPrice >= buyPrice ? '✅ 매수 신호 충족!' : '❌ 미달'}`);

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

check();
