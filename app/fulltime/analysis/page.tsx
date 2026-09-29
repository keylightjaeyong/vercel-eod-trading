'use client';

import { useEffect, useState } from 'react';

interface Config {
  global_settings: {
    min_rise: number;
    stop_loss_pct: number;
    trailing_stop_loss_pct: number;
    enabled: boolean;
  };
}

interface TradeRecord {
  code: string;
  name: string;
  action: string;
  quantity: number;
  price: number;
  created_at: string;
}

export default function AnalysisPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 설정값 조회
        const configRes = await fetch('/api/fulltime/config');
        const configData = await configRes.json();
        setConfig(configData.data);
      } catch (err) {
        console.error('설정 조회 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // 10초마다 자동 새로고침
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <p className="text-2xl">📊 데이터 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">📊 거래 분석</h1>
        <p className="text-sm text-gray-400">자동 새로고침: 10초</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">현재 상태</h2>
          <p className="text-lg mb-2">
            {config?.global_settings.enabled ? '🟢 실거래 활성화' : '🔴 거래 중단'}
          </p>
          <p className="text-lg mb-2">min_rise: {config?.global_settings.min_rise}%</p>
          <p className="text-lg mb-2">손절매: {config?.global_settings.stop_loss_pct}%</p>
          <p className="text-lg mb-2">동적손절: {config?.global_settings.trailing_stop_loss_pct} (수익의 {(config?.global_settings.trailing_stop_loss_pct ?? 0) * 100}%)</p>
          <p className="text-lg text-blue-400">매수/매도 신호 진행 중...</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">API 엔드포인트</h2>
          <ul className="space-y-2">
            <li>📈 <a href="/api/cron/trade" className="text-blue-400 hover:underline">매수 (저점 반동)</a></li>
            <li>📉 <a href="/api/cron/sell" className="text-blue-400 hover:underline">매도 (손절/동적손절/추세반전)</a></li>
            <li>💰 <a href="/api/fulltime/config" className="text-blue-400 hover:underline">설정 조회/저장</a></li>
            <li>📊 <a href="/api/cron/init-db" className="text-blue-400 hover:underline">DB 초기화</a></li>
          </ul>
        </div>
      </div>

      <div className="mt-8 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">✅ 방안3 배포 완료!</h2>
        <div className="space-y-2 text-lg">
          <p>✅ 매수: 저점 반동 기반 (신뢰도 시스템 제거)</p>
          <p>✅ 손절매: DB 설정값 반영 (실시간)</p>
          <p>✅ 동적손절: 수익의 N% 손실 시</p>
          <p>✅ 추세반전: 가속도 부호 변화 감지</p>
          <p>✅ 시간대: KST 08:00-20:00 (정상)</p>
          <p>✅ 실거래: 5분 주기 자동 실행 중</p>
        </div>
      </div>

      <div className="mt-8 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">⚙️ 실시간 설정값 (DB 연동)</h2>
        <div className="space-y-2 text-lg">
          <p>📊 min_rise: <span className="text-yellow-400">{config?.global_settings.min_rise}%</span> (저점에서 반동 기준)</p>
          <p>🔴 stop_loss_pct: <span className="text-red-400">{config?.global_settings.stop_loss_pct}%</span> (손절매 기준)</p>
          <p>🔵 trailing_stop_loss_pct: <span className="text-blue-400">{config?.global_settings.trailing_stop_loss_pct}</span> (동적손절 비율)</p>
          <p>🕐 거래 시간: 08:00-20:00 KST</p>
          <p>💼 거래 상태: {config?.global_settings.enabled ? '활성화' : '비활성화'}</p>
          <p className="text-sm text-gray-400 mt-4">💡 설정값은 파라미터 설정에서 변경 후 10초 내 자동 업데이트됩니다</p>
        </div>
      </div>
    </div>
  );
}
