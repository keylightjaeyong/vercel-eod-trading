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

  console.log('🔍 보유종목 조회 API 테스트 (v2)\n');

  // 공식 문서 기준 파라미터
  const params = {
    CANO: cano,
    ACNT_PRDT_CD: acntPrdtCd,
    INQR_DVSN_1: '1',      // 1: 잔고 조회
    INQR_DVSN_2: '0',      // 0: 기본값
    CTX_AREA_FK100: '',
    CTX_AREA_NK100: ''
  };

  console.log('📤 요청 파라미터:');
  Object.entries(params).forEach(([k,v]) => console.log(`   ${k}: ${v}`));

  return client.get('/uapi/domestic-stock/v1/trading/inquire-holdings', {
    headers: {
      authorization: `Bearer ${token}`,
      appkey: config.appKey,
      appsecret: config.appSecret,
      tr_id: 'TTTC8434R'
    },
    params
  });
})
.then(res => {
  console.log('\n✅ 보유종목 조회 성공!');
  console.log('  rt_cd:', res.data.rt_cd);
  console.log('  msg:', res.data.msg1);
  
  if (res.data.output1 && Array.isArray(res.data.output1)) {
    console.log(`\n📊 보유 종목: ${res.data.output1.length}개`);
    if (res.data.output1.length > 0) {
      console.log('  첫 번째 항목 필드:', Object.keys(res.data.output1[0]).slice(0, 10));
      console.log('  샘플 데이터:', res.data.output1[0]);
    }
  }
  
  if (res.data.output2) {
    console.log('\n📋 output2:', res.data.output2);
  }
})
.catch(err => {
  console.error('❌ 실패');
  console.error('  상태:', err.response?.status);
  console.error('  rt_cd:', err.response?.data?.rt_cd);
  console.error('  msg:', err.response?.data?.msg1 || err.message);
});
