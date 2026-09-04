import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from kis_client import KISClient

# .env 파일 로드
load_dotenv()

app = Flask(__name__)
CORS(app)

# KIS 클라이언트 초기화 (싱글톤)
kis_client = KISClient()


@app.route('/health', methods=['GET'])
def health_check():
    """헬스 체크"""
    return jsonify({
        "status": "ok",
        "message": "Python 백엔드 정상 작동"
    }), 200


@app.route('/api/account', methods=['GET'])
def get_account():
    """계좌 정보 조회"""
    try:
        account_id = request.args.get('account_id') or os.getenv('KIS_ACCOUNT')

        if not account_id:
            return jsonify({
                "success": False,
                "error": "계좌ID가 설정되지 않았습니다"
            }), 400

        print(f"[ACCOUNT_QUERY] Querying account: {account_id}")
        account = kis_client.get_account(account_id)

        return jsonify({
            "success": True,
            "data": account
        }), 200

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Account query error: {e}")
        print(f"[ERROR] Traceback: {error_trace}")
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": error_trace
        }), 500


@app.route('/api/price', methods=['GET'])
def get_price():
    """현재가 조회"""
    try:
        code = request.args.get('code')
        market = request.args.get('market', 'NX')

        if not code:
            return jsonify({
                "success": False,
                "error": "종목코드(code) 필수"
            }), 400

        print(f"[PRICE_QUERY] Querying price: {code}")
        price = kis_client.get_price(code, market)

        return jsonify({
            "success": True,
            "data": price
        }), 200

    except Exception as e:
        print(f"[ERROR] Price query error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/token-status', methods=['GET'])
def token_status():
    """토큰 상태 조회"""
    import time
    now = int(time.time())
    expires_in = kis_client.token_expires_at - now if kis_client.token_expires_at else 0

    return jsonify({
        "has_token": kis_client.access_token is not None,
        "expires_in_seconds": max(0, expires_in),
        "expires_at_unix": kis_client.token_expires_at
    }), 200


if __name__ == '__main__':
    port = int(os.getenv('PYTHON_PORT', 5000))
    print(f"[STARTUP] Python backend started (port: {port})")
    print(f"[TOKEN] Memory caching enabled (single process)")
    print(f"[RATE_LIMIT] Problem solved via caching")
    app.run(host='0.0.0.0', port=port, debug=True)
