const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  최근 거래 활동 분석                                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 거래 이력 최근 20개
    console.log('📊 [최근 거래 이력 (최근 20개)]');
    console.log('─────────────────────────────────────────────────────────────\n');

    const historyResult = await pool.query(`
      SELECT 
        id,
        code,
        name,
        action,
        quantity,
        price,
        created_at
      FROM trade_history
      ORDER BY created_at DESC
      LIMIT 20
    `);

    if (historyResult.rows.length === 0) {
      console.log('❌ 거래 이력 없음\n');
    } else {
      historyResult.rows.forEach((hist, idx) => {
        const date = new Date(hist.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const icon = hist.action === 'BUY' ? '🟢' : '🔴';
        const timeDiff = Date.now() - new Date(hist.created_at).getTime();
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        
        console.log(`[${idx + 1}] ${date} (${hoursAgo}시간 전)`);
        console.log(`    ${icon} ${hist.code} ${hist.action} ${hist.quantity}주 @ ${parseInt(hist.price).toLocaleString()}원\n`);
      });

      const lastTradeDate = new Date(historyResult.rows[0].created_at);
      const hoursSinceLastTrade = Math.floor((Date.now() - lastTradeDate.getTime()) / (1000 * 60 * 60));
      console.log(`⚠️ 마지막 거래: ${hoursSinceLastTrade}시간 전\n`);
    }

    // 포지션 변동 이력
    console.log('\n📈 [포지션 상태 변동]');
    console.log('─────────────────────────────────────────────────────────────\n');

    const posResult = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM trade_positions
      GROUP BY status
      ORDER BY status DESC
    `);

    posResult.rows.forEach(row => {
      const icons = {
        'holding': '🟢',
        'sold': '🔴',
        'waiting_reentry': '🟡'
      };
      console.log(`${icons[row.status] || '⭕'} ${row.status}: ${row.count}개`);
    });

    // 최근 업데이트된 포지션
    console.log('\n\n📋 [최근 업데이트된 포지션]');
    console.log('─────────────────────────────────────────────────────────────\n');

    const recentPosResult = await pool.query(`
      SELECT 
        id,
        code,
        name,
        status,
        entry_price,
        exit_price,
        updated_at
      FROM trade_positions
      ORDER BY updated_at DESC
      LIMIT 5
    `);

    recentPosResult.rows.forEach((pos, idx) => {
      const date = new Date(pos.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const statusIcon = pos.status === 'holding' ? '🟢' : pos.status === 'sold' ? '🔴' : '🟡';
      
      console.log(`[${idx + 1}] ${statusIcon} ${pos.code} | ${date}`);
      console.log(`    상태: ${pos.status}`);
      console.log(`    진입가: ${parseInt(pos.entry_price).toLocaleString()}원`);
      if (pos.exit_price) {
        console.log(`    청산가: ${parseInt(pos.exit_price).toLocaleString()}원`);
      }
      console.log('');
    });

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
