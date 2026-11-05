const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  6일 동안 거래 0건의 원인 분석                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 마지막 매도
    console.log('📊 [1] 마지막 거래 정보\n');

    const lastSellResult = await pool.query(`
      SELECT 
        id,
        code,
        name,
        exit_price,
        exit_time,
        reentry_threshold,
        last_reference_low,
        updated_at
      FROM trade_positions
      WHERE status = 'sold'
      ORDER BY exit_time DESC
      LIMIT 1
    `);

    if (lastSellResult.rows.length > 0) {
      const lastSell = lastSellResult.rows[0];
      const exitTime = new Date(lastSell.exit_time);
      const now = new Date();
      const daysDiff = Math.floor((now - exitTime) / (1000 * 60 * 60 * 24));
      const hoursDiff = Math.floor((now - exitTime) / (1000 * 60 * 60));

      console.log(`마지막 매도: ${exitTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log(`경과: ${daysDiff}일 ${(hoursDiff % 24)}시간 전`);
      console.log(`매도가: ${parseInt(lastSell.exit_price).toLocaleString()}원`);
      console.log(`재진입 기준: ${parseInt(lastSell.reentry_threshold || 0).toLocaleString()}원\n`);
    }

    // 이후 가격 데이터 추이
    console.log('📈 [2] 마지막 매도 이후 가격 추이\n');

    const lastSellTime = lastSellResult.rows[0]?.exit_time;
    
    if (lastSellTime) {
      const priceAfterSellResult = await pool.query(`
        SELECT 
          DATE(created_at AT TIME ZONE 'Asia/Seoul') as date,
          COUNT(*) as count,
          MAX(close) as max_price,
          MIN(close) as min_price,
          close as latest_price,
          created_at
        FROM price_snapshots
        WHERE code = '005930'
          AND created_at > $1
        GROUP BY DATE(created_at AT TIME ZONE 'Asia/Seoul'), close, created_at
        ORDER BY created_at DESC
        LIMIT 20
      `, [lastSellTime]);

      if (priceAfterSellResult.rows.length > 0) {
        const lastSellPrice = parseInt(lastSellResult.rows[0].exit_price);
        const reentryThreshold = parseInt(lastSellResult.rows[0].reentry_threshold || 0);

        console.log(`매도가: ${lastSellPrice.toLocaleString()}원`);
        console.log(`재진입 기준: ${reentryThreshold.toLocaleString()}원\n`);

        priceAfterSellResult.rows.slice(0, 5).forEach((row, idx) => {
          const rowDate = new Date(row.created_at);
          const dateStr = rowDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
          const maxPrice = parseInt(row.max_price);
          const minPrice = parseInt(row.min_price);

          const aboveReentry = reentryThreshold > 0 && maxPrice >= reentryThreshold ? '✅ 재진입 기준 도달' : '❌ 미달';
          
          console.log(`${dateStr}`);
          console.log(`  최고: ${maxPrice.toLocaleString()}원, 최저: ${minPrice.toLocaleString()}원 ${aboveReentry}`);
        });
      }
    }

    // 매도 이후 동작 기록
    console.log('\n\n📋 [3] 6일간의 패턴 분석\n');

    const sixDaysAgoResult = await pool.query(`
      SELECT 
        DATE(created_at AT TIME ZONE 'Asia/Seoul') as date,
        COUNT(*) as price_points,
        MAX(close) as max_price,
        MIN(close) as min_price,
        MAX(created_at) as latest_update
      FROM price_snapshots
      WHERE code = '005930'
        AND created_at > NOW() - INTERVAL '6 days'
      GROUP BY DATE(created_at AT TIME ZONE 'Asia/Seoul')
      ORDER BY date DESC
    `);

    console.log('최근 6일 가격 데이터:');
    console.log('');

    if (sixDaysAgoResult.rows.length > 0) {
      const lastSellPrice = parseInt(lastSellResult.rows[0]?.exit_price || 0);
      const reentryThreshold = parseInt(lastSellResult.rows[0]?.reentry_threshold || 0);

      sixDaysAgoResult.rows.forEach((row) => {
        const maxPrice = parseInt(row.max_price);
        const status = reentryThreshold > 0 && maxPrice >= reentryThreshold ? '✅ 재진입OK' : '❌ 재진입NO';
        console.log(`${row.date} | 최고: ${maxPrice.toLocaleString()}원 | ${status} (기준: ${reentryThreshold.toLocaleString()}원)`);
      });
    }

    // 결론
    console.log('\n\n🎯 [4] 6일 거래 0건 원인\n');

    if (lastSellResult.rows.length > 0) {
      const reentryThreshold = parseInt(lastSellResult.rows[0].reentry_threshold || 0);
      const maxRecentPrice = sixDaysAgoResult.rows.length > 0 
        ? parseInt(sixDaysAgoResult.rows[0].max_price) 
        : 0;

      console.log(`재진입 기준: ${reentryThreshold.toLocaleString()}원`);
      console.log(`최근 최고가: ${maxRecentPrice.toLocaleString()}원`);
      console.log(`비교: ${maxRecentPrice} ${maxRecentPrice >= reentryThreshold ? '≥' : '<'} ${reentryThreshold}\n`);

      if (reentryThreshold === 0) {
        console.log('❌ 원인 1: 재진입 기준이 0원!');
        console.log('   → 매도 시 재진입 기준 계산 실패');
        console.log('   → 모든 가격이 재진입 조건 만족');
        console.log('   → 하지만 신호가 발생하지 않음\n');
      }

      if (maxRecentPrice < reentryThreshold && reentryThreshold > 0) {
        console.log('❌ 원인 2: 재진입 기준을 충족하지 못함');
        console.log(`   → 필요: ${reentryThreshold.toLocaleString()}원`);
        console.log(`   → 실제: ${maxRecentPrice.toLocaleString()}원 (${(reentryThreshold - maxRecentPrice).toLocaleString()}원 부족)\n`);
      }

      console.log('또 다른 가능성:');
      console.log('- getBalance() 호출 실패로 진행 중단');
      console.log('- KIS API 토큰 만료');
      console.log('- 72개 가격 데이터 미달\n');
    }

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
