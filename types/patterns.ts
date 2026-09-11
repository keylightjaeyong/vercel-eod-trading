/**
 * V자 저점 (무릎-어깨) 패턴 감지 타입 정의
 */

export interface InflectionPoint {
  index: number;
  type: 'valley' | 'peak';
  value?: number;
}

export interface DerivativeResult {
  derivative1: number[];
  derivative2: number[];
  inflectionPoints: InflectionPoint[];
}

export interface PatternResult {
  detected: boolean;
  knee: number; // 무릎 가격
  shoulder: number; // 어깨 가격
  kneeIndex?: number; // 무릎 인덱스
  shoulderIndex?: number; // 어깨 인덱스
  confidence: number; // 0-100
  dropPct?: number; // 낙폭율
  risePct?: number; // 상승율
}

export interface TradeSignal {
  signal: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
  reason: string;
  confidence: number;
  pattern?: PatternResult;
  targetPrice?: number;
  stopLossPrice?: number;
  holdTimeMinutes?: number;
}

export interface PatternConfig {
  min_drop_pct: number; // 최소 낙폭 (예: 2%)
  min_rise_pct: number; // 최소 상승폭 (예: 1%)
  search_window: number; // 어깨 탐색 범위 (봉)
  confidence_threshold: number; // 신뢰도 기준 (0-100)
  max_history_points: number; // 분석할 최근 가격 개수
  trailing_stop_loss_pct: number; // 동적 손절매 손실률 (20% = 0.2)
  stop_loss_multiplier: number; // 손절배수
}

export interface Position {
  code: string;
  name: string;
  quantity: number;
  entryPrice: number;
  entryTime: Date;
  highestPrice: number; // 진입 후 최고가
  pattern: string; // 진입 패턴 (knee-shoulder 등)
  confidence: number; // 진입 신뢰도
}

export interface TradeAnalysis {
  timestamp: Date;
  code: string;
  name: string;
  action: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  pattern: string;
  patternConfidence: number;
  reason: string;
  profitPct?: number;
  sellReason?: 'shoulder' | 'stop_loss' | 'time_limit';
}

export interface PriceSnapshot {
  timestamp: Date;
  code: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export interface KneeShoulderAnalysis {
  prices: number[];
  derivative1: number[];
  derivative2: number[];
  kneeIndex: number;
  kneePrice: number;
  kneeDrop: number;
  shoulderIndex: number;
  shoulderPrice: number;
  shoulderRise: number;
  confidence: number;
  isValid: boolean;
}
