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

  const endpoints = [
    {
      name: 'trading/inquire-holdings',
      path: '/uapi/domestic-stock/v1/trading/inquire-holdings',
      tr_id: 'TTTC8434R'
    },
    {
      name: 'account/inquire-holdings',
      path: '/uapi/domestic-stock/v1/account/inquire-holdings',
      tr_id: 'TTTC8434R'
    },
    {
      name: 'trading/inquire-balance',
      path: '/uapi/domestic-stock/v1/trading/inquire-balance',
      tr_id: 'CTRP6548R'
    }
  ];

  console.log('🔍 보유종목 조회 엔드포인트 테스트\n');

  const promises = endpoints.map((ep, idx) => {
    return new Promise(resolve => {
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
          resolve();
        })
        .catch(err => {
          console.log(`❌ ${ep.name}`);
          console.log(`   status: ${err.response?.status}, msg: ${err.response?.data?.msg1 || err.message}`);
          resolve();
        });
      }, idx * 1500);
    });
  });

  return Promise.all(promises);
})
.catch(err => console.error('Token error:', err.message));
