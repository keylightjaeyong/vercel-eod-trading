import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function monitor() {
  try {
    const now = new Date();
    const kst = new Date(now.getTime() + 9*60*60*1000);
    const kstStr = kst.toISOString();
    console.log(`⏰ 현재: ${kstStr.split('T')[0]} ${kstStr.split('T')[1].split('.')[0]} KST\n`);
    
    // 최근 24시간 데이터
    const recent24h = await pool.query(`
      SELECT COUNT(*) as count,
             MAX(created_at AT TIME ZONE 'Asia/Seoul') as latest
      FROM price_snapshots
      WHERE code = '005930'
      AND created_at > NOW() - INTERVAL '24 hours'
    `);
    
    console.log('📊 최근 24시간 수집:');
    console.log(`   개수: ${recent24h.rows[0].count}개`);
    if (recent24h.rows[0].count > 0) {
      const latest = new Date(recent24h.rows[0].latest).toISOString().split('T')[1].split('.')[0];
      console.log(`   마지막: ${latest}`);
    }
    
    // 72개 데이터
    const prices72 = await pool.query(`
      SELECT close, created_at AT TIME ZONE 'Asia/Seoul' as kst_time
      FROM price_snapshots
      WHERE code = '005930'
      ORDER BY created_at DESC
      LIMIT 72
    `);
    
    if (prices72.rows.length >= 72) {
      const priceArray = prices72.rows.map(r => parseInt(r.close));
      const min = Math.min(...priceArray);
      const max = Math.max(...priceArray);
      const current = priceArray[0];
      const oldest = prices72.rows[71];
      
      console.log(`\n📈 최근 72개 데이터:`);
      console.log(`   개수: ${prices72.rows.length}개 ✅`);
      console.log(`   현재: ${current.toLocaleString()}원`);
      console.log(`   최저: ${min.toLocaleString()}원`);
      console.log(`   최고: ${max.toLocaleString()}원`);
      
      const oldestTime = new Date(oldest.kst_time).toISOString().split('T')[1].split('.')[0];
      const newestTime = new Date(prices72.rows[0].kst_time).toISOString().split('T')[1].split('.')[0];
      console.log(`   시간: ${oldestTime} ~ ${newestTime}`);
      
      // 매수 신호
      const buyPrice = Math.floor(min * 1.01);
      const diff = current - buyPrice;
      
      console.log(`\n🎯 매수 신호:`);
      console.log(`   저점: ${min.toLocaleString()}원`);
      console.log(`   기준가: ${buyPrice.toLocaleString()}원 (1% 상승)`);
      console.log(`   현재: ${current.toLocaleString()}원`);
      if (diff >= 0) {
        console.log(`   ✅ 매수 신호! (+${diff.toLocaleString()}원)`);
      } else {
        console.log(`   ❌ 대기 (${diff.toLocaleString()}원 부족)`);
      }
    } else {
      console.log(`\n⚠️ 데이터 부족: ${prices72.rows.length}개 (72개 필요)`);
    }
    
  } catch (err) {
    console.error('❌ 에러:', err.message);
  } finally {
    await pool.end();
  }
}

monitor();
