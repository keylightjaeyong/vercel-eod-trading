'use client';

import React, { useEffect, useState } from 'react';

interface Status {
  timestamp: string;
  enabled: boolean;
  test_mode: boolean;
  total_capital: number;
  active_positions: number;
  stocks_enabled: number;
  daily_pnl: {
    date: string;
    trades: number;
    profit_pct: number;
    profit_amount: number;
    win_rate: number;
  };
  monthly_profit: number;
}

export default function FulltimeDashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/fulltime/status');
        if (!response.ok) throw new Error('상태 조회 실패');
        const data = await response.json();
        setStatus(data.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // 10초마다 갱신
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin mb-4">🔄</div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-400">
          <p>❌ {error}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p>데이터를 불러올 수 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🚀 풀타임 자동 거래</h1>
        <p className="text-gray-400">
          마지막 업데이트: {new Date(status.timestamp).toLocaleTimeString('ko-KR')}
        </p>
      </div>

      {/* 상태 배너 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* 시스템 상태 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">시스템 상태</h3>
            <span className={`text-2xl ${status.enabled ? '🟢' : '🔴'}`} />
          </div>
          <p className="text-gray-400 mb-2">
            {status.enabled ? '활성화됨' : '비활성화됨'}
          </p>
          <div className="bg-gray-900 rounded px-3 py-2">
            <p className="text-sm text-gray-400">모드</p>
            <p className={`font-semibold ${status.test_mode ? 'text-yellow-400' : 'text-red-400'}`}>
              {status.test_mode ? '모의거래 (TEST)' : '실거래'}
            </p>
          </div>
        </div>

        {/* 보유 포지션 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">보유 포지션</h3>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">활성 포지션</p>
              <p className="text-4xl font-bold text-blue-400">{status.active_positions}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">활성 종목</p>
              <p className="text-2xl font-bold text-green-400">{status.stocks_enabled}</p>
            </div>
          </div>
        </div>

        {/* 자본금 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">총 자본금</h3>
          <p className="text-4xl font-bold text-purple-400">
            {(status.total_capital / 1000000).toFixed(1)}M
          </p>
          <p className="text-gray-400 text-sm mt-2">
            {status.total_capital.toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 일일 손익 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">📊 일일 손익</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">거래 건수</span>
              <span className="font-semibold">{status.daily_pnl.trades}건</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">총 손익</span>
              <span
                className={`font-semibold text-lg ${
                  status.daily_pnl.profit_pct >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {status.daily_pnl.profit_pct >= 0 ? '+' : ''}
                {status.daily_pnl.profit_pct.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">금액</span>
              <span
                className={`font-semibold ${
                  status.daily_pnl.profit_amount >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {status.daily_pnl.profit_amount >= 0 ? '+' : ''}
                {status.daily_pnl.profit_amount.toLocaleString()}원
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">승률</span>
              <span className="font-semibold text-yellow-400">
                {status.daily_pnl.win_rate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">📈 월간 손익</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">누적 손익률</span>
              <span
                className={`font-semibold text-2xl ${
                  status.monthly_profit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {status.monthly_profit >= 0 ? '+' : ''}
                {status.monthly_profit.toFixed(2)}%
              </span>
            </div>
            <div className="mt-6 p-3 bg-gray-900 rounded">
              <p className="text-xs text-gray-400 mb-1">상태</p>
              <p className="text-sm">
                {status.monthly_profit > 0
                  ? '📈 양호 - 수익 중입니다'
                  : status.monthly_profit < 0
                  ? '📉 주의 - 손실 중입니다'
                  : '➡️ 보합 - 변화 없습니다'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 빠른 작업 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">⚡ 빠른 작업</h3>
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => window.location.href = '/fulltime/stocks'}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            🏷️ 종목 추가
          </button>
          <button
            onClick={() => window.location.href = '/fulltime/allocation'}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors"
          >
            💰 금액 설정
          </button>
          <button
            onClick={() => window.location.href = '/fulltime/settings'}
            className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"
          >
            ⚙️ 파라미터
          </button>
          <button
            onClick={() => window.location.href = '/fulltime/history'}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
          >
            📈 거래 이력
          </button>
        </div>
      </div>
    </div>
  );
}
