const https = require('https');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// .env.local 파일 읽기
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
  }
});

const pool = new Pool({
  connectionString: envVars.DATABASE_URL
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

    const appKey = envVars.KIS_APPKEY;
    const appSecret = envVars.KIS_SECRET;

    // 토큰 조회
    const tokenResult = await pool.query('SELECT access_token FROM kis_tokens ORDER BY id DESC LIMIT 1');
    if (tokenResult.rows.length === 0) {
      console.error('❌ KIS 토큰이 없습니다!');
      await pool.end();
      return;
    }

    const token = tokenResult.rows[0].access_token;
    const cano = '44291220';
    const acnt = '01';

    const headers = {
      'authorization': `Bearer ${token}`,
      'appkey': appKey,
      'appsecret': appSecret,
      'tr_id': 'TTTC8434R',
      'custtype': 'P'
    };

    // 1. 주식잔고조회
    console.log('📋 [1] 주식잔고조회');
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
      console.log(`  예수금액: ${parseInt(output.dnca_tot_amt || 0).toLocaleString()}원`);
      console.log(`  매수체결금액: ${parseInt(output.bfdy_buy_amt || 0).toLocaleString()}원`);
      console.log(`  매도체결금액: ${parseInt(output.bfdy_sll_amt || 0).toLocaleString()}원`);
      
      console.log('\n📈 자산 정보:');
      console.log(`  주식평가금액: ${parseInt(output.scts_evlu_amt || 0).toLocaleString()}원`);
      console.log(`  총평가금액: ${parseInt(output.tot_evlu_amt || 0).toLocaleString()}원`);
      console.log(`  순자산: ${parseInt(output.nass_amt || 0).toLocaleString()}원`);

      console.log('\n📊 보유 종목:');
      if (output.output2 && output.output2.length > 0) {
        console.log(`  총 ${output.output2.length}개 종목`);
        output.output2.forEach((h, i) => {
          const qty = parseInt(h.hldg_qty || 0);
          const price = parseInt(h.prpr || 0);
          const totalValue = qty * price;
          console.log(`  [${i+1}] ${h.pdno}: ${qty.toLocaleString()}주 @ ${price.toLocaleString()}원 = ${totalValue.toLocaleString()}원`);
        });
      } else {
        console.log('  보유 종목: 없음');
      }
    } else {
      console.error(`❌ 실패: ${balanceRes.msg}`);
    }

    // 2. 매수가능조회
    console.log('\n\n📋 [2] 매수가능조회 (삼성전자 218,500원)');
    console.log('─────────────────────────────────────────────────────────────');
    
    const capabilityRes = await makeKISRequest(
      `/uapi/domestic-stock/v1/trading/inquire-psbl-order?CANO=${cano}&ACNT_PRDT_CD=${acnt}&PDNO=005930&ORD_UNPR=218500&ORD_DVSN=00&CMA_EVLU_AMT_ICLD_YN=Y&ONLY_ORD_PSBL_YN=&CTX_AREA_FK=&CTX_AREA_NK=`,
      'GET',
      null,
      headers
    );

    if (capabilityRes.rt_cd === '0') {
      const output = capabilityRes.output;
      console.log('💳 매수 가능 정보:');
      console.log(`  주문가능현금: ${parseInt(output.ord_psbl_cash || 0).toLocaleString()}원`);
      console.log(`  미수없는매수수량: ${parseInt(output.nrcvb_buy_qty || 0).toLocaleString()}주`);
      console.log(`  최대매수수량: ${parseInt(output.max_buy_ordr_qty || 0).toLocaleString()}주`);
      
      const buyQty = parseInt(output.nrcvb_buy_qty || 0);
      const totalAmount = buyQty * 218500;
      
      if (buyQty > 0) {
        console.log(`\n✅ 최대 ${buyQty.toLocaleString()}주 매수 가능 (${totalAmount.toLocaleString()}원)`);
      } else {
        console.log('\n❌ 매수 불가능 상태');
      }
    } else {
      console.error(`❌ 실패: ${capabilityRes.msg}`);
    }

    // 3. 원인 분석
    console.log('\n\n🔍 [3] 원인 분석');
    console.log('─────────────────────────────────────────────────────────────');
    
    if (balanceRes.rt_cd === '0' && capabilityRes.rt_cd === '0') {
      const dncaTotAmt = parseInt(balanceRes.output.dnca_tot_amt || 0);
      const ordPsblCash = parseInt(capabilityRes.output.ord_psbl_cash || 0);
      const buyQty = parseInt(capabilityRes.output.nrcvb_buy_qty || 0);
      const sctsEvluAmt = parseInt(balanceRes.output.scts_evlu_amt || 0);
      
      console.log('💡 현금 상태:');
      console.log(`  예수금액: ${dncaTotAmt.toLocaleString()}원`);
      console.log(`  주문가능: ${ordPsblCash.toLocaleString()}원`);
      console.log(`  차이: ${(dncaTotAmt - ordPsblCash).toLocaleString()}원`);
      
      if (buyQty === 0) {
        console.log('\n⚠️ 문제: 매수 수량이 0주!');
        console.log('\n원인 분석:');
        
        if (ordPsblCash === 0) {
          console.log('1️⃣ 주문가능현금이 0원');
          console.log(`   → 예수금액 ${dncaTotAmt.toLocaleString()}원이 모두 사용 중`);
          
          if (sctsEvluAmt > 0) {
            console.log(`\n2️⃣ 보유 주식이 있음 (${sctsEvluAmt.toLocaleString()}원)`);
            console.log('   → 현금이 주식으로 전환되어 있음');
            console.log('   → 해결책: 기존 주식을 매도하거나 신규 자금 입금');
          } else {
            console.log('2️⃣ 미체결 주문 또는 신용거래');
            console.log('   → 현금이 주문에 홀딩되어 있음');
          }
        } else {
          console.log(`1️⃣ 주문가능현금은 ${ordPsblCash.toLocaleString()}원 있지만`);
          console.log(`   → 218,500원 × ${parseInt(ordPsblCash / 218500)}주 = ${(parseInt(ordPsblCash / 218500) * 218500).toLocaleString()}원`);
          console.log('   → 수량 부족으로 매수 불가');
        }
      } else {
        console.log(`\n✅ 매수 가능: ${buyQty.toLocaleString()}주`);
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║ 분석 완료                                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    await pool.end();

  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
})();
