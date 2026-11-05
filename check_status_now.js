const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

async function checkStatus() {
  try {
    console.log('\n📊 현재 거래 상태 확인\n');

    // 1. 포지션 현황
    const positions = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM trade_positions 
      GROUP BY status
    `);

    console.log('💼 포지션 상태:');
    if (positions.rows.length === 0) {
      console.log('   📭 포지션 없음');
    } else {
      positions.rows.forEach(p => {
        const icon = p.status === 'holding' ? '🟢' : p.status === 'sold' ? '🔴' : '🟡';
        console.log(`   ${icon} ${p.status}: ${p.count}개`);
      });
    }

    // 2. 오늘 거래 이력
    const today = new Date('2026-11-05').toISOString().split('T')[0];
    const history = await pool.query(`
      SELECT action, COUNT(*) as count 
      FROM trade_history 
      WHERE DATE(created_at) = $1
      GROUP BY action
    `, [today]);

    console.log('\n📋 오늘 거래 이력:');
    if (history.rows.length === 0) {
      console.log('   📭 거래 없음');
    } else {
      history.rows.forEach(h => {
        const icon = h.action === 'BUY' ? '📈' : h.action === 'SELL' ? '📉' : '⚠️';
        console.log(`   ${icon} ${h.action}: ${h.count}건`);
      });
    }

    // 3. 최근 5건 거래
    const recent = await pool.query(`
      SELECT action, code, name, quantity, price, created_at
      FROM trade_history 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    console.log('\n📈 최근 거래 5건:');
    if (recent.rows.length === 0) {
      console.log('   없음');
    } else {
      recent.rows.forEach((r, i) => {
        const icon = r.action === 'BUY' ? '📈' : r.action === 'SELL' ? '📉' : '⚠️';
        console.log(`   ${i+1}. ${icon} ${r.action} ${r.name}: ${r.quantity}주 @ ${r.price}원 (${new Date(r.created_at).toLocaleString('ko-KR')})`);
      });
    }

    console.log('\n✅ 확인 완료\n');
  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await pool.end();
  }
}

checkStatus();
