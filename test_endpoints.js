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
      name: 'inquire-account-balance',
      path: '/uapi/domestic-stock/v1/trading/inquire-account-balance',
      trId: 'CTRP6548R',
      params: { CANO: cano, ACNT_PRDT_CD: acntPrdtCd, INQR_DVSN_1: '', BSPR_BF_DT_APLY_YN: '' }
    },
    {
      name: 'inquire-account',
      path: '/uapi/domestic-stock/v1/trading/inquire-account',
      trId: 'TTTC8434R',
      params: { CANO: cano, ACNT_PRDT_CD: acntPrdtCd }
    }
  ];

  console.log('🔍 엔드포인트 테스트\n');

  endpoints.forEach((ep, idx) => {
    setTimeout(() => {
      client.get(ep.path, {
        headers: {
          authorization: token,
          appkey: config.appKey,
          appsecret: config.appSecret,
          tr_id: ep.trId
        },
        params: ep.params
      })
      .then(res => {
        console.log(`✅ ${ep.name}\n   status: ${res.status}, rt_cd: ${res.data.rt_cd}`);
      })
      .catch(err => {
        console.log(`❌ ${ep.name}\n   status: ${err.response?.status}, msg: ${err.response?.data?.msg1 || err.message}`);
      });
    }, idx * 2000);
  });
})
.catch(err => console.error('토큰 실패:', err.message));
