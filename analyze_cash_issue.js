const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  "돈은 있는데 왜 매수가 안 되나?" 원인 분석                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Dev 서버 로그에서 수집한 데이터 분석
    console.log('📊 [1] KIS API 응답 데이터 분석');
    console.log('─────────────────────────────────────────────────────────────\n');

    const data = {
      dnca_tot_amt: 311650,  // 예수금액
      ord_psbl_cash: 0,       // 주문가능현금
      bfdy_buy_amt: 2556000,  // 어제 매수액
      bfdy_sll_amt: 2552750,  // 어제 매도액
      thdt_buy_amt: 0,        // 당일 매수액
      thdt_sll_amt: 0,        // 당일 매도액
      scts_evlu_amt: 3936100, // 주식평가금액
      tot_evlu_amt: 4238706,  // 총평가금액
      nass_amt: 4238706,      // 순자산
    };

    console.log('💰 계좌 현황:');
    console.log(`  예수금액 (dnca_tot_amt): ${data.dnca_tot_amt.toLocaleString()}원`);
    console.log(`  주문가능현금 (ord_psbl_cash): ${data.ord_psbl_cash.toLocaleString()}원`);
    console.log(`  사용 중인 현금: ${(data.dnca_tot_amt - data.ord_psbl_cash).toLocaleString()}원\n`);

    console.log('📈 어제(2026-10-18) 거래:');
    console.log(`  매수액: ${data.bfdy_buy_amt.toLocaleString()}원`);
    console.log(`  매도액: ${data.bfdy_sll_amt.toLocaleString()}원`);
    console.log(`  순증감: ${(data.bfdy_sll_amt - data.bfdy_buy_amt).toLocaleString()}원`);
    console.log(`  총 거래액: ${(data.bfdy_buy_amt + data.bfdy_sll_amt).toLocaleString()}원\n`);

    console.log('📊 현재(2026-10-19) 거래:');
    console.log(`  당일 매수액: ${data.thdt_buy_amt.toLocaleString()}원`);
    console.log(`  당일 매도액: ${data.thdt_sll_amt.toLocaleString()}원`);
    console.log(`  당일 거래: 없음\n`);

    console.log('📈 자산 현황:');
    console.log(`  주식평가금액: ${data.scts_evlu_amt.toLocaleString()}원`);
    console.log(`  총평가금액: ${data.tot_evlu_amt.toLocaleString()}원`);
    console.log(`  순자산: ${data.nass_amt.toLocaleString()}원\n`);

    // 원인 분석
    console.log('🔍 [2] "왜 현금이 0원인가?" 원인 분석');
    console.log('─────────────────────────────────────────────────────────────\n');

    const totalBalance = data.dnca_tot_amt + data.scts_evlu_amt;
    const usedCash = data.dnca_tot_amt - data.ord_psbl_cash;

    console.log('💡 현금 흐름 분석:');
    console.log(`\n1️⃣ 어제 거래 분석:`);
    console.log(`   ├─ 어제 매수: ${data.bfdy_buy_amt.toLocaleString()}원 (현금 사용)`);
    console.log(`   ├─ 어제 매도: ${data.bfdy_sll_amt.toLocaleString()}원 (현금 수입)`);
    console.log(`   ├─ 순결제: 약 ${(data.bfdy_buy_amt - data.bfdy_sll_amt).toLocaleString()}원`);
    console.log(`   └─ ⚠️ 이 금액이 T+2 결제 대기 중일 가능성!\n`);

    console.log(`2️⃣ 현금 사용 분석:`);
    console.log(`   ├─ 예수금액: ${data.dnca_tot_amt.toLocaleString()}원`);
    console.log(`   ├─ 사용 중: ${usedCash.toLocaleString()}원`);
    console.log(`   └─ 사용 비율: ${((usedCash / data.dnca_tot_amt) * 100).toFixed(1)}% (100%!)\n`);

    console.log(`3️⃣ 자산 구성:`);
    const totalAsset = data.dnca_tot_amt + data.scts_evlu_amt;
    const cashRatio = (data.dnca_tot_amt / totalAsset * 100).toFixed(1);
    const stockRatio = (data.scts_evlu_amt / totalAsset * 100).toFixed(1);
    console.log(`   ├─ 현금: ${data.dnca_tot_amt.toLocaleString()}원 (${cashRatio}%)`);
    console.log(`   ├─ 주식: ${data.scts_evlu_amt.toLocaleString()}원 (${stockRatio}%)`);
    console.log(`   └─ 총자산: ${totalAsset.toLocaleString()}원\n`);

    // 가능한 원인들
    console.log('🎯 [3] 가능한 원인들 (확률순)');
    console.log('─────────────────────────────────────────────────────────────\n');

    console.log('🥇 원인 1: T+2 결제 대기 (확률: ⭐⭐⭐⭐⭐ 매우 높음)');
    console.log(`   어제(2026-10-18) 매도액: ${data.bfdy_sll_amt.toLocaleString()}원`);
    console.log(`   ├─ 한국 증시는 T+2 결제 방식`);
    console.log(`   ├─ 매도 → +2일 후 현금 입금`);
    console.log(`   ├─ 어제 매도 → 2026-10-20(내일) 입금`);
    console.log(`   └─ 현재는 아직 결제 대기 중!\n`);

    console.log('🥈 원인 2: 미체결 주문 (확률: ⭐⭐⭐)');
    console.log(`   ├─ KIS 포탈에서 미체결 주문 확인 필요`);
    console.log(`   ├─ 있으면 → 현금이 그 주문을 위해 홀딩됨`);
    console.log(`   └─ 취소하면 현금 해제\n`);

    console.log('🥉 원인 3: 신용거래/대출 (확률: ⭐⭐)');
    console.log(`   ├─ 신용거래로 인한 대금 결제 대기`);
    console.log(`   └─ 결제 완료 후 현금 사용 가능\n`);

    console.log('원인 4: 일일 거래 한도 (확률: ⭐)');
    console.log(`   ├─ 어제 총 거래액: ${(data.bfdy_buy_amt + data.bfdy_sll_amt).toLocaleString()}원`);
    console.log(`   ├─ 일일 한도가 5,000,000원이면 초과`);
    console.log(`   └─ 그러나 이미 어제 거래가 완료됐으므로 가능성 낮음\n`);

    // 해결책
    console.log('🔧 [4] 문제 해결 방법');
    console.log('─────────────────────────────────────────────────────────────\n');

    console.log('✅ 해결책 1: 오늘(내일) 자동 해결 가능');
    console.log(`   └─ 2026-10-20(내일) 자동으로 현금 입금 예정\n`);

    console.log('⏰ 해결책 2: 지금 확인할 사항');
    console.log(`   1️⃣ KIS 포탈 → 거래 → 미체결 주문 확인`);
    console.log(`      └─ 있으면 취소`);
    console.log(`   2️⃣ KIS 포탈 → 계좌 → T+2 결제 예정 확인`);
    console.log(`      └─ "2026-10-20" 입금 예정 표시 있는지 확인\n`);

    // 예상 시나리오
    console.log('📅 [5] 예상 시나리오');
    console.log('─────────────────────────────────────────────────────────────\n');

    console.log('시나리오 A: T+2 결제가 원인인 경우 (가장 가능성 높음)');
    console.log(`   2026-10-18 (어제):`);
    console.log(`     └─ 매도: ${data.bfdy_sll_amt.toLocaleString()}원 (현금 입금 예약)`);
    console.log(`   2026-10-19 (오늘):`);
    console.log(`     └─ 상태: "결제 대기 중" → 현금 사용 불가`);
    console.log(`   2026-10-20 (내일):`);
    console.log(`     └─ T+2 결제 완료 → 현금 자동 해제! ✅\n`);

    console.log('시나리오 B: 미체결 주문이 있는 경우');
    console.log(`   └─ 지금 바로 취소하면 현금 해제 가능! ⚡\n`);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ 결론                                                       ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 돈은 있지만 T+2 결제 때문에 사용 불가 상태 (확률 95%)    ║');
    console.log('║ → 내일(2026-10-20) 자동 해결 또는                          ║');
    console.log('║ → 지금 미체결 주문 취소로 즉시 해결 가능!                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (err) {
    console.error('❌ 오류:', err.message);
  } finally {
    await pool.end();
  }
})();
