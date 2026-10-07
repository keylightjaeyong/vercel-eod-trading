import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const data = await pool.query(`
      SELECT 
        id,
        close,
        created_at,
        EXTRACT(EPOCH FROM created_at) as epoch_seconds
      FROM price_snapshots
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 72
    `);
    
    console.log(`✅ 최근 72개 데이터 상세 분석\n`);
    console.log(`개수: ${data.rows.length}개\n`);
    
    if (data.rows.length > 0) {
      // 첫 번째와 마지막 데이터
      const first = data.rows[0];
      const last = data.rows[data.rows.length - 1];
      
      console.log('🔝 가장 최신 데이터 (ID ${first.id}):');
      console.log(`   시간: ${first.created_at}`);
      console.log(`   가격: ${first.close}원\n`);
      
      console.log('🔚 가장 오래된 데이터 (ID ${last.id}):');
      console.log(`   시간: ${last.created_at}`);
      console.log(`   가격: ${last.close}원\n`);
      
      // 시간 차이 계산
      const timeDiffSeconds = first.epoch_seconds - last.epoch_seconds;
      const timeDiffMinutes = Math.floor(timeDiffSeconds / 60);
      const timeDiffHours = (timeDiffMinutes / 60).toFixed(2);
      
      console.log('📊 시간 범위:');
      console.log(`   초: ${timeDiffSeconds}초`);
      console.log(`   분: ${timeDiffMinutes}분`);
      console.log(`   시간: ${timeDiffHours}시간`);
      
      // 평균 간격
      const avgInterval = (timeDiffMinutes / (data.rows.length - 1)).toFixed(2);
      console.log(`\n📈 데이터 간격:`);
      console.log(`   평균: ${avgInterval}분`);
      
      // 5분 간격이면 예상 범위
      const expected5min = ((data.rows.length - 1) * 5) / 60;
      console.log(`\n📌 검증:`);
      console.log(`   5분 간격이면: ${expected5min.toFixed(2)}시간 범위`);
      console.log(`   실제: ${timeDiffHours}시간 범위`);
      console.log(`   상태: ${Math.abs(timeDiffHours - expected5min) < 1 ? '✅ 정상' : '⚠️ 이상'}`);
    }
    
  } catch (err) {
    console.error('❌ 에러:', err.message);
  } finally {
    await pool.end();
  }
}

check();
