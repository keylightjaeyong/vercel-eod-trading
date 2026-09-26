const https = require('https');

const config = {
  global_settings: {
    min_drop: 0.1,
    min_rise: 0.1,
    search_window: 15,
    confidence_threshold: 0,
    test_mode: false,
    enabled: true
  }
};

const postData = JSON.stringify(config);

const options = {
  hostname: 'vercel-eod-trading.vercel.app',
  path: '/api/fulltime/config',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const result = JSON.parse(data);
    console.log('✅ 신뢰도 필터 제거 완료!');
    console.log('');
    console.log('최종 파라미터:');
    console.log(JSON.stringify(result.data.global_settings, null, 2));
    console.log('');
    console.log('🚀 이제 모든 V자 패턴에서 매수 신호 발생!');
    console.log('위험 제어: 손절매 1% (손실 제한)');
  });
});

req.on('error', (e) => {
  console.error('❌ 오류:', e.message);
});

req.write(postData);
req.end();
