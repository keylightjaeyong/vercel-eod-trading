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

  console.log('🔍 보유종목 조회 테스트\n');

  return client.get('/uapi/domestic-stock/v1/trading/inquire-holdings', {
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
      INQR_DVSN_2: ''
    }
  });
})
.then(res => {
  console.log('✅ 보유종목 조회 성공!');
  console.log('  rt_cd:', res.data.rt_cd);
  console.log('  msg:', res.data.msg1);
  
  if (res.data.output1) {
    console.log('\n📊 응답 구조:');
    console.log('  output1 (리스트):', res.data.output1.length, '개');
    if (res.data.output1[0]) {
      console.log('  첫 번째 항목:', Object.keys(res.data.output1[0]));
    }
  }
  
  if (res.data.output2) {
    console.log('\n📋 output2:', res.data.output2);
  }
})
.catch(err => {
  console.error('❌ 보유종목 조회 실패');
  console.error('  status:', err.response?.status);
  console.error('  msg:', err.response?.data?.msg1 || err.message);
});
