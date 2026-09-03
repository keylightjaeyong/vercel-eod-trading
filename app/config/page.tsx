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
  const [editMode, setEditMode] = useState<'buy' | 'sell' | null>(null);
  const [editBuy, setEditBuy] = useState<any[] | null>(null);
  const [editSell, setEditSell] = useState<any | null>(null);

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

    const newState = !config.enabled;
    setSaving(true);

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
        setConfig({ ...config, enabled: newState });
        setMessage(`거래가 ${newState ? '활성화' : '비활성화'}되었습니다`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('저장 실패');
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
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('저장 실패');
    }
  };

  const saveBuySchedule = async () => {
    if (!editBuy) return;

    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_buy_schedule',
          schedule: editBuy,
        }),
      });

      if (res.ok) {
        setConfig({
          ...config!,
          buy: { ...config!.buy, schedule: editBuy },
        });
        setEditMode(null);
        setMessage('매수 일정이 저장되었습니다');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const saveSellSchedule = async () => {
    if (!editSell) return;

    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_sell_conditions',
          conditions: editSell.conditions,
        }),
      });

      if (res.ok) {
        setConfig({
          ...config!,
          sell: { ...config!.sell, schedule: editSell },
        });
        setEditMode(null);
        setMessage('매도 조건이 저장되었습니다');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const addBuyPhase = () => {
    const newPhase = {
      phase: (editBuy?.length || 0) + 1,
      time: '09:00',
      ratio: 0.25,
      market: 'KOSPI',
      min_qty: 100,
    };
    setEditBuy([...(editBuy || []), newPhase]);
  };

  const removeBuyPhase = (idx: number) => {
    setEditBuy(editBuy?.filter((_, i) => i !== idx) || null);
  };

  const addSellCondition = () => {
    const newCondition = {
      type: 'take_profit',
      threshold: 5.0,
      action: 'sell_all',
    };
    setEditSell({
      ...editSell,
      conditions: [...(editSell?.conditions || []), newCondition],
    });
  };

  const removeSellCondition = (idx: number) => {
    setEditSell({
      ...editSell,
      conditions: editSell?.conditions.filter((_: any, i: number) => i !== idx) || [],
    });
  };

  if (loading) return <div className="text-center text-gray-400 p-8">설정 로드 중...</div>;

  if (!config) return <div className="text-center text-red-500 p-8">설정을 로드할 수 없습니다</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
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
              {config.enabled ? '🛑 비활성화' : '▶️ 활성화'}
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">🛒 매수 일정</h2>
            {editMode !== 'buy' && (
              <button
                onClick={() => {
                  setEditBuy(JSON.parse(JSON.stringify(config.buy.schedule)));
                  setEditMode('buy');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
              >
                ✏️ 편집
              </button>
            )}
          </div>

          {editMode === 'buy' && editBuy ? (
            <div className="space-y-4">
              {editBuy.map((item, idx) => (
                <div key={idx} className="bg-slate-700 p-4 rounded border border-slate-600">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="text-gray-400 text-sm">시간</label>
                      <input
                        type="time"
                        value={item.time}
                        onChange={(e) => {
                          const updated = [...editBuy];
                          updated[idx].time = e.target.value;
                          setEditBuy(updated);
                        }}
                        className="w-full bg-slate-600 text-white px-3 py-2 rounded mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">비율 (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={(item.ratio * 100).toFixed(0)}
                        onChange={(e) => {
                          const updated = [...editBuy];
                          updated[idx].ratio = parseFloat(e.target.value) / 100;
                          setEditBuy(updated);
                        }}
                        className="w-full bg-slate-600 text-white px-3 py-2 rounded mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">마켓</label>
                      <select
                        value={item.market}
                        onChange={(e) => {
                          const updated = [...editBuy];
                          updated[idx].market = e.target.value;
                          setEditBuy(updated);
                        }}
                        className="w-full bg-slate-600 text-white px-3 py-2 rounded mt-1"
                      >
                        <option value="KOSPI">KOSPI (일반)</option>
                        <option value="NXT">NXT (야간)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">최소 수량</label>
                      <input
                        type="number"
                        min="1"
                        value={item.min_qty}
                        onChange={(e) => {
                          const updated = [...editBuy];
                          updated[idx].min_qty = parseInt(e.target.value);
                          setEditBuy(updated);
                        }}
                        className="w-full bg-slate-600 text-white px-3 py-2 rounded mt-1"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeBuyPhase(idx)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-bold text-sm"
                  >
                    🗑️ 삭제
                  </button>
                </div>
              ))}
              <button
                onClick={addBuyPhase}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold"
              >
                ➕ 매수 일정 추가
              </button>
              <div className="flex gap-3">
                <button
                  onClick={saveBuySchedule}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold"
                >
                  💾 저장
                </button>
                <button
                  onClick={() => setEditMode(null)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-bold"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {config.buy.schedule?.map((s: any, idx: number) => (
                <div key={idx} className="bg-slate-700 p-4 rounded">
                  <div className="flex justify-between mb-2">
                    <span className="text-white font-bold">Phase {s.phase}</span>
                    <span className="text-gray-400">{s.time}</span>
                  </div>
                  <div className="text-gray-400 text-sm">
                    <p>📊 비율: {(s.ratio * 100).toFixed(0)}%</p>
                    <p>🏪 마켓: {s.market}</p>
                    <p>📦 최소수량: {s.min_qty}주</p>
                    {s.condition && <p>⚡ 조건: {s.condition}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 매도 조건 */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">📤 매도 조건</h2>
            {editMode !== 'sell' && (
              <button
                onClick={() => {
                  setEditSell(JSON.parse(JSON.stringify(config.sell.schedule)));
                  setEditMode('sell');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
              >
                ✏️ 편집
              </button>
            )}
          </div>

          {editMode === 'sell' && editSell ? (
            <div className="space-y-4">
              <div className="bg-slate-700 p-4 rounded">
                <label className="text-gray-400 text-sm">매도 시간대</label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <input
                    type="time"
                    value={editSell.start_time}
                    onChange={(e) =>
                      setEditSell({
                        ...editSell,
                        start_time: e.target.value,
                      })
                    }
                    className="bg-slate-600 text-white px-3 py-2 rounded"
                  />
                  <input
                    type="time"
                    value={editSell.end_time}
                    onChange={(e) =>
                      setEditSell({
                        ...editSell,
                        end_time: e.target.value,
                      })
                    }
                    className="bg-slate-600 text-white px-3 py-2 rounded"
                  />
                </div>
              </div>

              <div className="border-t border-slate-600 pt-4">
                <p className="text-white font-bold mb-3">매도 조건</p>
                {editSell.conditions?.map((cond: any, idx: number) => (
                  <div key={idx} className="bg-slate-700 p-4 rounded mb-3 border border-slate-600">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="text-gray-400 text-sm">유형</label>
                        <select
                          value={cond.type}
                          onChange={(e) => {
                            const updated = [...editSell.conditions];
                            updated[idx].type = e.target.value;
                            setEditSell({ ...editSell, conditions: updated });
                          }}
                          className="w-full bg-slate-600 text-white px-3 py-2 rounded mt-1"
                        >
                          <option value="take_profit">✅ 익절</option>
                          <option value="stop_loss">❌ 손절</option>
                          <option value="time_end">⏰ 강제청산</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">퍼센트 (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={cond.threshold}
                          onChange={(e) => {
                            const updated = [...editSell.conditions];
                            updated[idx].threshold = parseFloat(e.target.value);
                            setEditSell({ ...editSell, conditions: updated });
                          }}
                          className="w-full bg-slate-600 text-white px-3 py-2 rounded mt-1"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeSellCondition(idx)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-bold text-sm"
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                ))}
                <button
                  onClick={addSellCondition}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold"
                >
                  ➕ 조건 추가
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveSellSchedule}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold"
                >
                  💾 저장
                </button>
                <button
                  onClick={() => setEditMode(null)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-bold"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-700 p-4 rounded">
                <p className="text-white font-bold mb-2">⏰ 매도 시간대</p>
                <p className="text-gray-400">
                  {config.sell.schedule?.start_time} ~ {config.sell.schedule?.end_time}
                </p>
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
                  <p className="text-gray-400">{cond.threshold}%</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 텔레그램 설정 */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">📱 텔레그램 알림</h2>
          <div className="space-y-2 text-gray-400">
            <p>매수: {config.telegram?.notifications?.buy ? '✅' : '❌'}</p>
            <p>매도: {config.telegram?.notifications?.sell ? '✅' : '❌'}</p>
            <p>에러: {config.telegram?.notifications?.error ? '✅' : '❌'}</p>
            <p>일일 리포트: {config.telegram?.notifications?.daily_report ? '✅' : '❌'}</p>
            <p className="text-sm">리포트 시간: {config.telegram?.report_time}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
