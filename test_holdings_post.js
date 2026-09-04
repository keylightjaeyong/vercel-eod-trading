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
  console.log('✅ Token obtained\n');

  const [cano, acntPrdtCd] = config.accountId.split('-');

  // Test with different methods
  const tests = [
    {
      name: 'GET with INQR_DVSN',
      method: 'GET',
      path: '/uapi/domestic-stock/v1/trading/inquire-holdings',
      tr_id: 'TTTC8434R',
      params: {
        CANO: cano,
        ACNT_PRDT_CD: acntPrdtCd,
        INQR_DVSN_1: '1',
        INQR_DVSN_2: '0'
      }
    },
    {
      name: 'GET without INQR_DVSN',
      method: 'GET',
      path: '/uapi/domestic-stock/v1/trading/inquire-holdings',
      tr_id: 'TTTC8434R',
      params: {
        CANO: cano,
        ACNT_PRDT_CD: acntPrdtCd
      }
    },
    {
      name: 'POST with INQR_DVSN',
      method: 'POST',
      path: '/uapi/domestic-stock/v1/trading/inquire-holdings',
      tr_id: 'TTTC8434R',
      data: {
        CANO: cano,
        ACNT_PRDT_CD: acntPrdtCd,
        INQR_DVSN_1: '1',
        INQR_DVSN_2: '0'
      }
    },
    {
      name: 'GET alternative path (inquire-balance-detail)',
      method: 'GET',
      path: '/uapi/domestic-stock/v1/trading/inquire-balance-detail',
      tr_id: 'TTTC8434R',
      params: {
        CANO: cano,
        ACNT_PRDT_CD: acntPrdtCd
      }
    }
  ];

  console.log('🔍 Testing Different Methods/Parameters:\n');

  let completed = 0;
  tests.forEach((test, idx) => {
    setTimeout(() => {
      const config_req = {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: config.appKey,
          appsecret: config.appSecret,
          tr_id: test.tr_id
        }
      };

      if (test.method === 'GET') {
        config_req.params = test.params;
      }

      const requestFn = test.method === 'GET' ? client.get : client.post;
      requestFn.call(client, test.path, test.data || {}, config_req)
        .then(r => {
          console.log(`✅ ${test.name}`);
          console.log(`   rt_cd: ${r.data.rt_cd}, msg: ${r.data.msg1}`);
          if (r.data.output && Array.isArray(r.data.output)) {
            console.log(`   보유종목: ${r.data.output.length}개`);
          }
        })
        .catch(err => {
          console.log(`❌ ${test.name}`);
          const status = err.response?.status;
          const data = err.response?.data;
          console.log(`   status: ${status}, msg: ${data?.msg1 || data?.msg || err.message}`);
        })
        .finally(() => {
          completed++;
          if (completed === tests.length) {
            process.exit(0);
          }
        });
    }, idx * 1200);
  });
})
.catch(err => {
  console.error('❌ Token error:', err.message);
  process.exit(1);
});
