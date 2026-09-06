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

  return client.get('/uapi/domestic-stock/v1/trading/inquire-balance', {
    headers: {
      authorization: `Bearer ${token}`,
      appkey: config.appKey,
      appsecret: config.appSecret,
      tr_id: 'TTTC8434R'
    },
    params: {
      CANO: cano,
      ACNT_PRDT_CD: acntPrdtCd,
      INQR_DVSN_1: '1',
      INQR_DVSN_2: '0'
    }
  });
})
.then(res => {
  console.log('✅ 주식잔고조회 성공!\n');

  const output1 = res.data.output1 || [];
  const output2 = res.data.output2 || {};

  console.log('📊 보유종목 정보:');
  if (output1.length > 0) {
    console.log(`  총 ${output1.length}개 종목 보유\n`);
    output1.forEach((item, idx) => {
      if (item.pdno && item.hldg_qty && parseInt(item.hldg_qty) > 0) {
        console.log(`  [${idx + 1}] ${item.prdt_name} (${item.pdno})`);
        console.log(`      보유수량: ${item.hldg_qty}주`);
        console.log(`      매입평균가: ${item.pchs_avg_pric}원`);
        console.log(`      현재가: ${item.prpr}원`);
        console.log(`      평가금액: ${item.evlu_amt}원`);
        console.log(`      평가손익: ${item.evlu_pfls_amt}원 (${item.evlu_pfls_rt}%)\n`);
      }
    });
  } else {
    console.log('  보유종목 없음\n');
  }

  console.log('💰 계좌 요약정보:');
  console.log(`  예수금: ${output2.dnca_tot_amt}원`);
  console.log(`  평가금액: ${output2.evlu_amt_smtl}원`);
  console.log(`  평가손익: ${output2.evlu_pfls_amt_smtl}원`);
  console.log(`  총자산: ${output2.tot_asst_amt}원`);
})
.catch(err => {
  console.error('❌ 오류:', err.message);
  if (err.response?.data) {
    console.error('응답:', err.response.data);
  }
});
