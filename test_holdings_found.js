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

  console.log('✅ Token obtained\n');
  console.log('🔍 Testing Holdings Endpoint: /domestic-stock/v1/trading/inquire-holdings\n');

  // Test the working endpoint
  client.get('/domestic-stock/v1/trading/inquire-holdings', {
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
  })
  .then(r => {
    console.log('✅ SUCCESS!\n');
    console.log('📋 Response Status:', r.status);
    console.log('📋 Full Response:');
    console.log(JSON.stringify(r.data, null, 2));
  })
  .catch(err => {
    console.log('❌ FAILED');
    console.log('Status:', err.response?.status);
    console.log('Response:', JSON.stringify(err.response?.data, null, 2) || err.message);
  });
})
.catch(err => {
  console.error('❌ Token error:', err.message);
});
