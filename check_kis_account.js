const https = require('https');
const { Pool } = require('pg');

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
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  KIS 계좌 잔액 상세 분석                                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 토큰 조회
    const tokenResult = await pool.query('SELECT access_token FROM kis_tokens ORDER BY id DESC LIMIT 1');
    if (tokenResult.rows.length === 0) {
      console.error('❌ KIS 토큰이 없습니다!');
      await pool.end();
      return;
    }

    const token = tokenResult.rows[0].access_token;
    const appKey = process.env.KIS_APPKEY;
    const appSecret = process.env.KIS_SECRET;
    const cano = '44291220';
    const acnt = '01';

    const headers = {
      'authorization': `Bearer ${token}`,
      'appkey': appKey,
      'appsecret': appSecret,
      'tr_id': 'TTTC8434R',
      'custtype': 'P'
    };

    // 1. 주식잔고조회 (가장 중요!)
    console.log('📋 [1] 주식잔고조회 (/uapi/domestic-stock/v1/trading/inquire-balance)');
    console.log('─────────────────────────────────────────────────────────────');

    const balanceRes = await makeKISRequest(
      `/uapi/domestic-stock/v1/trading/inquire-balance?CANO=${cano}&ACNT_PRDT_CD=${acnt}&AFHR_FLPR_YN=N&ORL_YN=&INQR_DVSN=02&UNPR_DVSN=01&FUND_STTL_ICLD_YN=N&FNCG_AMT_AUTO_RDPT_YN=N&PRCS_DVSN=00&CTX_AREA_FK=&CTX_AREA_NK=`,
      'GET',
      null,
      headers
    );

    if (balanceRes.rt_cd === '0') {
      const output = balanceRes.output;

      console.log('💰 현금/잔액 정보:');
      console.log(`  예수금액 (dnca_tot_amt): ${parseInt(output.dnca_tot_amt || 0).toLocaleString()}원`);
      console.log(`  매수체결금액: ${parseInt(output.bfdy_buy_amt || 0).toLocaleString()}원`);
      console.log(`  매도체결금액: ${parseInt(output.bfdy_sll_amt || 0).toLocaleString()}원`);
      console.log(`  당일매수: ${parseInt(output.thdt_buy_amt || 0).toLocaleString()}원`);
      console.log(`  당일매도: ${parseInt(output.thdt_sll_amt || 0).toLocaleString()}원`);

      console.log('\n📈 자산 정보:');
      console.log(`  주식평가금액 (scts_evlu_amt): ${parseInt(output.scts_evlu_amt || 0).toLocaleString()}원`);
      console.log(`  총평가금액 (tot_evlu_amt): ${parseInt(output.tot_evlu_amt || 0).toLocaleString()}원`);
      console.log(`  순자산 (nass_amt): ${parseInt(output.nass_amt || 0).toLocaleString()}원`);

      console.log('\n📊 보유 종목:');
      if (output.output2 && output.output2.length > 0) {
        console.log(`  총 ${output.output2.length}개 종목`);
        output.output2.slice(0, 5).forEach((h, i) => {
          const qty = parseInt(h.hldg_qty || 0);
          const price = parseInt(h.prpr || 0);
          const totalValue = qty * price;
          console.log(`  [${i+1}] ${h.pdno}: ${qty.toLocaleString()}주 @ ${price.toLocaleString()}원 = ${totalValue.toLocaleString()}원`);
        });
        if (output.output2.length > 5) {
          console.log(`  ... 외 ${output.output2.length - 5}개`);
        }
      } else {
        console.log('  보유 종목: 없음');
      }
    } else {
      console.error(`❌ 주식잔고조회 실패: ${balanceRes.msg}`);
    }

    // 2. 매수가능조회
    console.log('\n\n📋 [2] 매수가능조회 (/uapi/domestic-stock/v1/trading/inquire-psbl-order)');
    console.log('─────────────────────────────────────────────────────────────');

    const capabilityRes = await makeKISRequest(
      `/uapi/domestic-stock/v1/trading/inquire-psbl-order?CANO=${cano}&ACNT_PRDT_CD=${acnt}&PDNO=005930&ORD_UNPR=218500&ORD_DVSN=00&CMA_EVLU_AMT_ICLD_YN=Y&ONLY_ORD_PSBL_YN=&CTX_AREA_FK=&CTX_AREA_NK=`,
      'GET',
      null,
      headers
    );

    if (capabilityRes.rt_cd === '0') {
      const output = capabilityRes.output;
      console.log('💳 매수 가능 정보 (삼성전자 218,500원 기준):');
      console.log(`  주문가능현금 (ord_psbl_cash): ${parseInt(output.ord_psbl_cash || 0).toLocaleString()}원`);
      console.log(`  미수없는매수수량 (nrcvb_buy_qty): ${parseInt(output.nrcvb_buy_qty || 0).toLocaleString()}주`);
      console.log(`  최대매수수량 (max_buy_ordr_qty): ${parseInt(output.max_buy_ordr_qty || 0).toLocaleString()}주`);

      const buyQty = parseInt(output.nrcvb_buy_qty || 0);
      const totalAmount = buyQty * 218500;
      console.log(`\n  ✅ 최대 매수 가능액: ${totalAmount.toLocaleString()}원`);
    } else {
      console.error(`❌ 매수가능조회 실패: ${capabilityRes.msg}`);
    }

    // 3. 원인 분석
    console.log('\n\n🔍 [3] 원인 분석');
    console.log('─────────────────────────────────────────────────────────────');

    if (balanceRes.rt_cd === '0') {
      const dncaTotAmt = parseInt(balanceRes.output.dnca_tot_amt || 0);
      const sctsEvluAmt = parseInt(balanceRes.output.scts_evlu_amt || 0);

      if (capabilityRes.rt_cd === '0') {
        const ordPsblCash = parseInt(capabilityRes.output.ord_psbl_cash || 0);

        console.log('💡 현금 흐름 분석:');
        console.log(`  예수금액: ${dncaTotAmt.toLocaleString()}원`);
        console.log(`  주문가능현금: ${ordPsblCash.toLocaleString()}원`);
        console.log(`  사용 중인 현금: ${(dncaTotAmt - ordPsblCash).toLocaleString()}원`);

        if (ordPsblCash === 0) {
          console.log('\n⚠️ 문제 진단: 주문가능현금이 0원!');
          console.log('\n원인 가능성:');

          if (sctsEvluAmt > 0) {
            console.log(`\n1️⃣ 주식 보유 (${sctsEvluAmt.toLocaleString()}원)`);
            console.log('   → 현금이 주식으로 전환되어 있음');
            console.log('   → 보유 주식을 매도하거나 신규 자금을 입금해야 함');
          }

          console.log('\n2️⃣ 신용/대출 사용');
          console.log('   → 신용거래로 인한 대금결제 대기');

          console.log('\n3️⃣ 미체결 주문');
          console.log('   → 현금이 미체결 주문에 홀딩되어 있음');

          console.log('\n4️⃣ 일일 한도 초과');
          console.log('   → 당일 매매 한도를 초과했을 가능성');
        } else {
          console.log('\n✅ 주문 가능 현금이 있습니다:');
          console.log(`   최대 ${ordPsblCash.toLocaleString()}원 범위에서 매수 가능`);
        }
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║ 분석 완료                                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
    console.error(err.stack);
  }
})();
