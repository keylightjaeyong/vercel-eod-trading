const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  포지션 상세 분석 - ${now}                  ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('📊 [1] 모든 포지션 (최신순)');
    console.log('─────────────────────────────────────────────────────────────\n');

    const posResult = await pool.query(`
      SELECT
        id,
        code,
        name,
        entry_price,
        quantity,
        exit_price,
        status,
        profit_loss_amount,
        profit_loss_percent,
        reentry_threshold,
        last_reference_low,
        market_regime,
        highest_price,
        created_at,
        updated_at
      FROM trade_positions
      ORDER BY updated_at DESC
      LIMIT 50
    `);

    console.log(`총 포지션: ${posResult.rows.length}개\n`);

    const statusCount = {};
    posResult.rows.forEach(pos => {
      if (!statusCount[pos.status]) statusCount[pos.status] = 0;
      statusCount[pos.status]++;
    });

    console.log('📈 상태별 포지션:');
    Object.keys(statusCount).forEach(status => {
      const icons = {
        'holding': '🟢',
        'sold': '🔴',
        'waiting_reentry': '🟡'
      };
      console.log(`  ${icons[status] || '⭕'} ${status}: ${statusCount[status]}개`);
    });

    console.log('\n📋 [2] 포지션 상세 정보');
    console.log('─────────────────────────────────────────────────────────────\n');

    posResult.rows.forEach((pos, idx) => {
      const createdDate = new Date(pos.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const updatedDate = new Date(pos.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const statusIcon = {
        'holding': '🟢',
        'sold': '🔴',
        'waiting_reentry': '🟡'
      }[pos.status] || '⭕';

      console.log(`[${idx+1}] ${statusIcon} ${pos.code} - ${pos.name}`);
      console.log(`    상태: ${pos.status}`);
      console.log(`    진입가: ${parseInt(pos.entry_price).toLocaleString()}원 × ${pos.quantity}주 = ${(parseInt(pos.entry_price) * pos.quantity).toLocaleString()}원`);
      
      if (pos.exit_price) {
        console.log(`    청산가: ${parseInt(pos.exit_price).toLocaleString()}원`);
      }
      
      if (pos.profit_loss_amount !== null) {
        const plIcon = pos.profit_loss_amount > 0 ? '✅' : pos.profit_loss_amount < 0 ? '❌' : '➖';
        console.log(`    손익: ${plIcon} ${parseInt(pos.profit_loss_amount).toLocaleString()}원 (${pos.profit_loss_percent.toFixed(2)}%)`);
      }

      if (pos.reentry_threshold) {
        console.log(`    재진입 임계값: ${parseInt(pos.reentry_threshold).toLocaleString()}원`);
      }

      if (pos.last_reference_low) {
        console.log(`    마지막 저점: ${parseInt(pos.last_reference_low).toLocaleString()}원`);
      }

      if (pos.market_regime) {
        console.log(`    시장 상황: ${pos.market_regime}`);
      }

      if (pos.highest_price) {
        console.log(`    최고가: ${parseInt(pos.highest_price).toLocaleString()}원`);
      }

      console.log(`    생성: ${createdDate}`);
      console.log(`    업데이트: ${updatedDate}`);
      console.log('');
    });

    // 총 손익
    console.log('\n💰 [3] 누적 손익');
    console.log('─────────────────────────────────────────────────────────────\n');

    const plResult = await pool.query(`
      SELECT
        SUM(profit_loss_amount) as total_pl,
        COUNT(*) as total_positions,
        SUM(CASE WHEN profit_loss_amount > 0 THEN 1 ELSE 0 END) as winning_trades,
        SUM(CASE WHEN profit_loss_amount < 0 THEN 1 ELSE 0 END) as losing_trades
      FROM trade_positions
      WHERE status = 'sold'
    `);

    if (plResult.rows[0]) {
      const totalPL = parseInt(plResult.rows[0].total_pl) || 0;
      const totalPos = plResult.rows[0].total_positions || 0;
      const winTrades = plResult.rows[0].winning_trades || 0;
      const loseTrades = plResult.rows[0].losing_trades || 0;

      console.log(`청산된 포지션: ${totalPos}개`);
      console.log(`  ✅ 수익: ${winTrades}개`);
      console.log(`  ❌ 손실: ${loseTrades}개`);
      console.log(`\n누적 손익: ${totalPL > 0 ? '✅' : totalPL < 0 ? '❌' : '➖'} ${totalPL.toLocaleString()}원`);
    }

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
