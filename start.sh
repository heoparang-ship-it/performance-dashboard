#!/bin/bash
# 퍼포먼스 마케팅 대시보드 실행 스크립트
# 사용법: bash start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== 퍼포먼스 마케팅 대시보드 시작 ==="

# Backend 시작
echo "[1/2] Backend 서버 시작 (포트 8000)..."
cd "$SCRIPT_DIR/backend"

if [ ! -d ".venv" ]; then
    echo "  Python venv 생성 중..."
    uv venv --python 3.13 .venv 2>/dev/null || python3 -m venv .venv
    source .venv/bin/activate
    uv pip install -r requirements.txt 2>/dev/null || pip install -r requirements.txt
else
    source .venv/bin/activate
fi

# 기존 프로세스 종료
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

sleep 2

# Frontend 시작
echo "[2/2] Frontend 서버 시작 (포트 3000)..."
cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "  npm 의존성 설치 중..."
    NPM_CONFIG_CACHE="/tmp/npm-cache-dashboard" npm install
fi

lsof -ti:3000 | xargs kill -9 2>/dev/null || true

NPM_CONFIG_CACHE="/tmp/npm-cache-dashboard" npx next dev --port 3000 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "=== 실행 완료 ==="
echo "  대시보드: http://localhost:3000"
echo "  API 문서: http://localhost:8000/docs"
echo ""
echo "종료하려면 Ctrl+C를 누르세요."

# 종료 시 정리
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
