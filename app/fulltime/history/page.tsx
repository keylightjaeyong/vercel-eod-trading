'use client';

import React, { useEffect, useState } from 'react';

interface Trade {
  stock_code: string;
  stock_name: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  profit_pct: number;
  profit_amount: number;
  entry_time: string;
  exit_time: string;
  reason: string;
  duration_min: number;
}

export default function HistoryPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCode, setFilterCode] = useState('');
  const [filterReason, setFilterReason] = useState('');

  // 거래 이력 조회
  useEffect(() => {
    fetchTrades();
  }, []);

  // 필터 적용
  useEffect(() => {
    let filtered = trades;

    if (filterCode) {
      filtered = filtered.filter((t) => t.stock_code.includes(filterCode));
    }

    if (filterReason) {
      filtered = filtered.filter((t) => t.reason === filterReason);
    }

    setFilteredTrades(filtered);
  }, [trades, filterCode, filterReason]);

  const fetchTrades = async () => {
    try {
      const response = await fetch('/api/fulltime/trades');
      if (!response.ok) throw new Error('거래 이력 조회 실패');
      const data = await response.json();
      setTrades(data.data.reverse()); // 최신 순서
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  // 통계 계산
  const stats = {
    total: filteredTrades.length,
    wins: filteredTrades.filter((t) => t.profit_pct > 0).length,
    losses: filteredTrades.filter((t) => t.profit_pct <= 0).length,
    totalProfit: filteredTrades.reduce((sum, t) => sum + t.profit_pct, 0),
    avgProfit: filteredTrades.length > 0
      ? (filteredTrades.reduce((sum, t) => sum + t.profit_pct, 0) / filteredTrades.length)
      : 0,
    winRate:
      filteredTrades.length > 0
        ? (filteredTrades.filter((t) => t.profit_pct > 0).length / filteredTrades.length) * 100
        : 0,
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">📈 거래 이력</h1>

      {/* 오류 메시지 */}
      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-8 text-red-200">
          ❌ {error}
        </div>
      )}

      {/* 필터 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">🔍 필터</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">종목 코드</label>
            <input
              type="text"
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value)}
              placeholder="예: 000660"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">종료 사유</label>
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
            >
              <option value="">모두</option>
              <option value="shoulder_pattern">어깨 발견</option>
              <option value="trailing_stop_loss">손절</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterCode('');
                setFilterReason('');
              }}
              className="w-full bg-gray-600 hover:bg-gray-700 rounded px-3 py-2 transition-colors"
            >
              🔄 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">총 거래</p>
          <p className="text-3xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">수익</p>
          <p className="text-2xl font-bold text-green-400">{stats.wins}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">손실</p>
          <p className="text-2xl font-bold text-red-400">{stats.losses}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">총 수익률</p>
          <p
            className={`text-2xl font-bold ${
              stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {stats.totalProfit >= 0 ? '+' : ''}
            {stats.totalProfit.toFixed(2)}%
          </p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">승률</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.winRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* 거래 목록 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin mb-4">🔄</div>
          <p>로딩 중...</p>
        </div>
      ) : filteredTrades.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
          {trades.length === 0 ? '거래 이력이 없습니다' : '필터에 맞는 거래가 없습니다'}
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">시간</th>
                <th className="px-6 py-3 text-left">종목</th>
                <th className="px-6 py-3 text-right">매수가</th>
                <th className="px-6 py-3 text-right">매도가</th>
                <th className="px-6 py-3 text-right">수량</th>
                <th className="px-6 py-3 text-right">수익률</th>
                <th className="px-6 py-3 text-right">수익액</th>
                <th className="px-6 py-3 text-center">사유</th>
                <th className="px-6 py-3 text-center">보유시간</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade, idx) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-900">
                  <td className="px-6 py-3 text-sm">
                    {new Date(trade.exit_time).toLocaleString('ko-KR', {
                      year: '2-digit',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-3">
                    <div>
                      <p className="font-semibold">{trade.stock_name}</p>
                      <p className="text-xs text-gray-400">{trade.stock_code}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right font-mono">
                    {trade.entry_price.toLocaleString()}원
                  </td>
                  <td className="px-6 py-3 text-right font-mono">
                    {trade.exit_price.toLocaleString()}원
                  </td>
                  <td className="px-6 py-3 text-right">{trade.quantity}주</td>
                  <td
                    className={`px-6 py-3 text-right font-semibold ${
                      trade.profit_pct > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {trade.profit_pct >= 0 ? '+' : ''}
                    {trade.profit_pct.toFixed(2)}%
                  </td>
                  <td
                    className={`px-6 py-3 text-right font-semibold ${
                      trade.profit_amount > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {trade.profit_amount >= 0 ? '+' : ''}
                    {trade.profit_amount.toLocaleString()}원
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        trade.reason === 'shoulder_pattern'
                          ? 'bg-blue-900 text-blue-200'
                          : 'bg-red-900 text-red-200'
                      }`}
                    >
                      {trade.reason === 'shoulder_pattern' ? '어깨' : '손절'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">{trade.duration_min}분</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 더 많은 정보 */}
      {filteredTrades.length > 0 && (
        <div className="mt-8 p-6 bg-gray-800 border border-gray-700 rounded-lg">
          <h3 className="font-semibold mb-4">📊 상세 분석</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-gray-900 rounded">
              <p className="text-sm text-gray-400">평균 수익률</p>
              <p
                className={`text-lg font-semibold ${
                  stats.avgProfit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {stats.avgProfit >= 0 ? '+' : ''}
                {stats.avgProfit.toFixed(2)}%
              </p>
            </div>
            <div className="p-3 bg-gray-900 rounded">
              <p className="text-sm text-gray-400">최대 수익</p>
              <p className="text-lg font-semibold text-green-400">
                {Math.max(...filteredTrades.map((t) => t.profit_pct)).toFixed(2)}%
              </p>
            </div>
            <div className="p-3 bg-gray-900 rounded">
              <p className="text-sm text-gray-400">최대 손실</p>
              <p className="text-lg font-semibold text-red-400">
                {Math.min(...filteredTrades.map((t) => t.profit_pct)).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
