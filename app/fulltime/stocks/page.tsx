'use client';

import React, { useEffect, useState } from 'react';

interface Stock {
  code: string;
  name: string;
  enabled: boolean;
  allocation_pct: number;
}

export default function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStockCode, setNewStockCode] = useState('');
  const [newStockName, setNewStockName] = useState('');
  const [newStockAllocation, setNewStockAllocation] = useState(0);
  const [adding, setAdding] = useState(false);

  // 종목 조회
  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      const response = await fetch('/api/fulltime/stocks');
      if (!response.ok) throw new Error('종목 조회 실패');
      const data = await response.json();
      setStocks(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  // 종목 추가
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStockCode || !newStockName) {
      setError('코드와 이름을 입력하세요');
      return;
    }

    setAdding(true);
    try {
      const response = await fetch('/api/fulltime/stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newStockCode.toUpperCase(),
          name: newStockName,
          allocation_pct: newStockAllocation,
        }),
      });

      if (!response.ok) throw new Error('종목 추가 실패');
      await fetchStocks();
      setNewStockCode('');
      setNewStockName('');
      setNewStockAllocation(0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setAdding(false);
    }
  };

  // 종목 활성화 토글
  const handleToggleStock = async (code: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/fulltime/stocks/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });

      if (!response.ok) throw new Error('상태 변경 실패');
      await fetchStocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  };

  // 종목 삭제
  const handleDeleteStock = async (code: string) => {
    if (!confirm(`${code} 종목을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/fulltime/stocks/${code}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('종목 삭제 실패');
      await fetchStocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">🏷️ 종목 관리</h1>

      {/* 오류 메시지 */}
      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-8 text-red-200">
          ❌ {error}
        </div>
      )}

      {/* 종목 추가 폼 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">➕ 새 종목 추가</h2>
        <form onSubmit={handleAddStock} className="grid grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="종목 코드 (예: 000660)"
            value={newStockCode}
            onChange={(e) => setNewStockCode(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500"
          />
          <input
            type="text"
            placeholder="종목명 (예: SK하이닉스)"
            value={newStockName}
            onChange={(e) => setNewStockName(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500"
          />
          <input
            type="number"
            placeholder="할당 비율 (%)"
            value={newStockAllocation}
            onChange={(e) => setNewStockAllocation(Number(e.target.value))}
            min="0"
            max="100"
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded px-4 py-2 font-semibold transition-colors"
          >
            {adding ? '추가 중...' : '추가'}
          </button>
        </form>
      </div>

      {/* 종목 목록 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin mb-4">🔄</div>
          <p>로딩 중...</p>
        </div>
      ) : stocks.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
          종목이 없습니다. 위의 폼에서 종목을 추가하세요.
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">상태</th>
                <th className="px-6 py-3 text-left">종목 코드</th>
                <th className="px-6 py-3 text-left">종목명</th>
                <th className="px-6 py-3 text-left">할당 비율</th>
                <th className="px-6 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => (
                <tr key={stock.code} className="border-b border-gray-700 hover:bg-gray-900">
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleToggleStock(stock.code, stock.enabled)}
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        stock.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-600 text-gray-300'
                      }`}
                    >
                      {stock.enabled ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="px-6 py-3 font-mono">{stock.code}</td>
                  <td className="px-6 py-3">{stock.name}</td>
                  <td className="px-6 py-3">{stock.allocation_pct}%</td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleDeleteStock(stock.code)}
                      className="text-red-400 hover:text-red-300 font-semibold"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 요약 */}
      {stocks.length > 0 && (
        <div className="mt-8 p-6 bg-gray-800 border border-gray-700 rounded-lg">
          <h3 className="font-semibold mb-2">📊 요약</h3>
          <p className="text-gray-400">
            총 {stocks.length}개 종목 · 활성화된 종목:{' '}
            <span className="text-green-400 font-semibold">
              {stocks.filter((s) => s.enabled).length}개
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
