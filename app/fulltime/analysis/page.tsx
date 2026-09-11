'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface AnalysisData {
  summary: {
    totalTrades: number;
    buyCount: number;
    sellCount: number;
    totalProfit: number;
    profitRate: number;
  };
  signalAccuracy: Array<{
    signal: string;
    count: number;
    accuracy: number;
  }>;
  dailyTrades: Array<{
    date: string;
    total: number;
    buy: number;
    sell: number;
  }>;
  stockTrades: Array<{
    code: string;
    name: string;
    totalTrades: number;
    buys: number;
    sells: number;
  }>;
  confidenceDistribution: Array<{
    confidence: number;
    count: number;
  }>;
  recentTrades: Array<{
    code: string;
    name: string;
    action: string;
    quantity: number;
    price: number;
    signal: string;
    confidence: number;
    timestamp: string;
  }>;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981'];

export default function AnalysisPage() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const res = await fetch('/api/fulltime/analysis-data');
        const result = await res.json();
        if (result.success) {
          setData(result);
        }
      } catch (err) {
        console.error('분석 데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
    const interval = setInterval(fetchAnalysis, 30000); // 30초마다 갱신

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-8 text-center">📊 분석 데이터 로드 중...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">❌ 분석 데이터 로드 실패</div>;
  }

  const { summary, signalAccuracy, dailyTrades, stockTrades, confidenceDistribution, recentTrades } = data;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">📊 거래 분석 대시보드</h1>

      {/* 요약 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-blue-900 p-6 rounded-lg">
          <div className="text-sm text-blue-300">총 거래</div>
          <div className="text-3xl font-bold">{summary.totalTrades}</div>
          <div className="text-xs text-blue-400 mt-1">매수: {summary.buyCount} | 매도: {summary.sellCount}</div>
        </div>

        <div className="bg-green-900 p-6 rounded-lg">
          <div className="text-sm text-green-300">총 수익</div>
          <div className="text-3xl font-bold text-green-400">₩{summary.totalProfit.toLocaleString()}</div>
        </div>

        <div className={`${summary.profitRate >= 0 ? 'bg-emerald-900' : 'bg-red-900'} p-6 rounded-lg`}>
          <div className="text-sm text-emerald-300">수익률</div>
          <div className={`text-3xl font-bold ${summary.profitRate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {summary.profitRate.toFixed(2)}%
          </div>
        </div>

        <div className="bg-purple-900 p-6 rounded-lg">
          <div className="text-sm text-purple-300">신호 정확도</div>
          <div className="text-3xl font-bold">
            {signalAccuracy.length > 0
              ? (signalAccuracy.reduce((acc, s) => acc + s.accuracy, 0) / signalAccuracy.length).toFixed(1)
              : 0}
            %
          </div>
        </div>

        <div className="bg-yellow-900 p-6 rounded-lg">
          <div className="text-sm text-yellow-300">평균 신뢰도</div>
          <div className="text-3xl font-bold">
            {confidenceDistribution.length > 0
              ? (confidenceDistribution.reduce((acc, c) => acc + c.confidence * c.count, 0) /
                  confidenceDistribution.reduce((acc, c) => acc + c.count, 0)).toFixed(0)
              : 0}
            %
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* 일별 거래량 */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">📈 일별 거래량</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyTrades.reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="date" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #666' }}
                formatter={(value) => value.toString()}
              />
              <Legend />
              <Bar dataKey="buy" fill="#3b82f6" name="매수" />
              <Bar dataKey="sell" fill="#ef4444" name="매도" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 신호별 정확도 */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">🎯 신호별 정확도</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={signalAccuracy}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="signal" stroke="#888" />
              <YAxis stroke="#888" label={{ value: '정확도 (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #666' }}
                formatter={(value) => `${(value as number).toFixed(1)}%`}
              />
              <Bar dataKey="accuracy" fill="#10b981" name="정확도" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 신뢰도 분포 */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">📊 신뢰도 분포</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={confidenceDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="confidence" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #666' }} />
              <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} name="신호 개수" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 종목별 거래량 */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">📍 종목별 거래량</h2>
          <div className="space-y-3">
            {stockTrades.map((stock) => (
              <div key={stock.code} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                <div>
                  <div className="font-semibold">{stock.name}</div>
                  <div className="text-sm text-gray-400">{stock.code}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{stock.totalTrades}</div>
                  <div className="text-sm text-gray-400">매수: {stock.buys} | 매도: {stock.sells}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 최근 거래 기록 */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">📋 최근 거래 기록 (50개)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-2 px-3">종목</th>
                <th className="text-left py-2 px-3">거래</th>
                <th className="text-right py-2 px-3">수량</th>
                <th className="text-right py-2 px-3">가격</th>
                <th className="text-left py-2 px-3">신호</th>
                <th className="text-right py-2 px-3">신뢰도</th>
                <th className="text-left py-2 px-3">시간</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade, idx) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700">
                  <td className="py-2 px-3">
                    <div className="font-semibold">{trade.name}</div>
                    <div className="text-gray-400">{trade.code}</div>
                  </td>
                  <td className={`py-2 px-3 font-bold ${trade.action === 'BUY' ? 'text-blue-400' : 'text-red-400'}`}>
                    {trade.action}
                  </td>
                  <td className="text-right py-2 px-3">{trade.quantity}</td>
                  <td className="text-right py-2 px-3">₩{trade.price.toLocaleString()}</td>
                  <td className="py-2 px-3 text-yellow-400">{trade.signal}</td>
                  <td className="text-right py-2 px-3">{trade.confidence}%</td>
                  <td className="py-2 px-3 text-gray-400">{new Date(trade.timestamp).toLocaleString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
