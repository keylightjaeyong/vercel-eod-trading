/**
 * V자 저점(무릎) - 어깨 패턴 감지
 * 1차/2차 미분을 사용한 수학적 변곡점 포착
 */

import { PatternResult, TradeSignal, PatternConfig, KneeShoulderAnalysis } from '@/types/patterns';

export class KneeShoulderPattern {
  /**
   * 1️⃣ 1차 미분 계산 (가격 변화율)
   * 변화율 = (현재가 - 이전가) / 이전가 × 100
   */
  static calculateFirstDerivative(prices: number[]): number[] {
    if (prices.length < 2) return [];

    const derivative = [];
    for (let i = 1; i < prices.length; i++) {
      const changeRate = ((prices[i] - prices[i - 1]) / prices[i - 1]) * 100;
      derivative.push(changeRate);
    }
    return derivative;
  }

  /**
   * 2️⃣ 2차 미분 계산 (가속도)
   * 가속도 = 변화율[i] - 변화율[i-1]
   * 음수→양수: 하락 속도 감소 (저점 근처!)
   */
  static calculateSecondDerivative(derivative1: number[]): number[] {
    if (derivative1.length < 2) return [];

    const derivative2 = [];
    for (let i = 1; i < derivative1.length; i++) {
      const acceleration = derivative1[i] - derivative1[i - 1];
      derivative2.push(acceleration);
    }
    return derivative2;
  }

  /**
   * 3️⃣ 변곡점 감지 (부호 변화 지점)
   * 음수에서 양수로 변하는 지점 = V자 바닥 (무릎)
   */
  static findInflectionPoints(derivative2: number[]): Array<{
    index: number;
    type: 'valley' | 'peak';
  }> {
    const inflectionPoints: Array<{ index: number; type: 'valley' | 'peak' }> = [];

    for (let i = 1; i < derivative2.length; i++) {
      const prevSign = Math.sign(derivative2[i - 1]);
      const currSign = Math.sign(derivative2[i]);

      // 부호 변화 감지
      if (prevSign !== currSign && currSign !== 0 && prevSign !== 0) {
        // valley: 음수 → 양수 (저점)
        // peak: 양수 → 음수 (고점)
        const type = prevSign < 0 ? 'valley' : 'peak';
        inflectionPoints.push({ index: i, type });
      }
    }

    return inflectionPoints;
  }

  /**
   * 4️⃣ V자 저점(무릎) 감지
   * 최근 30개 가격에서 V자 바닥 찾기
   */
  static detectKneeShoulderPattern(
    prices: number[],
    window: number = 10
  ): PatternResult {
    const result: PatternResult = {
      detected: false,
      knee: 0,
      shoulder: 0,
      confidence: 0,
    };

    // 데이터 유효성 검사
    if (!prices || prices.length < window + 5) {
      console.warn('⚠️ 분석 데이터 부족');
      return result;
    }

    // 1차 미분 계산 (변화율)
    const derivative1 = this.calculateFirstDerivative(prices);
    if (derivative1.length < 2) return result;

    // 2차 미분 계산 (가속도)
    const derivative2 = this.calculateSecondDerivative(derivative1);
    if (derivative2.length < 2) return result;

    // 변곡점 감지
    const inflectionPoints = this.findInflectionPoints(derivative2);
    if (inflectionPoints.length < 2) {
      console.log('⚠️ 변곡점 부족');
      return result;
    }

    // 최근 valley(저점) 2개 찾기
    const valleys = inflectionPoints.filter(p => p.type === 'valley');
    if (valleys.length < 2) {
      console.log('⚠️ 저점 부족');
      return result;
    }

    // 가장 최근의 2개 저점
    const recentValleys = valleys.slice(-2);
    const kneeIndex = recentValleys[0].index + 1; // +1은 미분 오프셋 보정
    const shoulderIndex = recentValleys[1].index + 1;

    if (kneeIndex >= prices.length || shoulderIndex >= prices.length) {
      console.log('⚠️ 인덱스 범위 초과');
      return result;
    }

    const kneePrice = prices[kneeIndex];
    const shoulderPrice = prices[shoulderIndex];
    const currentPrice = prices[prices.length - 1];

    // 무릎-어깨 조건 검증
    const kneeDropPct =
      ((prices[kneeIndex - 1] - kneePrice) / prices[kneeIndex - 1]) * 100;
    const shoulderRisePct =
      ((shoulderPrice - kneePrice) / kneePrice) * 100;
    const currentRisePct =
      ((currentPrice - kneePrice) / kneePrice) * 100;

    // V자 형태 확인
    const isVShape = kneePrice < shoulderPrice && kneePrice < currentPrice;
    const enoughDrop = kneeDropPct > 0; // 낙폭 있음
    const enoughRise = currentRisePct > 0; // 현재 상승 중

    if (!isVShape || !enoughDrop || !enoughRise) {
      console.log(
        `⚠️ V자 조건 미충족: isVShape=${isVShape}, drop=${kneeDropPct.toFixed(2)}%, rise=${currentRisePct.toFixed(2)}%`
      );
      return result;
    }

    // 신뢰도 계산
    const confidence = Math.min(
      100,
      50 + Math.abs(kneeDropPct) * 5 + currentRisePct * 3
    );

    result.detected = true;
    result.knee = kneePrice;
    result.shoulder = shoulderPrice;
    result.kneeIndex = kneeIndex;
    result.shoulderIndex = shoulderIndex;
    result.dropPct = kneeDropPct;
    result.risePct = currentRisePct;
    result.confidence = Math.round(confidence);

    console.log(`✅ V자 패턴 감지:`);
    console.log(`   무릎(저점): ${kneePrice.toLocaleString()}원 (낙폭: ${kneeDropPct.toFixed(2)}%)`);
    console.log(`   어깨(반등): ${shoulderPrice.toLocaleString()}원`);
    console.log(`   현재가: ${currentPrice.toLocaleString()}원 (상승: ${currentRisePct.toFixed(2)}%)`);
    console.log(`   신뢰도: ${result.confidence}%`);

    return result;
  }

