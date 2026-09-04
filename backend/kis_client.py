import os
import time
import requests
from typing import Optional, Dict, Any


class KISClient:
    """한국투자증권 API 클라이언트 (Reference 구조 기반)"""

    def __init__(self):
        self.base_url = os.getenv("KIS_BASE_URL", "https://openapi.koreainvestment.com:9443")
        self.app_key = os.getenv("KIS_APPKEY", "")
        self.app_secret = os.getenv("KIS_SECRET", "")
        self.account_id = os.getenv("KIS_ACCOUNT", "")

        # 토큰 캐싱 (메모리 - Reference 방식)
        self.access_token: Optional[str] = None
        self.token_expires_at: int = 0

        self.req_timeout = 8
        self.max_retry = 3

    def _request_json(self, method: str, url: str, **kwargs) -> Dict[str, Any]:
        """HTTP 요청 (재시도 로직 포함)"""
        for attempt in range(1, self.max_retry + 1):
            try:
                headers = kwargs.pop('headers', {})
                headers['User-Agent'] = 'EOD-Trading-Bot/1.0'

                if method.upper() == "GET":
                    res = requests.get(url, headers=headers, timeout=self.req_timeout, **kwargs)
                else:
                    res = requests.post(url, headers=headers, timeout=self.req_timeout, **kwargs)

                res.raise_for_status()
                return res.json()
            except Exception as e:
                if attempt == self.max_retry:
                    raise RuntimeError(f"Request failed after {self.max_retry} attempts: {url} / {e}") from e
                time.sleep(0.5 * attempt)
        return {}

    def get_token(self, force_refresh: bool = False) -> None:
        """토큰 갱신 (Reference 방식)"""
        now = int(time.time())

        # Valid token cached, reuse with 60s margin
        if not force_refresh and self.access_token and now < self.token_expires_at - 60:
            print(f"[TOKEN_CACHE] Using cached token (expires in {self.token_expires_at - now}s)")
            return

        print("[TOKEN_REQUEST] Requesting new token...")

        url = f"{self.base_url}/oauth2/tokenP"
        body = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "appsecret": self.app_secret
        }

        res = self._request_json("POST", url, json=body)
        token = res.get("access_token")
        expires_in = int(res.get("expires_in", 3600))

        if not token:
            raise RuntimeError(f"Token response invalid: {res}")

        # Token saved to memory cache
        self.access_token = token
        self.token_expires_at = now + expires_in
        print(f"[TOKEN_OBTAINED] New token obtained (valid for {expires_in}s)")

    def _kis_headers(self, tr_id: str) -> Dict[str, str]:
        """KIS API 요청 헤더"""
        self.get_token()  # 필요하면 갱신, 있으면 재사용
        return {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {self.access_token}",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
            "tr_id": tr_id,
        }

    def get_account(self, account_id: Optional[str] = None) -> Dict[str, Any]:
        """계좌 정보 조회 - 투자계좌자산현황조회 API"""
        if not account_id:
            account_id = self.account_id

        if not account_id:
            raise ValueError("계좌ID 필수")

        try:
            cano, acnt_prdt_cd = account_id.split('-')
        except ValueError:
            raise ValueError(f"계좌ID 형식 오류: {account_id} (형식: 계좌번호-상품코드)")

        # 올바른 엔드포인트 (공식 문서 확인: 투자계좌자산현황조회)
        endpoint = "/uapi/domestic-stock/v1/trading/inquire-account-balance"
        headers = self._kis_headers('CTRP6548R')

        params = {
            "CANO": cano,
            "ACNT_PRDT_CD": acnt_prdt_cd or '01',
            "INQR_DVSN_1": "",
            "BSPR_BF_DT_APLY_YN": "",
        }

        url = f"{self.base_url}{endpoint}"
        print(f"[ACCOUNT] 요청: {endpoint} (계좌: {account_id})")

        res = self._request_json("GET", url, headers=headers, params=params)

        if not res or res.get("rt_cd") != "0":
            error_msg = res.get("msg1", "Unknown error") if res else "No response"
            print(f"[ACCOUNT] 실패: {error_msg}")
            raise RuntimeError(f"계좌 조회 실패: {error_msg}")

        # Output2에서 필요한 데이터 추출
        output2 = res.get("output2", {})

        # 필드명 확인: 문서상 예수금액 = dncl_amt, 평가금액합계 = evlu_amt_smtl
        balance = int(output2.get("dncl_amt", 0))  # 예수금액 (현금잔고)
        evaluating = int(output2.get("evlu_amt_smtl", 0))  # 평가금액합계 (보유주식 총액)
        profit_loss = int(output2.get("evlu_pfls_amt_smtl", 0))  # 평가손익금액합계
        total_assets = int(output2.get("tot_asst_amt", 0))  # 총자산금액

        return {
            "account_id": account_id,
            "balance": balance,
            "evaluating": evaluating,
            "profit_loss": profit_loss,
            "profit_rate": (profit_loss / evaluating * 100) if evaluating > 0 else 0,
            "total_assets": total_assets
        }

    def get_price(self, code: str, market: str = "NX") -> Dict[str, Any]:
        """현재가 조회"""
        headers = self._kis_headers('FHKST01010100')

        url = f"{self.base_url}/uapi/domestic-stock/v1/quotations/inquire-price"
        params = {
            "FID_COND_MRKT_DIV_CODE": market,
            "FID_INPUT_ISCD": code,
        }

        res = self._request_json("GET", url, headers=headers, params=params)
        output = res.get("output", {})

        return {
            "code": code,
            "name": output.get("hts_kor_isnm", ""),
            "current": int(output.get("stck_prpr", 0)),
            "bid": int(output.get("bidp1", 0)),
            "ask": int(output.get("askp1", 0)),
            "bid_qty": int(output.get("bidp_rsqn1", 0)),
            "ask_qty": int(output.get("askp_rsqn1", 0)),
        }
