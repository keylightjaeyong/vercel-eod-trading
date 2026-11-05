const { KISApi } = require('./lib/kis/api');

async function checkAccount() {
  try {
    console.log('🔍 KIS API 계좌 정보 확인\n');
    
    const kis = new KISApi();
    kis.updateEnv();
    
    console.log('✅ KIS 환경변수:');
    console.log(`   - APPKEY: ${kis.appKey ? '✅' : '❌'}`);
    console.log(`   - SECRET: ${kis.appSecret ? '✅' : '❌'}`);
    console.log(`   - ACCOUNT: ${kis.account}`);
    
    // 계좌 정보 조회
    console.log('\n📊 계좌 정보 조회 중...');
    
    try {
      const balance = await kis.getBalance();
      console.log('✅ getBalance() 성공:');
      console.log(`   - 예수금: ${balance.dnca_tot_amt}`);
      console.log(`   - 총자산: ${balance.tot_asst_amt}`);
      console.log(`   - 보유종목: ${balance.holdings?.length || 0}개`);
    } catch (err) {
      console.log(`❌ getBalance() 실패: ${err.message}`);
    }

    try {
      const account = await kis.getAccount();
      console.log('✅ getAccount() 성공:');
      console.log(`   - 잔액: ${account.balance}`);
    } catch (err) {
      console.log(`❌ getAccount() 실패: ${err.message}`);
    }

  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
}

checkAccount();