  /**
   * 5️⃣ 거래 신호 생성
   * 설정에서 가져온 파라미터로 매매 신호 판정
   */
  static generateTradingSignal(
    prices: number[],
    config: Partial<PatternConfig>
  ): TradeSignal {
    // 기본 설정값
    const defaultConfig: PatternConfig = {
      min_drop_pct: 0,
      min_rise_pct: 1.0,
      search_window: 10,
      confidence_threshold: 30,  // 🎯 신뢰도 필터: 30% 이상만 매수 (과도한 거래 신호 감소)
      max_history_points: 30,
      trailing_stop_loss_pct: 0.2,
      stop_loss_multiplier: 0.2,
    };

    const finalConfig = { ...defaultConfig, ...config };

    // V자 패턴 감지
    const pattern = this.detectKneeShoulderPattern(
      prices,
      finalConfig.max_history_points
    );

    if (!pattern.detected) {
      return {
        signal: 'HOLD',
        reason: '무릎-어깨 패턴 미감지',
        confidence: 0,
      };
    }

    // 신뢰도 확인
    if (pattern.confidence < finalConfig.confidence_threshold) {
      return {
        signal: 'WAIT',
        reason: `신뢰도 부족 (${pattern.confidence}% < ${finalConfig.confidence_threshold}%)`,
        confidence: pattern.confidence,
        pattern,
      };
    }

    // 낙폭 확인 (> 비교: 설정값보다 커야 함)
    if (!((pattern.dropPct || 0) > finalConfig.min_drop_pct)) {
      return {
        signal: 'WAIT',
        reason: `낙폭 부족 (${pattern.dropPct?.toFixed(2)}% <= ${finalConfig.min_drop_pct}%)`,
        confidence: pattern.confidence,
        pattern,
      };
    }

    // 현재가가 무릎 위에 있는지 확인
    const currentPrice = prices[prices.length - 1];
    const isAboveKnee = currentPrice > pattern.knee;

    if (!isAboveKnee) {
      return {
        signal: 'WAIT',
        reason: '현재가가 무릎 아래',
        confidence: pattern.confidence,
        pattern,
      };
    }

    // 📥 매수 신호!
    const profitTarget = pattern.knee * 1.02; // 2% 수익 목표
    const stopLoss = pattern.knee * 0.95; // 5% 손절매

    return {
      signal: 'BUY',
      reason: `무릎-어깨 패턴 감지 (신뢰도: ${pattern.confidence}%, 낙폭: ${pattern.dropPct?.toFixed(2)}%)`,
      confidence: pattern.confidence,
      pattern,
      targetPrice: profitTarget,
      stopLossPrice: stopLoss,
    };
  }

  /**
   * 어깨 패턴 감지 (매도 신호)
   * 무릎 이후 10봉(50분) 내에서 반등(어깨) 찾기
   */
  static detectShoulder(
    prices: number[],
    kneeIndex: number,
    kneePrice: number,
    searchWindow: number = 10
  ): number | null {
    if (kneeIndex + searchWindow >= prices.length) {
      return null;
    }

    let maxPrice = kneePrice;
    let maxIndex = kneeIndex;

    // 무릎 이후 searchWindow 범위 내에서 최고가 찾기
    for (let i = kneeIndex + 1; i <= Math.min(kneeIndex + searchWindow, prices.length - 1); i++) {
      if (prices[i] > maxPrice) {
        maxPrice = prices[i];
        maxIndex = i;
      }
    }

    // 반등이 감지되면 최고가 인덱스 반환
    if (maxIndex > kneeIndex) {
      const riseFromKnee = ((maxPrice - kneePrice) / kneePrice) * 100;
      if (riseFromKnee > 1.0) {
        // 1% 이상 상승
        console.log(`👉 어깨 감지: ${maxPrice.toLocaleString()}원 (상승: ${riseFromKnee.toFixed(2)}%)`);
        return maxIndex;
      }
    }

    return null;
  }

  /**
   * 동적 손절매 가격 계산
   * 최고가에서 -20% 손실 시 손절
   */
  static calculateDynamicStopLoss(
    entryPrice: number,
    highestPrice: number,
    lossPct: number = 0.2
  ): number {
    const stopLossPrice = highestPrice * (1 - lossPct);
    // 진입가보다 낮으면 진입가로 설정
    return Math.max(stopLossPrice, entryPrice);
  }
}
