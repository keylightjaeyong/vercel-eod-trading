import * as fs from 'fs';
import * as path from 'path';
import defaultConfig from '@/config/default.json';

interface Config {
  enabled: boolean;
  account: any;
  stocks: any[];
  buy: any;
  sell: any;
  telegram: any;
  logging: any;
}

const CONFIG_PATH = process.env.DATABASE_PATH || '/tmp/eod-config.json';

/**
 * 설정 저장소
 */
export class ConfigStore {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * 설정 로드
   */
  private loadConfig(): Config {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('설정 파일 로드 실패, 기본값 사용:', error);
    }

    return { ...defaultConfig } as Config;
  }

  /**
   * 설정 저장
   */
  save(): void {
    try {
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
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
