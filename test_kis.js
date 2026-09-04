const axios = require('axios');

const config = {
  appKey: process.env.KIS_APPKEY,
  appSecret: process.env.KIS_SECRET,
  baseUrl: process.env.KIS_BASE_URL || 'https://openapi.koreainvestment.com:9443'
};

console.log('📋 설정값 확인:');
console.log('  KIS_APPKEY:', config.appKey ? `✅ 존재 (${config.appKey.length}자)` : '❌ 없음');
console.log('  KIS_SECRET:', config.appSecret ? `✅ 존재 (${config.appSecret.length}자)` : '❌ 없음');
console.log('  Base URL:', config.baseUrl);

if (!config.appKey || !config.appSecret) {
  console.error('\n❌ 환경변수 누락!');
  process.exit(1);
}

console.log('\n🔄 토큰 요청 중...\n');

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
  console.log('✅ 토큰 요청 성공!');
  console.log('  토큰:', res.data.access_token?.substring(0, 50) + '...');
  console.log('  유효기간:', res.data.expires_in, '초');
  console.log('  토큰타입:', res.data.token_type);
})
.catch(err => {
  console.error('❌ 토큰 요청 실패:');
  console.error('  상태코드:', err.response?.status);
  console.error('  에러코드:', err.response?.data?.error_code);
  console.error('  에러메시지:', err.response?.data?.error_description || err.message);
});
