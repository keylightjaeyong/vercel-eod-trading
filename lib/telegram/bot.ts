import axios from 'axios';

interface MessageOptions {
  parse_mode?: 'Markdown' | 'HTML';
  disable_notification?: boolean;
}

export class TelegramBot {
  private token: string;
  private chatId: string;
  private apiUrl: string;

  constructor() {
    this.token = process.env.TELEGRAM_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    this.apiUrl = `https://api.telegram.org/bot${this.token}`;
  }

  /**
   * 메시지 전송
   */
  async send(message: string, options?: MessageOptions): Promise<boolean> {
    if (!this.token || !this.chatId) {
      console.warn('Telegram 설정 없음');
      return false;
    }

    try {
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: options?.parse_mode || 'Markdown',
        disable_notification: options?.disable_notification || false,
      });

      return response.status === 200;
    } catch (error) {
      console.error('Telegram 메시지 전송 실패:', error);
      return false;
    }
  }

  /**
   * 매수 알림
   */
  async notifyBuy(stock: string, quantity: number, price: number, phase: number): Promise<boolean> {
    const message = `✅ *매수 완료*\n\n📊 종목: ${stock}\n📈 수량: ${quantity}주\n💰 가격: ${price.toLocaleString()}원\n🔢 단계: Phase ${phase}\n\n⏰ ${new Date().toLocaleString()}`;

    return this.send(message);
  }

  /**
   * 매도 알림
   */
  async notifySell(
    stock: string,
    quantity: number,
    price: number,
    profit: number,
    profitRate: number,
    reason: string
  ): Promise<boolean> {
    let emoji = '✅';
    if (reason === 'STOP_LOSS') emoji = '❌';
    if (reason === 'TIME_END') emoji = '⏰';

    const message = `${emoji} *매도 완료*\n\n📊 종목: ${stock}\n📈 수량: ${quantity}주\n💰 가격: ${price.toLocaleString()}원\n📊 수익: ${profit > 0 ? '+' : ''}${profit.toLocaleString()}원 (${profitRate > 0 ? '+' : ''}${profitRate.toFixed(2)}%)\n🏷️ 사유: ${reason}\n\n⏰ ${new Date().toLocaleString()}`;

    return this.send(message);
  }

  /**
   * 에러 알림
   */
  async notifyError(error: string, details?: string): Promise<boolean> {
    const message = `❌ *에러 발생*\n\n🚨 ${error}\n${details ? `\n📝 ${details}` : ''}\n\n⏰ ${new Date().toLocaleString()}`;

    return this.send(message, { disable_notification: false });
  }

  /**
   * 일일 리포트
   */
  async notifyDailyReport(
    totalProfit: number,
    totalRate: number,
    trades: number,
    positions: any[]
  ): Promise<boolean> {
    const positionText = positions
      .map((p) => `• ${p.stock}: ${p.quantity}주 @ ${p.avg_price}원 (+${p.profit_rate}%)`)
      .join('\n');

    const message = `📊 *일일 거래 리포트*\n\n💰 수익: ${totalProfit > 0 ? '+' : ''}${totalProfit.toLocaleString()}원\n📈 수익률: ${totalRate > 0 ? '+' : ''}${totalRate.toFixed(2)}%\n🔢 거래: ${trades}회\n\n📍 현재 포지션:\n${positionText || '없음'}\n\n⏰ ${new Date().toLocaleString()}`;

    return this.send(message);
  }

  /**
   * 정보성 메시지
   */
  async notifyInfo(title: string, message: string): Promise<boolean> {
    const text = `ℹ️ *${title}*\n\n${message}\n\n⏰ ${new Date().toLocaleString()}`;

    return this.send(text);
  }

  /**
   * 경고 알림
   */
  async notifyWarning(warning: string): Promise<boolean> {
    const message = `⚠️ *경고*\n\n${warning}\n\n⏰ ${new Date().toLocaleString()}`;

    return this.send(message, { disable_notification: false });
  }
}

// 싱글톤 인스턴스
export const telegramBot = new TelegramBot();
