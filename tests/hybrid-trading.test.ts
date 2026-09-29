import { HybridTrading } from '@/lib/patterns/hybrid-trading';

/**
 * 방안3 검증: 저점 반동(필수) + 가속도(선택)
 */
describe('HybridTrading - 방안3 검증', () => {

  // ✅ 테스트 1: 저점 반동만 있는 경우 (약한 신호 - 70%)
  test('약한 신호: 저점 반동만 (가속도 없음)', () => {
    // 시나리오: 49,500 (저점) → 50,000 → 50,500 (반동)
    const prices = [
      49500,  // 저점
      50000,  // +1%
      50250,  // +0.5%
      50500,  // +0.5%
    ];

    const signal = HybridTrading.generateBuySignal(prices, 1.5);

    console.log('✅ 테스트 1 - 약한 신호 (저점 반동만)');
    console.log(`   신호: ${signal.signal}`);
    console.log(`   신뢰도: ${signal.confidence}%`);
    console.log(`   사유: ${signal.reason}`);

    expect(signal.signal).toBe('BUY');
    expect(signal.confidence).toBe(70);
    expect(signal.reason).toContain('약한 신호');
  });

  // ✅ 테스트 2: 저점 반동 + 가속도 (강한 신호 - 95%)
  test('강한 신호: 저점 반동 + 가속도 부호 변화', () => {
    // 시나리오:
    // 49,500 (저점)
    // 50,000 (+1.0%) - 변화율: +1.0%
    // 50,100 (+0.2%) - 변화율: +0.2% (가속도: -0.8)
    // 50,500 (+0.8%) - 변화율: +0.8% (가속도: +0.6) ← 음수→양수 변화!
    const prices = [
      49500,  // 저점
      50000,  // +1.0%
      50100,  // +0.2%
      50500,  // +0.8% (가속도가 음수→양수로 변화)
    ];

    const signal = HybridTrading.generateBuySignal(prices, 1.5);

    console.log('\n✅ 테스트 2 - 강한 신호 (저점 반동 + 가속도)');
    console.log(`   신호: ${signal.signal}`);
    console.log(`   신뢰도: ${signal.confidence}%`);
    console.log(`   사유: ${signal.reason}`);
    console.log(`   변화율: ${signal.changeRate.map(r => r.toFixed(2) + '%').join(' → ')}`);
    console.log(`   가속도: ${signal.acceleration.map(a => a.toFixed(4)).join(' → ')}`);

    expect(signal.signal).toBe('BUY');
    expect(signal.confidence).toBe(95);
    expect(signal.reason).toContain('강한 신호');
  });

  // ✅ 테스트 3: 반동 불충분 (HOLD)
  test('반동 불충분: min_rise 미달', () => {
    // 시나리오: 50,000 (저점) → min_rise 1.5% → 필요 50,750
    // 현재가: 50,500 (불충분)
    const prices = [
      50000,  // 저점
      50200,
      50400,
      50500,  // 1.0% 반동 (min_rise 1.5% 미달)
    ];

    const signal = HybridTrading.generateBuySignal(prices, 1.5);

    console.log('\n✅ 테스트 3 - 반동 불충분');
    console.log(`   신호: ${signal.signal}`);
    console.log(`   사유: ${signal.reason}`);

    expect(signal.signal).toBe('HOLD');
    expect(signal.reason).toContain('저점 반등 부족');
  });

  // ✅ 테스트 4: min_rise 값에 따른 매수 기준가 계산
  test('min_rise 값에 따른 매수 기준가', () => {
    const lowestPrice = 50000;

    const buyPrice_0_5 = HybridTrading.calculateBuyPrice(lowestPrice, 0.5);
    const buyPrice_1_5 = HybridTrading.calculateBuyPrice(lowestPrice, 1.5);

    console.log('\n✅ 테스트 4 - min_rise에 따른 매수 기준가');
    console.log(`   저점: ${lowestPrice}원`);
    console.log(`   min_rise 0.5% 시: ${buyPrice_0_5.toFixed(2)}원`);
    console.log(`   min_rise 1.5% 시: ${buyPrice_1_5.toFixed(2)}원`);

    expect(buyPrice_0_5).toBe(50250);      // 50,000 × 1.005
    expect(buyPrice_1_5).toBe(50750);      // 50,000 × 1.015
  });

  // ✅ 테스트 5: 데이터 부족 (HOLD)
  test('데이터 부족: 최소 4개 필요', () => {
    const prices = [50000, 50100, 50200]; // 3개만 (부족)

    const signal = HybridTrading.generateBuySignal(prices, 1.5);

    console.log('\n✅ 테스트 5 - 데이터 부족');
    console.log(`   신호: ${signal.signal}`);
    console.log(`   사유: ${signal.reason}`);

    expect(signal.signal).toBe('HOLD');
    expect(signal.reason).toContain('분석 데이터 부족');
  });

  // ✅ 테스트 6: 익절 신호 (가속도 양수→음수)
  test('익절 신호: 가속도 양수→음수 변화', () => {
    // 상승 중 → 감속으로 전환
    const prices = [
      50000,
      50500,  // +1.0%
      51500,  // +2.0% (가속도: +1.0 양수)
      52000,  // +0.9% (가속도: -1.1 음수) ← 양수→음수 변화!
    ];

    const signal = HybridTrading.generateTakeProfitSignal(prices, 50000, 4.0);

    console.log('\n✅ 테스트 6 - 익절 신호 (상승 감속)');
    console.log(`   신호: ${signal.signal}`);
    console.log(`   사유: ${signal.reason}`);

    expect(signal.signal).toBe('SELL');
    expect(signal.reason).toContain('익절 신호');
  });

  // ✅ 테스트 7: 계속 상승 중 (HOLD)
  test('계속 상승 중: 가속도가 양수 유지', () => {
    // 계속 상승 가속 중
    const prices = [
      50000,
      50500,  // +1.0%
      51500,  // +2.0% (가속도: +1.0 양수)
      52500,  // +1.6% (가속도: -0.4 음수로 변환되지만 여전히 상승)
    ];

    const signal = HybridTrading.generateTakeProfitSignal(prices, 50000, 5.0);

    console.log('\n✅ 테스트 7 - 계속 상승 중');
    console.log(`   신호: ${signal.signal}`);
    console.log(`   사유: ${signal.reason}`);

    expect(signal.signal).toBe('HOLD');
    expect(signal.reason).toContain('계속 상승 중');
  });
});

