const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    // 전체 최저가 찾기
    const allLow = await pool.query(`
      SELECT CAST(close AS NUMERIC) as price, timestamp
      FROM price_snapshots 
      WHERE code='005930'
      ORDER BY CAST(close AS NUMERIC) ASC LIMIT 1
    `);

    // 08:00~10:00 범위의 데이터
    const morning = await pool.query(`
      SELECT CAST(close AS NUMERIC) as price, timestamp,
             EXTRACT(HOUR FROM timestamp AT TIME ZONE 'Asia/Seoul') as hour
      FROM price_snapshots 
      WHERE code='005930'
      AND timestamp AT TIME ZONE 'Asia/Seoul' >= '2026-10-07 08:00:00'
      AND timestamp AT TIME ZONE 'Asia/Seoul' <= '2026-10-07 10:00:00'
      ORDER BY CAST(close AS NUMERIC) ASC LIMIT 10
    `);

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 아침 시간대 가격 데이터 분석');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('🔍 전체 최저가:');
    console.log(`  가격: ${allLow.rows[0].price.toLocaleString()}원`);
    console.log(`  시간: ${allLow.rows[0].timestamp}\n`);

    console.log('📈 08:00~10:00 구간 최저가:');
    if (morning.rows.length > 0) {
      morning.rows.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i+1}. ${r.price.toLocaleString()}원 @ ${new Date(r.timestamp).toLocaleTimeString()}`);
      });
    } else {
      console.log('  데이터 없음');
    }

    // 269,500 이하 찾기
    const veryLow = await pool.query(`
      SELECT COUNT(*) as cnt, MIN(CAST(close AS NUMERIC)) as min_price
      FROM price_snapshots 
      WHERE code='005930'
      AND CAST(close AS NUMERIC) <= 269500
    `);

    console.log('\n📉 269,500원 이하인 데이터:');
    console.log(`  개수: ${veryLow.rows[0].cnt}개`);
    if (veryLow.rows[0].cnt > 0) {
      console.log(`  최저: ${veryLow.rows[0].min_price.toLocaleString()}원`);
    }

    // 현재 매수 신호 조건 재검토
    if (veryLow.rows[0].cnt > 0) {
      const newLow = veryLow.rows[0].min_price;
      const buyPrice = newLow * 1.01;
      const currentPrice = 272000;
      
      console.log('\n🎯 만약 저점이 269,500원 이하라면:');
      console.log(`  저점: ${newLow.toLocaleString()}원`);
      console.log(`  매수기준 (1%): ${buyPrice.toLocaleString()}원`);
      console.log(`  현재가: ${currentPrice.toLocaleString()}원`);
      console.log(`  상태: ${currentPrice >= buyPrice ? '✅ 매수 완료되어야 함!' : '❌ 아직'}`);
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

check();
