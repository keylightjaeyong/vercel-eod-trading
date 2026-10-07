const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function checkLow() {
  try {
    // 오늘 데이터
    const todayResult = await pool.query(`
      SELECT 
        MIN(CAST(close AS NUMERIC)) as min_price,
        MAX(CAST(close AS NUMERIC)) as max_price,
        AVG(CAST(close AS NUMERIC))::NUMERIC(10,0) as avg_price,
        COUNT(*) as data_points
      FROM price_snapshots
      WHERE code = '005930'
      AND DATE(timestamp AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE AT TIME ZONE 'Asia/Seoul'
    `);

    // 전체 데이터
    const allResult = await pool.query(`
      SELECT 
        MIN(CAST(close AS NUMERIC)) as min_price,
        MAX(CAST(close AS NUMERIC)) as max_price,
        COUNT(*) as data_points
      FROM price_snapshots
      WHERE code = '005930'
    `);

    // 현재 가격
    const currentResult = await pool.query(`
      SELECT CAST(close AS NUMERIC) as current_price, timestamp
      FROM price_snapshots
      WHERE code = '005930'
      ORDER BY timestamp DESC LIMIT 1
    `);

    const today = todayResult.rows[0];
    const all = allResult.rows[0];
    const current = currentResult.rows[0];

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 삼성전자 [005930] 가격 분석');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📈 현재 상태:');
    console.log(`  현재가: ${current.current_price.toLocaleString()}원`);
    console.log(`  최신 시간: ${current.timestamp}\n`);

    console.log('📅 오늘 (당일):');
    console.log(`  저점: ${today.min_price.toLocaleString()}원`);
    console.log(`  고점: ${today.max_price.toLocaleString()}원`);
    console.log(`  평균: ${today.avg_price.toLocaleString()}원`);
    console.log(`  낙폭: ${((today.max_price - today.min_price) / today.max_price * 100).toFixed(2)}%`);
    console.log(`  데이터: ${today.data_points}개\n`);

    console.log('📊 전체 (누적):');
    console.log(`  최저: ${all.min_price.toLocaleString()}원`);
    console.log(`  최고: ${all.max_price.toLocaleString()}원`);
    console.log(`  데이터: ${all.data_points}개\n`);

    // 현재가 기준 낙폭율
    const dropPct = ((current.current_price - today.min_price) / today.min_price * 100).toFixed(2);
    const riseFromLow = ((current.current_price - today.min_price) / today.min_price * 100).toFixed(2);

    console.log('💹 매매 판단:');
    console.log(`  저점 대비: +${riseFromLow}%`);
    console.log(`  고점 대비: ${((current.current_price - today.max_price) / today.max_price * 100).toFixed(2)}%\n`);

    console.log('═══════════════════════════════════════════════════════');
    
    if (today.min_price < current.current_price * 0.98) {
      console.log('⚠️ 현재 가격이 저점에서 상승 중 → 매수 신호 확인 필요');
    } else if (today.min_price === current.current_price) {
      console.log('🔴 현재가 = 저점 → 반등 신호 대기');
    } else {
      console.log('✅ 저점 대비 반등 중 → 매수 기회 가능');
    }

    await pool.end();
  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
}

checkLow();
