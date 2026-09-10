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
  const [actualBalance, setActualBalance] = useState<number | null>(null);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 할당 데이터 조회
  useEffect(() => {
    fetchAllocation();
    fetchActualBalance();
  }, []);

  const fetchActualBalance = async () => {
    try {
      const accountId = localStorage.getItem('kis_account_id') || '';
      const url = accountId
        ? `/api/account?account_id=${accountId}`
        : '/api/account';

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.balance) {
          setActualBalance(data.data.balance);
        }
      }
    } catch (err) {
      // 실제 잔고 조회 실패해도 계속 진행
      console.warn('실제 잔고 조회 실패:', err);
    }
  };

  const fetchAllocation = async () => {
    try {
      const accountId = localStorage.getItem('kis_account_id') || '';
      const url = accountId
        ? `/api/fulltime/allocation?account_id=${accountId}`
        : '/api/fulltime/allocation';

      console.log('🔍 Fetching allocation from:', url);
      const response = await fetch(url);
      if (!response.ok) throw new Error('할당 조회 실패');
      const data = await response.json();
      console.log('📡 Allocation response:', data);
      console.log('🏷️ Allocations:', data.data.allocations);

      setAllocation(data.data);
      setTotalCapital(data.data.total_capital);

      // 할당 비율 설정
      const allocs: Record<string, number> = {};
      Object.entries(data.data.allocations).forEach(([code, info]: [string, any]) => {
        console.log(`  ${code}: current_price=${info.current_price}, pct=${info.pct}`);
        allocs[code] = info.pct;
      });
      setAllocations(allocs);
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching allocation:', err);
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
        <h2 className="text-xl font-semibold mb-4">🏦 계좌 잔고 정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">실제 잔고 (원)</label>
            <div className={`rounded px-3 py-2 text-white font-mono text-lg font-semibold border ${
              actualBalance ? 'bg-green-900 border-green-700 text-green-300' : 'bg-gray-900 border-gray-700'
            }`}>
              {actualBalance ? actualBalance.toLocaleString() : totalCapital.toLocaleString()}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">포맷된 금액</label>
            <div className={`rounded px-3 py-2 text-white font-semibold border ${
              actualBalance ? 'bg-green-900 border-green-700 text-green-300' : 'bg-gray-900 border-gray-700'
            }`}>
              {actualBalance ? (actualBalance / 1000000).toFixed(2) : (totalCapital / 1000000).toFixed(1)}M원
            </div>
          </div>
        </div>
        {actualBalance && (
          <div className="mt-3 p-3 bg-green-900 border border-green-700 rounded text-green-300 text-sm">
            ✅ 계좌에서 실제 잔고를 조회했습니다. 이 잔고를 기반으로 구매 가능한 주수가 계산됩니다.
          </div>
        )}
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

            <div className="space-y-6">
              {Object.entries(allocation.allocations).map(([code, info]: [string, any]) => {
                // 실제 잔고가 있으면 그것을 기반으로, 없으면 설정된 자본금 기반으로 계산
                const capital = actualBalance || totalCapital;
                const amount = (capital * (allocations[code] || 0)) / 100;
                const possibleQty = info.current_price ? Math.floor(amount / info.current_price) : 0;

                // 전체 잔고로 구매 가능한 최대 주수
                const maxPossibleQty = info.current_price && actualBalance
                  ? Math.floor(actualBalance / info.current_price)
                  : possibleQty;

                return (
                  <div key={code} className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                    {/* 1행: 종목, 코드 */}
                    <div className="flex items-end justify-between mb-6">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">종목</p>
                        <p className="text-2xl font-bold">{info.name} ({code})</p>
                      </div>
                    </div>

                    {/* 2행: 할당 비율 입력과 할당 금액 */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div className="bg-blue-950 border border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-gray-400 mb-3">할당 비율</p>
                        <div className="flex items-baseline gap-3">
                          <input
                            type="number"
                            value={allocations[code] || 0}
                            onChange={(e) => handleAllocationChange(code, Number(e.target.value))}
                            min="0"
                            max="100"
                            step="1"
                            className="text-4xl font-bold bg-blue-900 border border-blue-700 rounded px-3 py-2 text-blue-300 w-24"
                          />
                          <span className="text-3xl text-blue-300">%</span>
                        </div>
                      </div>
                      <div className="bg-green-950 border border-green-800 rounded-lg p-4">
                        <p className="text-sm text-gray-400 mb-3">할당 금액</p>
                        <p className="text-4xl font-bold text-green-300">
                          {(amount / 1000000).toFixed(2)}M
                        </p>
                        <p className="text-sm text-green-400 mt-2">
                          ₩{amount.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* 3행: 현재가, 구매 가능 주수 (할당액 vs 최대) */}
                    {info.current_price && (
                      <div className="border-t border-gray-700 pt-6 space-y-3">
                        {/* 할당액 기반 */}
                        <div className="grid grid-cols-4 gap-4 bg-green-950 bg-opacity-30 rounded p-3">
                          <div>
                            <p className="text-sm text-gray-400">현재가</p>
                            <p className="font-semibold text-yellow-400">
                              {info.current_price.toLocaleString()}원
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">할당액 기반</p>
                            <p className="font-semibold text-green-400 text-xl">
                              {possibleQty}주
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">할당액</p>
                            <p className="font-semibold text-cyan-400">
                              {(amount / 1000000).toFixed(2)}M원
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">사용률</p>
                            <p className="font-semibold text-purple-400">
                              {possibleQty && info.current_price
                                ? ((info.current_price * possibleQty) / amount * 100).toFixed(1)
                                : '0'}%
                            </p>
                          </div>
                        </div>

                        {/* 최대 잔고 기반 */}
                        {actualBalance && maxPossibleQty > possibleQty && (
                          <div className="grid grid-cols-4 gap-4 bg-blue-950 bg-opacity-30 rounded p-3 border border-blue-700">
                            <div>
                              <p className="text-sm text-gray-400">최대 구매</p>
                              <p className="font-semibold text-blue-400">
                                전체 잔고 기반
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-400">최대 구매 가능</p>
                              <p className="font-semibold text-blue-300 text-xl">
                                {maxPossibleQty}주 💰
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-400">필요 금액</p>
                              <p className="font-semibold text-blue-300">
                                {(info.current_price * maxPossibleQty / 1000000).toFixed(2)}M원
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-400">남은 금액</p>
                              <p className="font-semibold text-blue-300">
                                {((actualBalance - (info.current_price * maxPossibleQty)) / 1000000).toFixed(3)}M원
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 진행 바 */}
                    <div className="mt-6 pt-4 border-t border-gray-700">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="bg-gray-800 rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all"
                              style={{
                                width: `${Math.min((allocations[code] || 0), 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-lg font-semibold text-blue-400 w-12">
                          {(allocations[code] || 0).toFixed(0)}%
                        </span>
                      </div>
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

    </div>
  );
}
