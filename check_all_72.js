const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    const result = await pool.query(`
      SELECT CAST(close AS NUMERIC) as price
      FROM (
        SELECT close FROM price_snapshots 
        WHERE code='005930'
        ORDER BY timestamp DESC LIMIT 72
      ) as recent
      ORDER BY CAST(close AS NUMERIC) ASC
    `);

    const prices = result.rows.map(r => r.price);
    const hasZero = prices.some(p => p === 0);
    const minAll = Math.min(...prices);
    const validPrices = prices.filter(p => p > 0);
    const minValid = Math.min(...validPrices);

    console.log('📊 최근 72개 분석:\n');
    console.log(`전체: ${prices.length}개`);
    console.log(`0원 포함: ${hasZero ? '있음' : '없음'}`);
    console.log(`0원 개수: ${prices.length - validPrices.length}개\n`);
    
    console.log('최저가:');
    console.log(`  Math.min (0원 포함): ${minAll.toLocaleString()}원`);
    console.log(`  Math.min (0원 제외): ${minValid.toLocaleString()}원\n`);

    if (hasZero) {
      console.log('🚨 0원 데이터 발견! 이것이 문제입니다!');
      console.log('   → Math.min이 0을 반환');
      console.log('   → 매수기준이 0 × 1.01 = 0원');
      console.log('   → 모든 가격이 매수 신호 충족');
      console.log('   → 하지만 거래 없음?');
    } else {
      console.log('✅ 0원 데이터 없음 (정상)');
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
  }
}

check();
