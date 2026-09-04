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

  // Various possible paths for holdings inquiry
  const paths = [
    '/uapi/domestic-stock/v1/trading/inquire-holdings',
    '/uapi/domestic-stock/v1/account/holdings',
    '/uapi/domestic-stock/v1/holdings',
    '/uapi/domestic-stock/v1/products/holdings',
    '/uapi/domestic-stock/inquire-holdings',
    '/uapi/trading/inquire-holdings',
    '/domestic-stock/v1/trading/inquire-holdings',
    '/quotations/inquire-balance-detail',
    '/trading/inquire-balance-detail',
    '/account/inquire-balance'
  ];

  console.log('🔍 Testing Various API Paths:\n');

  let completed = 0;
  paths.forEach((path, idx) => {
    setTimeout(() => {
      client.get(path, {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: config.appKey,
          appsecret: config.appSecret,
          tr_id: 'TTTC8434R'
        },
        params: {
          CANO: cano,
          ACNT_PRDT_CD: acntPrdtCd
        }
      })
      .then(r => {
        console.log(`✅ ${path}`);
        console.log(`   Status: ${r.status}, rt_cd: ${r.data.rt_cd}`);
      })
      .catch(err => {
        const status = err.response?.status;
        if (status && status !== 404 && status !== 403) {
          console.log(`⚠️  ${path}`);
          console.log(`   Status: ${status}, msg: ${err.response?.data?.msg1 || err.message}`);
        }
      })
      .finally(() => {
        completed++;
        if (completed === paths.length) {
          console.log('\nℹ️  (Only non-404/403 results shown above)');
          process.exit(0);
        }
      });
    }, idx * 500);
  });
})
.catch(err => {
  console.error('❌ Token error:', err.message);
  process.exit(1);
});
