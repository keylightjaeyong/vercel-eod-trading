const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function checkADX() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 ADX 기반 시장 체제 분석 상태 확인');
    console.log('═══════════════════════════════════════════════════════\n');

    // 1. 전체 데이터 개수
    const allCount = await pool.query(
      `SELECT COUNT(*) as total FROM price_snapshots WHERE code = '005930'`
    );
    console.log(`📈 수집된 총 데이터: ${allCount.rows[0].total}개\n`);

    // 2. 최근 72개 데이터 확인
    const recentData = await pool.query(`
      SELECT COUNT(*) as count, 
             MIN(CAST(close AS NUMERIC)) as min_price,
             MAX(CAST(close AS NUMERIC)) as max_price,
             MIN(timestamp) as oldest,
             MAX(timestamp) as latest
      FROM (
        SELECT close, timestamp FROM price_snapshots 
        WHERE code = '005930'
        ORDER BY timestamp DESC LIMIT 72
      ) as recent
    `);

    const data = recentData.rows[0];
    console.log('📊 최근 72개 데이터 분석:');
    console.log(`  데이터 개수: ${data.count}/72개`);
    console.log(`  최저가: ${data.min_price.toLocaleString()}원`);
    console.log(`  최고가: ${data.max_price.toLocaleString()}원`);
    console.log(`  범위: ${data.oldest} ~ ${data.latest}`);
    console.log(`  기간: 약 ${Math.round((new Date(data.latest) - new Date(data.oldest)) / 60000)}분\n`);

    // 3. ADX 분석 가능 여부
    console.log('✅ ADX 분석 가능 조건 확인:');
    if (data.count >= 72) {
      console.log('  ✅ 데이터 충분 (72개 이상) → ADX 계산 가능');
      console.log('  ✅ 시장 체제 분석 진행 중');
      console.log('  ✅ 동적 반등률(risePercent) 결정됨');
    } else if (data.count >= 14) {
      console.log(`  ⚠️ 데이터 부족 (${data.count}/72개)`);
      console.log(`  ⚠️ ADX 계산 불가 → 기본값 risePercent=0.8% 적용`);
      console.log(`  ⚠️ 필요: 추가 ${72 - data.count}개 데이터 수집 필요`);
    } else {
      console.log(`  ❌ 데이터 심각 부족 (${data.count}/14개)`);
      console.log(`  ❌ ADX 계산 불가능`);
    }

    // 4. 데이터 수집 주기 계산
    if (data.count > 1) {
      const timeGapMs = (new Date(data.latest) - new Date(data.oldest)) / (data.count - 1);
      const timeGapMin = Math.round(timeGapMs / 60000);
      console.log(`\n⏱️ 수집 주기: 약 ${timeGapMin}분`);
      
      const minutesToFill = (72 - data.count) * timeGapMin;
      const hoursToFill = (minutesToFill / 60).toFixed(1);
      console.log(`⏳ 72개 완성까지: 약 ${hoursToFill}시간 필요`);
    }

    // 5. 현재 매수 기준 계산
    console.log('\n💡 현재 매수 신호 상태:');
    const latest = await pool.query(`
      SELECT CAST(close AS NUMERIC) as price FROM price_snapshots 
      WHERE code = '005930' ORDER BY timestamp DESC LIMIT 1
    `);
    const currentPrice = latest.rows[0].price;

    const risePercent = data.count >= 72 ? '동적' : '0.8% (고정)';
    const buyPrice = data.min_price * 1.008; // 기본값 기준
    const gap = currentPrice - buyPrice;

    console.log(`  저점: ${data.min_price.toLocaleString()}원`);
    console.log(`  반등률: ${risePercent}`);
    console.log(`  매수기준가: ${buyPrice.toLocaleString()}원`);
    console.log(`  현재가: ${currentPrice.toLocaleString()}원`);
    console.log(`  차이: ${gap > 0 ? `✅ +${gap.toFixed(0)}원 (매수 가능!)` : `❌ ${gap.toFixed(0)}원 (${Math.abs(gap).toFixed(0)}원 모자람)`}`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📌 결론:');
    if (data.count >= 72) {
      console.log('✅ ADX 기반 시장 체제 분석 진행 중!');
      console.log('✅ 동적 매수 기준 적용 중');
    } else {
      console.log('⚠️ 아직 데이터 수집 진행 중');
      console.log(`⚠️ ${72 - data.count}개 더 필요 (약 ${hoursToFill}시간)`);
      console.log('⚠️ 현재: 기본값(0.8%) 반등률 적용');
    }

    await pool.end();
  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
}

checkADX();
