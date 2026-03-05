"""FastAPI 앱 진입점."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.router import router as v1_router
from .config import CORS_ORIGINS, MASTER_EMAIL, MASTER_PASSWORD
from .core.security import hash_password
from .database import SessionLocal, init_db
from .models.user import User

logger = logging.getLogger(__name__)

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
    _ensure_master_account()


def _ensure_master_account():
    """마스터 계정이 없으면 자동 생성, 있으면 ID/비밀번호를 설정값으로 동기화."""
    db = SessionLocal()
    try:
        master = db.query(User).filter_by(role="master").first()
        if not master:
            master = User(
                email=MASTER_EMAIL,
                hashed_password=hash_password(MASTER_PASSWORD),
                name="마스터",
                role="master",
            )
            db.add(master)
            db.commit()
            logger.info("마스터 계정 생성됨: %s", MASTER_EMAIL)
        else:
            # 설정값이 변경된 경우 마스터 계정 동기화
            if master.email != MASTER_EMAIL:
                master.email = MASTER_EMAIL
                master.hashed_password = hash_password(MASTER_PASSWORD)
                db.commit()
                logger.info("마스터 계정 업데이트됨: %s", MASTER_EMAIL)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}
