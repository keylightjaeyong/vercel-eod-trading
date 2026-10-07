const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function checkSystem() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 거래 시스템 상세 검증');
    console.log('═══════════════════════════════════════════════════════\n');

    // 1. 활성화된 종목 확인
    const stocks = await pool.query(
      `SELECT code, name, enabled FROM stocks WHERE enabled = true LIMIT 20`
    );
    console.log(`📌 활성화된 종목: ${stocks.rows.length}개`);
    stocks.rows.forEach(s => console.log(`  - [${s.code}] ${s.name}`));

    // 2. 전체 거래 기록 (최근 20개)
    console.log('\n📊 전체 거래 기록 (최근 20개):');
    const trades = await pool.query(
      `SELECT id, code, name, quantity, entry_price, exit_price, status, 
              profit_loss, created_at, updated_at
       FROM trade_positions
       ORDER BY created_at DESC LIMIT 20`
    );
    
    if (trades.rows.length === 0) {
      console.log('  📭 거래 기록 없음');
    } else {
      trades.rows.forEach(t => {
        console.log(`  ${t.status === 'sold' ? '✅' : '⏳'} [${t.code}] ${t.name} | ${t.quantity}주 | 매수: ${t.entry_price}원 | 상태: ${t.status}`);
      });
    }

    // 3. 거래 상태 확인
    console.log('\n⚙️ 거래 시스템 상태:');
    const status = await pool.query(
      `SELECT trading_enabled, updated_at FROM trading_status WHERE id = 1`
    );
    if (status.rows.length > 0) {
      console.log(`  거래 활성화: ${status.rows[0].trading_enabled ? '✅ YES' : '❌ NO'}`);
      console.log(`  마지막 업데이트: ${status.rows[0].updated_at}`);
    }

    // 4. 가격 데이터 확인
    console.log('\n📈 최근 가격 수집 현황:');
    const prices = await pool.query(
      `SELECT code, COUNT(*) as count, MAX(timestamp) as latest
       FROM price_snapshots
       GROUP BY code
       ORDER BY MAX(timestamp) DESC LIMIT 10`
    );
    
    if (prices.rows.length === 0) {
      console.log('  📭 가격 데이터 없음');
    } else {
      prices.rows.forEach(p => {
        console.log(`  [${p.code}] ${p.count}개 | 최신: ${p.latest}`);
      });
    }

    // 5. 현재 시간 (KST)
    console.log('\n🕐 현재 시간:');
    const timeResult = await pool.query(`SELECT NOW() AT TIME ZONE 'Asia/Seoul' as kst_time`);
    console.log(`  ${timeResult.rows[0].kst_time}`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('💡 분석:');
    
    if (trades.rows.length === 0 && stocks.rows.length > 0) {
      console.log('  ⚠️ 활성화된 종목이 있지만 거래 기록이 없음');
      console.log('  📌 원인: 매수 신호 미생성 또는 크론 미실행');
      console.log('  ✅ 대응: 크론 실행 상태 확인 필요');
    }

    await pool.end();
  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
}

checkSystem();
