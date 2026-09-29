'use client';

export default function AnalysisPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">📊 거래 분석</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">현재 상태</h2>
          <p className="text-lg mb-2">🟢 실거래 활성화 (진행 중)</p>
          <p className="text-lg mb-2">min_rise: 1.5% (저점 반동)</p>
          <p className="text-lg mb-2">손절매: -2.0% (손실 제한)</p>
          <p className="text-lg mb-2">동적손절: 0.2 (수익의 20%)</p>
          <p className="text-lg">매수/매도 신호 진행 중...</p>
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
          <p>✅ 매수: 저점 반동 1.5% (신뢰도 시스템 제거)</p>
          <p>✅ 손절매: -2.0% (손실 제한)</p>
          <p>✅ 동적손절: 수익의 20% 손실 시</p>
          <p>✅ 추세반전: 가속도 부호 변화 감지</p>
          <p>✅ 시간대: KST 08:00-20:00 (정상)</p>
          <p>✅ 실거래: 5분 주기 자동 실행 중</p>
        </div>
      </div>

      <div className="mt-8 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">⚙️ 설정값 (UI에서 변경 가능)</h2>
        <div className="space-y-2 text-lg">
          <p>📊 min_rise: 1.5% (저점에서 반동 기준)</p>
          <p>🔴 stop_loss_pct: -2.0% (손절매 기준)</p>
          <p>🔵 trailing_stop_loss_pct: 0.2 (동적손절 비율)</p>
          <p>🕐 거래 시간: 08:00-20:00 KST</p>
          <p>💼 거래 상태: 파라미터 설정에서 확인</p>
        </div>
      </div>
    </div>
  );
}
