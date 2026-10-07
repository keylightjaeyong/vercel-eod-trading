const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function check() {
  try {
    console.log('🔍 매수가 안 된 이유 분석:\n');

    // 1. 보유 포지션 확인
    const holding = await pool.query(`
      SELECT * FROM trade_positions WHERE status='holding'
    `);
    
    console.log('1️⃣ 보유 포지션:');
    if (holding.rows.length > 0) {
      console.log(`  ❌ 있음! (${holding.rows.length}개)`);
      holding.rows.forEach(h => {
        console.log(`    - [${h.code}] ${h.name}: ${h.quantity}주 @ ${h.entry_price}원`);
      });
      console.log('  → 중복 매수 방지로 인해 매수 안 됨!');
    } else {
      console.log('  ✅ 없음 (정상)');
    }

    // 2. 거래 상태 확인
    console.log('\n2️⃣ 거래 상태:');
    const status = await pool.query(`
      SELECT * FROM trading_status WHERE id = 1
    `);
    
    if (status.rows.length > 0) {
      const s = status.rows[0];
      console.log(`  활성화: ${s.enabled ? '✅' : '❌'}`);
      if (!s.enabled) {
        console.log(`  사유: ${s.stopped_reason}`);
      }
    } else {
      console.log('  상태 정보 없음');
    }

    // 3. 환경변수 확인
    console.log('\n3️⃣ 환경변수:');
    const tradingEnabled = process.env.TRADING_ENABLED;
    console.log(`  TRADING_ENABLED: ${tradingEnabled}`);
    if (tradingEnabled === 'false') {
      console.log('  ❌ 거래 비활성화 상태!');
    }

    // 4. 거래 이력
    console.log('\n4️⃣ 거래 이력:');
    const history = await pool.query(`
      SELECT action, code, name, quantity, price, created_at 
      FROM trade_history 
      WHERE code='005930'
      ORDER BY created_at DESC LIMIT 5
    `);
    
    if (history.rows.length > 0) {
      console.log(`  최근 5개:`);
      history.rows.forEach(h => {
        console.log(`    ${h.action} [${h.code}] ${h.name}: ${h.quantity}주 @ ${h.price}원`);
      });
    } else {
      console.log('  거래 이력 없음');
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
  }
}

check();
