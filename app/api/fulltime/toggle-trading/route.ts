import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/db/pool';

/**
 * 거래 활성화/중단 토글 API
 * POST /api/fulltime/toggle-trading
 *
 * 요청 본문:
 * {
 *   "enabled": false,  // true: 거래 재개, false: 거래 중단
 *   "reason": "사용자가 긴급 중단"  // 선택사항
 * }
 *
 * 응답:
 * {
 *   "success": true,
 *   "trading_enabled": false,
 *   "message": "거래가 중단되었습니다",
 *   "stopped_at": "2024-09-28T10:30:00Z",
 *   "stopped_reason": "사용자가 긴급 중단"
 * }
 */

export async function POST(req: NextRequest) {
  const pool = getPostgresPool();

  try {
    // 테이블이 없으면 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trading_status (
        id SERIAL PRIMARY KEY,
        trading_enabled BOOLEAN DEFAULT true,
        stopped_at TIMESTAMP NULL,
        stopped_reason VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 초기 레코드가 없으면 생성
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM trading_status'
    );
    if (countResult.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO trading_status (trading_enabled, updated_at)
        VALUES (true, CURRENT_TIMESTAMP)
      `);
    }

    const body = await req.json();
    const { enabled = false, reason = '사용자 요청' } = body;

    // 거래 상태 업데이트
    const result = await pool.query(
      `
      UPDATE trading_status
      SET
        trading_enabled = $1,
        stopped_at = $2,
        stopped_reason = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      RETURNING *
      `,
      [
        enabled,
        enabled ? null : new Date().toISOString(),
        enabled ? null : reason,
      ]
    );

    if (result.rows.length === 0) {
      // 레코드가 없으면 생성
      const createResult = await pool.query(
        `
        INSERT INTO trading_status (trading_enabled, stopped_at, stopped_reason, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING *
        `,
        [
          enabled,
          enabled ? null : new Date().toISOString(),
          enabled ? null : reason,
        ]
      );

      const status = createResult.rows[0];
      const message = enabled
        ? '✅ 거래가 재개되었습니다'
        : '🛑 거래가 중단되었습니다';

      console.log(`${message} (사유: ${reason})`);

      return NextResponse.json({
        success: true,
        trading_enabled: status.trading_enabled,
        message,
        stopped_at: status.stopped_at,
        stopped_reason: status.stopped_reason,
      });
    }

    const status = result.rows[0];
    const message = enabled
      ? '✅ 거래가 재개되었습니다'
      : '🛑 거래가 중단되었습니다';

    console.log(`${message} (사유: ${reason})`);

    return NextResponse.json({
      success: true,
      trading_enabled: status.trading_enabled,
      message,
      stopped_at: status.stopped_at,
      stopped_reason: status.stopped_reason,
    });
  } catch (err: any) {
    console.error('❌ 거래 상태 변경 실패:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || '거래 상태 변경 실패'
      },
      { status: 500 }
    );
  }
}

/**
 * GET 요청: 현재 거래 상태 조회
 */
export async function GET(req: NextRequest) {
  const pool = getPostgresPool();

  try {
    // 테이블이 없으면 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trading_status (
        id SERIAL PRIMARY KEY,
        trading_enabled BOOLEAN DEFAULT true,
        stopped_at TIMESTAMP NULL,
        stopped_reason VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 초기 레코드가 없으면 생성
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM trading_status'
    );
    if (countResult.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO trading_status (trading_enabled, updated_at)
        VALUES (true, CURRENT_TIMESTAMP)
      `);
    }

    const result = await pool.query(
      'SELECT * FROM trading_status WHERE id = 1'
    );

    if (result.rows.length === 0) {
      // 기본값 반환
      return NextResponse.json({
        success: true,
        trading_enabled: true,
        stopped_at: null,
        stopped_reason: null,
      });
    }

    const status = result.rows[0];
    return NextResponse.json({
      success: true,
      trading_enabled: status.trading_enabled,
      stopped_at: status.stopped_at,
      stopped_reason: status.stopped_reason,
      updated_at: status.updated_at,
    });
  } catch (err: any) {
    console.error('❌ 거래 상태 조회 실패:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || '거래 상태 조회 실패'
      },
      { status: 500 }
    );
  }
}
