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

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

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
        <div className="flex justify-between items-center mb-8">
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

        {error && <div className="bg-red-500 text-white p-4 rounded-lg mb-6">{error}</div>}

        {loading ? (
          <div className="text-center text-gray-400"><p>📡 데이터 로딩 중...</p></div>
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
