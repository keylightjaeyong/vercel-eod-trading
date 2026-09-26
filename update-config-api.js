const https = require('https');

const config = {
  global_settings: {
    min_drop: 0.05,
    min_rise: 0.05,
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
    console.log('응답:', data);
  });
});

req.on('error', (e) => {
  console.error('오류:', e.message);
});

req.write(postData);
req.end();
