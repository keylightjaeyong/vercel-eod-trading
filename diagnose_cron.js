const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  크론 잡 중단 원인 분석                                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 1. 마지막 거래 이후 날짜 차이
    console.log('📅 [1] 마지막 거래 시간 확인\n');

    const lastTradeResult = await pool.query(`
      SELECT 
        id,
        code,
        name,
        action,
        price,
        created_at
      FROM trade_history
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (lastTradeResult.rows.length > 0) {
      const lastTrade = lastTradeResult.rows[0];
      const lastDate = new Date(lastTrade.created_at);
      const now = new Date();
      const daysDiff = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      
      console.log(`마지막 거래: ${lastDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log(`현재 시간: ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log(`경과: ${daysDiff}일 전\n`);
    } else {
      console.log('❌ 거래 이력 없음\n');
    }

    // 2. KIS 토큰 상태 확인
    console.log('🔑 [2] KIS 토큰 상태\n');

    const tokenResult = await pool.query(`
      SELECT 
        id,
        access_token,
        token_type,
        expires_in,
        created_at,
        updated_at
      FROM kis_tokens
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (tokenResult.rows.length > 0) {
      const token = tokenResult.rows[0];
      const createdAt = new Date(token.created_at);
      const now = new Date();
      const hoursDiff = Math.floor((now - createdAt) / (1000 * 60 * 60));
      const expiresIn = token.expires_in || 86400; // 기본 24시간
      
      console.log(`✅ KIS 토큰 존재`);
      console.log(`생성: ${createdAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log(`경과: ${hoursDiff}시간`);
      console.log(`유효시간: ${expiresIn}초 (${(expiresIn / 3600).toFixed(1)}시간)`);
      
      if (hoursDiff > expiresIn / 3600) {
        console.log(`⚠️ 토큰 만료됨! (${hoursDiff}시간 > ${(expiresIn/3600).toFixed(1)}시간)\n`);
      } else {
        console.log(`✅ 토큰 유효 (${(expiresIn/3600 - hoursDiff).toFixed(1)}시간 남음)\n`);
      }
    } else {
      console.log('❌ KIS 토큰 없음\n');
    }

    // 3. 가격 데이터 수집 상태
    console.log('📊 [3] 가격 데이터 수집 상태\n');

    const priceResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        MAX(created_at) as latest_time,
        MIN(created_at) as oldest_time
      FROM price_snapshots
      WHERE code = '005930'
    `);

    if (priceResult.rows.length > 0) {
      const data = priceResult.rows[0];
      const latestTime = new Date(data.latest_time);
      const now = new Date();
      const minutesDiff = Math.floor((now - latestTime) / (1000 * 60));
      
      console.log(`총 가격 데이터: ${data.total_count}개`);
      console.log(`최신: ${latestTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log(`경과: ${minutesDiff}분 전`);
      
      if (minutesDiff > 60) {
        console.log(`⚠️ 가격 데이터 수집이 1시간 이상 중단됨!\n`);
      } else {
        console.log(`✅ 가격 데이터 정상 수집 중\n`);
      }
    }

    // 4. 환경 변수 확인 (간접적)
    console.log('⚙️  [4] 시스템 설정 확인\n');

    console.log('환경 변수 필요성:');
    console.log('  - KIS_APPKEY: 한국투자증권 API 키');
    console.log('  - KIS_SECRET: 한국투자증권 API 시크릿');
    console.log('  - DATABASE_URL: PostgreSQL 연결\n');

    // 5. 포지션 상태 분석
    console.log('💼 [5] 포지션 상태\n');

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
      
      console.log(`${icons[row.status] || '⭕'} ${row.status}: ${row.count}개`);
      console.log(`   최근 업데이트: ${updateTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (${hoursDiff}시간 전)\n`);
    });

    // 6. 가능한 원인 진단
    console.log('🔍 [6] 크론 잡 중단 가능 원인\n');

    const diagnostics = [];

    if (tokenResult.rows.length === 0) {
      diagnostics.push('❌ KIS 토큰 없음 → 거래 API 호출 불가');
    } else {
      const token = tokenResult.rows[0];
      const createdAt = new Date(token.created_at);
      const now = new Date();
      const hoursDiff = Math.floor((now - createdAt) / (1000 * 60 * 60));
      if (hoursDiff > 24) {
        diagnostics.push('❌ KIS 토큰 만료 → 거래 신호 생성 불가');
      }
    }

    if (priceResult.rows[0].total_count < 100) {
      diagnostics.push('❌ 가격 데이터 부족 → 지표 계산 불가');
    }

    if (diagnostics.length === 0) {
      diagnostics.push('✅ 시스템 정상 - 다른 원인 조사 필요');
      diagnostics.push('✅ 매수 신호 조건 미충족 가능성');
      diagnostics.push('✅ 환경 변수 미설정 가능성 (KIS_APPKEY/SECRET)');
    }

    diagnostics.forEach(d => console.log(d));

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
