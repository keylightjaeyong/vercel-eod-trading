/**
 * ADX (Average Directional Index) 지표 계산
 * 최근 14개 5분봉을 기반으로 ADX, +DI, -DI 계산
 */

interface PriceData {
  high: number;
  low: number;
  close: number;
}

/**
 * True Range 계산
 * TR = MAX(high - low, ABS(high - prev_close), ABS(low - prev_close))
 */
function calculateTrueRange(prices: number[], index: number): number {
  if (index === 0) {
    return prices[0];
  }

  const high = prices[index];
  const low = prices[index];
  const prevClose = prices[index - 1];

  const tr1 = high - low;
  const tr2 = Math.abs(high - prevClose);
  const tr3 = Math.abs(low - prevClose);

  return Math.max(tr1, tr2, tr3);
}

/**
 * +DM (Plus Directional Movement) 계산
 */
function calculatePlusDM(prices: number[], index: number): number {
  if (index === 0) {
    return 0;
  }

  const high = prices[index];
  const prevHigh = prices[index - 1];
  const upMove = high - prevHigh;

  return upMove > 0 ? upMove : 0;
}

/**
 * -DM (Minus Directional Movement) 계산
 */
function calculateMinusDM(prices: number[], index: number): number {
  if (index === 0) {
    return 0;
  }

  const low = prices[index];
  const prevLow = prices[index - 1];
  const downMove = prevLow - low;

  return downMove > 0 ? downMove : 0;
}

/**
 * ADX (Average Directional Index) 계산
 * 입력: 최근 14개 5분봉의 종가 배열
 * 출력: ADX 값 (0~100)
 */
export function calculateADX(prices: number[]): number {
  if (prices.length < 14) {
    return 0;
  }

  // 14개만 사용
  const recentPrices = prices.slice(-14);

  // TR, +DM, -DM 계산
  let sumTR = 0;
  let sumPlusDM = 0;
  let sumMinusDM = 0;

  for (let i = 0; i < recentPrices.length; i++) {
    // TR 계산 (단순화: high-low)
    const tr = i === 0
      ? recentPrices[i]
      : Math.max(
          recentPrices[i] - recentPrices[i - 1],
          Math.abs(recentPrices[i] - recentPrices[i - 1])
        );

    // +DM, -DM 계산
    const plusDM = calculatePlusDM(recentPrices, i);
    const minusDM = calculateMinusDM(recentPrices, i);

    sumTR += tr;
    sumPlusDM += plusDM;
    sumMinusDM += minusDM;
  }

  if (sumTR === 0) {
    return 0;
  }

  // +DI, -DI 계산
  const plusDI = (sumPlusDM / sumTR) * 100;
  const minusDI = (sumMinusDM / sumTR) * 100;

  // DX 계산
  const diSum = plusDI + minusDI;
  if (diSum === 0) {
    return 0;
  }

  const dx = Math.abs(plusDI - minusDI) / diSum * 100;

  // ADX는 단순화를 위해 DX로 반환 (실제 ADX는 14주기 평활 필요)
  // 더 정확한 계산을 위해서는 누적 평평이 필요하지만,
  // 현재 구현에서는 현재 DX 값을 ADX로 사용
  return Math.min(dx, 100);
}

/**
 * +DI (Plus Directional Indicator) 계산
 * 입력: 최근 14개 5분봉의 종가 배열
 * 출력: +DI 값 (%)
 */
export function calculatePlusDI(prices: number[]): number {
  if (prices.length < 14) {
    return 0;
  }

  const recentPrices = prices.slice(-14);

  let sumTR = 0;
  let sumPlusDM = 0;

  for (let i = 0; i < recentPrices.length; i++) {
    // TR 계산 (단순화)
    const tr = i === 0
      ? recentPrices[i]
      : Math.max(
          recentPrices[i] - recentPrices[i - 1],
          Math.abs(recentPrices[i] - recentPrices[i - 1])
        );

    // +DM 계산
    const plusDM = calculatePlusDM(recentPrices, i);

    sumTR += tr;
    sumPlusDM += plusDM;
  }

  if (sumTR === 0) {
    return 0;
  }

  return (sumPlusDM / sumTR) * 100;
}

/**
 * -DI (Minus Directional Indicator) 계산
 * 입력: 최근 14개 5분봉의 종가 배열
 * 출력: -DI 값 (%)
 */
export function calculateMinusDI(prices: number[]): number {
  if (prices.length < 14) {
    return 0;
  }

  const recentPrices = prices.slice(-14);

  let sumTR = 0;
  let sumMinusDM = 0;

  for (let i = 0; i < recentPrices.length; i++) {
    // TR 계산 (단순화)
    const tr = i === 0
      ? recentPrices[i]
      : Math.max(
          recentPrices[i] - recentPrices[i - 1],
          Math.abs(recentPrices[i] - recentPrices[i - 1])
        );

    // -DM 계산
    const minusDM = calculateMinusDM(recentPrices, i);

    sumTR += tr;
    sumMinusDM += minusDM;
  }

  if (sumTR === 0) {
    return 0;
  }

  return (sumMinusDM / sumTR) * 100;
}

/**
 * 간단한 테스트용 함수
 */
export function testADXCalculation(prices: number[]): {
  adx: number;
  plusDI: number;
  minusDI: number;
} {
  return {
    adx: calculateADX(prices),
    plusDI: calculatePlusDI(prices),
    minusDI: calculateMinusDI(prices)
  };
}
