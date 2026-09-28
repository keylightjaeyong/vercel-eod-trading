/**
 * 시간대별 거래소 자동 전환 유틸리티
 * KST 기준:
 * - 08:00-09:00: NXT (야시장)
 * - 09:00-15:30: KRX (정규장)
 * - 15:30-20:00: NXT (야시장)
 */

export function getExchangeCode(kstHour: number, kstMinute: number = 0): string {
  const totalMinutes = kstHour * 60 + kstMinute;
  const startNX1 = 8 * 60; // 08:00 = 480분
  const endNX1 = 9 * 60; // 09:00 = 540분
  const startKRX = 9 * 60; // 09:00 = 540분
  const endKRX = 15.5 * 60; // 15:30 = 930분
  const startNX2 = 15.5 * 60; // 15:30 = 930분
  const endNX2 = 20 * 60; // 20:00 = 1200분

  if (totalMinutes >= startNX1 && totalMinutes < endNX1) {
    return 'NXT';
  }
  if (totalMinutes >= startKRX && totalMinutes < endKRX) {
    return 'KRX';
  }
  if (totalMinutes >= startNX2 && totalMinutes < endNX2) {
    return 'NXT';
  }

  // 거래 시간 외에는 NXT 반환
  return 'NXT';
}

/**
 * 현재 KST 시간을 기반으로 거래소 코드 반환
 */
export function getCurrentExchangeCode(): string {
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  const kstMinute = now.getUTCMinutes();
  return getExchangeCode(kstHour, kstMinute);
}

/**
 * 거래 시간 여부 확인
 */
export function isTradingTime(kstHour: number): boolean {
  return kstHour >= 8 && kstHour < 20;
}
