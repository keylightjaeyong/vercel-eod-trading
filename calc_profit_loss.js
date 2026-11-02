const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  손익 분석 - ${now}                  ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const posResult = await pool.query(`
      SELECT 
        id,
        code,
        name,
        quantity,
        entry_price,
        exit_price,
        status,
        updated_at
      FROM trade_positions
      ORDER BY updated_at DESC
      LIMIT 50
    `);

    console.log('📊 [1] 포지션별 손익');
    console.log('─────────────────────────────────────────────────────────────\n');

    let totalPL = 0;
    let totalBuyCost = 0;
    let totalSellRevenue = 0;
    let winCount = 0;
    let loseCount = 0;

    posResult.rows.forEach((pos, idx) => {
      const buyCost = parseFloat(pos.entry_price) * pos.quantity;
      const sellRevenue = parseFloat(pos.exit_price) * pos.quantity;
      const pl = sellRevenue - buyCost;
      const plPercent = (pl / buyCost * 100).toFixed(2);

      totalBuyCost += buyCost;
      totalSellRevenue += sellRevenue;
      totalPL += pl;

      if (pl > 0) winCount++;
      else if (pl < 0) loseCount++;

      const plIcon = pl > 0 ? '✅' : pl < 0 ? '❌' : '➖';
      const date = new Date(pos.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

      console.log(`[${idx+1}] ${pos.code} - ${pos.name} | ${date}`);
      console.log(`    매수: ${parseInt(pos.entry_price).toLocaleString()}원 × ${pos.quantity}주 = ${parseInt(buyCost).toLocaleString()}원`);
      console.log(`    매도: ${parseInt(pos.exit_price).toLocaleString()}원 × ${pos.quantity}주 = ${parseInt(sellRevenue).toLocaleString()}원`);
      console.log(`    손익: ${plIcon} ${parseInt(pl).toLocaleString()}원 (${plPercent}%)\n`);
    });

    console.log('📈 [2] 누적 손익');
    console.log('─────────────────────────────────────────────────────────────\n');
    console.log(`총 매수액: ${parseInt(totalBuyCost).toLocaleString()}원`);
    console.log(`총 매도액: ${parseInt(totalSellRevenue).toLocaleString()}원`);
    console.log(`─────────────────────────────────────────────────────────────`);
    
    const plIcon = totalPL > 0 ? '✅' : totalPL < 0 ? '❌' : '➖';
    const plPercent = (totalPL / totalBuyCost * 100).toFixed(2);
    console.log(`총 손익: ${plIcon} ${parseInt(totalPL).toLocaleString()}원 (${plPercent}%)\n`);

    console.log(`승리: ${winCount}개`);
    console.log(`패배: ${loseCount}개`);
    console.log(`승률: ${winCount > 0 ? (winCount / (winCount + loseCount) * 100).toFixed(1) : 0}%\n`);

    // 왜 적자인지 분석
    console.log('🔍 [3] 적자 원인 분석');
    console.log('─────────────────────────────────────────────────────────────\n');

    if (loseCount > winCount) {
      console.log(`❌ 문제: 손실 거래(${loseCount}개) > 수익 거래(${winCount}개)`);
      console.log(`   → 재진입 조건이 너무 자주 트리거되어 작은 손실이 누적됨\n`);
    }

    const avgWin = winCount > 0 ? posResult.rows
      .slice(0, winCount)
      .reduce((sum, pos) => {
        const pl = (parseFloat(pos.exit_price) - parseFloat(pos.entry_price)) * pos.quantity;
        return sum + pl;
      }, 0) / winCount : 0;

    const avgLose = loseCount > 0 ? posResult.rows
      .slice(winCount)
      .reduce((sum, pos) => {
        const pl = (parseFloat(pos.exit_price) - parseFloat(pos.entry_price)) * pos.quantity;
        return sum + pl;
      }, 0) / loseCount : 0;

    console.log(`평균 수익 거래: +${parseInt(avgWin).toLocaleString()}원`);
    console.log(`평균 손실 거래: ${parseInt(avgLose).toLocaleString()}원`);
    console.log(`손/익 비율: ${(Math.abs(avgLose) / avgWin).toFixed(2)}배\n`);

    if (Math.abs(avgLose) > avgWin) {
      console.log('⚠️  위험한 신호: 평균 손실 > 평균 수익');
      console.log('   → 손실 거래를 더 빨리 끝내거나 손실 한도를 강화해야 함\n');
    }

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
