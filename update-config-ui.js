const https = require('https');

const config = {
  global_settings: {
    min_drop: 0.1,
    min_rise: 0.1,
    search_window: 15,
    confidence_threshold: 60,
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
    console.log('✅ DB 업데이트 완료!');
    console.log('업데이트된 파라미터:');
    console.log(JSON.stringify(result.data.global_settings, null, 2));
  });
});

req.on('error', (e) => {
  console.error('❌ 오류:', e.message);
});

req.write(postData);
req.end();
