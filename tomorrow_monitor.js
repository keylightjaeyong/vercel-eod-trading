const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

async function checkCron() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'vercel-eod-trading.vercel.app',
      path: '/api/cron/trade',
      method: 'GET',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: 'ok', data: json });
        } catch (e) {
          resolve({ status: 'error', message: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ status: 'failed', message: err.message });
    });

    req.end();
  });
}

async function checkDB() {
  try {
    const positions = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM trade_positions 
      GROUP BY status
    `);

    const history = await pool.query(`
      SELECT COUNT(*) as count FROM trade_history
    `);

    return {
      positions: positions.rows,
      historyCount: history.rows[0].count
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function monitor() {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`\n📊 ${now} - 모니터링 체크\n`);

  // Cron 상태
  console.log('🔄 [1] 크론 상태');
  const cronStatus = await checkCron();
  console.log(`   ${cronStatus.status === 'ok' ? '✅' : '❌'} ${JSON.stringify(cronStatus).substring(0, 100)}...\n`);

  // DB 상태
  console.log('📈 [2] DB 포지션');
  const dbStatus = await checkDB();
  if (dbStatus.positions) {
    dbStatus.positions.forEach(p => {
      const icon = p.status === 'holding' ? '🟢' : p.status === 'sold' ? '🔴' : '🟡';
      console.log(`   ${icon} ${p.status}: ${p.count}개`);
    });
    console.log(`   📋 거래 이력: ${dbStatus.historyCount}개\n`);
  }

  console.log('═════════════════════════════════════════════════════════════\n');
}

// 08:00-20:00 사이에만 모니터링
async function start() {
  const hour = new Date().getHours() + 9; // KST
  
  if (hour < 8 || hour >= 20) {
    console.log('⏰ 거래 시간이 아닙니다 (08:00-20:00 KST)');
    process.exit(0);
  }

  console.log('🚀 모니터링 시작 (5분마다 체크)');
  console.log('⏹️  종료하려면 Ctrl+C\n');

  monitor();
  setInterval(monitor, 5 * 60 * 1000); // 5분마다
}

start().catch(err => {
  console.error('❌', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n\n✅ 모니터링 종료');
  await pool.end();
  process.exit(0);
});
