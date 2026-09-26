const https = require('https');

const config = {
  global_settings: {
    min_drop: 0.1,
    min_rise: 0.1,
    search_window: 15,
    confidence_threshold: 30,
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
    console.log('✅ 신뢰도 30% 설정 완료!');
    console.log('');
    console.log('최종 파라미터:');
    console.log(JSON.stringify(result.data.global_settings, null, 2));
    console.log('');
    console.log('실험 시작: 신뢰도 30%로 거래 신호 수집 중...');
  });
});

req.on('error', (e) => {
  console.error('오류:', e.message);
});

req.write(postData);
req.end();
