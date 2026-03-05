"""FastAPI 앱 진입점."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.router import router as v1_router
from .config import CORS_ORIGINS
from .database import init_db

app = FastAPI(
    title="퍼포먼스 마케팅 대시보드 API",
    description="네이버 스마트스토어 광고 성과 분석 대시보드",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}
