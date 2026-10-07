const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    // 10월 7일 데이터
    const morning = await pool.query(`
      SELECT CAST(close AS NUMERIC) as price, 
             timestamp AT TIME ZONE 'Asia/Seoul' as time
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(close AS NUMERIC) > 0
      AND timestamp >= '2026-10-07 00:00:00'::timestamp
      ORDER BY CAST(close AS NUMERIC) ASC
    `);

    console.log('📊 10월 7일 가격 데이터:\n');
    
    if (morning.rows.length > 0) {
      console.log('최저가 상위:');
      morning.rows.slice(0, 10).forEach((r, i) => {
        console.log(`${i+1}. ${r.price.toLocaleString()}원 @ ${r.time}`);
      });

      const lowest = morning.rows[0].price;
      const buyPrice = lowest * 1.01;
      
      console.log(`\n💡 분석:`);
      console.log(`  저점: ${lowest.toLocaleString()}원`);
      console.log(`  매수기준 (1%): ${buyPrice.toLocaleString()}원`);
      console.log(`  현재가 (시뮬): 272,500원`);
      console.log(`  상태: ${272500 >= buyPrice ? '✅ 매수 신호 충족!' : `❌ ${(buyPrice - 272500).toFixed(0)}원 모자람`}`);
    } else {
      console.log('10월 7일 데이터 없음');
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

check();
