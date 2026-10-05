const { Pool } = require('pg');

async function checkRealMarket() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('\n🎯 현재 실시간 시장 분석 (16:25 KST)\n');

    const result = await pool.query(`
      SELECT 
        code,
        close,
        created_at AT TIME ZONE 'Asia/Seoul' as kst_time
      FROM price_snapshots
      WHERE DATE(created_at AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE AT TIME ZONE 'Asia/Seoul'
      ORDER BY code, created_at DESC
      LIMIT 500
    `);

    if (result.rows.length === 0) {
      console.log('❌ 오늘 가격 데이터가 없습니다');
      await pool.end();
      return;
    }

    const pricesByCode = {};
    for (const row of result.rows) {
      if (!pricesByCode[row.code]) pricesByCode[row.code] = [];
      pricesByCode[row.code].push(parseFloat(row.close));
    }

    function calculateADX(prices) {
      if (prices.length < 14) return null;
      const recent = prices.slice(0, 14);
      
      let sumTR = 0, sumPlusDM = 0, sumMinusDM = 0;
      
      for (let i = 0; i < recent.length; i++) {
        const curr = recent[i];
        const prev = i < recent.length - 1 ? recent[i + 1] : curr;
        
        const tr = Math.abs(curr - prev) || Math.abs(curr);
        const upMove = curr - prev;
        const downMove = prev - curr;
        
        sumTR += tr;
        sumPlusDM += upMove > 0 ? upMove : 0;
        sumMinusDM += downMove > 0 ? downMove : 0;
      }
      
      if (sumTR === 0) return null;
      
      const plusDI = (sumPlusDM / sumTR) * 100;
      const minusDI = (sumMinusDM / sumTR) * 100;
      const diSum = plusDI + minusDI;
      
      if (diSum === 0) return null;
      
      const dx = Math.abs(plusDI - minusDI) / diSum * 100;
      return { adx: Math.min(dx, 100), plusDI, minusDI };
    }

    console.log('═'.repeat(70));

    for (const [code, prices] of Object.entries(pricesByCode)) {
      if (prices.length < 14) continue;

      const indicators = calculateADX(prices);
      if (!indicators) continue;

      const { adx, plusDI, minusDI } = indicators;
      
      let regime = '➡️ SIDEWAYS';
      if (adx > 25) {
        regime = plusDI > minusDI ? '📈 UPTREND (상승장)' : '📉 DOWNTREND (하락장)';
      }

      const current = prices[0];
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const change = ((current - prices[prices.length - 1]) / prices[prices.length - 1] * 100).toFixed(2);

      console.log(`\n[${code}] ${regime}`);
      console.log(`  ADX: ${adx.toFixed(1)} (+DI: ${plusDI.toFixed(1)}, -DI: ${minusDI.toFixed(1)})`);
      console.log(`  현재: ${current.toLocaleString()}원 | 저: ${min.toLocaleString()}원 | 고: ${max.toLocaleString()}원`);
      console.log(`  변화: ${change}% (${prices.length}개 캔들)`);
    }

    console.log('\n' + '═'.repeat(70));

  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await pool.end();
  }
}

checkRealMarket();
