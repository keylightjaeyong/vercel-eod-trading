const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function status() {
  try {
    const [time, price, trades, holding] = await Promise.all([
      pool.query(`SELECT NOW() AT TIME ZONE 'Asia/Seoul' as t`),
      pool.query(`SELECT CAST(close AS NUMERIC) as p FROM price_snapshots WHERE code='005930' ORDER BY timestamp DESC LIMIT 1`),
      pool.query(`SELECT COUNT(*) as cnt FROM trade_positions`),
      pool.query(`SELECT * FROM trade_positions WHERE status='holding' ORDER BY created_at DESC`)
    ]);

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 거래 상태 최종 확인');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`⏰ 시간: ${time.rows[0].t}`);
    console.log(`💹 현재가: ${price.rows[0].p.toLocaleString()}원`);
    console.log(`📈 총 거래: ${trades.rows[0].cnt}건`);
    console.log(`🏠 보유 포지션: ${holding.rows.length}개\n`);

    if (holding.rows.length > 0) {
      console.log('✅ 보유 중인 포지션:');
      holding.rows.forEach((h, i) => {
        console.log(`  ${i+1}. [${h.code}] ${h.name} | ${h.quantity}주 @ ${h.entry_price}원 (수익: ${h.profit_loss || '계산중'}원)`);
      });
    } else {
      console.log('⏳ 현재 보유 포지션: 없음');
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 평가:');
    
    if (holding.rows.length > 0) {
      console.log('✅ 자동 매수 성공!');
      console.log('✅ 거래 시스템 정상 작동!');
    } else {
      console.log('⏳ 아직 매수 신호 대기 중');
      console.log('📌 매수 기준: 272,805원 (상승장 1%)');
      console.log('📌 현재가: ' + price.rows[0].p.toLocaleString() + '원');
    }

    await pool.end();
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

status();
