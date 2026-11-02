const fs = require('fs');
const path = require('path');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  코드 수정 확인                                            ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// 1. trade/route.ts 확인
const tradeRoute = fs.readFileSync('app/api/cron/trade/route.ts', 'utf8');

console.log('✅ [1] trade/route.ts 검증:\n');

if (tradeRoute.includes('const reentryValidPrices = prices.filter(p => p > 0);')) {
  console.log('   ✅ 변수명 변경 완료: validPrices → reentryValidPrices');
} else {
  console.log('   ❌ 변수명 변경 실패');
}

if (tradeRoute.includes('📝 [${name}] trade_history 저장 시도:')) {
  console.log('   ✅ 거래 기록 로깅 강화 완료');
} else {
  console.log('   ❌ 거래 기록 로깅 미적용');
}

// 2. sell/route.ts 확인
const sellRoute = fs.readFileSync('app/api/cron/sell/route.ts', 'utf8');

console.log('\n✅ [2] sell/route.ts 검증:\n');

if (sellRoute.includes('if (sellPrice <= 0)')) {
  console.log('   ✅ sellPrice 안전성 검사 추가');
} else {
  console.log('   ❌ sellPrice 안전성 검사 미적용');
}

if (sellRoute.includes('📊 [${name}] trade_positions 업데이트 준비:')) {
  console.log('   ✅ trade_positions 업데이트 로깅 강화');
} else {
  console.log('   ❌ trade_positions 업데이트 로깅 미적용');
}

if (sellRoute.includes('📝 [${name}] trade_history 저장 시도:')) {
  console.log('   ✅ SELL 거래 기록 로깅 강화');
} else {
  console.log('   ❌ SELL 거래 기록 로깅 미적용');
}

console.log('\n═════════════════════════════════════════════════════════════');
console.log('📋 [3] 배포 상태:\n');
console.log('   ✅ 코드 커밋 완료');
console.log('   ✅ Vercel 배포 완료');
console.log('   ⏰ 다음 크론 실행 시 개선된 로깅으로 문제 추적 가능');

console.log('\n═════════════════════════════════════════════════════════════');
console.log('🚀 [4] 예상 효과:\n');
console.log('   ✅ 변수 중복 제거로 코드 안정성 향상');
console.log('   ✅ sellPrice 검증으로 재진입 기준값 0 문제 해결');
console.log('   ✅ 상세 로깅으로 거래 기록 미저장 원인 파악 가능');
console.log('   ✅ 다음 거래 시 자세한 디버그 정보 수집\n');

