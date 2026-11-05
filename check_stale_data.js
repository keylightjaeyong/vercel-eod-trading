const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
};

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  DB 구 데이터 분석 (6일 이상 갱신 없음)                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 마지막 매도 포지션
    console.log('📊 [1] 마지막 매도 포지션\n');

    const lastSoldResult = await pool.query(`
      SELECT 
        id,
        code,
        name,
        entry_price,
        exit_price,
        reentry_threshold,
        last_reference_low,
        status,
        updated_at
      FROM trade_positions
      WHERE status = 'sold'
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    if (lastSoldResult.rows.length > 0) {
      const pos = lastSoldResult.rows[0];
      const updatedTime = new Date(pos.updated_at);
      const now = new Date();
      const daysDiff = Math.floor((now - updatedTime) / (1000 * 60 * 60 * 24));

      console.log(`종목: ${pos.code} - ${pos.name}`);
      console.log(`진입가: ${parseInt(pos.entry_price).toLocaleString()}원`);
      console.log(`매도가: ${parseInt(pos.exit_price).toLocaleString()}원`);
      console.log(`재진입 기준: ${parseInt(pos.reentry_threshold || 0).toLocaleString()}원`);
      console.log(`극강저점: ${parseInt(pos.last_reference_low || 0).toLocaleString()}원`);
      console.log(`마지막 업데이트: ${daysDiff}일 전\n`);

      if (daysDiff > 3) {
        console.log(`⚠️ ${daysDiff}일 동안 업데이트 안 됨!\n`);
      }
    }

    // 최근 6일 가격 범위
    console.log('📈 [2] 최근 6일 가격 범위\n');

    const priceRange = await pool.query(`
      SELECT 
        MAX(close) as max_price,
        MIN(close) as min_price
      FROM price_snapshots
      WHERE code = '005930'
        AND created_at > NOW() - INTERVAL '6 days'
    `);

    if (priceRange.rows.length > 0) {
      const maxPrice = parseInt(priceRange.rows[0].max_price || 0);
      const minPrice = parseInt(priceRange.rows[0].min_price || 0);
      
      console.log(`최고가: ${maxPrice.toLocaleString()}원`);
      console.log(`최저가: ${minPrice.toLocaleString()}원`);
      console.log(`범위: ${(maxPrice - minPrice).toLocaleString()}원\n`);
    }

    // 권장 조치
    console.log('🔧 [3] 권장 조치\n');
    
    console.log('옵션 1: 구 포지션 삭제');
    console.log('  - 6일 이상 갱신 없는 포지션 삭제');
    console.log('  - 신선한 시작 가능');
    console.log('  - 위험: 거래 이력 손실\n');

    console.log('옵션 2: 포지션 데이터 업데이트');
    console.log('  - reentry_threshold 재계산');
    console.log('  - last_reference_low 업데이트');
    console.log('  - 거래 이력 유지\n');

    console.log('옵션 3: 신규 포지션 추가');
    console.log('  - 구 포지션은 유지');
    console.log('  - 새로운 매수 신호 대기');
    console.log('  - 안전하지만 혼동 가능\n');

    // 현재 상태
    console.log('\n💡 [4] 현재 상태\n');

    const posCount = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM trade_positions
      GROUP BY status
    `);

    console.log('포지션 상태:');
    posCount.rows.forEach(row => {
      const icons = {
        'holding': '🟢',
        'sold': '🔴',
        'waiting_reentry': '🟡'
      };
      console.log(`${icons[row.status] || '⭕'} ${row.status}: ${row.count}개`);
    });

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
