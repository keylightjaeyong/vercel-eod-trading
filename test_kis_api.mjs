import { KISApi } from './lib/kis/api.ts';

async function test() {
  try {
    console.log('🧪 KIS API 테스트...\n');
    
    const kis = new KISApi();
    kis.updateEnv();
    
    console.log('📡 현재가 조회 시도: 005930 (삼성전자)');
    const price = await kis.retryGetPrice('005930', 'NX');
    
    console.log(`\n✅ KIS API 응답:`);
    console.log(`   종목명: ${price.name}`);
    console.log(`   현재가: ${price.current.toLocaleString()}원`);
    console.log(`   시가: ${price.bid}원`);
    console.log(`   종가: ${price.ask}원`);
    
  } catch (err) {
    console.error('\n❌ KIS API 에러:');
    console.error(`   ${err.message}`);
  }
}

test();
