import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function diagnose() {
  try {
    // 1. 전체 데이터 개수
    const total = await pool.query(`
      SELECT COUNT(*) as total, 
             COUNT(DISTINCT DATE(created_at AT TIME ZONE 'Asia/Seoul')) as days
      FROM price_snapshots
      WHERE code = '005930'
    `);
    
    console.log('📊 전체 데이터:');
    console.log(`   총 레코드: ${total.rows[0].total}개`);
    console.log(`   기록 날짜: ${total.rows[0].days}일`);
    
    // 2. 날짜별 데이터 개수
    const byDate = await pool.query(`
      SELECT DATE(created_at AT TIME ZONE 'Asia/Seoul') as date,
             COUNT(*) as count
      FROM price_snapshots
      WHERE code = '005930'
      GROUP BY DATE(created_at AT TIME ZONE 'Asia/Seoul')
      ORDER BY date DESC
      LIMIT 5
    `);
    
    console.log('\n📅 날짜별 데이터 개수:');
    byDate.rows.forEach(r => {
      console.log(`   ${r.date}: ${r.count}개`);
    });
    
    // 3. 현재 72개 데이터의 시간 범위
    const range72 = await pool.query(`
      SELECT 
        MIN(created_at AT TIME ZONE 'Asia/Seoul') as earliest,
        MAX(created_at AT TIME ZONE 'Asia/Seoul') as latest,
        COUNT(*) as count
      FROM (
        SELECT created_at FROM price_snapshots
        WHERE code = '005930'
        ORDER BY created_at DESC
        LIMIT 72
      ) t
    `);
    
    if (range72.rows[0].count >= 72) {
      const start = new Date(range72.rows[0].earliest).toISOString().split('T')[1].split('.')[0];
      const end = new Date(range72.rows[0].latest).toISOString().split('T')[1].split('.')[0];
      console.log(`\n⏱️ 최근 72개 데이터 시간 범위:`);
      console.log(`   개수: ${range72.rows[0].count}개 ✅`);
      console.log(`   시작: ${start} (가장 오래됨)`);
      console.log(`   종료: ${end} (가장 최신)`);
      
      // 시간 차이 계산
      const start_ms = new Date(range72.rows[0].earliest).getTime();
      const end_ms = new Date(range72.rows[0].latest).getTime();
      const hours = (end_ms - start_ms) / (1000 * 60 * 60);
      console.log(`   범위: ${hours.toFixed(1)}시간`);
      
      // 5분마다라면 71 * 5 = 355분 ≈ 5.92시간
      if (Math.abs(hours - 5.92) < 1) {
        console.log(`   ✅ 5분 간격 정상`);
      } else {
        console.log(`   ⚠️ 간격 이상 (5분 간격이면 5.92시간이어야 함)`);
      }
    } else {
      console.log(`\n⚠️ 데이터 부족: ${range72.rows[0].count}개 (72개 필요)`);
    }
    
    // 4. 최근 1시간 수집 여부
    const lastHour = await pool.query(`
      SELECT COUNT(*) as count,
             MAX(created_at AT TIME ZONE 'Asia/Seoul') as latest
      FROM price_snapshots
      WHERE code = '005930'
      AND created_at > NOW() - INTERVAL '1 hour'
    `);
    
    console.log(`\n🕐 최근 1시간 수집:`);
    console.log(`   개수: ${lastHour.rows[0].count}개`);
    if (lastHour.rows[0].count > 0) {
      const latest = new Date(lastHour.rows[0].latest).toISOString().split('T')[1].split('.')[0];
      console.log(`   마지막: ${latest}`);
      console.log(`   ✅ 수집 진행 중`);
    } else {
      console.log(`   ❌ 1시간 동안 수집 없음`);
    }
    
  } catch (err) {
    console.error('❌ 진단 오류:', err.message);
  } finally {
    await pool.end();
  }
}

diagnose();
