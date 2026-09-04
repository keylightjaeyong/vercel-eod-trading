import axios, { AxiosInstance } from 'axios';
import { getConfigValue, setConfigValue } from '@/lib/database/supabase';

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
  holding_qty: number;
}

interface HoldingData {
  symbol: string;
  name: string;
  quantity: number;
  current_price: number;
  evaluating: number;
  profit_loss: number;
  profit_rate: number;
}

export class KISApi {
  private baseUrl: string;
  private appKey: string;
  private appSecret: string;
  private accountId: string = '';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private client: AxiosInstance;

  constructor() {
    this.baseUrl = process.env.KIS_BASE_URL || 'https://openapi.koreainvestment.com:9443';
    this.appKey = process.env.KIS_APPKEY || '';
    this.appSecret = process.env.KIS_SECRET || '';
    this.accountId = process.env.KIS_ACCOUNT || '';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 8000,
    });
  }

  /**
   * 런타임에 환경변수 업데이트 (지연 초기화)
   */
  updateEnv() {
    this.appKey = process.env.KIS_APPKEY || '';
    this.appSecret = process.env.KIS_SECRET || '';
    this.accountId = process.env.KIS_ACCOUNT || '';
    this.baseUrl = process.env.KIS_BASE_URL || 'https://openapi.koreainvestment.com:9443';

    if (!this.appKey || !this.appSecret) {
      console.warn(`⚠️ KIS 환경변수 부재: appKey=${!!this.appKey}, secret=${!!this.appSecret}`);
    }
  }

  /**
   * 계좌ID 설정
   */
  setAccountId(accountId: string) {
    this.accountId = accountId;
  }

  /**
   * 토큰 갱신
   */
  async getToken(): Promise<string> {
    const now = Date.now() / 1000;

    // 1단계: 로컬 메모리 캐시 확인
    if (this.accessToken && now < this.tokenExpiry - 60) {
      console.log('✅ 로컬 메모리 캐시 토큰 사용');
      return this.accessToken;
    }

    // 2단계: Supabase에서 유효한 캐시 토큰 확인
    try {
      const cachedToken = await getConfigValue('kis_token', '');
      const cachedExpiry = await getConfigValue('kis_token_expiry', '0');
      const expiryTime = parseInt(cachedExpiry, 10);

      if (cachedToken && expiryTime && now < expiryTime - 60) {
        console.log('✅ Supabase 캐시 토큰 사용 (유효함)');
        this.accessToken = cachedToken;
        this.tokenExpiry = expiryTime;
        return this.accessToken;
      }
    } catch (dbError) {
      console.warn('⚠️ Supabase 캐시 조회 실패:', dbError);
    }

    // 3단계: 새 토큰 요청
    console.log('📝 새 토큰 요청 (캐시 없거나 만료됨)');

    try {
      const response = await this.client.post<TokenResponse>('/oauth2/tokenP', {
        grant_type: 'client_credentials',
        appkey: this.appKey,
        appsecret: this.appSecret,
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + (response.data.expires_in || 3600);

      // Supabase에 저장 (다른 요청에서 재사용)
      try {
        await setConfigValue('kis_token', this.accessToken);
        await setConfigValue('kis_token_expiry', this.tokenExpiry.toString());
        console.log('💾 토큰을 Supabase에 저장 완료');
      } catch (dbError) {
        console.warn('⚠️ Supabase 저장 실패 (진행은 계속함):', dbError);
      }

      return this.accessToken;
    } catch (error: any) {
      const errorCode = error?.response?.data?.error_code;
      const errorMsg = error?.response?.data?.error_description || error?.message;
      console.error(`❌ 토큰 갱신 실패 (${errorCode}): ${errorMsg}`);

      throw new Error(`KIS API 인증 실패: ${errorMsg}`);
    }
  }

  /**
   * 요청 헤더 생성
   */
  private async getHeaders(trId: string): Promise<Record<string, string>> {
    const token = await this.getToken();

    const headers = {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${token}`,
      appkey: this.appKey,
      appsecret: this.appSecret,
      tr_id: trId,
    };

    return headers;
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
   * 공식 문서: 투자계좌자산현황조회 API (CTRP6548R)
   */
  async getAccount(): Promise<AccountData> {
    try {
      const headers = await this.getHeaders('CTRP6548R');

      const cano = this.accountId.split('-')[0];
      const acntPrdtCd = this.accountId.split('-')[1] || '01';

      console.log(`📝 KIS 요청: CANO=${cano}, ACNT=${acntPrdtCd}, AUTH=${headers.authorization ? 'YES' : 'NO'}, APPKEY=${headers.appkey ? 'YES' : 'NO'}`);

      const response = await this.client.get(
        '/uapi/domestic-stock/v1/trading/inquire-account-balance',
        {
          headers,
          params: {
            CANO: cano,
            ACNT_PRDT_CD: acntPrdtCd,
            INQR_DVSN_1: '',
            BSPR_BF_DT_APLY_YN: '',
          },
        }
      );

      console.log(`✅ KIS 응답: status=${response.status}, rt_cd=${response.data.rt_cd}, msg=${response.data.msg1}`);

      // 응답 상태 확인
      if (response.data.rt_cd !== '0') {
        throw new Error(`KIS API 에러: ${response.data.msg1}`);
      }

      const output2 = response.data.output2 || {};

      return {
        account_id: this.accountId,
        balance: parseInt(output2.dncl_amt || '0', 10), // 예수금액 (현금)
        evaluating: parseInt(output2.evlu_amt_smtl || '0', 10), // 평가금액합계
        profit_loss: parseInt(output2.evlu_pfls_amt_smtl || '0', 10), // 평가손익금액합계
        profit_rate:
          parseInt(output2.evlu_amt_smtl || '0', 10) > 0
            ? (parseInt(output2.evlu_pfls_amt_smtl || '0', 10) /
                parseInt(output2.evlu_amt_smtl || '0', 10)) *
              100
            : 0,
        holding_qty: parseInt(output2.hldg_qty || '0', 10), // 보유수량
      };
    } catch (error: any) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.msg1 || error?.response?.statusText || error?.message;
      console.error(`❌ KIS API 에러: status=${status}, msg=${msg}`);
      throw error;
    }
  }

  /**
   * 보유종목 조회
   * 공식 문서: 보유종목조회 API (TTTC8434R)
   * 엔드포인트: /domestic-stock/v1/trading/inquire-holdings
   */
  async getHoldings(): Promise<HoldingData[]> {
    try {
      const headers = await this.getHeaders('TTTC8434R');

      const cano = this.accountId.split('-')[0];
      const acntPrdtCd = this.accountId.split('-')[1] || '01';

      console.log(`📝 보유종목 조회: CANO=${cano}, ACNT=${acntPrdtCd}`);

      const response = await this.client.get(
        '/domestic-stock/v1/trading/inquire-holdings',
        {
          headers,
          params: {
            CANO: cano,
            ACNT_PRDT_CD: acntPrdtCd,
            INQR_DVSN_1: '1',
            INQR_DVSN_2: '0',
            CTX_AREA_FK100: '',
            CTX_AREA_NK100: '',
          },
        }
      );

      // HTML 리다이렉트 응답 확인 (권한 부족)
      if (typeof response.data === 'string' && response.data.includes('refresh')) {
        throw new Error('보유종목 조회 권한이 없습니다. KIS 개발자 포탈에서 권한을 활성화해주세요.');
      }

      // 응답 상태 확인
      if (response.data.rt_cd !== '0') {
        throw new Error(`보유종목 조회 실패: ${response.data.msg1}`);
      }

      const holdings: HoldingData[] = [];
      const output = response.data.output || [];

      for (const holding of output) {
        holdings.push({
          symbol: holding.pdno || '',
          name: holding.prdt_name || '',
          quantity: parseInt(holding.hldg_qty || '0', 10),
          current_price: parseInt(holding.stck_prpr || '0', 10),
          evaluating: parseInt(holding.evlu_amt || '0', 10),
          profit_loss: parseInt(holding.evlu_pfls_amt || '0', 10),
          profit_rate:
            parseInt(holding.evlu_amt || '0', 10) > 0
              ? (parseInt(holding.evlu_pfls_amt || '0', 10) /
                  parseInt(holding.evlu_amt || '0', 10)) *
                100
              : 0,
        });
      }

      console.log(`✅ 보유종목 조회 성공: ${holdings.length}개`);
      return holdings;
    } catch (error: any) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.msg1 || error?.message;
      console.error(`❌ 보유종목 조회 실패: status=${status}, msg=${msg}`);
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

// 싱글톤 인스턴스 (런타임에 환경변수 로드)
let _kisApi: KISApi | null = null;

export function getKisApi(): KISApi {
  if (!_kisApi) {
    _kisApi = new KISApi();
  }
  // 매번 환경변수 업데이트 (Vercel 지연 로드 대응)
  _kisApi.updateEnv();
  return _kisApi;
}
