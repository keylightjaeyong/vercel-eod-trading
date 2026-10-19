const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  상세 데이터베이스 상태 확인                               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 1. trade_positions 전체
    const positions = await pool.query('SELECT * FROM trade_positions');
    console.log(`1️⃣ trade_positions: ${positions.rows.length}개 레코드`);
    positions.rows.forEach(row => {
      console.log(`   - ${row.code}/${row.name} (${row.status}): ${row.quantity}주 @ ${row.entry_price}원`);
    });

    // 2. trade_history 전체
    const history = await pool.query('SELECT * FROM trade_history ORDER BY created_at DESC');
    console.log(`\n2️⃣ trade_history: ${history.rows.length}개 레코드`);
    history.rows.slice(0, 10).forEach(row => {
      const date = new Date(row.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      console.log(`   - [${date}] ${row.code}/${row.name} ${row.action} ${row.quantity}주 @ ${row.price}원`);
    });

    // 3. stocks 활성 상태
    const stocks = await pool.query('SELECT * FROM stocks');
    console.log(`\n3️⃣ stocks 설정: ${stocks.rows.length}개`);
    stocks.rows.forEach(row => {
      console.log(`   - ${row.code}/${row.name}: ${row.enabled ? '✅' : '❌'} (배분: ${row.allocation_pct}%)`);
    });

    // 4. price_snapshots 데이터
    const priceSnapshots = await pool.query(`
      SELECT code, COUNT(*) as count, MIN(timestamp) as oldest, MAX(timestamp) as newest
      FROM price_snapshots
      GROUP BY code
    `);
    console.log(`\n4️⃣ price_snapshots: ${priceSnapshots.rows.length}개 종목`);
    priceSnapshots.rows.forEach(row => {
      const oldDate = new Date(row.oldest).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const newDate = new Date(row.newest).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      console.log(`   - ${row.code}: ${row.count}개 캔들 (${oldDate} ~ ${newDate})`);
    });

    // 5. kis_tokens 상태
    const tokens = await pool.query(`
      SELECT id, expires_at, (expires_at - EXTRACT(EPOCH FROM NOW())::bigint) as remaining_secs
      FROM kis_tokens
      ORDER BY id DESC
      LIMIT 1
    `);
    console.log(`\n5️⃣ kis_tokens:`);
    if (tokens.rows.length > 0) {
      const remaining = tokens.rows[0].remaining_secs;
      const hours = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      console.log(`   ✅ 토큰 유효: ${hours}시간 ${mins}분 남음`);
    } else {
      console.log(`   ❌ 토큰 없음`);
    }

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
})();
