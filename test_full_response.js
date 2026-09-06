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
  console.log('✅ 전체 응답 구조:\n');
  console.log(JSON.stringify(res.data, null, 2).substring(0, 3000));
  console.log('\n...(이하 생략)\n');

  if (res.data.output1 && res.data.output1.length > 0) {
    console.log('첫 번째 항목 구조:');
    console.log(JSON.stringify(res.data.output1[0], null, 2));
  }
})
.catch(err => {
  console.error('❌ 오류:', err.message);
});
