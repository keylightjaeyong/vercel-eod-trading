'use client';

export default function AnalysisPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">📊 거래 분석</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">현재 상태</h2>
          <p className="text-lg mb-2">🟢 실거래 활성화</p>
          <p className="text-lg mb-2">신뢰도: 0% (모든 V자 패턴 감지)</p>
          <p className="text-lg mb-2">손절매: 1% (손실 제한)</p>
          <p className="text-lg">매수 신호 대기 중...</p>
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
