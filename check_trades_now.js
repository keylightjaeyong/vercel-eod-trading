const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function checkNow() {
  try {
    // 현재 시간
    const timeResult = await pool.query(
      `SELECT NOW() AT TIME ZONE 'Asia/Seoul' as kst_time`
    );
    const now = timeResult.rows[0].kst_time;

    // 거래 기록 조회
    const trades = await pool.query(
      `SELECT code, name, quantity, entry_price, status, created_at AT TIME ZONE 'Asia/Seoul' as trade_time
       FROM trade_positions
       ORDER BY created_at DESC LIMIT 10`
    );

    // 가격 데이터 최신
    const priceResult = await pool.query(
      `SELECT code, close, timestamp FROM price_snapshots 
       ORDER BY timestamp DESC LIMIT 1`
    );

    console.log(`\n🕐 현재시간: ${now}\n`);
    console.log(`📈 최신가격: [${priceResult.rows[0]?.code}] ${priceResult.rows[0]?.close}원\n`);

    if (trades.rows.length === 0) {
      console.log('📭 거래 기록: 없음');
    } else {
      console.log('📊 거래 기록:');
      trades.rows.forEach(t => {
        const status = t.status === 'sold' ? '✅ 매도' : '⏳ 보유';
        console.log(`  ${status} [${t.code}] ${t.name} | ${t.quantity}주 @ ${t.entry_price}원 (${t.trade_time})`);
      });
    }

    console.log(`\n상태: ${trades.rows.length > 0 ? '✅ 거래 진행 중' : '⏳ 신호 대기 중'}`);

    await pool.end();
  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
}

checkNow();
