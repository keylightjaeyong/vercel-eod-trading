'use client';

import React, { useEffect, useState } from 'react';

interface AllocationData {
  total_capital: number;
  allocations: Record<
    string,
    {
      name: string;
      pct: number;
      amount: number;
      current_price?: number;
      possible_quantity?: number;
    }
  >;
}

export default function AllocationPage() {
  const [allocation, setAllocation] = useState<AllocationData | null>(null);
  const [totalCapital, setTotalCapital] = useState(10000000);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 할당 데이터 조회
  useEffect(() => {
    fetchAllocation();
  }, []);

  const fetchAllocation = async () => {
    try {
      const accountId = localStorage.getItem('kis_account_id') || '';
      const url = accountId
        ? `/api/fulltime/allocation?account_id=${accountId}`
        : '/api/fulltime/allocation';

      const response = await fetch(url);
      if (!response.ok) throw new Error('할당 조회 실패');
      const data = await response.json();
      setAllocation(data.data);
      setTotalCapital(data.data.total_capital);

      // 할당 비율 설정
      const allocs: Record<string, number> = {};
      Object.entries(data.data.allocations).forEach(([code, info]: [string, any]) => {
        allocs[code] = info.pct;
      });
      setAllocations(allocs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  // 할당 저장
  const handleSaveAllocation = async () => {
    setSaving(true);
    try {
      const accountId = localStorage.getItem('kis_account_id') || '';

      const response = await fetch('/api/fulltime/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_capital: totalCapital,
          allocations: allocations,
          account_id: accountId,
        }),
      });

      if (!response.ok) throw new Error('할당 저장 실패');
      await fetchAllocation();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  };

  // 할당 비율 변경
  const handleAllocationChange = (code: string, value: number) => {
    setAllocations((prev) => ({
      ...prev,
      [code]: value,
    }));
  };

  // 총 할당 비율 계산
  const totalAllocation = Object.values(allocations).reduce((sum, pct) => sum + pct, 0);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">💰 금액 할당</h1>

      {/* 오류 메시지 */}
      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-8 text-red-200">
          ❌ {error}
        </div>
      )}

      {/* 총 자본금 설정 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">🏦 총 자본금 설정 (계좌 자동 조회)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">자본금 (원)</label>
            <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-lg">
              {totalCapital.toLocaleString()}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">포맷된 금액</label>
            <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white">
              {(totalCapital / 1000000).toFixed(1)}M원
            </div>
          </div>
        </div>
      </div>

      {/* 종목별 할당 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin mb-4">🔄</div>
          <p>로딩 중...</p>
        </div>
      ) : allocation && Object.keys(allocation.allocations).length > 0 ? (
        <>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6">📊 종목별 할당</h2>

            <div className="space-y-4">
              {Object.entries(allocation.allocations).map(([code, info]: [string, any]) => {
                const amount = (totalCapital * (allocations[code] || 0)) / 100;
                return (
                  <div key={code} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    {/* 1행: 종목, 코드, 할당 비율, 할당 금액 */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-400">종목</p>
                        <p className="font-semibold">{info.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">코드</p>
                        <p className="font-mono">{code}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">할당 비율</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={allocations[code] || 0}
                            onChange={(e) => handleAllocationChange(code, Number(e.target.value))}
                            min="0"
                            max="100"
                            step="1"
                            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
                          />
                          <span>%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">할당 금액</p>
                        <p className="font-semibold text-blue-400">
                          {(amount / 1000000).toFixed(2)}M
                        </p>
                      </div>
                    </div>

                    {/* 2행: 현재가, 구매 가능 주수 */}
                    {info.current_price && (
                      <div className="grid grid-cols-4 gap-4 mb-3 border-t border-gray-700 pt-3">
                        <div>
                          <p className="text-sm text-gray-400">현재가</p>
                          <p className="font-semibold text-yellow-400">
                            {info.current_price.toLocaleString()}원
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">구매 가능</p>
                          <p className="font-semibold text-green-400">
                            {info.possible_quantity || 0}주
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">추정 비용</p>
                          <p className="font-semibold text-cyan-400">
                            {(amount / 1000000).toFixed(2)}M원
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">사용률</p>
                          <p className="font-semibold text-purple-400">
                            {info.current_price && info.possible_quantity
                              ? ((info.current_price * info.possible_quantity) / amount * 100).toFixed(1)
                              : '0'}%
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 진행 바 */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min((allocations[code] || 0) / 100 * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8">
                        {((allocations[code] || 0) / 100 * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 할당 비율 합계 */}
            <div className={`mt-6 p-4 rounded-lg border ${
              totalAllocation === 100
                ? 'bg-green-900 border-green-700 text-green-200'
                : 'bg-yellow-900 border-yellow-700 text-yellow-200'
            }`}>
              <p className="text-sm">
                📌 총 할당 비율: <span className="font-semibold">{totalAllocation}%</span>
                {totalAllocation === 100 && ' ✅ (완벽!)'}
                {totalAllocation !== 100 && ` (${100 - totalAllocation > 0 ? '+' : ''} ${100 - totalAllocation}%)`}
              </p>
            </div>
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSaveAllocation}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {saving ? '저장 중...' : '💾 저장'}
          </button>
        </>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
          할당할 종목이 없습니다. 종목 관리에서 종목을 추가하세요.
        </div>
      )}

      {/* 요약 */}
      {allocation && Object.keys(allocation.allocations).length > 0 && (
        <div className="mt-8 p-6 bg-gray-800 border border-gray-700 rounded-lg">
          <h3 className="font-semibold mb-4">📈 할당 요약</h3>
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(allocation.allocations).map(([code, info]: [string, any]) => {
              const amount = (totalCapital * (allocations[code] || 0)) / 100;
              return (
                <div key={code} className="p-4 bg-gray-900 rounded border border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm text-gray-400">{info.name} ({code})</p>
                      <p className="font-semibold text-lg">
                        {(amount / 1000000).toFixed(2)}M ({(allocations[code] || 0)}%)
                      </p>
                    </div>
                    {info.current_price && (
                      <div className="text-right">
                        <p className="text-sm text-gray-400">현재가</p>
                        <p className="font-semibold text-yellow-400">
                          {info.current_price.toLocaleString()}원
                        </p>
                      </div>
                    )}
                  </div>
                  {info.possible_quantity && (
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">구매 가능:</span>
                        <span className="font-semibold text-green-400 ml-1">{info.possible_quantity}주</span>
                      </div>
                      <div>
                        <span className="text-gray-400">예상 가격:</span>
                        <span className="font-semibold text-cyan-400 ml-1">
                          {(info.current_price * info.possible_quantity).toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
