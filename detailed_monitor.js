const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    const now = new Date();
    const kstTime = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║ 거래 신호 상세 모니터링 - ${kstTime}          ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 1️⃣ 최신 가격 데이터 확인
    console.log('📈 [1] 최신 가격 데이터 (5분 캔들)');
    console.log('─────────────────────────────────────────────────────────────');
    
    const latestPrices = await pool.query(`
      SELECT 
        code,
        close,
        timestamp,
        ROW_NUMBER() OVER (PARTITION BY code ORDER BY timestamp DESC) as rn
      FROM price_snapshots
      WHERE timestamp > NOW() - INTERVAL '1 hour'
    `);

    const priceMap = {};
    latestPrices.rows.forEach(row => {
      if (row.rn === 1) {
        const time = new Date(row.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        priceMap[row.code] = { price: row.close, time };
      }
    });

    Object.entries(priceMap).forEach(([code, data]) => {
      console.log(`${code}: ${parseInt(data.price).toLocaleString()}원 (${data.time})`);
    });

    // 2️⃣ 거래 신호 조건 분석
    console.log('\n\n🔍 [2] 거래 신호 조건 분석 (삼성전자 기준)');
    console.log('─────────────────────────────────────────────────────────────');

    const priceHistory = await pool.query(`
      SELECT close, timestamp
      FROM price_snapshots
      WHERE code = '005930'
      ORDER BY timestamp DESC
      LIMIT 72
    `);

    if (priceHistory.rows.length > 0) {
      const prices = priceHistory.rows.map(r => parseInt(r.close)).reverse();
      const latest = prices[prices.length - 1];
      const min5 = Math.min(...prices.slice(-5));
      const max5 = Math.max(...prices.slice(-5));
      const min10 = Math.min(...prices.slice(-10));
      const max10 = Math.max(...prices.slice(-10));
      
      console.log(`현재가: ${latest.toLocaleString()}원`);
      console.log(`5분: ${min5.toLocaleString()}원 ~ ${max5.toLocaleString()}원`);
      console.log(`10분: ${min10.toLocaleString()}원 ~ ${max10.toLocaleString()}원`);
      
      // 간단한 신호 분석
      const changeFrom10Min = latest - min10;
      const changeFrom5Min = latest - min5;
      console.log(`\n5분 저점 대비: ${changeFrom5Min > 0 ? '+' : ''}${changeFrom5Min.toLocaleString()}원`);
      console.log(`10분 저점 대비: ${changeFrom10Min > 0 ? '+' : ''}${changeFrom10Min.toLocaleString()}원`);
      
      if (changeFrom5Min > 0 && changeFrom10Min > 0) {
        console.log('\n✅ 신호 가능성: 상승 추세 확인');
      } else if (changeFrom5Min < 0) {
        console.log('\n❌ 신호 불가능: 하락 추세');
      }
    }

    // 3️⃣ 거래 가능 여부
    console.log('\n\n💰 [3] 거래 가능 상태');
    console.log('─────────────────────────────────────────────────────────────');

    const stocks = await pool.query('SELECT code, name, enabled FROM stocks');
    const enabledStocks = stocks.rows.filter(s => s.enabled);
    
    console.log(`활성 종목: ${enabledStocks.length}개`);
    enabledStocks.forEach(s => {
      console.log(`  ✅ ${s.code} - ${s.name}`);
    });

    if (enabledStocks.length === 0) {
      console.log('  ❌ 활성 종목 없음 - 거래 신호 생성 불가');
    }

    // 4️⃣ 재진입 조건 상태
    console.log('\n\n🔄 [4] 재진입 조건 상태');
    console.log('─────────────────────────────────────────────────────────────');

    const reentryStates = await pool.query(`
      SELECT 
        code, 
        status, 
        reentry_threshold,
        last_reference_low,
        updated_at
      FROM trade_positions
      WHERE status IN ('sold', 'waiting_reentry')
    `);

    if (reentryStates.rows.length > 0) {
      console.log(`재진입 대기: ${reentryStates.rows.length}개`);
      reentryStates.rows.forEach(pos => {
        const updated = new Date(pos.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.log(`  ${pos.code} (${updated})`);
        console.log(`    상태: ${pos.status}`);
        if (pos.reentry_threshold) {
          console.log(`    재진입 임계: ${parseInt(pos.reentry_threshold).toLocaleString()}원`);
        }
        if (pos.last_reference_low) {
          console.log(`    마지막 저점: ${parseInt(pos.last_reference_low).toLocaleString()}원`);
        }
      });
    } else {
      console.log('⭕ 재진입 조건 대기 없음');
    }

    // 5️⃣ API 엔드포인트 연결 테스트
    console.log('\n\n🔗 [5] API 엔드포인트 상태');
    console.log('─────────────────────────────────────────────────────────────');

    try {
      const fetch = require('node-fetch');
      const apiUrl = process.env.VERCEL_API_URL || 'https://vercel-eod-trading.vercel.app';
      const response = await fetch(`${apiUrl}/api/cron/trade`, { 
        method: 'POST',
        timeout: 5000
      }).catch(err => {
        console.log(`❌ API 연결 불가: ${err.message}`);
        return null;
      });

      if (response) {
        console.log(`✅ API 응답 상태: ${response.status}`);
      }
    } catch (err) {
      console.log(`⚠️  API 테스트 건너뜀 (node-fetch 필요)`);
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║ 모니터링 완료                                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
})();
