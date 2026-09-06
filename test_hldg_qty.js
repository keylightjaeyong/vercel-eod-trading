const axios = require('axios');

const config = {
  appKey: process.env.KIS_APPKEY,
  appSecret: process.env.KIS_SECRET,
  baseUrl: 'https://openapi.koreainvestment.com:9443',
  accountId: '44291220-01'
};

const client = axios.create({
  baseURL: config.baseUrl,
  timeout: 10000,
  https: { rejectUnauthorized: false }
});

client.post('/oauth2/tokenP', {
  grant_type: 'client_credentials',
  appkey: config.appKey,
  appsecret: config.appSecret
})
.then(res => {
  const token = res.data.access_token;
  const [cano, acntPrdtCd] = config.accountId.split('-');

  return client.get('/uapi/domestic-stock/v1/trading/inquire-account-balance', {
    headers: {
      authorization: `Bearer ${token}`,
      appkey: config.appKey,
      appsecret: config.appSecret,
      tr_id: 'CTRP6548R'
    },
    params: {
      CANO: cano,
      ACNT_PRDT_CD: acntPrdtCd,
      INQR_DVSN_1: '',
      BSPR_BF_DT_APLY_YN: ''
    }
  });
})
.then(res => {
  console.log('✅ 응답 성공\n');

  console.log('📋 output2 (계좌 요약):');
  const output2 = res.data.output2 || {};
  console.log(`  dncl_amt (잔고): ${output2.dncl_amt}`);
  console.log(`  evlu_amt_smtl (평가금액): ${output2.evlu_amt_smtl}`);

  console.log('\n📊 output1 (보유종목 목록):');
  const output1 = res.data.output1 || [];
  console.log(`  보유종목 수: ${output1.length}개`);

  if (output1.length > 0) {
    console.log('\n  상세 정보:');
    output1.forEach((item, idx) => {
      console.log(`  [${idx + 1}] ${item.prdt_name} (${item.pdno})`);
      console.log(`      보유수량: ${item.hldg_qty}주`);
      console.log(`      매입평균가: ${item.pchs_avg_pric}원`);
    });
  } else {
    console.log('  → 보유중인 종목 없음');
  }

  // 보유수량 합계 계산
  const totalQty = output1.reduce((sum, item) => sum + parseInt(item.hldg_qty || '0', 10), 0);
  console.log(`\n💰 전체 보유수량: ${totalQty}주`);
})
.catch(err => {
  console.error('❌ 오류:', err.message);
});
