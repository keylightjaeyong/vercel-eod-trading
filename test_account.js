const axios = require('axios');

const config = {
  appKey: process.env.KIS_APPKEY,
  appSecret: process.env.KIS_SECRET,
  baseUrl: process.env.KIS_BASE_URL || 'https://openapi.koreainvestment.com:9443',
  accountId: '44291220-01'
};

const client = axios.create({
  baseURL: config.baseUrl,
  timeout: 10000,
  https: { rejectUnauthorized: false }
});

// 1. 토큰 요청
console.log('1️⃣ 토큰 요청 중...');
client.post('/oauth2/tokenP', {
  grant_type: 'client_credentials',
  appkey: config.appKey,
  appsecret: config.appSecret
})
.then(res => {
  const token = res.data.access_token;
  console.log('   ✅ 토큰 획득\n');

  // 2. 계좌 조회 요청
  console.log('2️⃣ 계좌 조회 중...');
  const [cano, acntPrdtCd] = config.accountId.split('-');

  return client.get('/uapi/domestic-stock/v1/trading/inquire-account-balance', {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      authorization: token,
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
  console.log('   ✅ 계좌 조회 성공!\n');
  console.log('📊 응답:');
  console.log('   rt_cd:', res.data.rt_cd);
  console.log('   msg1:', res.data.msg1);
  if (res.data.output2) {
    console.log('   잔고:', res.data.output2.dncl_amt);
    console.log('   평가금액:', res.data.output2.evlu_amt_smtl);
  }
})
.catch(err => {
  console.error('   ❌ 요청 실패\n');
  console.error('📋 에러 정보:');
  console.error('   상태코드:', err.response?.status);
  console.error('   rt_cd:', err.response?.data?.rt_cd);
  console.error('   msg1:', err.response?.data?.msg1);
  console.error('   에러:', err.message);
});
