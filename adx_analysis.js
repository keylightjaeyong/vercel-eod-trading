const { Pool } = require('pg');

// ADX 계산 함수들
function calculateTrueRange(prices, index) {
  if (index === 0) {
    return prices[0];
  }
  const high = prices[index];
  const low = prices[index];
  const prevClose = prices[index - 1];
  
  const tr1 = high - low;
  const tr2 = Math.abs(high - prevClose);
  const tr3 = Math.abs(low - prevClose);
  
  return Math.max(tr1, tr2, tr3);
}

function calculatePlusDM(prices, index) {
  if (index === 0) return 0;
  const high = prices[index];
  const prevHigh = prices[index - 1];
  const upMove = high - prevHigh;
  return upMove > 0 ? upMove : 0;
}

function calculateMinusDM(prices, index) {
  if (index === 0) return 0;
  const low = prices[index];
  const prevLow = prices[index - 1];
  const downMove = prevLow - low;
  return downMove > 0 ? downMove : 0;
}

function calculateADX(prices) {
  if (prices.length < 14) return 0;
  
  const recentPrices = prices.slice(-14);
  let sumTR = 0, sumPlusDM = 0, sumMinusDM = 0;
  
  for (let i = 0; i < recentPrices.length; i++) {
    const tr = i === 0
      ? recentPrices[i]
      : Math.max(
          recentPrices[i] - recentPrices[i - 1],
          Math.abs(recentPrices[i] - recentPrices[i - 1])
        );
    
    const plusDM = calculatePlusDM(recentPrices, i);
    const minusDM = calculateMinusDM(recentPrices, i);
    
    sumTR += tr;
    sumPlusDM += plusDM;
    sumMinusDM += minusDM;
  }
  
  if (sumTR === 0) return 0;
  
  const plusDI = (sumPlusDM / sumTR) * 100;
  const minusDI = (sumMinusDM / sumTR) * 100;
  
  const diSum = plusDI + minusDI;
  if (diSum === 0) return 0;
  
  const dx = Math.abs(plusDI - minusDI) / diSum * 100;
  return Math.min(dx, 100);
}

function calculatePlusDI(prices) {
  if (prices.length < 14) return 0;
  
  const recentPrices = prices.slice(-14);
  let sumTR = 0, sumPlusDM = 0;
  
  for (let i = 0; i < recentPrices.length; i++) {
    const tr = i === 0
      ? recentPrices[i]
      : Math.max(
          recentPrices[i] - recentPrices[i - 1],
          Math.abs(recentPrices[i] - recentPrices[i - 1])
        );
    
    const plusDM = calculatePlusDM(recentPrices, i);
    sumTR += tr;
    sumPlusDM += plusDM;
  }
  
  if (sumTR === 0) return 0;
  return (sumPlusDM / sumTR) * 100;
}

function calculateMinusDI(prices) {
  if (prices.length < 14) return 0;
  
  const recentPrices = prices.slice(-14);
  let sumTR = 0, sumMinusDM = 0;
  
  for (let i = 0; i < recentPrices.length; i++) {
    const tr = i === 0
      ? recentPrices[i]
      : Math.max(
          recentPrices[i] - recentPrices[i - 1],
          Math.abs(recentPrices[i] - recentPrices[i - 1])
        );
    
    const minusDM = calculateMinusDM(recentPrices, i);
    sumTR += tr;
    sumMinusDM += minusDM;
  }
  
  if (sumTR === 0) return 0;
  return (sumMinusDM / sumTR) * 100;
}

function getMarketRegime(adx, plusDI, minusDI) {
  if (adx > 25) {
    return plusDI > minusDI ? 'UPTREND' : 'DOWNTREND';
  } else {
    return 'SIDEWAYS';
  }
}

function getRisePercent(regime) {
  const map = { 'UPTREND': 1.0, 'DOWNTREND': 0.5, 'SIDEWAYS': 0.8 };
  return map[regime] || 1.0;
}

async function analyzeADX() {
  const pool = new Pool({
    connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 ADX 기반 시장 체제 분석');
    console.log('═══════════════════════════════════════════════════════\n');

    // 최근 72개 가격 조회
    const result = await pool.query(`
      SELECT CAST(close AS NUMERIC) as price
      FROM price_snapshots 
      WHERE code = '005930'
      ORDER BY timestamp DESC LIMIT 72
    `);

    const prices = result.rows.reverse().map(r => r.price);

    if (prices.length < 72) {
      console.log(`⚠️ 데이터 부족: ${prices.length}/72개`);
      await pool.end();
      return;
    }

    // ADX 계산
    const adx = calculateADX(prices);
    const plusDI = calculatePlusDI(prices);
    const minusDI = calculateMinusDI(prices);
    const regime = getMarketRegime(adx, plusDI, minusDI);
    const risePercent = getRisePercent(regime);

    // 시장 상태 텍스트
    const regimeText = {
      'UPTREND': '📈 상승장',
      'DOWNTREND': '📉 하락장',
      'SIDEWAYS': '➡️ 횡보장'
    };

    console.log('📈 ADX 지표:');
    console.log(`  ADX: ${adx.toFixed(2)} (임계: 25)`);
    console.log(`  +DI: ${plusDI.toFixed(2)}%`);
    console.log(`  -DI: ${minusDI.toFixed(2)}%`);
    console.log(`  판정: ${plusDI > minusDI ? '+DI > -DI (상승압력)' : '-DI > +DI (하락압력)'}\n`);

    console.log('🎯 시장 체제 판정:');
    console.log(`  현재: ${regimeText[regime]}`);
    console.log(`  ADX ${adx > 25 ? '> 25' : '< 25'} → ${adx > 25 ? '강한 추세' : '약한/없는 추세'}`);
    console.log(`\n💡 매수 기준 반등률: ${risePercent}%`);

    // 신뢰도
    const confidenceMap = { 'UPTREND': 70, 'DOWNTREND': 60, 'SIDEWAYS': 55 };
    const confidence = confidenceMap[regime];
    console.log(`  신뢰도: ${confidence}%`);

    // 손절매
    const stopLossMap = { 'UPTREND': -2.0, 'DOWNTREND': -1.5, 'SIDEWAYS': -1.5 };
    const stopLoss = stopLossMap[regime];
    console.log(`  손절매: ${stopLoss}%`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📌 결론:');
    if (regime === 'UPTREND') {
      console.log('  ✅ 상승장: 매수 신호에 유리한 환경');
    } else if (regime === 'DOWNTREND') {
      console.log('  ⚠️ 하락장: 신중한 매수 필요');
    } else {
      console.log('  ➡️ 횡보장: 중립적 환경, 신호 대기');
    }

    await pool.end();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

analyzeADX();
