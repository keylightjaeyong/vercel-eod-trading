#!/bin/bash
echo "📊 Vercel 크론 로그 최근 30분..."
echo ""
# Vercel CLI로 최근 로그 확인
# vercel logs https://vercel-eod-trading.vercel.app/api/cron/trade --follow=false --limit=50 2>/dev/null | tail -50

# 또는 수동으로 Vercel 대시보드 열기
echo "❓ Vercel 대시보드에서 직접 확인:"
echo "   https://vercel.com/dashboard"
echo "   → vercel-eod-trading"
echo "   → Functions"
echo "   → /api/cron/trade 로그 탭"
echo ""
echo "🔍 확인해야 할 것:"
echo "   1. 마지막 실행 시간 (5분 이내여야 함)"
echo "   2. 에러 메시지"
echo "   3. getBalance() 성공 여부"
echo "   4. 매수 신호 발생 여부"
