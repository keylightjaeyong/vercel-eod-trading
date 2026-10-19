const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  vercel-eod-trading 거래 모니터링 시스템 상태               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 1. 거래 설정 상태
    console.log('📋 [1] 거래 설정 상태');
    console.log('─────────────────────────────────────────────────────────────');
    const stocks = await pool.query('SELECT code, name, enabled FROM stocks');
    let activeStocks = stocks.rows.filter(s => s.enabled);
    activeStocks.forEach(s => {
      console.log(`  ✅ ${s.code} (${s.name}) - 활성화`);
    });
    if (activeStocks.length === 0) {
      console.log('  ❌ 활성화된 종목 없음');
    }

    // 2. 현재 포지션
    console.log('\n📊 [2] 현재 보유 포지션');
    console.log('─────────────────────────────────────────────────────────────');
    const positions = await pool.query(
      `SELECT id, code, name, status, entry_price, created_at 
       FROM trade_positions ORDER BY created_at DESC`
    );
    if (positions.rows.length === 0) {
      console.log('  ⏳ 보유 포지션: 없음');
    } else {
      positions.rows.forEach((p, i) => {
        console.log(`  [${i+1}] ${p.code} (${p.name})`);
        console.log(`       상태: ${p.status}, 진입가: ${p.entry_price}원`);
        console.log(`       시간: ${new Date(p.created_at).toLocaleString('ko-KR')}`);
      });
    }

    // 3. 최근 거래 이력
    console.log('\n📈 [3] 최근 거래 이력 (최근 5건)');
    console.log('─────────────────────────────────────────────────────────────');
    const history = await pool.query(
      `SELECT id, code, name, action, price, created_at
       FROM trade_history ORDER BY created_at DESC LIMIT 5`
    );
    if (history.rows.length === 0) {
      console.log('  📭 거래 이력: 없음');
    } else {
      history.rows.forEach((h, i) => {
        const actionText = h.action === 'buy' ? '🔵 매수' : '🔴 매도';
        console.log(`  [${i+1}] ${actionText} - ${h.code} (${h.name})`);
        console.log(`       가격: ${h.price}원 | ${new Date(h.created_at).toLocaleString('ko-KR')}`);
      });
    }

    // 4. 가격 데이터 현황
    console.log('\n💹 [4] 가격 데이터 현황');
    console.log('─────────────────────────────────────────────────────────────');
    for (const stock of activeStocks) {
      const priceData = await pool.query(
        `SELECT COUNT(*) as cnt, MAX(timestamp) as latest 
         FROM price_snapshots WHERE code = $1`,
        [stock.code]
      );
      const cnt = priceData.rows[0].cnt;
      const latest = new Date(priceData.rows[0].latest);
      console.log(`  ${stock.code}: ${cnt}개 | 최신: ${latest.toLocaleString('ko-KR')}`);
    }

    // 5. 재진입 조건 (마지막 매도)
    console.log('\n🔄 [5] 재진입 조건 확인');
    console.log('─────────────────────────────────────────────────────────────');
    for (const stock of activeStocks) {
      const lastSold = await pool.query(
        `SELECT exit_price, reentry_threshold, last_reference_low, profit_loss, exit_time
         FROM trade_positions WHERE code = $1 AND status = 'sold'
         ORDER BY exit_time DESC LIMIT 1`,
        [stock.code]
      );
      
      if (lastSold.rows.length === 0) {
        console.log(`  ${stock.code}: 📭 이전 거래 없음 (신규 신호 대기)`);
      } else {
        const last = lastSold.rows[0];
        console.log(`  ${stock.code}:`);
        console.log(`    └─ 마지막 매도: ${last.exit_price}원 @ ${new Date(last.exit_time).toLocaleString('ko-KR')}`);
        console.log(`    └─ 손익: ${last.profit_loss}원`);
        console.log(`    └─ 재진입 기준: ${last.reentry_threshold}원`);
        console.log(`    └─ 이전 저점: ${last.last_reference_low}원`);
      }
    }

    // 6. 거래 신호 분석
    console.log('\n🎯 [6] 거래 신호 분석');
    console.log('─────────────────────────────────────────────────────────────');
    for (const stock of activeStocks) {
      const prices = await pool.query(
        `SELECT close FROM price_snapshots 
         WHERE code = $1 AND CAST(close as INTEGER) > 0
         ORDER BY created_at DESC LIMIT 72`,
        [stock.code]
      );

      if (prices.rows.length < 72) {
        console.log(`  ${stock.code}: ⚠️  데이터 부족 (${prices.rows.length}/72개)`);
        continue;
      }

      const priceArray = prices.rows.reverse().map(r => parseFloat(r.close));
      const min = Math.min(...priceArray);
      const max = Math.max(...priceArray);
      const current = priceArray[priceArray.length - 1];
      const range = max - min;
      const adx = Math.min(100, (range / min) * 100 + 20);
      
      const market = adx > 25 ? 'UPTREND' : 'DOWNTREND';
      const risePercent = adx > 25 ? 1.0 : 0.5;
      const buyPrice = min * (1 + risePercent / 100);
      const shouldBuy = current >= buyPrice;

      console.log(`  ${stock.code}:`);
      console.log(`    └─ 저점: ${min.toFixed(0)}원 | 고점: ${max.toFixed(0)}원 | 현재: ${current.toFixed(0)}원`);
      console.log(`    └─ 시장: ${market} (ADX: ${adx.toFixed(0)}) | 반등: ${risePercent}%`);
      console.log(`    └─ 매수기준: ${buyPrice.toFixed(0)}원`);
      console.log(`    └─ 신호: ${shouldBuy ? '✅ 매수!' : '❌ 대기'}`);
    }

    // 7. KIS 토큰 상태
    console.log('\n🔐 [7] KIS API 토큰 상태');
    console.log('─────────────────────────────────────────────────────────────');
    const tokens = await pool.query('SELECT expires_at FROM kis_tokens ORDER BY id DESC LIMIT 1');
    if (tokens.rows.length > 0) {
      const expiresAt = tokens.rows[0].expires_at;
      const now = Math.floor(Date.now() / 1000);
      const secondsLeft = expiresAt - now;
      
      if (secondsLeft > 0) {
        const hoursLeft = Math.floor(secondsLeft / 3600);
        const minutesLeft = Math.floor((secondsLeft % 3600) / 60);
        console.log(`  ✅ 토큰 유효 (${hoursLeft}시간 ${minutesLeft}분 남음)`);
      } else {
        console.log(`  ❌ 토큰 만료됨`);
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║ 모니터링 완료                                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await pool.end();
  }
})();
