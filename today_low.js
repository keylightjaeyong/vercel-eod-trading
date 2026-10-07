const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    // 오늘 데이터만 추출 (0원 제외)
    const today = await pool.query(`
      SELECT CAST(close AS NUMERIC) as price, 
             timestamp AT TIME ZONE 'Asia/Seoul' as time,
             EXTRACT(HOUR FROM timestamp AT TIME ZONE 'Asia/Seoul') as hour
      FROM price_snapshots 
      WHERE code='005930'
      AND DATE(timestamp AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE AT TIME ZONE 'Asia/Seoul'
      AND CAST(close AS NUMERIC) > 0
      ORDER BY CAST(close AS NUMERIC) ASC
    `);

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 오늘(10월 7일) 가격 데이터 분석');
    console.log('═══════════════════════════════════════════════════════\n');

    if (today.rows.length === 0) {
      console.log('데이터 없음');
      await pool.end();
      return;
    }

    console.log('📈 오늘 최저가 상위 15개:\n');
    today.rows.slice(0, 15).forEach((r, i) => {
      console.log(`${i+1}. ${r.price.toLocaleString()}원 @ ${r.time} (${Math.floor(r.hour)}시)`);
    });

    const todayLowest = today.rows[0].price;
    const buyPrice = todayLowest * 1.01;
    const currentPrice = 272500;

    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log('💡 매수 신호 재분석:');
    console.log(`  오늘 최저가: ${todayLowest.toLocaleString()}원`);
    console.log(`  매수기준 (1%): ${buyPrice.toLocaleString()}원`);
    console.log(`  현재가: ${currentPrice.toLocaleString()}원`);
    console.log(`  상태: ${currentPrice >= buyPrice ? '✅ 매수 신호 충족!' : `❌ ${(buyPrice - currentPrice).toFixed(0)}원 모자람`}`);

    // 반등률 계산
    const risePercent = ((currentPrice - todayLowest) / todayLowest * 100).toFixed(2);
    console.log(`\n📈 저점 대비 반등: +${risePercent}%`);

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

check();
