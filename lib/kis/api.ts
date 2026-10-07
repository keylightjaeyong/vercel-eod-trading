import axios, { AxiosInstance } from 'axios';
import { getCurrentExchangeCode } from '@/lib/utils/exchange';

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

interface BalanceHolding {
  pdno: string;
  prdt_name: string;
  hldg_qty: number;
  pchs_avg_pric: number;
  prpr: number;
  evlu_amt: number;
  evlu_pfls_amt: number;
  evlu_pfls_rt: number;
}

interface BalanceData {
  account_id: string;
  holdings: BalanceHolding[];
  dnca_tot_amt: number;
  evlu_amt_smtl: number;
  evlu_pfls_amt_smtl: number;
  tot_asst_amt: number;
  estimated_order_amount?: number; // 추정된 주문 가능금액 (85%)
}

interface OrderableData {
  ord_psbl_cash: number; // 주문가능현금
  nrcvb_buy_amt: number; // 미수없는매수금액
  nrcvb_buy_qty: number; // 미수없는매수수량 ← 실제 매수 가능 수량
  max_buy_qty: number; // 최대매수수량
}

interface SellableData {
  ord_psbl_qty: number; // 주문가능수량 (매도 가능 수량)
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
   * 토큰 갱신 (유효기간: 1일)
   * @param forceRefresh - true이면 캐시 무시하고 강제 갱신
   */
  async getToken(forceRefresh: boolean = false): Promise<string> {
    const now = Date.now() / 1000;

    // 1단계: 로컬 메모리 캐시 확인
    if (!forceRefresh && this.accessToken && now < this.tokenExpiry - 60) {
      console.log('✅ 로컬 메모리 캐시 토큰 사용');
      return this.accessToken;
    }

    // 2단계: 데이터베이스 캐시 토큰 확인 (강제 갱신이 아닐 때만)
    if (!forceRefresh) {
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        });

        const result = await pool.query(
          `SELECT access_token, expires_at FROM kis_tokens WHERE id = 1`
        );
        await pool.end();

