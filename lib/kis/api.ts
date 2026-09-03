import axios, { AxiosInstance } from 'axios';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface PriceData {
  code: string;
  name: string;
  current: number;
  bid: number;
  ask: number;
  bid_qty: number;
  ask_qty: number;
}

interface AccountData {
  account_id: string;
  balance: number;
  evaluating: number;
  profit_loss: number;
  profit_rate: number;
}

export class KISApi {
  private baseUrl: string;
  private appKey: string;
  private appSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private client: AxiosInstance;

  constructor() {
    this.baseUrl = process.env.KIS_BASE_URL || 'https://openapi.koreainvestment.com:9443';
    this.appKey = process.env.KIS_APPKEY || '';
    this.appSecret = process.env.KIS_SECRET || '';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 8000,
    });
  }

  /**
   * 토큰 갱신
   */
  async getToken(): Promise<string> {
    const now = Date.now() / 1000;

    // 토큰이 유효하면 재사용
    if (this.accessToken && now < this.tokenExpiry - 60) {
      return this.accessToken;
    }

    try {
      const response = await this.client.post<TokenResponse>('/oauth2/tokenP', {
        grant_type: 'client_credentials',
        appkey: this.appKey,
        appsecret: this.appSecret,
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + (response.data.expires_in || 3600);

      return this.accessToken;
    } catch (error) {
      console.error('토큰 갱신 실패:', error);
      throw new Error('KIS API 인증 실패');
    }
  }

  /**
   * 요청 헤더 생성
   */
  private async getHeaders(trId: string): Promise<Record<string, string>> {
    const token = await this.getToken();

    return {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${token}`,
      appkey: this.appKey,
      appsecret: this.appSecret,
      tr_id: trId,
    };
  }

  /**
   * 현재가 조회
   */
  async getPrice(code: string, market: string = 'NX'): Promise<PriceData> {
    try {
      const headers = await this.getHeaders('FHKST01010100');

      const response = await this.client.get('/uapi/domestic-stock/v1/quotations/inquire-price', {
        headers,
        params: {
          FID_COND_MRKT_DIV_CODE: market,
          FID_INPUT_ISCD: code,
        },
      });

      const output = response.data.output || {};

      return {
        code,
        name: output.hts_kor_isnm || '',
        current: parseInt(output.stck_prpr || '0', 10),
        bid: parseInt(output.bidp1 || '0', 10),
        ask: parseInt(output.askp1 || '0', 10),
        bid_qty: parseInt(output.bidp_rsqn1 || '0', 10),
        ask_qty: parseInt(output.askp_rsqn1 || '0', 10),
      };
    } catch (error) {
      console.error(`가격 조회 실패 (${code}):`, error);
      throw error;
    }
  }

  /**
   * 계좌 정보 조회 (잔액, 평가액 등)
   */
  async getAccount(): Promise<AccountData> {
    try {
      const headers = await this.getHeaders('TTTC8434R');
      const accountId = process.env.KIS_ACCOUNT || '';

      const response = await this.client.get('/uapi/domestic-stock/v1/trading/inquire-account', {
        headers,
        params: {
          CANO: accountId.split('-')[0],
          ACNT_PRDT_CD: accountId.split('-')[1] || '01',
          INQR_DVSN_CD: '02',
          UNPR_DVSN_CD: '01',
          FUND_STTL_ICLD_YN_CD: 'N',
          FNCG_AMT_AUTO_RDPT_YN_CD: 'N',
          INQR_DVSN_CD2: '',
          REPORT_CD: '',
          CTX_AREA_FK100: '',
          CTX_AREA_NK100: '',
        },
      });

      const output = response.data.output1 || {};
      const accounts = response.data.output2 || [];
      const account = accounts[0] || {};

      return {
        account_id: accountId,
        balance: parseInt(account.dnca_tot_amt || '0', 10),
        evaluating: parseInt(account.evaluate_amt || '0', 10),
        profit_loss: parseInt(account.sell_buy_dsugt_chgs || '0', 10),
        profit_rate: parseFloat(account.tot_evlu_pfls_rt || '0'),
      };
    } catch (error) {
      console.error('계좌 정보 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 시장가 매수
   */
  async buy(code: string, quantity: number): Promise<any> {
    try {
      const headers = await this.getHeaders('TTTC0802U');
      const accountId = process.env.KIS_ACCOUNT || '';
      const [cano, acntPrdtCd] = accountId.split('-');

      const response = await this.client.post(
        '/uapi/domestic-stock/v1/trading/order-cash',
        {
          CANO: cano,
          ACNT_PRDT_CD: acntPrdtCd || '01',
          PDNO: code,
          ORD_DVSN_CD: '01', // 시장가
          ORD_QTY: quantity.toString(),
          ORD_UNPR: '0',
        },
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error(`매수 주문 실패 (${code}):`, error);
      throw error;
    }
  }

  /**
   * 시장가 매도
   */
  async sell(code: string, quantity: number): Promise<any> {
    try {
      const headers = await this.getHeaders('TTTC0801U');
      const accountId = process.env.KIS_ACCOUNT || '';
      const [cano, acntPrdtCd] = accountId.split('-');

      const response = await this.client.post(
        '/uapi/domestic-stock/v1/trading/order-cash',
        {
          CANO: cano,
          ACNT_PRDT_CD: acntPrdtCd || '01',
          PDNO: code,
          ORD_DVSN_CD: '01', // 시장가
          ORD_QTY: quantity.toString(),
          ORD_UNPR: '0',
          ORD_GBN_CD: '02', // 매도
        },
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error(`매도 주문 실패 (${code}):`, error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
export const kisApi = new KISApi();
