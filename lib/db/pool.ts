import { Pool } from 'pg';

/**
 * 🔌 Postgres 커넥션풀 싱글톤
 *
 * 문제점:
 * - 기존: 각 엔드포인트에서 new Pool() → 커넥션 누수
 * - 해결: 글로벌 풀 인스턴스 재사용 → 효율적인 커넥션 관리
 *
 * 성능:
 * - max: 10개 커넥션 (동시 요청 10개까지 처리)
 * - idleTimeoutMillis: 30초 (유휴 커넥션 자동 종료)
 * - connectTimeoutMillis: 5초 (연결 타임아웃)
 */

let poolInstance: Pool | null = null;

/**
 * Postgres 커넥션풀 획득 (싱글톤)
 * 첫 호출 시 풀 생성, 이후 재사용
 */
export function getPostgresPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,                    // 최대 10개 커넥션
      idleTimeoutMillis: 30000,   // 30초 유휴 타임아웃
      connectionTimeoutMillis: 5000, // 5초 연결 타임아웃
      statement_timeout: 30000,   // 30초 쿼리 타임아웃
    });

    // 에러 핸들링
    poolInstance.on('error', (err) => {
      console.error('❌ 커넥션풀 에러:', err);
    });

    console.log('✅ Postgres 커넥션풀 생성됨 (max=10, idleTimeout=30s)');
  }

  return poolInstance;
}

/**
 * 커넥션풀 종료 (Serverless 함수 정리용)
 * 필요한 경우만 호출 (보통 앱 종료 시)
 */
export async function closePostgresPool(): Promise<void> {
  if (poolInstance) {
    try {
      await poolInstance.end();
      console.log('✅ 커넥션풀 종료됨');
      poolInstance = null;
    } catch (err) {
      console.error('❌ 커넥션풀 종료 실패:', err);
    }
  }
}

/**
 * 커넥션풀 상태 확인 (디버깅용)
 */
export function getPoolStats(): { totalCount: number; idleCount: number } {
  if (!poolInstance) {
    return { totalCount: 0, idleCount: 0 };
  }

  return {
    totalCount: poolInstance.totalCount,
    idleCount: poolInstance.idleCount,
  };
}
