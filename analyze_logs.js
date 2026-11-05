const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

async function analyze() {
  try {
    console.log('🔍 최근 1시간 거래 데이터 분석\n');

    // 1. trade_history 확인
    const history = await pool.query(`
      SELECT action, COUNT(*) as count 
      FROM trade_history
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY action
      ORDER BY action
    `);

    console.log('📋 최근 1시간 trade_history:');
    if (history.rows.length === 0) {
      console.log('   거래 없음');
    } else {
      history.rows.forEach(h => {
        console.log(`   - ${h.action}: ${h.count}건`);
      });
    }

    // 2. trade_positions 확인
    const positions = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM trade_positions
      GROUP BY status
    `);

    console.log('\n📍 현재 포지션 상태:');
    positions.rows.forEach(p => {
      const icon = p.status === 'holding' ? '🟢' : p.status === 'sold' ? '🔴' : '🟡';
      console.log(`   ${icon} ${p.status}: ${p.count}개`);
    });

    // 3. trading_status 확인
    const trading = await pool.query(`
      SELECT * FROM trading_status WHERE id = 1
    `);

    console.log('\n⚙️ trading_status (거래 설정):');
    if (trading.rows.length > 0) {
      const row = trading.rows[0];
      console.log(`   - trading_enabled: ${row.trading_enabled !== undefined ? row.trading_enabled : '설정 안 됨'}`);
      console.log(`   - total_capital: ${row.total_capital?.toLocaleString()}원`);
      console.log(`   - timestamp: ${row.timestamp}`);
    } else {
      console.log('   설정 없음');
    }

    // 4. 가격 수집 현황
    const prices = await pool.query(`
      SELECT COUNT(*) as count
      FROM price_snapshots
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);

    console.log('\n📊 최근 1시간 수집된 가격:');
    console.log(`   ${prices.rows[0].count}개`);

    // 5. KIS 토큰 상태
    const token = await pool.query(`
      SELECT * FROM kis_tokens 
      WHERE token_type = 'ACCESS'
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    console.log('\n🔐 KIS 토큰 상태:');
    if (token.rows.length > 0) {
      const row = token.rows[0];
      console.log(`   - 발급시간: ${row.created_at}`);
      console.log(`   - 유효기간: ${row.expires_at}`);
      const now = new Date();
      const expiry = new Date(row.expires_at);
      const valid = expiry > now ? '✅ 유효' : '❌ 만료';
      console.log(`   - 상태: ${valid}`);
    }

  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await pool.end();
  }
}

analyze();
