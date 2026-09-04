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

// Step 1: Get token
client.post('/oauth2/tokenP', {
  grant_type: 'client_credentials',
  appkey: config.appKey,
  appsecret: config.appSecret
})
.then(res => {
  const token = res.data.access_token;
  console.log('✅ Token obtained successfully\n');

  const [cano, acntPrdtCd] = config.accountId.split('-');

  // Step 2: Test different endpoints for holdings
  const endpoints = [
    {
      name: 'trading/inquire-holdings (TTTC8434R)',
      path: '/uapi/domestic-stock/v1/trading/inquire-holdings',
      tr_id: 'TTTC8434R'
    },
    {
      name: 'account/inquire-holdings (TTTC8434R)',
      path: '/uapi/domestic-stock/v1/account/inquire-holdings',
      tr_id: 'TTTC8434R'
    },
    {
      name: 'product/inquire-holdings (TTTC8434R)',
      path: '/uapi/domestic-stock/v1/product/inquire-holdings',
      tr_id: 'TTTC8434R'
    },
    {
      name: 'trading/inquire-stock-balance (TTTC8434R)',
      path: '/uapi/domestic-stock/v1/trading/inquire-stock-balance',
      tr_id: 'TTTC8434R'
    },
    {
      name: 'account/inquire-balance (TTTC8434R)',
      path: '/uapi/domestic-stock/v1/account/inquire-balance',
      tr_id: 'TTTC8434R'
    }
  ];

  console.log('🔍 Testing Holdings Endpoints:\n');

  let completed = 0;
  endpoints.forEach((ep, idx) => {
    setTimeout(() => {
      client.get(ep.path, {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: config.appKey,
          appsecret: config.appSecret,
          tr_id: ep.tr_id
        },
        params: {
          CANO: cano,
          ACNT_PRDT_CD: acntPrdtCd,
          INQR_DVSN_1: '1',
          INQR_DVSN_2: '0'
        }
      })
      .then(r => {
        console.log(`✅ ${ep.name}`);
        console.log(`   rt_cd: ${r.data.rt_cd}, msg: ${r.data.msg1}`);
        if (r.data.output && r.data.output.length > 0) {
          console.log(`   보유종목 수: ${r.data.output.length}`);
        }
      })
      .catch(err => {
        console.log(`❌ ${ep.name}`);
        const status = err.response?.status;
        const data = err.response?.data;
        console.log(`   status: ${status}, msg: ${data?.msg1 || data?.msg || err.message}`);
      })
      .finally(() => {
        completed++;
        if (completed === endpoints.length) {
          process.exit(0);
        }
      });
    }, idx * 1000);
  });
})
.catch(err => {
  console.error('❌ Token error:', err.message);
  process.exit(1);
});
