'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Config {
  enabled: boolean;
  account: any;
  stocks: any[];
  buy: any;
  sell: any;
  telegram: any;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data.data);
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled',
          enabled: !config.enabled,
        }),
      });

      if (res.ok) {
        setConfig({ ...config, enabled: !config.enabled });
        setMessage(`거래가 ${!config.enabled ? '활성화' : '비활성화'}되었습니다`);
      }
    } catch (error) {
      setMessage('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStock = async (code: string, enabled: boolean) => {
    if (!config) return;

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_stock_enabled',
          code,
          enabled: !enabled,
        }),
      });

      if (res.ok) {
        const updated = config.stocks.map((s) =>
          s.code === code ? { ...s, enabled: !enabled } : s
        );
        setConfig({ ...config, stocks: updated });
        setMessage(`${code} 거래가 ${!enabled ? '활성화' : '비활성화'}되었습니다`);
      }
    } catch (error) {
      setMessage('저장 실패');
    }
  };

  if (loading) return <div className="text-center text-gray-400 p-8">설정 로드 중...</div>;

  if (!config) return <div className="text-center text-red-500 p-8">설정을 로드할 수 없습니다</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-500 mb-6 inline-block">
          ← 대시보드로 돌아가기
        </Link>

        <h1 className="text-3xl font-bold text-white mb-8">⚙️ 거래 설정</h1>

        {message && (
          <div className="bg-green-600 text-white p-4 rounded-lg mb-6">
            {message}
          </div>
        )}

        {/* 거래 활성화 */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">거래 활성화</h2>
              <p className="text-gray-400 text-sm mt-1">
                {config.enabled ? '✅ 활성화됨' : '❌ 비활성화됨'}
              </p>
            </div>
            <button
              onClick={handleToggleEnabled}
              disabled={saving}
              className={`px-6 py-2 rounded-lg font-bold text-white transition ${
                config.enabled
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {config.enabled ? '비활성화' : '활성화'}
            </button>
          </div>
        </div>

        {/* 종목 설정 */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">📊 거래 종목</h2>
          <div className="space-y-3">
            {config.stocks.map((stock) => (
              <div key={stock.code} className="flex justify-between items-center bg-slate-700 p-4 rounded">
                <div>
                  <p className="text-white font-bold">{stock.name} ({stock.code})</p>
                  <p className="text-gray-400 text-sm">
                    {stock.enabled ? '✅ 활성화' : '❌ 비활성화'}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleStock(stock.code, stock.enabled)}
                  className={`px-4 py-2 rounded font-bold text-white transition ${
                    stock.enabled
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {stock.enabled ? '비활성화' : '활성화'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 매수 일정 */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">🛒 매수 일정</h2>
          <div className="space-y-3">
            {config.buy.schedule?.map((s: any, idx: number) => (
              <div key={idx} className="bg-slate-700 p-4 rounded">
                <div className="flex justify-between mb-2">
                  <span className="text-white font-bold">Phase {s.phase}</span>
                  <span className="text-gray-400">{s.time}</span>
                </div>
                <div className="text-gray-400 text-sm">
                  <p>수량 비율: {(s.ratio * 100).toFixed(0)}%</p>
                  <p>마켓: {s.market}</p>
                  {s.condition && <p>조건: {s.condition}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 매도 조건 */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">📤 매도 조건</h2>
          <div className="space-y-3">
            <div className="bg-slate-700 p-4 rounded">
              <p className="text-white font-bold mb-2">⏰ 매도 시간</p>
              <p className="text-gray-400">{config.sell.schedule?.start_time} ~ {config.sell.schedule?.end_time}</p>
            </div>

            {config.sell.schedule?.conditions?.map((cond: any, idx: number) => (
              <div key={idx} className="bg-slate-700 p-4 rounded">
                <p className="text-white font-bold mb-2">
                  {cond.type === 'take_profit'
                    ? '✅ 익절'
                    : cond.type === 'stop_loss'
                      ? '❌ 손절'
                      : '⏰ 강제청산'}
                </p>
                <p className="text-gray-400">
                  {cond.threshold}% ({cond.action})
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 텔레그램 설정 */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">📱 텔레그램 알림</h2>
          <div className="space-y-2 text-gray-400">
            <p>
              매수: {config.telegram?.notifications?.buy ? '✅' : '❌'}
            </p>
            <p>
              매도: {config.telegram?.notifications?.sell ? '✅' : '❌'}
            </p>
            <p>
              에러: {config.telegram?.notifications?.error ? '✅' : '❌'}
            </p>
            <p>
              일일 리포트: {config.telegram?.notifications?.daily_report ? '✅' : '❌'}
            </p>
            <p className="text-sm">
              리포트 시간: {config.telegram?.report_time}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
