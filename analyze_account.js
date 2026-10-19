const { KISApi } = require('./lib/kis/api');

(async () => {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  KIS 계좌 잔액 상세 분석                                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const kis = new KISApi();
    kis.updateEnv();

    // 1. getBalance() - 주식잔고조회
    console.log('📋 [1] 주식잔고조회 (getBalance)');
    console.log('─────────────────────────────────────────────────────────────');
    try {
      const balance = await kis.getBalance();

      console.log('💰 현금/잔액 정보:');
      console.log(`  예수금액 (dnca_tot_amt): ${(balance.dnca_tot_amt || 0).toLocaleString()}원`);
      console.log(`  주문가능현금 (ord_psbl_cash): ${(balance.ord_psbl_cash || 0).toLocaleString()}원`);
      console.log(`  추정주문가능금액 (estimated_order_amount): ${(balance.estimated_order_amount || 0).toLocaleString()}원`);

      console.log('\n📈 자산 정보:');
      console.log(`  주식평가금액 (scts_evlu_amt): ${(balance.scts_evlu_amt || 0).toLocaleString()}원`);
      console.log(`  총평가금액 (tot_evlu_amt): ${(balance.tot_evlu_amt || 0).toLocaleString()}원`);
      console.log(`  순자산 (nass_amt): ${(balance.nass_amt || 0).toLocaleString()}원`);

      console.log('\n🏦 거래 기록:');
      console.log(`  어제 매수액 (bfdy_buy_amt): ${(balance.bfdy_buy_amt || 0).toLocaleString()}원`);
      console.log(`  어제 매도액 (bfdy_sll_amt): ${(balance.bfdy_sll_amt || 0).toLocaleString()}원`);
      console.log(`  당일 매수액 (thdt_buy_amt): ${(balance.thdt_buy_amt || 0).toLocaleString()}원`);
      console.log(`  당일 매도액 (thdt_sll_amt): ${(balance.thdt_sll_amt || 0).toLocaleString()}원`);

      console.log('\n📊 보유 종목:');
      if (balance.holdings && balance.holdings.length > 0) {
        console.log(`  보유 종목: ${balance.holdings.length}개`);
        balance.holdings.forEach((h, i) => {
          console.log(`  [${i+1}] ${h.code} - ${h.qty}주 @ ${h.price}원 (평가금액: ${h.evalAmount?.toLocaleString()}원)`);
        });
      } else {
        console.log('  보유 종목: 없음');
      }

    } catch (err) {
      console.error('❌ getBalance 실패:', err.message);
    }

    // 2. getPurchaseCapability() - 매수가능조회
    console.log('\n\n📋 [2] 매수가능조회 (getPurchaseCapability)');
    console.log('─────────────────────────────────────────────────────────────');
    try {
      const capability = await kis.getPurchaseCapability('005930', 218500);

      console.log('💳 매수 가능 정보:');
      console.log(`  주문가능현금 (ord_psbl_cash): ${(capability.ord_psbl_cash || 0).toLocaleString()}원`);
      console.log(`  미수없는매수수량 (nrcvb_buy_qty): ${(capability.nrcvb_buy_qty || 0).toLocaleString()}주`);
      console.log(`  최대매수수량 (max_buy_ordr_qty): ${(capability.max_buy_ordr_qty || 0).toLocaleString()}주`);

      console.log('\n📊 세부 정보:');
      console.log(`  매수가능금액: ${((capability.nrcvb_buy_qty || 0) * 218500).toLocaleString()}원`);
      console.log(`  종목: 005930 (삼성전자)`);
      console.log(`  기준가: 218,500원`);

    } catch (err) {
      console.error('❌ getPurchaseCapability 실패:', err.message);
    }

    // 3. getAccount() - 계좌정보조회
    console.log('\n\n📋 [3] 계좌정보조회 (getAccount)');
    console.log('─────────────────────────────────────────────────────────────');
    try {
      const account = await kis.getAccount();

      console.log('🏦 계좌 정보:');
      console.log(`  계좌번호: ${account.accountNumber}`);
      console.log(`  잔액: ${(account.balance || 0).toLocaleString()}원`);
      console.log(`  총자산: ${(account.totalAsset || 0).toLocaleString()}원`);
      console.log(`  상태: ${account.status}`);

    } catch (err) {
      console.error('❌ getAccount 실패:', err.message);
    }

    // 4. 원인 분석
    console.log('\n\n🔍 [4] 원인 분석');
    console.log('─────────────────────────────────────────────────────────────');

    try {
      const balance = await kis.getBalance();
      const ordPsblCash = balance.ord_psbl_cash || 0;
      const dncaTotAmt = balance.dnca_tot_amt || 0;
      const sctsEvluAmt = balance.scts_evlu_amt || 0;
      const totEvluAmt = balance.tot_evlu_amt || 0;

      console.log('💡 현금 상태 분석:');
      console.log(`  예수금액: ${dncaTotAmt.toLocaleString()}원`);
      console.log(`  주문가능현금: ${ordPsblCash.toLocaleString()}원`);
      console.log(`  차이: ${(dncaTotAmt - ordPsblCash).toLocaleString()}원`);

      if (ordPsblCash === 0 && dncaTotAmt > 0) {
        console.log('\n⚠️ 문제: 주문가능현금이 0원입니다!');
        console.log('   원인 가능성:');
        console.log('   1️⃣  신용/대출금 사용 중 (대금결제 대기)');
        console.log('   2️⃣  미체결 주문이 있음 (현금 홀딩)');
        console.log('   3️⃣  약정 중인 거래가 있음');
        console.log('   4️⃣  API 권한 부족');
        console.log('   5️⃣  KIS 시스템 오류');
      }

      if (sctsEvluAmt > 0) {
        console.log('\n📈 보유 주식 정보:');
        console.log(`  주식 평가 금액: ${sctsEvluAmt.toLocaleString()}원`);
        console.log(`  총 자산: ${totEvluAmt.toLocaleString()}원`);
        console.log(`  → 현금이 주식으로 전환되어 있을 가능성`);
      }

    } catch (err) {
      console.error('❌ 분석 실패:', err.message);
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║ 분석 완료                                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (err) {
    console.error('❌ 오류:', err.message);
    console.error(err.stack);
  }
})();
