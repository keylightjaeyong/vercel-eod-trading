const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  크론 잡 중단 원인 분석                                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 1. KIS 토큰 상태
    console.log('🔑 [1] KIS 토큰 상태\n');

    const tokenResult = await pool.query(`
      SELECT * FROM kis_tokens
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (tokenResult.rows.length > 0) {
      const token = tokenResult.rows[0];
      const createdAt = new Date(token.created_at);
      const now = new Date();
      const hoursDiff = Math.floor((now - createdAt) / (1000 * 60 * 60));
      
      console.log(`✅ KIS 토큰 존재`);
      console.log(`생성: ${createdAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log(`경과: ${hoursDiff}시간 전\n`);
    } else {
      console.log('❌ KIS 토큰 없음\n');
    }

    // 2. 가격 데이터 수집 상태
    console.log('📊 [2] 가격 데이터 수집 상태\n');

    const priceResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        MAX(created_at) as latest_time
      FROM price_snapshots
      WHERE code = '005930'
    `);

    if (priceResult.rows.length > 0) {
      const data = priceResult.rows[0];
      const latestTime = data.latest_time ? new Date(data.latest_time) : null;
      const now = new Date();
      
      console.log(`총 가격 데이터: ${data.total_count}개`);
      
      if (latestTime) {
        const minutesDiff = Math.floor((now - latestTime) / (1000 * 60));
        console.log(`최신: ${latestTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
        console.log(`경과: ${minutesDiff}분 전`);
        
        if (minutesDiff < 10) {
          console.log(`✅ 가격 데이터 실시간 수집 중\n`);
        } else if (minutesDiff < 60) {
          console.log(`⚠️ 가격 데이터 수집 지연 (${minutesDiff}분)\n`);
        } else {
          console.log(`❌ 가격 데이터 수집 중단 (${minutesDiff}분 이상)\n`);
        }
      }
    }

    // 3. 포지션 상태
    console.log('💼 [3] 포지션 상태\n');

    const posResult = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        MAX(updated_at) as latest_update
      FROM trade_positions
      GROUP BY status
      ORDER BY status DESC
    `);

    posResult.rows.forEach(row => {
      const updateTime = new Date(row.latest_update);
      const now = new Date();
      const hoursDiff = Math.floor((now - updateTime) / (1000 * 60 * 60));
      
      const icons = {
        'holding': '🟢',
        'sold': '🔴',
        'waiting_reentry': '🟡'
      };
      
      console.log(`${icons[row.status] || '⭕'} ${row.status}: ${row.count}개 (${hoursDiff}시간 전 업데이트)`);
    });

    // 4. 문제 분석
    console.log('\n\n🔍 [4] 크론 잡 중단 원인\n');

    console.log('📋 발견 사항:\n');
    
    if (tokenResult.rows.length === 0) {
      console.log('❌ KIS 토큰이 없음');
      console.log('   → kis_tokens 테이블에 데이터 없음');
      console.log('   → KIS API 인증 초기화 실패');
    } else {
      console.log('✅ KIS 토큰 존재');
    }

    if (priceResult.rows[0].total_count === 0) {
      console.log('❌ 가격 데이터 수집 안 됨');
      console.log('   → price_snapshots 비어있음');
      console.log('   → 가격 수집 배치 작동 안 함');
    } else {
      console.log('✅ 가격 데이터 존재');
    }

    console.log('\n\n⚡ [5] 핵심 문제\n');
    console.log('거래 이력(trade_history)이 완전히 없다는 것은:');
    console.log('  1️⃣ 매수 신호가 발생하지 않음 (가능성 높음)');
    console.log('  2️⃣ 매수 신호는 발생했지만 저장에 실패');
    console.log('  3️⃣ 크론 잡이 실행되지 않음\n');

    console.log('🎯 [6] 해결 방법\n');
    console.log('1️⃣ Vercel 크론 로그 확인');
    console.log('   → Vercel 대시보드 → 프로젝트 → Functions');
    console.log('   → /api/cron/trade, /api/cron/sell 로그 확인\n');
    
    console.log('2️⃣ 환경 변수 확인');
    console.log('   → Vercel 설정 → Environment Variables');
    console.log('   → KIS_APPKEY, KIS_SECRET 존재 여부 확인\n');

    console.log('3️⃣ 수동 테스트');
    console.log('   → curl https://vercel-eod-trading.vercel.app/api/cron/trade');
    console.log('   → 응답 확인\n');

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
