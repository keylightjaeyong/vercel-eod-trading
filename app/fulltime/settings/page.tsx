'use client';

import React, { useEffect, useState } from 'react';

interface GlobalSettings {
  min_drop: number;
  min_rise: number;
  search_window: number;
  trailing_stop_loss_pct: number;
  search_candles_limit: number;
  test_mode: boolean;
  enabled: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 설정 조회
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

  // 설정 저장
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
      await fetchSettings();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  };

  // TEST_MODE 토글
  const handleToggleTestMode = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/fulltime/toggle', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('토글 실패');
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setSaving(false);
    }
  };

  // 거래 활성화/비활성화
  const handleToggleTrading = async () => {
    setSaving(true);
    try {
      const newEnabled = !settings?.enabled;
      console.log('📤 거래 토글 요청:', { newEnabled });

      const response = await fetch('/api/fulltime/trading/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });

      if (!response.ok) throw new Error('거래 제어 실패');
      const data = await response.json();
      console.log('✅ 거래 토글 응답:', data);

      // 즉시 설정 새로고침 (Heroku와 동기화)
      console.log('🔄 설정 새로고침 중...');
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
      await fetchSettings();
      console.log('✅ 설정 동기화 완료');

      setError(null);
    } catch (err) {
      console.error('❌ 거래 토글 실패:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      // 에러 발생 시에도 상태 새로고침
      await fetchSettings();
    } finally {
      setSaving(false);
    }
  };

  // 설정 변경
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

      {/* 오류 메시지 */}
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
            {/* 거래 활성화 상태 */}
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

            {/* 테스트 모드 */}
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

          {/* 주의 메시지 */}
          <div className="mt-4 p-3 bg-red-950 border border-red-700 rounded text-sm text-red-200">
            <p className="font-semibold mb-1">⚠️ 중요 안내:</p>
            <p>• 거래 중지: 현재 진행 중인 거래는 계속 진행되며, 새로운 거래만 중단됩니다</p>
            <p>• 재개: 버튼을 다시 클릭하면 거래가 다시 시작됩니다</p>
            <p>• 모드 전환: 거래 모드는 즉시 전환되지만, 활성화된 거래 루프에는 적용되지 않을 수 있습니다</p>
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

      {/* TEST_MODE 토글 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">🔄 거래 모드</h2>
            <p className="text-gray-400 text-sm">
              {settings.test_mode
                ? '현재 모의거래 모드입니다. 실제 거래가 실행되지 않습니다.'
                : '⚠️ 실거래 모드입니다. 실제 금액이 거래됩니다.'}
            </p>
          </div>
          <button
            onClick={handleToggleTestMode}
            disabled={saving}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              settings.test_mode
                ? 'bg-yellow-600 hover:bg-yellow-700'
                : 'bg-red-600 hover:bg-red-700'
            } disabled:bg-gray-600`}
          >
            {settings.test_mode ? '🟡 모의거래' : '🔴 실거래'}
          </button>
        </div>
      </div>

      {/* 신호 조건 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-6">📊 신호 조건</h2>

        <div className="grid grid-cols-2 gap-6">
          {/* 최소 낙폭 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              최소 낙폭 (무릎 조건)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.min_drop}
                onChange={(e) =>
                  handleSettingChange('min_drop', parseFloat(e.target.value))
                }
                className="flex-1"
              />
              <span className="text-white font-semibold w-12">{settings.min_drop.toFixed(1)}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              무릎으로 인정하는 최소 낙폭 (0%: 모든 V자)
            </p>
          </div>

          {/* 최소 상승폭 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              최소 상승폭 (어깨 조건)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
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
              어깨로 인정하는 최소 상승폭 (권장: 0.5%)
            </p>
          </div>

          {/* 탐색 범위 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              탐색 범위 (봉 수)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="20"
                step="1"
                value={settings.search_window}
                onChange={(e) =>
                  handleSettingChange('search_window', parseInt(e.target.value))
                }
                className="flex-1"
              />
              <span className="text-white font-semibold w-12">{settings.search_window}봉</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              신호 생성 시 탐색하는 범위 ({settings.search_window * 5}분)
            </p>
          </div>

          {/* 10봉 제한 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              10봉 제한 (봉 수)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="20"
                step="1"
                value={settings.search_candles_limit}
                onChange={(e) =>
                  handleSettingChange('search_candles_limit', parseInt(e.target.value))
                }
                className="flex-1"
              />
              <span className="text-white font-semibold w-12">{settings.search_candles_limit}봉</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              어깨 탐색 제한 ({settings.search_candles_limit * 5}분)
            </p>
          </div>
        </div>
      </div>

      {/* 손절 조건 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-6">✂️ 손절 조건</h2>

        <div className="grid grid-cols-1 gap-6">
          {/* 손절 배수 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              손절 배수 (최고가 기준)
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
              올라간 수익의 {(settings.trailing_stop_loss_pct * 100).toFixed(0)}%를 손실하면 손절
              (권장: 20%)
            </p>
            <div className="mt-3 p-3 bg-gray-900 rounded text-sm">
              <p>📌 예시:</p>
              <p className="text-gray-400">
                • 진입가: 10,000원 → 최고가: 10,500원 → 손절가:{' '}
                <span className="text-blue-400">
                  {(10500 - (500 * settings.trailing_stop_loss_pct)).toFixed(0)}원
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex gap-3">
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
      <div className="mt-8 p-6 bg-gray-800 border border-gray-700 rounded-lg">
        <h3 className="font-semibold mb-4">📋 현재 설정 요약</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-gray-900 rounded">
            <p className="text-xs text-gray-400">최소 낙폭</p>
            <p className="font-semibold text-blue-400">{settings.min_drop.toFixed(1)}%</p>
          </div>
          <div className="p-3 bg-gray-900 rounded">
            <p className="text-xs text-gray-400">최소 상승</p>
            <p className="font-semibold text-green-400">{settings.min_rise.toFixed(1)}%</p>
          </div>
          <div className="p-3 bg-gray-900 rounded">
            <p className="text-xs text-gray-400">탐색 범위</p>
            <p className="font-semibold text-purple-400">
              {settings.search_window}봉 ({settings.search_window * 5}분)
            </p>
          </div>
          <div className="p-3 bg-gray-900 rounded">
            <p className="text-xs text-gray-400">10봉 제한</p>
            <p className="font-semibold text-yellow-400">
              {settings.search_candles_limit}봉 ({settings.search_candles_limit * 5}분)
            </p>
          </div>
          <div className="p-3 bg-gray-900 rounded">
            <p className="text-xs text-gray-400">손절 배수</p>
            <p className="font-semibold text-red-400">
              {(settings.trailing_stop_loss_pct * 100).toFixed(0)}%
            </p>
          </div>
          <div className="p-3 bg-gray-900 rounded">
            <p className="text-xs text-gray-400">모드</p>
            <p
              className={`font-semibold ${
                settings.test_mode ? 'text-yellow-400' : 'text-red-400'
              }`}
            >
              {settings.test_mode ? '모의거래' : '실거래'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
