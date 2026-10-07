const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function checkLow() {
  try {
    // 최근 100개 데이터로 저점 계산
    const result = await pool.query(`
      SELECT 
        MIN(CAST(close AS NUMERIC)) as min_price,
        MAX(CAST(close AS NUMERIC)) as max_price,
        (SELECT CAST(close AS NUMERIC) FROM price_snapshots WHERE code = '005930' ORDER BY timestamp DESC LIMIT 1) as current_price,
        COUNT(*) as data_points
      FROM (
        SELECT close FROM price_snapshots 
        WHERE code = '005930'
        ORDER BY timestamp DESC LIMIT 100
      ) as recent
    `);

    const data = result.rows[0];
    const minPrice = data.min_price;
    const maxPrice = data.max_price;
    const currentPrice = data.current_price;
    const dropPct = ((maxPrice - minPrice) / maxPrice * 100).toFixed(2);
    const fromLowPct = ((currentPrice - minPrice) / minPrice * 100).toFixed(2);

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 삼성전자 [005930] 현재 저점 분석');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`💹 현재가: ${currentPrice.toLocaleString()}원`);
    console.log(`📉 저점: ${minPrice.toLocaleString()}원`);
    console.log(`📈 고점: ${maxPrice.toLocaleString()}원`);
    console.log(`📊 데이터: ${data.data_points}개 (최근)\n`);

    console.log('📈 변동성:');
    console.log(`  낙폭: ${dropPct}%`);
    console.log(`  저점 대비 반등: +${fromLowPct}%\n`);

    console.log('═══════════════════════════════════════════════════════');
    
    if (dropPct >= 1.5) {
      console.log(`✅ 낙폭 ${dropPct}% → V자 패턴 가능성 높음!`);
    } else if (dropPct >= 1.0) {
      console.log(`⚠️ 낙폭 ${dropPct}% → 매수 신호 대기 중`);
    } else {
      console.log(`🟢 낙폭 ${dropPct}% → 변동 작음`);
    }

    await pool.end();
  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
}

checkLow();
