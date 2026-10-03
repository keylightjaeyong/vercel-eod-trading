/**
 * 시장 체제 판단
 * ADX, +DI, -DI를 기반으로 3가지 시장 상태 판단
 */

export type MarketRegime = 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';

/**
 * 시장 체제 판단
 * - UPTREND: ADX > 25 AND +DI > -DI
 * - DOWNTREND: ADX > 25 AND -DI > +DI
 * - SIDEWAYS: ADX < 25
 */
export function getMarketRegime(
  adx: number,
  plusDI: number,
  minusDI: number
): MarketRegime {
  if (adx > 25) {
    if (plusDI > minusDI) {
      return 'UPTREND';
    } else {
      return 'DOWNTREND';
    }
  } else {
    return 'SIDEWAYS';
  }
}

/**
 * 시장 체제별 반등 기준(%)
 * 저점 기준으로 얼마나 반등해야 매수 신호를 생성할지
 */
export function getRisePercent(regime: MarketRegime): number {
  switch (regime) {
    case 'UPTREND':
      return 1.0;  // 상승장: 1.0% 반등
    case 'DOWNTREND':
      return 0.5;  // 하락장: 0.5% 반등
    case 'SIDEWAYS':
      return 0.8;  // 횡보장: 0.8% 반등
    default:
      return 1.0;
  }
}

/**
 * 시장 체제별 손절매 기준(%)
 * 진입가 대비 얼마나 하락하면 손절매할지
 */
export function getStopLossPct(regime: MarketRegime): number {
  switch (regime) {
    case 'UPTREND':
      return -2.0;  // 상승장: -2.0% 손절
    case 'DOWNTREND':
      return -1.5;  // 하락장: -1.5% 손절
    case 'SIDEWAYS':
      return -1.5;  // 횡보장: -1.5% 손절
    default:
      return -2.0;
  }
}

/**
 * 시장 체제별 동적 추적 손절 기준(%)
 * 최고점 대비 얼마나 하락하면 손절매할지
 */
export function getTrailingStopPct(regime: MarketRegime): number {
  switch (regime) {
    case 'UPTREND':
      return -0.3;   // 상승장: -0.3% (덜 민감)
    case 'DOWNTREND':
      return -0.15;  // 하락장: -0.15% (더 민감, 빠른 이익)
    case 'SIDEWAYS':
      return -0.2;   // 횡보장: -0.2% (중간)
    default:
      return -0.3;
  }
}

/**
 * 시장 체제별 신뢰도(%)
 * 매수 신호의 신뢰도 점수
 */
export function getConfidence(regime: MarketRegime): number {
  switch (regime) {
    case 'UPTREND':
      return 70;  // 상승장: 70% 신뢰도
    case 'DOWNTREND':
      return 60;  // 하락장: 60% 신뢰도
    case 'SIDEWAYS':
      return 55;  // 횡보장: 55% 신뢰도
    default:
      return 50;
  }
}

/**
 * 시장 상태 한국어 설명
 */
export function getMarketRegimeKorean(regime: MarketRegime): string {
  switch (regime) {
    case 'UPTREND':
      return '상승장';
    case 'DOWNTREND':
      return '하락장';
    case 'SIDEWAYS':
      return '횡보장';
    default:
      return '알수없음';
  }
}

/**
 * 전체 정보 조회
 */
export function getRegimeConfig(regime: MarketRegime) {
  return {
    regime,
    korean: getMarketRegimeKorean(regime),
    risePercent: getRisePercent(regime),
    stopLossPct: getStopLossPct(regime),
    trailingStopPct: getTrailingStopPct(regime),
    confidence: getConfidence(regime)
  };
}
