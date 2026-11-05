const fs = require('fs');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  코드 변경사항 종합 검토                                   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const checks = [
  {
    file: 'lib/kis/api.ts',
    checks: [
      {
        name: '환경 변수 검증',
        search: 'if (!this.appKey || !this.appSecret)',
        expected: '환경 변수 없으면 Error throw'
      },
      {
        name: '상세 로깅',
        search: 'console.log(`🔍 KIS 환경변수 검증:',
        expected: '환경 변수 상태 상세 로깅'
      }
    ]
  },
  {
    file: 'app/api/cron/trade/route.ts',
    checks: [
      {
        name: '변수명 변경',
        search: 'const reentryValidPrices = prices.filter',
        expected: 'validPrices → reentryValidPrices'
      },
      {
        name: 'KIS API 초기화 에러 처리',
        search: 'try {\s+kis = new KISApi\(\);\s+kis.updateEnv\(\);',
        expected: 'KIS 초기화 실패 시 500 에러 반환'
      },
      {
        name: '매수 기록 로깅',
        search: '📝 \[${name}\] trade_history 저장 시도:',
        expected: '매수 전 상세 로깅'
      }
    ]
  },
  {
    file: 'app/api/cron/sell/route.ts',
    checks: [
      {
        name: 'sellPrice 검증',
        search: 'if (sellPrice <= 0)',
        expected: '판매가 유효성 검사'
      },
      {
        name: 'KIS API 초기화 에러 처리',
        search: 'try {\s+kis = new KISApi\(\);\s+kis.updateEnv\(\);',
        expected: 'KIS 초기화 실패 시 500 에러 반환'
      },
      {
        name: '매도 기록 로깅',
        search: '📝 \[${name}\] trade_history 저장 시도:',
        expected: '매도 전 상세 로깅'
      }
    ]
  }
];

checks.forEach(fileCheck => {
  const content = fs.readFileSync(fileCheck.file, 'utf8');
  
  console.log(`📄 ${fileCheck.file}`);
  console.log('─────────────────────────────────────────────────────────────');
  
  fileCheck.checks.forEach(check => {
    const regex = new RegExp(check.search, 'i');
    const found = regex.test(content);
    const status = found ? '✅' : '❌';
    
    console.log(`${status} ${check.name}`);
    console.log(`   예상: ${check.expected}`);
    if (found) {
      console.log(`   상태: 적용됨`);
    } else {
      console.log(`   상태: 미적용 ⚠️`);
    }
  });
  
  console.log('');
});

// 잠재적 문제점 검토
console.log('\n⚠️  [잠재적 문제점 검토]\n');

const tradeRoute = fs.readFileSync('app/api/cron/trade/route.ts', 'utf8');
const sellRoute = fs.readFileSync('app/api/cron/sell/route.ts', 'utf8');
const kisApi = fs.readFileSync('lib/kis/api.ts', 'utf8');

const issues = [];

// 1. 변수 범위 문제
if (tradeRoute.match(/const reentryValidPrices.*?const validPrices/s)) {
  // OK - 다른 범위
} else if (tradeRoute.match(/const reentryValidPrices/) && tradeRoute.match(/const validPrices/)) {
  // 두 변수 모두 있음 - 검토 필요
  const lines = tradeRoute.split('\n');
  const reentryLine = lines.findIndex(l => l.includes('const reentryValidPrices'));
  const validLine = lines.findIndex(l => l.includes('const validPrices'));
  
  if (reentryLine < validLine) {
    issues.push('✅ 변수 범위 분리 정상: reentryValidPrices는 블록 내부, validPrices는 블록 외부');
  }
}

// 2. KIS API 초기화 에러 처리
if (tradeRoute.includes('try {') && tradeRoute.includes('kis.updateEnv()') && tradeRoute.includes('catch (initErr')) {
  issues.push('✅ trade/route.ts KIS 초기화 에러 처리: OK');
} else {
  issues.push('❌ trade/route.ts KIS 초기화 에러 처리: 누락');
}

if (sellRoute.includes('try {') && sellRoute.includes('kis.updateEnv()') && sellRoute.includes('catch (initErr')) {
  issues.push('✅ sell/route.ts KIS 초기화 에러 처리: OK');
} else {
  issues.push('❌ sell/route.ts KIS 초기화 에러 처리: 누락');
}

// 3. 환경 변수 검증
if (kisApi.includes('throw new Error') && kisApi.includes('KIS 필수 환경변수')) {
  issues.push('✅ KIS API 환경 변수 검증: OK (에러 throw)');
} else {
  issues.push('❌ KIS API 환경 변수 검증: 미흡');
}

// 4. sellPrice 검증
if (sellRoute.includes('if (sellPrice <= 0)')) {
  issues.push('✅ sell/route.ts sellPrice 검증: OK');
} else {
  issues.push('❌ sell/route.ts sellPrice 검증: 누락');
}

// 5. 로깅 강화
if (tradeRoute.includes('📝 [${name}] trade_history 저장 시도:')) {
  issues.push('✅ trade/route.ts 거래 기록 로깅: OK');
} else {
  issues.push('❌ trade/route.ts 거래 기록 로깅: 누락');
}

if (sellRoute.includes('📝 [${name}] trade_history 저장 시도:')) {
  issues.push('✅ sell/route.ts 거래 기록 로깅: OK');
} else {
  issues.push('❌ sell/route.ts 거래 기록 로깅: 누락');
}

issues.forEach(issue => console.log(issue));

console.log('\n═════════════════════════════════════════════════════════════');
console.log('\n📊 [최종 평가]\n');

const okCount = issues.filter(i => i.startsWith('✅')).length;
const totalCount = issues.length;

console.log(`통과: ${okCount}/${totalCount}`);

if (okCount === totalCount) {
  console.log('\n✅ 모든 수정사항이 정상 적용되었습니다!\n');
} else {
  console.log(`\n⚠️ ${totalCount - okCount}개 항목 검토 필요\n`);
}

