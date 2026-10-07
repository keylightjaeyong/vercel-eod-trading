const https = require('https');

// Vercel에 배포된 엔드포인트 테스트
const options = {
  hostname: 'vercel-eod-trading.vercel.app',
  path: '/api/cron/collect-prices',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('🔍 collect-prices 엔드포인트 테스트...\n');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ 응답 받음:');
      console.log(`  상태: ${result.success ? '성공' : '실패'}`);
      console.log(`  메시지: ${result.message}`);
      if (result.debug) {
        console.log(`  성공 개수: ${result.debug.successCount}`);
        console.log(`  실패 개수: ${result.debug.errorCount}`);
      }
      if (result.results && result.results.length > 0) {
        console.log(`\n  결과:`);
        result.results.slice(0, 3).forEach(r => {
          console.log(`    [${r.code}] ${r.name}: ${r.status}`);
        });
      }
    } catch (e) {
      console.log('📝 응답:', data.substring(0, 200));
    }
  });
});

req.on('error', (err) => {
  console.error('❌ 오류:', err.message);
});

req.end();

setTimeout(() => {
  console.log('\n⏱️ 타임아웃 (30초)');
  process.exit(0);
}, 30000);
