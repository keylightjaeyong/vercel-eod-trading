/**
 * 하이브리드 거래 알고리즘
 * 저점 반등 + 가속도 부호 변화 확인
 */

export interface HybridSignal {
  signal: 'BUY' | 'HOLD' | 'SELL';
  reason: string;
  confidence: number;
  lowestPrice: number;
  buyPrice: number;
  currentPrice: number;
  changeRate: number[];
  acceleration: number[];
}

export class HybridTrading {
  /**
   * 1️⃣ 최근 저점 찾기
   */
  static findLowestPrice(prices: number[]): number {
    return Math.min(...prices);
  }

  /**
   * 2️⃣ 매수 기준가 계산
   * buyPrice = lowestPrice × (1 + min_rise%)
   */
  static calculateBuyPrice(lowestPrice: number, minRisePct: number): number {
    return lowestPrice * (1 + minRisePct / 100);
  }

  /**
   * 3️⃣ 변화율 계산 (최근 3개 봉)
   * changeRate = (현재가 - 이전가) / 이전가 × 100
   */
  static calculateChangeRates(prices: number[]): number[] {
    const rates: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const rate = ((prices[i] - prices[i - 1]) / prices[i - 1]) * 100;
      rates.push(rate);
    }
    return rates;
  }

  /**
   * 4️⃣ 가속도 계산
   * acceleration = rate[i] - rate[i-1]
   * 양수: 상승 가속, 음수: 상승 감속
   */
  static calculateAcceleration(changeRates: number[]): number[] {
    const accel: number[] = [];
    for (let i = 1; i < changeRates.length; i++) {
      const a = changeRates[i] - changeRates[i - 1];
      accel.push(a);
    }
    return accel;
  }

  /**
   * 5️⃣ 가속도 부호 변화 확인
   * 이전 봉의 가속도가 음수 → 현재 봉의 가속도가 양수 = 반등 신호
   */
  static detectAccelerationChange(acceleration: number[]): boolean {
    if (acceleration.length < 2) return false;

    const prev = acceleration[acceleration.length - 2];
    const curr = acceleration[acceleration.length - 1];

    // 부호 변화: 음수 → 양수 또는 음수 → 0 이상
    const signChange = prev < 0 && curr >= 0;

    return signChange;
  }

  /**
   * 6️⃣ 익절 신호 확인 (부호 역변화)
   * 상승 중 → 감속으로 전환
   * 이전 가속도가 양수 → 현재 가속도가 음수
   */
  static detectTakeProfitSignal(acceleration: number[]): boolean {
    if (acceleration.length < 2) return false;

    const prev = acceleration[acceleration.length - 2];
    const curr = acceleration[acceleration.length - 1];

    // 부호 역변화: 양수 → 음수
    return prev > 0 && curr < 0;
  }

  /**
   * 🎯 메인: 매수 신호 생성
   * 조건 1: 저점 반등 (currentPrice ≥ buyPrice)
   * 조건 2: 가속도 부호 변화 (음수 → 양수)
   */
  static generateBuySignal(
    prices: number[],
    minRisePct: number = 0.5
  ): HybridSignal {
    // 데이터 유효성 검사
    if (prices.length < 4) {
      return {
        signal: 'HOLD',
        reason: '분석 데이터 부족 (최소 4개 필요)',
        confidence: 0,
        lowestPrice: 0,
        buyPrice: 0,
        currentPrice: prices[prices.length - 1],
        changeRate: [],
        acceleration: [],
      };
    }

    const currentPrice = prices[prices.length - 1];
    const lowestPrice = this.findLowestPrice(prices);
    const buyPrice = this.calculateBuyPrice(lowestPrice, minRisePct);

    // 조건 1: 저점 반등 확인
    const isRebounced = currentPrice >= buyPrice;
    if (!isRebounced) {
      return {
        signal: 'HOLD',
        reason: `저점 반등 부족 (${lowestPrice.toFixed(2)} → ${currentPrice.toFixed(2)}, 필요: ${buyPrice.toFixed(2)})`,
        confidence: 0,
        lowestPrice,
        buyPrice,
        currentPrice,
        changeRate: [],
        acceleration: [],
      };
    }

    // 변화율 계산 (최근 4개)
    const changeRates = this.calculateChangeRates(prices.slice(-4));
    const acceleration = this.calculateAcceleration(changeRates);

    // 조건 2: 가속도 부호 변화 확인
    const hasAccelChange = this.detectAccelerationChange(acceleration);

    if (!hasAccelChange) {
      return {
        signal: 'HOLD',
        reason: `가속도 부호 변화 없음 (반등 신호 대기)`,
        confidence: 30,
        lowestPrice,
        buyPrice,
        currentPrice,
        changeRate: changeRates,
        acceleration,
      };
    }

    // ✅ 두 조건 모두 만족 → 매수 신호!
    return {
      signal: 'BUY',
      reason: `매수 신호 (저점반등 ${minRisePct}% + 가속도 부호변화)`,
      confidence: 95,
      lowestPrice,
      buyPrice,
      currentPrice,
      changeRate: changeRates,
      acceleration,
    };
  }

  /**
   * 🎯 메인: 익절 신호 생성
   * 상승 중 → 감속으로 전환 (가속도 부호 역변화)
   */
  static generateTakeProfitSignal(
    prices: number[],
    entryPrice: number,
    currentProfit: number
  ): HybridSignal {
    if (prices.length < 4) {
      return {
        signal: 'HOLD',
        reason: '데이터 부족',
        confidence: 0,
        lowestPrice: 0,
        buyPrice: entryPrice,
        currentPrice: prices[prices.length - 1],
        changeRate: [],
        acceleration: [],
      };
    }

    const currentPrice = prices[prices.length - 1];
    const changeRates = this.calculateChangeRates(prices.slice(-4));
    const acceleration = this.calculateAcceleration(changeRates);

    // 익절 조건: 가속도가 양수에서 음수로 변화
    const shouldTakeProfit = this.detectTakeProfitSignal(acceleration);

    if (!shouldTakeProfit) {
      return {
        signal: 'HOLD',
        reason: `계속 상승 중 (수익률: ${currentProfit.toFixed(2)}%)`,
        confidence: 50,
        lowestPrice: 0,
        buyPrice: entryPrice,
        currentPrice,
        changeRate: changeRates,
        acceleration,
      };
    }

    return {
      signal: 'SELL',
      reason: `익절 신호 (상승 감속 감지, 수익: ${currentProfit.toFixed(2)}%)`,
      confidence: 90,
      lowestPrice: 0,
      buyPrice: entryPrice,
      currentPrice,
      changeRate: changeRates,
      acceleration,
    };
  }
}