        if (result.rows.length > 0) {
          const { access_token, expires_at } = result.rows[0];
          if (expires_at > now + 60) {
            console.log('✅ DB 캐시 토큰 사용');
            this.accessToken = access_token;
            this.tokenExpiry = expires_at;
            return access_token;
          }
        }
      } catch (e) {
        console.log('⚠️ DB 토큰 캐시 조회 실패, 신규 발급으로 진행');
      }
    } else {
      console.log('🔄 강제 갱신 모드: 캐시 무시하고 새 토큰 요청');
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

      // DB에 토큰 저장
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        });

        await pool.query(
          `INSERT INTO kis_tokens (id, access_token, expires_at)
           VALUES (1, $1, $2)
           ON CONFLICT (id) DO UPDATE
           SET access_token = $1, expires_at = $2`,
          [this.accessToken, Math.floor(this.tokenExpiry)]
        );
        await pool.end();

        console.log(`💾 토큰 DB 저장: ${new Date(this.tokenExpiry * 1000).toISOString()}`);
      } catch (e) {
        console.log('⚠️ 토큰 DB 저장 실패 (계속 진행):', e);
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
  private async getHeaders(trId: string, forceRefresh: boolean = false): Promise<Record<string, string>> {
    const token = await this.getToken(forceRefresh);

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
   * 인증 실패 감지 헬퍼
   */
  private isAuthError(err: any): boolean {
    const status = err?.response?.status;
    const errorMsg = err?.response?.data?.msg1 || err?.message || '';

    return (
      status === 401 ||
      status === 403 ||
      errorMsg.includes('인증') ||
      errorMsg.includes('토큰') ||
      errorMsg.includes('token') ||
      errorMsg.includes('unauthorized') ||
      errorMsg.includes('만료')
    );
  }

  /**
   * 인증 실패 시 토큰 갱신 및 재시도 헬퍼
   */
  private async retryWithTokenRefresh<T>(
    operation: (forceRefresh?: boolean) => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation(false);
    } catch (err: any) {
      if (this.isAuthError(err)) {
        console.warn(`🔐 ${operationName} - 인증 실패 감지 - 토큰 강제 갱신 및 재시도`);
        try {
          return await operation(true);
        } catch (retryErr: any) {
          console.error(`❌ ${operationName} - 토큰 갱신 후에도 실패: ${retryErr.message}`);
          throw retryErr;
        }
      }
      throw err;
    }
  }

  /**
   * 현재가 조회
   */
  async getPrice(code: string, market: string = 'NX'): Promise<PriceData> {
    return this.retryWithTokenRefresh(
      async (forceRefresh?: boolean) => {
        const headers = await this.getHeaders('FHKST01010100', forceRefresh);

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
      },
      `현재가 조회 (${code})`
    );
  }

  /**
   * 재시도 로직이 포함된 현재가 조회
   * 네트워크 에러/타임아웃/인증실패 시 자동 재시도
   * 인증 실패(401) 시 토큰 강제 갱신 후 재시도
   * @param code 종목 코드
   * @param market 거래소 (NX=나스닥/NQ, KRX=한국거래소)
   * @param maxRetries 최대 재시도 횟수 (기본: 3회)
   */
  async retryGetPrice(code: string, market: string = 'NX', maxRetries: number = 3): Promise<PriceData> {
    let lastError: any;
    let tokenRefreshed = false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`📡 현재가 조회 시도: ${code} (${attempt + 1}/${maxRetries})`);
        return await this.getPrice(code, market);
      } catch (err: any) {
        lastError = err;
        const status = err?.response?.status;
        const errorMsg = err?.response?.data?.msg1 || err?.message || '';

        // 401 인증 실패 또는 토큰 관련 에러 감지
        const isAuthError =
          status === 401 ||
          status === 403 ||
          errorMsg.includes('인증') ||
          errorMsg.includes('토큰') ||
          errorMsg.includes('token') ||
          errorMsg.includes('unauthorized');

        if (isAuthError && !tokenRefreshed && attempt < maxRetries - 1) {
          console.warn(`🔐 [${code}] 인증 실패 감지 (${status}) - 토큰 강제 갱신 및 재시도`);

          try {
            // 토큰 강제 갱신
            await this.getToken(true);
            tokenRefreshed = true;
            console.log(`✅ [${code}] 토큰 갱신 완료 - 즉시 재시도`);
            continue; // 다음 루프로 진행 (delay 없이)
          } catch (tokenErr: any) {
            console.error(`❌ [${code}] 토큰 갱신 실패: ${tokenErr.message}`);
            lastError = tokenErr;
          }
        }

        if (attempt < maxRetries - 1) {
          // 지수백오프: 1초, 2초, 4초...
          const delay = 1000 * Math.pow(2, attempt);
          console.warn(`⚠️ [${code}] 재시도 ${attempt + 1}회 - ${delay}ms 후 재시도`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`❌ [${code}] 모든 재시도 실패 (${maxRetries}회 시도)`);
        }
      }
    }

    throw lastError;
  }

  /**
   * 계좌 정보 조회 (잔액, 평가액 등)
   * 공식 문서: 투자계좌자산현황조회 API (CTRP6548R)
   */
  async getAccount(): Promise<AccountData> {
    return this.retryWithTokenRefresh(
      async (forceRefresh?: boolean) => {
        const headers = await this.getHeaders('CTRP6548R', forceRefresh);

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
      },
      '계좌 정보 조회'
    );
  }

  /**
   * 주식잔고조회 (보유종목 + 계좌요약)
   * 공식 API: v1_국내주식-006
   * TR_ID: TTTC8434R (실전), VTTC8434R (모의)
   * 엔드포인트: /uapi/domestic-stock/v1/trading/inquire-balance
   */
  async getBalance(): Promise<BalanceData> {
    return this.retryWithTokenRefresh(
      async (forceRefresh?: boolean) => {
        const headers = await this.getHeaders('TTTC8434R', forceRefresh);

        const cano = this.accountId.split('-')[0];
        const acntPrdtCd = this.accountId.split('-')[1] || '01';

        console.log(`📝 주식잔고조회: CANO=${cano}, ACNT=${acntPrdtCd}`);

        const response = await this.client.get(
          '/uapi/domestic-stock/v1/trading/inquire-balance',
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

        // 응답 상태 확인
        if (response.data.rt_cd !== '0') {
          throw new Error(`주식잔고조회 실패: ${response.data.msg1}`);
        }

        // output1: 보유종목 배열 파싱
        const output1 = response.data.output1 || [];
        const holdings: BalanceHolding[] = output1.map((item: any) => ({
          pdno: item.pdno || '',
          prdt_name: item.prdt_name || '',
          hldg_qty: parseInt(item.hldg_qty || '0', 10),
          pchs_avg_pric: parseInt(item.pchs_avg_pric || '0', 10),
          prpr: parseInt(item.prpr || '0', 10),
          evlu_amt: parseInt(item.evlu_amt || '0', 10),
          evlu_pfls_amt: parseInt(item.evlu_pfls_amt || '0', 10),
          evlu_pfls_rt: parseFloat(item.evlu_pfls_rt || '0'),
        }));

        // output2: 계좌 요약정보 파싱 (배열의 첫 요소)
        const output2Array = response.data.output2 || [];
        const output2 = Array.isArray(output2Array) ? output2Array[0] : output2Array;

        // 📋 주문 가능금액 관련 필드 로깅 (모든 output2 필드 확인)
        console.log(`📋 [output2 전체 필드] ${JSON.stringify(output2, null, 2)}`);

        console.log(`✅ 주식잔고조회 성공: ${holdings.length}개 종목`);

        // 예수금액 계산
        const dncaTotAmt = parseInt(output2?.dnca_tot_amt || '0', 10);

        // 추정된 주문 가능금액 = 예수금액 × 100% (공격적 전략)
        const estimatedOrderAmount = dncaTotAmt;
        console.log(`💰 주문 가능금액: ${dncaTotAmt.toLocaleString()}원 (100% 공격적 전략)`);

        return {
          account_id: this.accountId,
          holdings,
          dnca_tot_amt: dncaTotAmt,
          evlu_amt_smtl: parseInt(output2?.scts_evlu_amt || '0', 10), // 유가증권 평가금액
          evlu_pfls_amt_smtl: parseInt(output2?.evlu_pfls_smtl_amt || '0', 10), // 평가손익합계
          tot_asst_amt: parseInt(output2?.tot_evlu_amt || '0', 10), // 총평가금액
          estimated_order_amount: estimatedOrderAmount, // ✅ 추정된 주문 가능금액
        };
      },
      '주식잔고조회'
    );
  }

  /**
   * 보유종목 조회 (구버전 - inquire-holdings)
   * 공식 문서: 보유종목조회 API (TTTC8434R)
   * 엔드포인트: /domestic-stock/v1/trading/inquire-holdings
   */
  async getHoldings(): Promise<HoldingData[]> {
    return this.retryWithTokenRefresh(
      async (forceRefresh?: boolean) => {
        const headers = await this.getHeaders('TTTC8434R', forceRefresh);

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
      },
      '보유종목 조회'
    );
  }

  /**
   * 현재 시간에 맞는 거래소 선택 (KRX 정규장 vs NXT 야시장)
   * KST 기준으로 시간대 판단 (exchange.ts의 함수 사용)
   */
  private getExchangeCode(): string {
    return getCurrentExchangeCode();
  }

  /**
   * 매수가능조회 (공식 권장)
   * TR_ID: TTTC8908R
   * 엔드포인트: /uapi/domestic-stock/v1/trading/inquire-psbl-order
   *
   * 증거금률, 수수료 등을 모두 반영한 실제 매수 가능 수량을 조회합니다.
   * @returns nrcvb_buy_qty (미수없는매수수량) - 이 값을 사용해야 함
   */
  async getOrderableAmount(code: string, currentPrice: number): Promise<OrderableData> {
    try {
      const headers = await this.getHeaders('TTTC8908R');
      const cano = this.accountId.split('-')[0];
      const acntPrdtCd = this.accountId.split('-')[1] || '01';

      console.log(`📝 매수가능조회: ${code} @ ${currentPrice}원 (시장가 조회)`);

      const response = await this.client.get(
        '/uapi/domestic-stock/v1/trading/inquire-psbl-order',
        {
          headers,
          params: {
            CANO: cano,
            ACNT_PRDT_CD: acntPrdtCd,
            PDNO: code,
            ORD_UNPR: currentPrice.toString(),
            ORD_DVSN: '01', // 시장가
            CMA_EVLU_AMT_ICLD_YN: 'Y', // CMA 포함
            OVRS_ICLD_YN: 'N', // 해외 제외
          },
        }
      );

      if (response.data.rt_cd !== '0') {
        throw new Error(`매수가능조회 실패: ${response.data.msg1}`);
      }

      const output = response.data.output || {};
      const orderableData: OrderableData = {
        ord_psbl_cash: parseInt(output.ord_psbl_cash || '0', 10), // 주문가능현금
        nrcvb_buy_amt: parseInt(output.nrcvb_buy_amt || '0', 10), // 미수없는매수금액
        nrcvb_buy_qty: parseInt(output.nrcvb_buy_qty || '0', 10), // 미수없는매수수량 ← 실제 사용값
        max_buy_qty: parseInt(output.max_buy_qty || '0', 10), // 최대매수수량
      };

      console.log(`✅ 매수가능조회 성공:`);
      console.log(`   주문가능현금: ${orderableData.ord_psbl_cash.toLocaleString()}원`);
      console.log(`   미수없는매수수량: ${orderableData.nrcvb_buy_qty.toLocaleString()}주 ← 이 값 사용!`);
      console.log(`   최대매수수량: ${orderableData.max_buy_qty.toLocaleString()}주`);

      return orderableData;
    } catch (error: any) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.msg1 || error?.message;
      console.error(`❌ 매수가능조회 실패: status=${status}, msg=${msg}`);
      throw error;
    }
  }

  /**
   * 매도가능수량조회 (공식 권장)
   * API: 국내주식-165 / 매도가능수량조회
   * 실전 TR_ID: TTTC8408R
   * 엔드포인트: /uapi/domestic-stock/v1/trading/inquire-psbl-order
   *
   * @returns ord_psbl_qty (주문가능수량) - 매도 가능 수량
   */
  async getSellableAmount(code: string): Promise<SellableData> {
    try {
      const headers = await this.getHeaders('TTTC8408R');
      const cano = this.accountId.split('-')[0];
      const acntPrdtCd = this.accountId.split('-')[1] || '01';

      console.log(`📝 매도가능수량조회: ${code}`);

      const response = await this.client.get(
        '/uapi/domestic-stock/v1/trading/inquire-psbl-sell',
        {
          headers,
          params: {
            CANO: cano,
            ACNT_PRDT_CD: acntPrdtCd,
            PDNO: code,
            ORD_DVSN: '01', // 시장가
            OVRS_ICLD_YN: 'N', // 해외 제외
          },
        }
      );

      if (response.data.rt_cd !== '0') {
        throw new Error(`매도가능수량조회 실패: ${response.data.msg1}`);
      }

      const output = response.data.output || {};
      const sellableData: SellableData = {
        ord_psbl_qty: parseInt(output.ord_psbl_qty || '0', 10), // 주문가능수량 ← 매도 가능 수량
      };

      console.log(`✅ 매도가능수량조회 성공:`);
      console.log(`   주문가능수량: ${sellableData.ord_psbl_qty.toLocaleString()}주 ← 이 값 사용!`);

      return sellableData;
    } catch (error: any) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.msg1 || error?.message;
      console.error(`❌ 매도가능수량조회 실패: status=${status}, msg=${msg}`);
      throw error;
    }
  }

  /**
   * 시장가 매수
   */
  async buy(code: string, quantity: number): Promise<any> {
    try {
      const headers = await this.getHeaders('TTTC0012U');
      const cano = this.accountId.split('-')[0];
      const acntPrdtCd = this.accountId.split('-')[1] || '01';
      const exchange = this.getExchangeCode();

      console.log(`📊 매수 주문: ${code} x ${quantity}주 (거래소: ${exchange})`);

      const response = await this.client.post(
        '/uapi/domestic-stock/v1/trading/order-cash',
        {
          CANO: cano,
          ACNT_PRDT_CD: acntPrdtCd,
          PDNO: code,
          ORD_DVSN: '01',
          ORD_QTY: quantity.toString(),
          ORD_UNPR: '0',
          EXCG_ID_DVSN_CD: exchange,
        },
        { headers }
      );

      if (response.data.rt_cd !== '0') {
        console.log(`📋 KIS API 매수 응답:`, JSON.stringify(response.data, null, 2));
        throw new Error(`매수 실패: ${response.data.msg1}`);
      }

      console.log(`✅ 매수 주문 성공 (${code}): 주문번호=${response.data.output?.order_number}`);
      return response.data;
    } catch (error: any) {
      const msg = error?.response?.data?.msg1 || error?.message;
      const fullResponse = error?.response?.data;
      console.error(`❌ 매수 주문 실패 (${code}): ${msg}`);
      if (fullResponse) {
        console.error(`📋 전체 응답:`, JSON.stringify(fullResponse, null, 2));
      }
      throw error;
    }
  }

  /**
   * 시장가 매도
   */
  async sell(code: string, quantity: number): Promise<any> {
    try {
      const headers = await this.getHeaders('TTTC0011U');
      const cano = this.accountId.split('-')[0];
      const acntPrdtCd = this.accountId.split('-')[1] || '01';
      const exchange = this.getExchangeCode();

      console.log(`📊 매도 주문: ${code} x ${quantity}주 (거래소: ${exchange})`);

      const response = await this.client.post(
        '/uapi/domestic-stock/v1/trading/order-cash',
        {
          CANO: cano,
          ACNT_PRDT_CD: acntPrdtCd,
          PDNO: code,
          ORD_DVSN: '01',
          ORD_QTY: quantity.toString(),
          ORD_UNPR: '0',
          EXCG_ID_DVSN_CD: exchange,
        },
        { headers }
      );

      if (response.data.rt_cd !== '0') {
        throw new Error(`매도 실패: ${response.data.msg1}`);
      }

      console.log(`✅ 매도 주문 성공 (${code}): 주문번호=${response.data.output?.order_number}`);
      return response.data;
    } catch (error: any) {
      const msg = error?.response?.data?.msg1 || error?.message;
      console.error(`❌ 매도 주문 실패 (${code}): ${msg}`);
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
