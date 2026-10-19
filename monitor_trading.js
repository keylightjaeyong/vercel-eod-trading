const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

function makeKISRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openapi.koreainvestment.com',
      port: 9443,
      path: path,
      method: method,
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  거래 모니터링 - ${now}                  ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 1️⃣ 현재 거래 포지션 확인
    console.log('📊 [1] 거래 포지션 현황');
    console.log('─────────────────────────────────────────────────────────────');

    const positionsResult = await pool.query(`
      SELECT
        code,
        name,
        entry_price,
        quantity,
        status,
        reentry_threshold,
        last_reference_low,
        market_regime,
        highest_price,
        updated_at
      FROM trade_positions
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    const statusGroups = {
      'holding': [],
      'sold': [],
      'waiting_reentry': []
    };

    positionsResult.rows.forEach(pos => {
      if (statusGroups[pos.status]) {
        statusGroups[pos.status].push(pos);
      }
    });

    let totalPositions = 0;
    if (statusGroups.holding.length > 0) {
      console.log(`\n🟢 보유 중: ${statusGroups.holding.length}개`);
      statusGroups.holding.forEach((pos, i) => {
        console.log(`  [${i+1}] ${pos.code} - ${pos.name}`);
        console.log(`      진입가: ${parseInt(pos.entry_price).toLocaleString()}원, ${pos.quantity}주`);
        console.log(`      시장: ${pos.market_regime}`);
      });
      totalPositions += statusGroups.holding.length;
    }

    if (statusGroups.waiting_reentry.length > 0) {
      console.log(`\n🟡 재진입 대기: ${statusGroups.waiting_reentry.length}개`);
      statusGroups.waiting_reentry.forEach((pos, i) => {
        console.log(`  [${i+1}] ${pos.code} - ${pos.name}`);
        console.log(`      재진입 임계값: ${parseInt(pos.reentry_threshold).toLocaleString()}원`);
        console.log(`      마지막 저점: ${parseInt(pos.last_reference_low).toLocaleString()}원`);
      });
      totalPositions += statusGroups.waiting_reentry.length;
    }

    if (statusGroups.sold.length > 0) {
      console.log(`\n⭕ 청산됨: ${statusGroups.sold.length}개`);
      totalPositions += statusGroups.sold.length;
    }

    if (totalPositions === 0) {
      console.log('⭕ 활성 포지션: 없음');
    }

    // 2️⃣ 최근 거래 이력
    console.log('\n\n📋 [2] 최근 거래 이력');
    console.log('─────────────────────────────────────────────────────────────');

    const historyResult = await pool.query(`
      SELECT
        id,
        code,
        name,
        action,
        quantity,
        price,
        pattern_signal,
        pattern_confidence,
        created_at
      FROM trade_history
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (historyResult.rows.length > 0) {
      historyResult.rows.forEach((trade, i) => {
        const date = new Date(trade.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const icon = trade.action === 'BUY' ? '🟢' : '🔴';
        const totalAmount = parseInt(trade.price) * trade.quantity;
        console.log(`\n[${i+1}] ${date}`);
        console.log(`   ${icon} ${trade.code} - ${trade.name} ${trade.action === 'BUY' ? '매수' : '매도'}`);
        console.log(`   ${trade.quantity}주 @ ${parseInt(trade.price).toLocaleString()}원 = ${totalAmount.toLocaleString()}원`);
        if (trade.pattern_signal) {
          console.log(`   신호: ${trade.pattern_signal} (확신도: ${trade.pattern_confidence}%)`);
        }
      });
    } else {
      console.log('⭕ 거래 이력: 없음');
    }

    // 3️⃣ 계좌 현황
    console.log('\n\n💰 [3] 계좌 현황');
    console.log('─────────────────────────────────────────────────────────────');

    const tokenResult = await pool.query('SELECT access_token FROM kis_tokens ORDER BY id DESC LIMIT 1');
    if (tokenResult.rows.length > 0) {
      const token = tokenResult.rows[0].access_token;
      const appKey = process.env.KIS_APPKEY || 'N/A';
      const appSecret = process.env.KIS_SECRET || 'N/A';

      if (appKey === 'N/A' || appSecret === 'N/A') {
        console.log('⚠️  환경 변수 설정 필요 (KIS_APPKEY, KIS_SECRET)');
        await pool.end();
        return;
      }
      const cano = '44291220';
      const acnt = '01';

      const headers = {
        'authorization': `Bearer ${token}`,
        'appkey': appKey,
        'appsecret': appSecret,
        'tr_id': 'TTTC8434R',
        'custtype': 'P'
      };

      const balanceRes = await makeKISRequest(
        `/uapi/domestic-stock/v1/trading/inquire-balance?CANO=${cano}&ACNT_PRDT_CD=${acnt}&AFHR_FLPR_YN=N&ORL_YN=&INQR_DVSN=02&UNPR_DVSN=01&FUND_STTL_ICLD_YN=N&FNCG_AMT_AUTO_RDPT_YN=N&PRCS_DVSN=00&CTX_AREA_FK=&CTX_AREA_NK=`,
        'GET',
        null,
        headers
      );

      if (balanceRes.rt_cd === '0') {
        const output = balanceRes.output;
        const dncaTotAmt = parseInt(output.dnca_tot_amt || 0);
        const sctsEvluAmt = parseInt(output.scts_evlu_amt || 0);
        const totEvluAmt = parseInt(output.tot_evlu_amt || 0);

        console.log('✅ 잔액 정보:');
        console.log(`   예수금액: ${dncaTotAmt.toLocaleString()}원`);
        console.log(`   주식평가: ${sctsEvluAmt.toLocaleString()}원`);
        console.log(`   총자산: ${totEvluAmt.toLocaleString()}원`);

        // 삼성전자 매수 가능 확인
        const capabilityRes = await makeKISRequest(
          `/uapi/domestic-stock/v1/trading/inquire-psbl-order?CANO=${cano}&ACNT_PRDT_CD=${acnt}&PDNO=005930&ORD_UNPR=218500&ORD_DVSN=00&CMA_EVLU_AMT_ICLD_YN=Y&ONLY_ORD_PSBL_YN=&CTX_AREA_FK=&CTX_AREA_NK=`,
          'GET',
          null,
          headers
        );

        if (capabilityRes.rt_cd === '0') {
          const ordPsblCash = parseInt(capabilityRes.output.ord_psbl_cash || 0);
          const nrcvbBuyQty = parseInt(capabilityRes.output.nrcvb_buy_qty || 0);

          console.log('\n   📌 삼성전자(005930) 매수 가능:');
          console.log(`      주문가능현금: ${ordPsblCash.toLocaleString()}원`);
          console.log(`      매수가능수량: ${nrcvbBuyQty}주`);
          console.log(`      상태: ${nrcvbBuyQty > 0 ? '✅ 매수 가능' : '❌ 매수 불가'}`);
        } else {
          console.log(`\n   ❌ 매수가능 조회 실패: ${capabilityRes.msg}`);
        }
      } else {
        console.log(`❌ 잔액 조회 실패: ${balanceRes.msg}`);
      }
    } else {
      console.log('⚠️  KIS 토큰 없음');
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║ 모니터링 완료                                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
})();