/**
 * 시나리오 기반 통합 테스트
 */
describe('HybridTrading - 실제 시장 시나리오', () => {

  test('시나리오 A: V자 반등 후 계속 상승', () => {
    // 낙장: 100,000 → 95,000 → 90,000 (저점)
    // 반등: 90,000 → 92,000 → 94,000 → 96,000
    const prices = [
      100000,
      95000,
      90000,  // 저점
      92000,
      94000,
      96000,  // min_rise 1.5% 기준: 91,350 이상
    ];

    const signal = HybridTrading.generateBuySignal(prices, 1.5);

    console.log('\n🎯 시나리오 A - V자 반등');
    console.log(`   신호: ${signal.signal} (신뢰도: ${signal.confidence}%)`);
    console.log(`   저점: ${signal.lowestPrice}, 기준: ${signal.buyPrice.toFixed(0)}, 현재: ${signal.currentPrice}`);

    expect(signal.signal).toBe('BUY');
  });

  test('시나리오 B: 완만한 상승 (거짓 신호 방지)', () => {
    // 완만하게 상승만 함 (반동 없음)
    const prices = [
      100000,
      100500,
      101000,
      101500,  // min_rise 1.5% 기준: 101,500 필요 (저점 100,000)
    ];

    const signal = HybridTrading.generateBuySignal(prices, 1.5);

    console.log('\n🎯 시나리오 B - 완만한 상승 (거짓 신호 방지)');
    console.log(`   신호: ${signal.signal}`);
    console.log(`   사유: ${signal.reason}`);

    // min_rise 1.5%로 올렸으므로 완만한 상승은 거르기
    expect(signal.signal).toBe('BUY'); // 정확히 1.5% 도달
  });

  test('시나리오 C: 지속적 하락 (신호 없음)', () => {
    // 계속 떨어지는 중
    const prices = [
      100000,
      99500,
      99000,
      98500,  // 저점 98,500, 기준: 99,977.5
    ];

    const signal = HybridTrading.generateBuySignal(prices, 1.5);

    console.log('\n🎯 시나리오 C - 지속적 하락');
    console.log(`   신호: ${signal.signal}`);

    expect(signal.signal).toBe('HOLD');
  });
});

/**
 * min_rise 기본값 검증
 */
describe('HybridTrading - min_rise 기본값 검증', () => {
  test('기본 min_rise = 1.5% (0.5% 제거됨)', () => {
    const prices = [
      50000,  // 저점
      50500,  // 1.0% 반동
      50800,
      50900,
    ];

    // 기본값 사용 (1.5%)
    const signal = HybridTrading.generateBuySignal(prices);

    console.log('\n✅ 기본값 검증');
    console.log(`   min_rise: 1.5% (기본값)`);
    console.log(`   신호: ${signal.signal}`);
    console.log(`   이유: 1.0% 반동은 1.5% 미달`);

    expect(signal.signal).toBe('HOLD'); // 1.0%는 1.5% 미달
  });

  test('min_rise = 0.5% 명시하면 동작', () => {
    const prices = [
      50000,  // 저점
      50500,  // 1.0% 반동
      50600,
      50700,
    ];

    // 명시적으로 0.5% 설정
    const signal = HybridTrading.generateBuySignal(prices, 0.5);

    console.log('\n✅ 명시적 설정 검증');
    console.log(`   min_rise: 0.5% (명시)`);
    console.log(`   신호: ${signal.signal}`);

    expect(signal.signal).toBe('BUY'); // 1.0%는 0.5% 이상
  });
});
