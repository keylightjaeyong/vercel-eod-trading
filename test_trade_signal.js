const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.oexmuweghtmzxipjxkgj:Deckor3412!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

(async () => {
  try {
    console.log('=== 거래 신호 수동 테스트 ===\n');

    // 1. 환경변수 확인
    const tradingEnabled = process.env.TRADING_ENABLED !== 'false';
    console.log(`[1] TRADING_ENABLED: ${process.env.TRADING_ENABLED} → enabled: ${tradingEnabled}`);

    if (!tradingEnabled) {
      console.log('❌ 거래가 비활성화되어 있습니다!');
      return;
    }

    // 2. trading_status 확인
    console.log('\n[2] trading_status 확인...');
    const statusResult = await pool.query(
      'SELECT trading_enabled, stopped_reason FROM trading_status WHERE id = 1'
    );
    if (statusResult.rows.length > 0) {
      const status = statusResult.rows[0];
      console.log(`  trading_enabled: ${status.trading_enabled}`);
      console.log(`  stopped_reason: ${status.stopped_reason || '없음'}`);

      if (!status.trading_enabled) {
        console.log('❌ 거래가 중단되어 있습니다!');
        return;
      }
    }

    // 3. trading_config 확인
    console.log('\n[3] trading_config 확인...');
    const configResult = await pool.query(
      'SELECT config_json FROM trading_config WHERE id = 1'
    );

    let config = {
      global_settings: {
        enabled: tradingEnabled,
        min_rise: 1.5,
        search_window: 10,
      },
      stocks: [],
    };

    if (configResult.rows.length > 0) {
      const dbConfig = JSON.parse(configResult.rows[0].config_json);
      config = {
        ...dbConfig,
        global_settings: {
          ...dbConfig.global_settings,
          enabled: tradingEnabled,
        },
      };
      console.log('  ✅ DB에서 설정 조회');
      console.log(`  설정 내용: ${JSON.stringify(config, null, 2)}`);
    } else {
      console.log('  ⚠️  DB 설정 없음, 기본값 사용');
    }

    // 4. stocks 조회
    console.log('\n[4] stocks 조회...');
    let stocks = (config.stocks || []).filter((s) => s.enabled);
    console.log(`  config.stocks에서: ${stocks.length}개`);

    if (stocks.length === 0) {
      console.log('  ⚠️  config.stocks 비어있음, DB에서 직접 조회...');
      const stocksResult = await pool.query(
        'SELECT code, name FROM stocks WHERE enabled = true'
      );
      stocks = stocksResult.rows;
      console.log(`  ✅ DB stocks 테이블에서: ${stocks.length}개`);
      stocks.forEach(s => console.log(`     - ${s.code} (${s.name})`));
    }

    if (stocks.length === 0) {
      console.log('\n❌ 활성화된 종목이 없습니다!');
      return;
    }

    // 5. 각 종목의 거래 신호 확인
    console.log('\n[5] 거래 신호 확인...');
    for (const stock of stocks) {
      console.log(`\n  [${stock.code}] ${stock.name}`);

      // 72개 가격 데이터 조회
      const pricesResult = await pool.query(
        `SELECT close FROM price_snapshots
         WHERE code = $1 AND CAST(close as INTEGER) > 0
         ORDER BY created_at DESC
         LIMIT 72`,
        [stock.code]
      );

      if (pricesResult.rows.length < 72) {
        console.log(`    ⚠️  데이터 부족 (${pricesResult.rows.length}/72개)`);
        continue;
      }

      const prices = pricesResult.rows
        .reverse()
        .map((r) => parseFloat(r.close));

      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const current = prices[prices.length - 1];

      // 간단한 ADX 계산
      const range = max - min;
      const adx = range > 0 ? Math.min(100, (range / min) * 100 + 20) : 20;

      // 시장 체제 판단
      const market = adx > 25 ? (max === current ? 'UPTREND' : 'DOWNTREND') : 'SIDEWAYS';
      const risePercent = market === 'UPTREND' ? 1.0 : market === 'DOWNTREND' ? 0.5 : 0.8;

      const buyPrice = min * (1 + risePercent / 100);
      const shouldBuy = current >= buyPrice;

      console.log(`    저점: ${min.toFixed(0)}원`);
      console.log(`    현재: ${current.toFixed(0)}원`);
      console.log(`    고점: ${max.toFixed(0)}원`);
      console.log(`    시장: ${market} (ADX: ${adx.toFixed(0)})`);
      console.log(`    반등: ${risePercent}%`);
      console.log(`    매수기준: ${buyPrice.toFixed(0)}원`);
      console.log(`    신호: ${shouldBuy ? '✅ 매수!' : '❌ 대기'}`);
    }

    console.log('\n=== 테스트 완료 ===');

  } catch (err) {
    console.error('❌ 오류:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
})();
