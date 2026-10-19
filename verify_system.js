const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 전체 시스템 엔드-투-엔드 검증');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // 1️⃣ 데이터 저장 확인 (최근 5분)
    console.log('📊 1️⃣ 데이터 저장 상태 (최근 5분)');
    console.log('─────────────────────────────────────');
    const priceResult = await pool.query(
      `SELECT code, COUNT(*) as count, MAX(created_at) as latest
       FROM price_snapshots
       WHERE created_at > NOW() - INTERVAL '5 minutes'
       GROUP BY code
       ORDER BY latest DESC`
    );

    if (priceResult.rows.length === 0) {
      console.log('⚠️ 최근 5분 내 수집된 데이터 없음');
    } else {
      priceResult.rows.forEach(row => {
        const utcTime = new Date(row.latest);
        const kstTime = new Date(utcTime.getTime() + 9 * 60 * 60 * 1000);
        console.log(`✅ ${row.code}: ${row.count}개 (최신: ${kstTime.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })} KST)`);
      });
    }

    console.log('');

    // 2️⃣ 활성 포지션 확인
    console.log('💼 2️⃣ 활성 포지션');
    console.log('─────────────────────────────────────');
    const posResult = await pool.query(
      `SELECT code, name, quantity, entry_price, created_at
       FROM trade_positions
       WHERE status = 'holding'`
    );

    if (posResult.rows.length === 0) {
      console.log('ℹ️ 활성 포지션 없음');
    } else {
      posResult.rows.forEach(row => {
        console.log(`✅ ${row.name} (${row.code}): ${row.quantity}주 @ ${row.entry_price.toLocaleString()}원`);
      });
    }

    console.log('');

    // 3️⃣ 거래 이력 확인
    console.log('📈 3️⃣ 거래 이력 (최근 10건)');
    console.log('─────────────────────────────────────');
    const tradeResult = await pool.query(
      `SELECT code, name, action, quantity, price, created_at
       FROM trade_history
       ORDER BY created_at DESC
       LIMIT 10`
    );

    if (tradeResult.rows.length === 0) {
      console.log('ℹ️ 거래 이력 없음');
    } else {
      tradeResult.rows.forEach(row => {
        const tradeTime = new Date(row.created_at);
        const kstTime = new Date(tradeTime.getTime() + 9 * 60 * 60 * 1000);
        const action = row.action === 'BUY' ? '🟢 매수' : '🔴 매도';
        console.log(`${action} ${row.name}: ${row.quantity}주 @ ${row.price.toLocaleString()}원 (${kstTime.toLocaleTimeString('ko-KR')})`);
      });
    }

    console.log('');

    // 4️⃣ 최근 캔들 데이터
    console.log('🎯 4️⃣ 캔들 데이터 상태');
    console.log('─────────────────────────────────────');
    const stocks = await pool.query(
      `SELECT code, name FROM stocks WHERE enabled = true`
    );

    for (const stock of stocks.rows) {
      const candleResult = await pool.query(
        `SELECT COUNT(*) as count FROM price_snapshots WHERE code = $1`,
        [stock.code]
      );
      const candleCount = candleResult.rows[0].count;
      const readiness = candleCount >= 144 ? '✅' : '⏳';
      console.log(`${readiness} ${stock.name} (${stock.code}): ${candleCount}/144개`);
    }

    console.log('');

    // 5️⃣ 데이터 품질 확인
    console.log('🔍 5️⃣ 데이터 품질 검사');
    console.log('─────────────────────────────────────');
    const qualityResult = await pool.query(
      `SELECT
        COUNT(*) as total_prices,
        COUNT(CASE WHEN CAST(close as INTEGER) = 0 THEN 1 END) as zero_prices,
        COUNT(CASE WHEN CAST(close as INTEGER) < 0 THEN 1 END) as negative_prices,
        MAX(created_at) as latest_timestamp
       FROM price_snapshots`
    );

    const quality = qualityResult.rows[0];
    const validData = quality.total_prices - quality.zero_prices - quality.negative_prices;
    const dataQuality = (validData / quality.total_prices * 100).toFixed(1);

    console.log(`총 저장된 데이터: ${quality.total_prices}개`);
    console.log(`❌ 이상 데이터: 0원 ${quality.zero_prices}개, 음수 ${quality.negative_prices}개`);
    console.log(`✅ 데이터 품질: ${dataQuality}%`);

    if (dataQuality >= 95) {
      console.log('   ✅ 정상 (95% 이상)');
    } else if (dataQuality >= 80) {
      console.log('   ⚠️ 주의 (80~95%)');
    } else {
      console.log('   ❌ 문제 (80% 이하)');
    }

    console.log('');

    // 6️⃣ 최근 거래 상태
    console.log('🎯 6️⃣ 최근 거래 상태');
    console.log('─────────────────────────────────────');
    const statusResult = await pool.query(
      `SELECT
        COUNT(CASE WHEN action = 'BUY' THEN 1 END) as buy_count,
        COUNT(CASE WHEN action = 'SELL' THEN 1 END) as sell_count,
        (SELECT COUNT(*) FROM trade_positions WHERE status = 'holding') as holding_positions,
        (SELECT COUNT(*) FROM trade_positions WHERE status = 'closed') as closed_positions
       FROM trade_history`
    );

    const status = statusResult.rows[0];
    console.log(`📊 거래 통계:`);
    console.log(`   매수: ${status.buy_count}건, 매도: ${status.sell_count}건`);
    console.log(`   보유 중: ${status.holding_positions}개, 종료: ${status.closed_positions}개`);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    await pool.end();
  } catch (err) {
    console.error('❌ 에러:', err.message);
    process.exit(1);
  }
}

verify();
