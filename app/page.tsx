'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Position {
  stock: string;
  quantity: number;
  entry_price: number;
  entry_amount: number;
  phase: number;
  entry_time: string;
}

interface Account {
  account_id: string;
  balance: number;
  evaluating: number;
  profit_loss: number;
  profit_rate: number;
  total_assets: number;
}

interface Exit {
  stock: string;
  quantity: number;
  exit_price: number;
  profit_loss: number;
  profit_rate: number;
  reason: string;
  exit_time: string;
}

export default function Dashboard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [exits, setExits] = useState<Exit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 초기값: true (서버가 API 응답으로 쿠키 값을 반영)
  const [tradingEnabled, setTradingEnabled] = useState(true);

  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetchData();
    fetchTradingState();
    const interval = setInterval(() => {
      fetchData();
      fetchTradingState();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleTrading = async () => {
    setToggling(true);
    const newState = !tradingEnabled;

    try {
      // API에 저장 (서버가 쿠키 설정)
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled',
          enabled: newState,
        }),
      });

      if (res.ok) {
        setTradingEnabled(newState);
      } else {
        setError('거래 상태 변경 실패');
      }
    } catch (err) {
      setError('거래 상태 변경 중 오류 발생');
    } finally {
      setToggling(false);
    }
  };

  const fetchTradingState = async () => {
    try {
      // API에서 서버 쿠키 값을 반영한 상태 조회
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setTradingEnabled(data.data?.enabled ?? true);
      }
    } catch (err) {
      console.error('거래 상태 조회 실패:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const accountRes = await fetch('/api/account');
      if (accountRes.ok) {
        const accountData = await accountRes.json();
        setAccount(accountData.data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const calculateAvgPrice = (): number => {
    if (positions.length === 0) return 0;
    const totalAmount = positions.reduce((sum, p) => sum + p.entry_amount, 0);
    const totalQty = positions.reduce((sum, p) => sum + p.quantity, 0);
    return totalQty > 0 ? totalAmount / totalQty : 0;
  };

  const calculateTodayProfit = (): { profit: number; rate: number } => {
    const totalProfit = exits.reduce((sum, e) => sum + e.profit_loss, 0);
    const totalRate = exits.length > 0 ? exits.reduce((sum, e) => sum + e.profit_rate, 0) / exits.length : 0;
    return { profit: totalProfit, rate: totalRate };
  };

  const avgPrice = calculateAvgPrice();
  const totalQty = positions.reduce((sum, p) => sum + p.quantity, 0);
  const totalAmount = positions.reduce((sum, p) => sum + p.entry_amount, 0);
  const { profit: todayProfit, rate: todayRate } = calculateTodayProfit();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-4xl font-bold text-white">📊 EOD Trading Dashboard</h1>
          <div className="flex gap-3">
            <Link href="/config" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
              ⚙️ 설정
            </Link>
            <button onClick={fetchData} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition">
              🔄 새로고침
            </button>
          </div>
        </div>

        {/* 거래 활성화/비활성화 토글 */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 border-2 border-slate-600 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-white font-bold text-lg">
                {tradingEnabled ? '🟢 자동 거래 활성화 중' : '🔴 자동 거래 중지됨'}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {tradingEnabled
                  ? '다음 거래 시간에 자동으로 매수/매도 실행됩니다'
                  : '수동으로 활성화할 때까지 자동 거래가 중지됩니다'}
              </p>
            </div>
            <button
              onClick={handleToggleTrading}
              disabled={toggling}
              className={`px-6 py-3 rounded-lg font-bold text-white transition text-lg whitespace-nowrap ml-4 ${
                tradingEnabled
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              } ${toggling ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {toggling ? '변경 중...' : tradingEnabled ? '🛑 중지' : '▶️ 시작'}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-500 text-white p-4 rounded-lg mb-6">{error}</div>}

        {/* 계좌정보 요약 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-900 to-blue-800 border-2 border-blue-600 rounded-lg p-6">
                <p className="text-blue-200 text-sm mb-1">💰 잔고</p>
                <p className="text-4xl font-bold text-white">{account ? (account.balance / 1_000_000).toFixed(2) : '-'}M</p>
                <p className="text-blue-300 text-xs mt-1">현금 보유액</p>
              </div>
              <div className="bg-gradient-to-br from-purple-900 to-purple-800 border-2 border-purple-600 rounded-lg p-6">
                <p className="text-purple-200 text-sm mb-1">📊 보유 주식수</p>
                <p className="text-4xl font-bold text-white">{totalQty > 0 ? totalQty.toLocaleString() : '0'}주</p>
                <p className="text-purple-300 text-xs mt-1">현재 포지션</p>
              </div>
            </div>

        {loading ? (
          <div className="text-center text-gray-400 mb-8"><p>📡 데이터 로딩 중...</p></div>
        ) : (
          <>
            {account && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <p className="text-gray-400 text-sm mb-2">💰 잔액</p>
                  <p className="text-2xl font-bold text-white">{(account.balance / 1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <p className="text-gray-400 text-sm mb-2">📈 평가금</p>
                  <p className="text-2xl font-bold text-white">{(account.evaluating / 1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <p className="text-gray-400 text-sm mb-2">🎯 총자산</p>
                  <p className="text-2xl font-bold text-white">{(account.total_assets / 1_000_000).toFixed(2)}M</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <p className="text-gray-400 text-sm mb-2">📊 수익률</p>
                  <p className={`text-2xl font-bold ${account.profit_rate > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {account.profit_rate > 0 ? '+' : ''}{account.profit_rate.toFixed(2)}%
                  </p>
                </div>
              </div>
            )}

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-white mb-4">📅 오늘의 수익</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-400 text-sm mb-2">수익금액</p>
                  <p className={`text-3xl font-bold ${todayProfit > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {todayProfit > 0 ? '+' : ''}{(todayProfit / 1000).toFixed(1)}K
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-2">수익률</p>
                  <p className={`text-3xl font-bold ${todayRate > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {todayRate > 0 ? '+' : ''}{todayRate.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">📍 현재 포지션</h2>
              {positions.length === 0 ? (
                <p className="text-gray-400">보유 포지션 없음</p>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">총 수량</p>
                    <p className="text-xl font-bold text-white">{totalQty}주</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">총 진입액</p>
                    <p className="text-xl font-bold text-white">{(totalAmount / 1_000_000).toFixed(2)}M</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">평단가</p>
                    <p className="text-xl font-bold text-white">{avgPrice.toLocaleString()}원</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
