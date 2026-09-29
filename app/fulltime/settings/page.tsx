'use client';

import React, { useEffect, useState } from 'react';

interface GlobalSettings {
  min_rise: number;
  stop_loss_pct: number;
  trailing_stop_loss_pct: number;
  test_mode: boolean;
  enabled: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    loadAccountId();
  }, []);

  const loadAccountId = () => {
    const stored = localStorage.getItem('kis_account_id');
    if (stored) {
      setAccountId(stored);
    }
  };

  const saveAccountId = () => {
    if (!accountId.trim()) {
      setError('계좌ID를 입력하세요');
      return;
    }
    try {
      localStorage.setItem('kis_account_id', accountId);
      document.cookie = `kis_account_id=${encodeURIComponent(accountId)}; path=/; max-age=31536000`;
      setError(null);
      alert('✅ 계좌ID가 저장되었습니다');
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/fulltime/config');
      if (!response.ok) throw new Error('설정 조회 실패');
      const data = await response.json();
      setSettings(data.data.global_settings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/fulltime/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global_settings: settings,
        }),
      });

      if (!response.ok) throw new Error('설정 저장 실패');
      alert('✅ 설정이 저장되었습니다');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTestMode = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const newSettings = {
        ...settings,
        test_mode: !settings.test_mode,
      };

      const response = await fetch('/api/fulltime/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global_settings: newSettings,
        }),
      });

      if (!response.ok) throw new Error('토글 실패');
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTrading = async () => {
    setSaving(true);
    try {
      const newEnabled = !settings?.enabled;

      const configToSave = {
        global_settings: {
          ...settings,
          enabled: newEnabled,
        },
        stocks: [],
      };

      const response = await fetch('/api/fulltime/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave),
      });

      if (!response.ok) throw new Error('거래 제어 실패');
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchSettings();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      await fetchSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = (key: keyof GlobalSettings, value: any) => {
    if (settings) {
      setSettings({
        ...settings,
        [key]: value,
      });
    }
  };

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

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-400">
          <p>❌ 설정을 불러올 수 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">⚙️ 파라미터 설정</h1>

      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-8 text-red-200">
          ❌ {error}
        </div>
      )}

      {/* 거래 제어 */}
      {settings && (
        <div className="bg-gradient-to-r from-red-900 to-red-800 border border-red-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">🛑 거래 제어</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-900 bg-opacity-50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">거래 상태</p>
              <p className={`text-3xl font-bold mb-3 ${settings.enabled ? 'text-green-400' : 'text-red-400'}`}>
                {settings.enabled ? '🟢 진행 중' : '🔴 중지됨'}
              </p>
              <button
                onClick={handleToggleTrading}
                disabled={saving}
                className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                  settings.enabled
                    ? 'bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white'
                    : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white'
                }`}
              >
                {saving ? '처리 중...' : (settings.enabled ? '🛑 거래 중지' : '▶️ 거래 시작')}
              </button>
            </div>

            <div className="bg-gray-900 bg-opacity-50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">거래 모드</p>
              <p className={`text-3xl font-bold mb-3 ${settings.test_mode ? 'text-yellow-400' : 'text-red-500'}`}>
                {settings.test_mode ? '📊 모의' : '💰 실제'}
              </p>
              <button
                onClick={handleToggleTestMode}
                disabled={saving}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 py-2 px-4 rounded-lg font-semibold transition-colors text-white"
              >
                {saving ? '처리 중...' : (settings.test_mode ? '실거래로 전환' : '모의거래로 전환')}
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 bg-red-950 border border-red-700 rounded text-sm text-red-200">
            <p className="font-semibold mb-1">⚠️ 중요 안내:</p>
            <p>• 🛑 거래 중지: <strong>매수 신호만 중단</strong> (손절매/동적손절매는 계속 작동)</p>
            <p>• ▶️ 거래 시작: 다시 매수 신호를 받기 시작합니다</p>
            <p>• 💰 모드 전환: 거래 모드(실제/모의)는 즉시 전환됩니다</p>
          </div>
        </div>
      )}

      {/* 계좌ID 설정 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">🏦 계좌 설정</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="예: 44291220-01"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
          />
          <button
            onClick={saveAccountId}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            💾 계좌 저장
          </button>
        </div>
        {accountId && (
          <p className="text-sm text-gray-400 mt-2">
            ✅ 저장된 계좌: <span className="text-blue-400 font-mono">{accountId}</span>
          </p>
        )}
      </div>

      {/* 하이브리드 알고리즘 설정 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-6">💡 하이브리드 알고리즘 설정</h2>
        <p className="text-gray-400 mb-6">저점 반등 + 가속도 부호변화 감지</p>

        <div className="grid grid-cols-1 gap-6">
          {/* 최소 반등폭 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              최소 반등폭 (저점 기준)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={settings.min_rise}
                onChange={(e) =>
                  handleSettingChange('min_rise', parseFloat(e.target.value))
                }
                className="flex-1"
              />
              <span className="text-white font-semibold w-12">{settings.min_rise.toFixed(1)}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              저점에서 이 정도 반등하면 매수 신호 조건 1 충족 (권장: 0.5%)
            </p>
            <div className="mt-3 p-3 bg-gray-900 rounded text-sm">
              <p>📌 예시:</p>
              <p className="text-gray-400">
                • 저점: 98.2원 → 구매기준: {(98.2 * (1 + settings.min_rise / 100)).toFixed(2)}원
              </p>
              <p className="text-gray-400">• 현재가 ≥ 구매기준 → 조건 1 충족 ✓</p>
            </div>
          </div>
        </div>
      </div>

      {/* 손절 조건 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-6">✂️ 손절 조건</h2>

        <div className="grid grid-cols-2 gap-6">
          {/* 손절매 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              손절매 (손실 제한)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={settings.stop_loss_pct}
                onChange={(e) =>
                  handleSettingChange('stop_loss_pct', parseFloat(e.target.value))
                }
                className="flex-1"
              />
              <span className="text-white font-semibold w-12">
                -{settings.stop_loss_pct.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              손실이 이 수준에 도달하면 자동 매도 (권장: 3%)
            </p>
            <div className="mt-3 p-3 bg-gray-900 rounded text-sm">
              <p>📌 예시:</p>
              <p className="text-gray-400">
                • 진입가: 10,000원 → 손절가: {(10000 * (1 - settings.stop_loss_pct / 100)).toFixed(0)}원 → 손절 실행
              </p>
            </div>
          </div>

          {/* 동적 손절매 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              동적 손절매 (수익 보호)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={settings.trailing_stop_loss_pct}
                onChange={(e) =>
                  handleSettingChange('trailing_stop_loss_pct', parseFloat(e.target.value))
                }
                className="flex-1"
              />
              <span className="text-white font-semibold w-16">
                {(settings.trailing_stop_loss_pct * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              올라간 수익의 {(settings.trailing_stop_loss_pct * 100).toFixed(0)}%를 손실하면 손절 (권장: 20%)
            </p>
            <div className="mt-3 p-3 bg-gray-900 rounded text-sm">
              <p>📌 예시:</p>
              <p className="text-gray-400">
                • 진입가: 10,000원 → 최고가: 10,500원 (수익 500원)
              </p>
              <p className="text-gray-400">
                • 손절가: {(10500 - (500 * settings.trailing_stop_loss_pct)).toFixed(0)}원 (수익의 {(settings.trailing_stop_loss_pct * 100).toFixed(0)}% 보호)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {saving ? '저장 중...' : '💾 설정 저장'}
        </button>
        <button
          onClick={fetchSettings}
          disabled={saving}
          className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          🔄 초기화
        </button>
      </div>

      {/* 현재 설정 요약 */}
      <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
        <h3 className="font-semibold mb-4">📋 현재 설정 요약</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-gray-900 rounded">
            <p className="text-xs text-gray-400">반등 조건</p>
            <p className="font-semibold text-green-400">{settings.min_rise.toFixed(1)}%</p>
          </div>
          <div className="p-3 bg-gray-900 rounded">
            <p className="text-xs text-gray-400">손절매</p>
            <p className="font-semibold text-red-400">
              -{settings.stop_loss_pct.toFixed(1)}%
            </p>
          </div>
          <div className="p-3 bg-gray-900 rounded">
            <p className="text-xs text-gray-400">동적 손절</p>
            <p className="font-semibold text-orange-400">
              -{(settings.trailing_stop_loss_pct * 100).toFixed(0)}%
            </p>
          </div>
          <div className="p-3 bg-gray-900 rounded col-span-3">
            <p className="text-xs text-gray-400">거래 모드</p>
            <p
              className={`font-semibold ${
                settings.test_mode ? 'text-yellow-400' : 'text-red-400'
              }`}
            >
              {settings.test_mode ? '📊 모의거래' : '💰 실거래'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
