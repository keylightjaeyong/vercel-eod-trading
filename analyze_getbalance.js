const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
};

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  getBalance() 실패 원인 분석                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('🔍 [1] KIS 토큰 상태\n');

    const tokenResult = await pool.query(`SELECT * FROM kis_tokens ORDER BY id DESC LIMIT 1`);
    
    if (tokenResult.rows.length > 0) {
      const token = tokenResult.rows[0];
      const expiresAt = token.expires_at || 0;
      const now = Math.floor(Date.now() / 1000);

      console.log(`토큰 생성: ${new Date(token.id * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log(`만료 예정: ${new Date(expiresAt * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log(`현재 시간: ${new Date(now * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      
      if (expiresAt < now) {
        console.log(`⚠️ 토큰 만료됨! (${Math.floor((now - expiresAt) / 3600)}시간 전)\n`);
      } else {
        console.log(`✅ 토큰 유효 (${Math.floor((expiresAt - now) / 3600)}시간 남음)\n`);
      }
    } else {
      console.log('❌ KIS 토큰 없음\n');
    }

    console.log('💡 [2] getBalance() 호출 실패 가능 원인\n');

    console.log('1️⃣ KIS API 토큰 만료');
    console.log('   - 토큰 유효시간: 24시간');
    console.log('   - 자동 갱신이 실패했을 수 있음');
    console.log('   - 해결: 토큰 강제 갱신\n');

    console.log('2️⃣ 계좌 정보 오류');
    console.log('   - KIS_ACCOUNT가 잘못됨');
    console.log('   - API에 등록되지 않은 계좌');
    console.log('   - 해결: 계좌 정보 재확인\n');

    console.log('3️⃣ KIS API 서버 오류');
    console.log('   - 한국투자증권 API 장애');
    console.log('   - 네트워크 문제');
    console.log('   - 해결: 재시도 (이미 3번 재시도 중)\n');

    console.log('4️⃣ 할당된 예산 부족');
    console.log('   - estimated_order_amount = 0');
    console.log('   - dnca_tot_amt = 0');
    console.log('   - 해결: 계좌에 예수금 확인\n');

    console.log('🎯 [3] 다음 거래 시간(08:00-20:00)의 예상\n');
    console.log('우리가 추가한 개선사항:');
    console.log('✅ KIS API 초기화 시 환경 변수 검증');
    console.log('✅ 에러 발생 시 상세 로그 출력');
    console.log('✅ reentry_threshold 유효성 검사\n');

    console.log('결과:');
    console.log('- getBalance() 실패 시 상세 에러 로그 출력');
    console.log('- 원인을 명확히 파악 가능');
    console.log('- Vercel 함수 로그 확인으로 정확한 원인 파악\n');

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
