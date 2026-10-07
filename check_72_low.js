const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    // 최근 72개 중 저점 찾기
    const result = await pool.query(`
      SELECT CAST(close AS NUMERIC) as price, 
             timestamp AT TIME ZONE 'Asia/Seoul' as time
      FROM (
        SELECT close, timestamp 
        FROM price_snapshots 
        WHERE code='005930'
        ORDER BY timestamp DESC 
        LIMIT 72
      ) as recent
      WHERE CAST(close AS NUMERIC) > 0
      ORDER BY CAST(close AS NUMERIC) ASC
    `);

    console.log('📊 최근 72개 데이터의 저점 상위 10개:\n');
    
    if (result.rows.length === 0) {
      console.log('데이터 없음');
    } else {
      result.rows.slice(0, 10).forEach((r, i) => {
        console.log(`${i+1}. ${r.price.toLocaleString()}원 @ ${r.time}`);
      });

      const lowest = result.rows[0];
      const current = 270000;
      const buyPrice = lowest.price * 1.01;

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📉 최저가: ${lowest.price.toLocaleString()}원`);
      console.log(`🕐 시간: ${lowest.time}`);
      console.log(`🎯 매수기준 (1%): ${buyPrice.toLocaleString()}원`);
      console.log(`💹 현재가: ${current.toLocaleString()}원`);
      console.log(`${current >= buyPrice ? `✅ 매수 신호!` : `❌ ${(buyPrice - current).toFixed(0)}원 모자람`}`);
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
  }
}

check();
