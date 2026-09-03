import defaultConfig from '@/config/default.json';
import * as fs from 'fs';

interface Config {
  enabled: boolean;
  account: any;
  stocks: any[];
  buy: any;
  sell: any;
  telegram: any;
  logging: any;
}

const CONFIG_FILE = '/tmp/trading-config.json';

// 메모리 캐시 (프로세스 수명 동안 유지)
let configCache: Config | null = null;
let lastConfigSave = 0;

/**
 * 설정 저장소 (메모리 + /tmp 파일 저장)
 */
export class ConfigStore {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * 설정 로드 (캐시 > 파일 > 환경변수 > 기본값)
   */
  private loadConfig(): Config {
    try {
      // 1. 메모리 캐시 확인
      if (configCache) {
        console.log('✅ 캐시된 설정 로드');
        return configCache;
      }

      // 2. /tmp 파일에서 로드 시도
      if (fs.existsSync(CONFIG_FILE)) {
        try {
          const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
          const savedConfig = JSON.parse(data);
          console.log('✅ 저장된 설정 파일 로드됨');
          configCache = { ...defaultConfig, ...savedConfig } as Config;
          return configCache;
        } catch (e) {
          console.warn('파일 로드 실패, 기본값 사용');
        }
      }

      // 3. 기본값으로 시작
      let config = { ...defaultConfig } as Config;

      // 4. 환경변수에서 오버라이드
      if (process.env.TRADING_ENABLED !== undefined) {
        config.enabled = process.env.TRADING_ENABLED === 'true';
      }

      configCache = config;
      return config;
    } catch (error) {
      console.warn('설정 로드 실패, 기본값 사용:', error);
      return { ...defaultConfig } as Config;
    }
  }

  /**
   * 설정 저장 (/tmp 파일 + 메모리 캐시)
   */
  save(): void {
    try {
      // 너무 자주 저장하지 않기 (1초 단위)
      const now = Date.now();
      if (now - lastConfigSave < 1000) {
        return;
      }

      // 중요 필드만 저장
      const toSave = {
        enabled: this.config.enabled,
        buy: this.config.buy,
        sell: this.config.sell,
      };

      // 파일에 저장
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2), 'utf-8');

      // 메모리 캐시 업데이트
      configCache = this.config;
      lastConfigSave = now;

      console.log('✅ 설정 저장됨 (파일 + 캐시)');
    } catch (error) {
      console.error('설정 저장 실패:', error);
    }
  }

  /**
   * 전체 설정 조회
   */
  getAll(): Config {
    return this.config;
  }

  /**
   * 설정 업데이트
   */
  update(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
    this.save();
  }

  /**
   * 활성화 상태 조회
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 활성화 상태 변경
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.save();
  }

  /**
   * 종목 활성화 상태 변경
   */
  setStockEnabled(code: string, enabled: boolean): void {
    const stock = this.config.stocks.find((s) => s.code === code);
    if (stock) {
      stock.enabled = enabled;
      this.save();
    }
  }

  /**
   * 매수 일정 업데이트
   */
  updateBuySchedule(schedule: any[]): void {
    this.config.buy.schedule = schedule;
    this.save();
  }

  /**
   * 매도 조건 업데이트
   */
  updateSellConditions(conditions: any[]): void {
    this.config.sell.schedule.conditions = conditions;
    this.save();
  }

  /**
   * 텔레그램 설정 업데이트
   */
  updateTelegram(telegram: any): void {
    this.config.telegram = telegram;
    this.save();
  }

  /**
   * 활성화된 종목 조회
   */
  getEnabledStocks(): any[] {
    return this.config.stocks.filter((s) => s.enabled);
  }

  /**
   * 매수 스케줄 조회
   */
  getBuySchedule(): any[] {
    return this.config.buy.schedule || [];
  }

  /**
   * 매도 스케줄 조회
   */
  getSellSchedule(): any {
    return this.config.sell.schedule;
  }

  /**
   * US 시장 신호 설정 조회
   */
  getUSMarketSignal(): any {
    return this.config.buy.us_market_signal;
  }
}

// 싱글톤 인스턴스
export const configStore = new ConfigStore();
