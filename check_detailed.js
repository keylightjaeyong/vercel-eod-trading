const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function checkDetailed() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 시스템 상태 상세 분석');
    console.log('═══════════════════════════════════════════════════════\n');

    // 1. 테이블 목록 확인
    console.log('📋 데이터베이스 테이블:');
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    tables.rows.forEach(t => console.log(`  - ${t.table_name}`));

    // 2. 가격 데이터 확인
    console.log('\n📈 가격 수집 현황:');
    const priceCount = await pool.query(
      `SELECT COUNT(*) as total FROM price_snapshots`
    );
    console.log(`  총 가격 데이터: ${priceCount.rows[0].total}개`);

    if (priceCount.rows[0].total > 0) {
      const latestPrice = await pool.query(
        `SELECT code, close, timestamp FROM price_snapshots ORDER BY timestamp DESC LIMIT 1`
      );
      console.log(`  최신: [${latestPrice.rows[0].code}] ${latestPrice.rows[0].close}원 @ ${latestPrice.rows[0].timestamp}`);
    }

    // 3. 설정 확인
    console.log('\n⚙️ 설정 정보:');
    const config = await pool.query(
      `SELECT * FROM stocks WHERE code = '005930'`
    );
    if (config.rows.length > 0) {
      const s = config.rows[0];
      console.log(`  종목: [${s.code}] ${s.name}`);
      console.log(`  활성화: ${s.enabled ? '✅' : '❌'}`);
      console.log(`  할당비율: ${s.allocation_pct}%`);
      console.log(`  손절매: ${s.stop_loss_pct}%`);
      console.log(`  추적손절: ${s.trailing_pct}%`);
    }

    // 4. 현재 시간
    console.log('\n🕐 현재 시간 (서울):');
    const now = await pool.query(
      `SELECT NOW() AT TIME ZONE 'Asia/Seoul' as kst_time, 
              EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Seoul') as hour`
    );
    const timeInfo = now.rows[0];
    console.log(`  ${timeInfo.kst_time}`);
    console.log(`  거래 시간 범위: 09:00 ~ 15:30`);
    console.log(`  현재 상태: ${timeInfo.hour >= 9 && timeInfo.hour < 15.5 ? '⏳ 거래 시간 중' : '🌙 거래 시간 외'}`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 평가 및 권장사항:');
    console.log('═══════════════════════════════════════════════════════');

    const hasStockConfig = config.rows.length > 0 && config.rows[0].enabled;
    const hasPrice = priceCount.rows[0].total > 0;
    const isInTradingTime = timeInfo.hour >= 9 && timeInfo.hour < 15.5;

    if (!hasStockConfig) {
      console.log('❌ 문제: 활성화된 종목 설정 없음');
    } else if (!hasPrice) {
      console.log('⚠️ 문제: 가격 데이터 수집 안 됨 (크론 미실행)');
    } else if (isInTradingTime) {
      console.log('✅ 상태: 시스템 정상 → 거래 시간 중');
      console.log('✅ 권장: 자동매수 계속 진행하세요!');
    } else {
      console.log('✅ 상태: 시스템 준비 완료 → 다음 거래 시간 대기');
    }

    await pool.end();
  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
}

checkDetailed();
