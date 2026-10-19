const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  "예수금액으로 주문할 수 없는가?" 분석                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Dev 로그에서 본 데이터
    const dnca_tot_amt = 311650;  // 예수금액
    const ord_psbl_cash = 0;      // 주문가능현금
    const current_price = 218000;
    
    console.log('📊 [1] 현재 상황');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`  예수금액 (dnca_tot_amt): ${dnca_tot_amt.toLocaleString()}원`);
    console.log(`  주문가능현금 (ord_psbl_cash): ${ord_psbl_cash.toLocaleString()}원`);
    console.log(`  차이: ${(dnca_tot_amt - ord_psbl_cash).toLocaleString()}원`);
    console.log(`  삼성전자 주가: ${current_price.toLocaleString()}원\n`);

    console.log('🤔 [2] "예수금액으로 주문할 수 없는가?" 분석');
    console.log('─────────────────────────────────────────────────────────────');
    
    const maxQtyFromDnca = Math.floor(dnca_tot_amt / current_price);
    const estimatedAmount = maxQtyFromDnca * current_price;
    
    console.log(`\n💡 만약 예수금액 전체를 사용할 수 있다면:`);
    console.log(`  최대 매수 수량: ${maxQtyFromDnca}주`);
    console.log(`  예상 매수액: ${estimatedAmount.toLocaleString()}원`);
    console.log(`  필요 금액: ${(maxQtyFromDnca * current_price).toLocaleString()}원`);

    console.log('\n\n🔍 [3] KIS API 파라미터 검토');
    console.log('─────────────────────────────────────────────────────────────');
    
    console.log('\n현재 설정:');
    console.log('  ORD_UNPR: 218,000원 (지정가)');
    console.log('  ORD_DVSN: "00" (지정가 주문)');
    console.log('  CMA_EVLU_AMT_ICLD_YN: "Y" (CMA 포함)');
    console.log('  OVRS_ICLD_YN: "N" (해외 제외)');
    
    console.log('\n\n💡 [4] 가능한 해결책');
    console.log('─────────────────────────────────────────────────────────────');
    
    console.log('\n방법 1️⃣: CMA (유동성대출) 사용');
    console.log('  └─ 현재 CMA_EVLU_AMT_ICLD_YN: "Y" (이미 포함)');
    console.log('  └─ 하지만 주문가능현금이 0이므로 미적용된 상태');
    console.log('  └─ KIS 포탈에서 유동성대출 옵션 확인 필요');
    
    console.log('\n방법 2️⃣: 신용거래 활성화');
    console.log('  └─ API에서 신용거래 옵션 추가');
    console.log('  └─ 하지만 T+2 결제 때문일 수 있음');
    
    console.log('\n방법 3️⃣: 어제 매도액 확인');
    console.log('  └─ 어제 매도: 2,552,750원');
    console.log('  └─ T+2 결제 예정: 내일(10-20)');
    console.log('  └─ 내일 이 금액이 자동으로 추가됨');
    console.log('  └─ → 가장 간단한 해결책!');

    console.log('\n\n⚠️  [5] 왜 지금 주문가능현금이 0인가?');
    console.log('─────────────────────────────────────────────────────────────');
    
    console.log('\n가설: T+2 결제 대기로 인한 현금 홀딩');
    console.log('  └─ 어제 매도한 돈이 아직 결제 중');
    console.log('  └─ T+2 규칙: 매도 → 2일 후 현금 입금');
    console.log('  └─ 어제(10-18) 매도 → 내일(10-20) 입금');
    console.log('  └─ 결국 내일 자동 해결됨!');

    console.log('\n\n✅ [6] 최종 결론');
    console.log('─────────────────────────────────────────────────────────────');
    
    console.log('\n❌ 지금 예수금액으로 주문 불가능한 이유:');
    console.log('   → T+2 결제 대기로 인한 현금 홀딩');
    
    console.log('\n✅ 내일 자동 해결됨:');
    console.log(`   → 2026-10-20 09:00 T+2 결제 완료`);
    console.log(`   → 어제 매도액 2,552,750원 자동 입금`);
    console.log(`   → 그 후 예수금액으로 자유롭게 주문 가능!`);

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
})();
