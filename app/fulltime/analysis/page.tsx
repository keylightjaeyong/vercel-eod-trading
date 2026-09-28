'use client';

import { useState, useEffect } from 'react';

export default function AnalysisPage() {
  const [tradingEnabled, setTradingEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState('');

  // 거래 상태 조회
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/fulltime/toggle-trading', {
          method: 'GET',
        });
        const data = await res.json();
        if (data.success) {
          setTradingEnabled(data.trading_enabled);
        }
      } catch (err) {
        console.error('거래 상태 조회 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  // 거래 상태 토글
  const handleToggleTrading = async () => {
    const isConfirmed = window.confirm(
      tradingEnabled
        ? '정말 거래를 중단하시겠습니까? (손절매는 작동합니다)'
        : '거래를 재개하시겠습니까?'
    );

    if (!isConfirmed) return;

    setToggling(true);
    setMessage('');

    try {
      const res = await fetch('/api/fulltime/toggle-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !tradingEnabled,
          reason: tradingEnabled ? '사용자가 긴급 중단' : '사용자가 거래 재개',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTradingEnabled(data.trading_enabled);
        setMessage(data.message);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ ${data.error || '중단 실패. 다시 시도해주세요'}`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      console.error('거래 상태 변경 실패:', err);
      setMessage(`❌ ${err.message || '중단 실패. 다시 시도해주세요'}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">📊 거래 분석</h1>

        {/* 거래 상태 버튼 */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleTrading}
            disabled={loading || toggling}
            className={`px-6 py-3 rounded-lg font-bold text-white transition-all ${
              tradingEnabled
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-500'
                : 'bg-green-600 hover:bg-green-700 disabled:bg-green-500'
            } disabled:cursor-not-allowed`}
          >
            {loading ? '로딩 중...' : toggling ? '처리 중...' : tradingEnabled ? '🛑 거래 중단' : '▶ 거래 재개'}
          </button>
        </div>
      </div>

      {/* 알림 메시지 */}
      {message && (
        <div className="mb-4 p-4 bg-blue-900 border border-blue-500 rounded-lg text-center">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">현재 상태</h2>
          <p className="text-lg mb-2">
            {tradingEnabled ? '🟢 거래 활성화' : '🔴 거래 중단'}
          </p>
          <p className="text-lg mb-2">신뢰도: 0% (모든 V자 패턴 감지)</p>
          <p className="text-lg mb-2">손절매: 1% (손실 제한)</p>
          <p className="text-lg">
            {tradingEnabled ? '매수 신호 대기 중...' : '거래 중단 - 손절매만 작동'}
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">API 엔드포인트</h2>
          <ul className="space-y-2">
            <li>📈 <a href="/api/cron/trade" className="text-blue-400 hover:underline">매수 신호</a></li>
            <li>📉 <a href="/api/cron/sell" className="text-blue-400 hover:underline">매도 신호</a></li>
            <li>📊 <a href="/api/fulltime/backtest" className="text-blue-400 hover:underline">백테스트</a></li>
            <li>💰 <a href="/api/balance" className="text-blue-400 hover:underline">계좌 잔액</a></li>
          </ul>
        </div>
      </div>

      <div className="mt-8 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">✅ 배포 완료!</h2>
        <div className="space-y-2 text-lg">
          <p>✅ 신뢰도 필터: 0% 제거됨</p>
          <p>✅ 시간대: KST 변환 완료 (08:00-20:00)</p>
          <p>✅ 백테스트: 신뢰도 필터 제거</p>
          <p>✅ 실거래: 활성화 중</p>
          <p>⏳ V자 패턴 형성 대기 중...</p>
        </div>
      </div>
    </div>
  );
}
