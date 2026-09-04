# Python 백엔드 가이드

## 개요

이 프로젝트는 **Python 백엔드** + **React 프론트엔드** 구조입니다:

- **Python 백엔드** (Flask): KIS API 토큰 관리, 계좌 정보 조회
- **React 프론트엔드** (Vercel): 대시보드 UI

---

## 파일 구조

```
backend/
├── app.py              # Flask 메인 서버
├── kis_client.py       # KIS API 클라이언트 (토큰 캐싱)
├── requirements.txt    # Python 의존성
├── .env.example        # 환경변수 예제
└── run.py             # 실행 스크립트

app/
├── page.tsx           # React 대시보드 (Python 백엔드 호출)
└── ...
```

---

## 설정 방법

### 1️⃣ Python 의존성 설치

```bash
cd backend
pip install -r requirements.txt
```

### 2️⃣ .env 파일 생성

```bash
cp .env.example .env
```

`.env` 파일에 다음 정보 입력:

```env
KIS_BASE_URL=https://openapi.koreainvestment.com:9443
KIS_APPKEY=your_appkey
KIS_SECRET=your_secret
KIS_ACCOUNT=44291220-01
PYTHON_PORT=5000
```

---

## 실행 방법

### 로컬 개발

**터미널 1 - Python 백엔드 실행:**
```bash
cd backend
python app.py
# 🚀 Python 백엔드 시작 (포트: 5000)
```

**터미널 2 - React 프론트엔드 실행:**
```bash
npm run dev
# ▲ Next.js 개발 서버 (포트: 3000)
```

그러면:
- React: `http://localhost:3000`
- Python 백엔드: `http://localhost:5000`

### 프로덕션 배포

#### Python 백엔드 (VPS/로컬)

```bash
cd backend

# 1. Python 3.10+ 설치
# 2. 의존성 설치
pip install -r requirements.txt

# 3. .env 파일에 실제 KIS 자격증명 입력

# 4. 백그라운드에서 실행 (예: screen, tmux, supervisor)
screen -S eod-backend
python app.py

# 또는 systemd 서비스 등록
```

#### React 프론트엔드 (Vercel)

Vercel의 환경변수에 Python 백엔드 URL 추가:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.com
```

---

## API 엔드포인트

### GET `/api/account?account_id=44291220-01`

계좌 정보 조회

**응답:**
```json
{
  "success": true,
  "data": {
    "account_id": "44291220-01",
    "balance": 5000000,
    "evaluating": 1000000,
    "profit_loss": 50000,
    "profit_rate": 2.5,
    "total_assets": 6000000
  }
}
```

### GET `/api/price?code=000660&market=NX`

현재가 조회

**응답:**
```json
{
  "success": true,
  "data": {
    "code": "000660",
    "name": "SK하이닉스",
    "current": 25000,
    "bid": 24900,
    "ask": 25100,
    "bid_qty": 1000,
    "ask_qty": 800
  }
}
```

### GET `/health`

헬스 체크

---

## 토큰 캐싱 (핵심!)

### ✅ 장점 (메모리 캐싱)

```python
# kis_client.py에서:
if self.access_token and now < self.token_expires_at - 60:
    return  # 캐시된 토큰 재사용!
```

- KIS API의 1분당 1회 rate limit **완벽 해결**
- 빠른 응답 (토큰 재발급 불필요)
- 간단한 구조 (Reference와 동일)

### ⚠️ 주의

Python 프로세스가 재시작되면 토큰도 초기화됩니다.
→ 재시작 후 첫 요청이 조금 오래 걸릴 수 있습니다.

---

## 트러블슈팅

### 1. "KIS API 인증 실패"

```
❌ Error: Token response invalid
```

**해결:**
- `.env` 파일의 `KIS_APPKEY`, `KIS_SECRET` 확인
- KIS 서비스 상태 확인

### 2. "계좌ID 형식 오류"

```
❌ ValueError: 계좌ID 형식 오류
```

**해결:**
- 계좌ID를 `계좌번호-상품코드` 형식으로 입력
- 예: `44291220-01`

### 3. CORS 에러 (프론트엔드)

```
❌ Access to XMLHttpRequest blocked by CORS policy
```

**해결:**
- Flask-CORS가 설치되어 있는지 확인
- Python 백엔드가 `http://0.0.0.0:5000`으로 실행 중인지 확인

---

## 다음 단계

1. ✅ Python 백엔드에 자동매매 로직 추가
2. ✅ WebSocket으로 실시간 시세 받기
3. ✅ Telegram 알림 연동
4. ✅ 데이터베이스 통합 (거래 기록)

---

## Reference

이 구조는 [keylightjaeyong/trading](https://github.com/keylightjaeyong/trading)을 기반으로 합니다.
