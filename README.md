# 퍼포먼스 마케팅 대시보드

네이버 스마트스토어 광고 성과를 한눈에 확인하는 웹 대시보드입니다.

## 빠른 시작

```bash
cd performance-dashboard
bash start.sh
```

- 대시보드: http://localhost:3000
- API 문서: http://localhost:8000/docs

## 수동 실행

### Backend (FastAPI)

```bash
cd backend
uv venv --python 3.13 .venv
source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

## 사용법

1. **설정** 페이지에서 스토어를 추가합니다
2. **CSV 업로드** 페이지에서 네이버 광고 보고서 CSV를 업로드합니다
3. **일일 요약**에서 매출/광고비/ROAS/전환수를 확인합니다
4. **광고 성과**에서 캠페인/광고그룹/키워드별 상세 데이터를 봅니다
5. **액션 추천**에서 최적화 액션을 확인하고 처리합니다

## CSV 형식

네이버 검색광고 관리 시스템에서 다운받은 CSV를 그대로 사용할 수 있습니다.
한글/영문 헤더 혼용을 지원합니다.

필수 컬럼: `노출수`, `클릭수`, `광고비`, `전환수`
선택 컬럼: `매출`, `캠페인명`, `광고그룹명`, `키워드`, `클릭률`, `평균클릭비용`, `roas`

## 기술 스택

- **Backend**: Python FastAPI + SQLAlchemy + SQLite
- **Frontend**: Next.js 15 + Tailwind CSS + Recharts
- **배포**: Docker Compose 지원
