const https = require('https');

console.log('🔍 collect-prices 엔드포인트 실행 중...\n');

const options = {
  hostname: 'vercel-eod-trading.vercel.app',
  path: '/api/cron/collect-prices',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      console.log('📊 응답:\n');
      console.log(`상태: ${result.success ? '✅ 성공' : '❌ 실패'}`);
      console.log(`메시지: ${result.message}`);
      
      if (result.debug) {
        console.log(`\n성공: ${result.debug.successCount}개`);
        console.log(`실패: ${result.debug.errorCount}개`);
        console.log(`DB: ${result.debug.database}`);
      }
      
      if (result.error) {
        console.log(`\n❌ 오류: ${result.error}`);
      }

      if (result.results && result.results.length > 0) {
        console.log(`\n수집 결과:`);
        result.results.forEach(r => {
          console.log(`  [${r.code}] ${r.name}: ${r.status}`);
          if (r.price) console.log(`    가격: ${r.price.toLocaleString()}원`);
          if (r.error) console.log(`    오류: ${r.error}`);
        });
      }
    } catch (e) {
      console.log('📄 응답 (JSON 파싱 실패):');
      console.log(data.substring(0, 500));
    }
  });
});

req.on('error', (err) => {
  console.error('❌ 요청 오류:', err.message);
});

req.on('timeout', () => {
  console.error('❌ 타임아웃');
  req.destroy();
});

req.setTimeout(15000);
req.end();

setTimeout(() => {
  console.log('\n⏱️ 대기 완료');
  process.exit(0);
}, 20000);
