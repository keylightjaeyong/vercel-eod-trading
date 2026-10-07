const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://94ea45caa9d840e42aefc1a738525d373232f4a2eadadf1e97dde4c59ba158ba:sk_x5u0CyB25sR5gldWV6kC8@db.prisma.io:5432/postgres?sslmode=require'
});

async function checkTrades() {
  try {
    // 어제와 오늘의 거래 기록 조회
    const result = await pool.query(`
      SELECT 
        DATE(created_at AT TIME ZONE 'Asia/Seoul') as trade_date,
        code,
        name,
        quantity,
        entry_price,
        exit_price,
        profit_loss,
        status,
        created_at AT TIME ZONE 'Asia/Seoul' as created_time
      FROM trade_positions
      WHERE DATE(created_at AT TIME ZONE 'Asia/Seoul') >= CURRENT_DATE AT TIME ZONE 'Asia/Seoul' - INTERVAL '1 day'
      ORDER BY created_at DESC
    `);

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 어제/오늘 거래 기록 검증');
    console.log('═══════════════════════════════════════════════════════\n');

    if (result.rows.length === 0) {
      console.log('📭 거래 기록 없음');
      await pool.end();
      return;
    }

    let totalProfit = 0;
    let totalTrades = 0;
    let successTrades = 0;
    let holdingTrades = 0;

    const groupByDate = {};
    result.rows.forEach(row => {
      const date = row.trade_date.toISOString().split('T')[0];
      if (!groupByDate[date]) {
        groupByDate[date] = [];
      }
      groupByDate[date].push(row);
    });

    for (const [date, trades] of Object.entries(groupByDate)) {
      console.log(`\n📅 ${date}`);
      console.log('─────────────────────────────────────────────────────');

      let dayProfit = 0;
      trades.forEach(trade => {
        totalTrades++;
        if (trade.status === 'sold') {
          successTrades++;
          dayProfit += trade.profit_loss || 0;
          totalProfit += trade.profit_loss || 0;
          const profitPct = ((trade.profit_loss || 0) / (trade.entry_price * trade.quantity)) * 100;
          console.log(`  ✅ ${trade.name} | 매수: ${trade.entry_price}원 × ${trade.quantity}주 → 매도: ${trade.exit_price}원 | 수익: ${trade.profit_loss?.toLocaleString()}원 (${profitPct.toFixed(2)}%)`);
        } else if (trade.status === 'holding') {
          holdingTrades++;
          console.log(`  ⏳ ${trade.name} | 매수: ${trade.entry_price}원 × ${trade.quantity}주 | 보유 중`);
        }
      });
      console.log(`  📈 일일 수익: ${dayProfit.toLocaleString()}원`);
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 종합 검증 결과');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`총 거래: ${totalTrades}건`);
    console.log(`✅ 완료: ${successTrades}건`);
    console.log(`⏳ 보유 중: ${holdingTrades}건`);
    console.log(`💰 총 수익: ${totalProfit.toLocaleString()}원`);
    console.log(`성공률: ${((successTrades / totalTrades) * 100).toFixed(1)}%`);

    if (totalProfit > 0 && successTrades >= 3) {
      console.log('\n✨ 평가: 시스템 정상 작동 → 자동매수 계속 진행 권장!');
    } else if (totalTrades === 0) {
      console.log('\n⚠️ 평가: 아직 거래 없음 → 시스템 대기 중');
    }

    await pool.end();
  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
}

checkTrades();
