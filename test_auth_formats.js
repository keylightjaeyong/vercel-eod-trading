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

  const authFormats = [
    { name: '토큰만', header: token },
    { name: 'Bearer {token}', header: `Bearer ${token}` },
    { name: 'token {token}', header: `token ${token}` },
    { name: 'Basic {token}', header: `Basic ${token}` }
  ];

  console.log('🔐 Authorization 헤더 형식 테스트\n');

  authFormats.forEach((fmt, idx) => {
    setTimeout(() => {
      client.get('/uapi/domestic-stock/v1/trading/inquire-account-balance', {
        headers: {
          authorization: fmt.header,
          appkey: config.appKey,
          appsecret: config.appSecret,
          tr_id: 'CTRP6548R'
        },
        params: { CANO: cano, ACNT_PRDT_CD: acntPrdtCd, INQR_DVSN_1: '', BSPR_BF_DT_APLY_YN: '' }
      })
      .then(res => {
        console.log(`✅ ${fmt.name}`);
        console.log(`   rt_cd: ${res.data.rt_cd}, msg: ${res.data.msg1}\n`);
      })
      .catch(err => {
        const msg = err.response?.data?.msg1 || err.message;
        console.log(`❌ ${fmt.name}`);
        console.log(`   status: ${err.response?.status}, msg: ${msg.substring(0, 60)}\n`);
      });
    }, idx * 1500);
  });
})
.catch(err => console.error('토큰 실패:', err.message));
