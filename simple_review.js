const fs = require('fs');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  코드 변경사항 검토                                        ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// 파일 검토
const files = {
  'lib/kis/api.ts': [
    { name: '환경 변수 검증 (throw)', search: 'throw new Error' },
    { name: '환경 변수 로깅', search: 'KIS 환경변수 검증' }
  ],
  'app/api/cron/trade/route.ts': [
    { name: '변수명 변경', search: 'reentryValidPrices' },
    { name: 'KIS 초기화 에러 처리', search: 'catch (initErr' },
    { name: '매수 기록 로깅', search: 'trade_history 저장 시도' }
  ],
  'app/api/cron/sell/route.ts': [
    { name: 'sellPrice 검증', search: 'if (sellPrice <= 0)' },
    { name: 'KIS 초기화 에러 처리', search: 'catch (initErr' },
    { name: '매도 기록 로깅', search: 'trade_history 저장 시도' }
  ]
};

let totalOk = 0;
let totalChecks = 0;

Object.entries(files).forEach(([filename, checks]) => {
  console.log(`📄 ${filename}\n`);
  
  try {
    const content = fs.readFileSync(filename, 'utf8');
    
    checks.forEach(check => {
      totalChecks++;
      const found = content.includes(check.search);
      const status = found ? '✅' : '❌';
      
      if (found) totalOk++;
      
      console.log(`${status} ${check.name}`);
      if (!found) {
        console.log(`   찾는 코드: "${check.search}"`);
      }
    });
  } catch (err) {
    console.log(`❌ 파일 없음: ${err.message}`);
  }
  
  console.log('');
});

console.log('═════════════════════════════════════════════════════════════\n');
console.log(`📊 검토 결과: ${totalOk}/${totalChecks} 통과\n`);

if (totalOk === totalChecks) {
  console.log('✅ 모든 수정사항이 정상 적용되었습니다!\n');
  console.log('🎯 다음 단계:');
  console.log('1. 거래 시간(08:00-20:00)에 크론 실행');
  console.log('2. Vercel 함수 로그 확인');
  console.log('3. 정확한 에러 원인 파악\n');
} else {
  console.log(`⚠️ ${totalChecks - totalOk}개 항목 미적용\n`);
}

