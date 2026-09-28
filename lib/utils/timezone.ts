/**
 * 타임존 관련 유틸리티 함수
 * 모든 DB 쿼리에서 'Asia/Seoul' 타임존 사용
 */

/**
 * SQL NOW() 함수에 타임존 적용
 * @returns "NOW() AT TIME ZONE 'Asia/Seoul'"
 */
export function nowInSeoul(): string {
  return "NOW() AT TIME ZONE 'Asia/Seoul'";
}

/**
 * SQL 날짜 비교 쿼리 생성
 * @param column 비교할 컬럼명 (예: 'created_at')
 * @param days 일수
 * @returns "created_at AT TIME ZONE 'Asia/Seoul' < NOW() AT TIME ZONE 'Asia/Seoul' - INTERVAL '30 days'"
 */
export function getDateFilterSQL(column: string, days: number): string {
  return `${column} AT TIME ZONE 'Asia/Seoul' < NOW() AT TIME ZONE 'Asia/Seoul' - INTERVAL '${days} days'`;
}

/**
 * 현재 KST 시간과 분을 반환
 */
export function getKSTTimeInfo(): { hour: number; minute: number; date: Date } {
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  const kstMinute = now.getUTCMinutes();

  return {
    hour: kstHour,
    minute: kstMinute,
    date: new Date(now.getTime() + 9 * 60 * 60 * 1000), // UTC+9
  };
}
