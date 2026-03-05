"""앱 설정."""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'dashboard.db'}")

# 기본 임계값 (기존 CLI 기본값과 동일)
DEFAULT_THRESHOLDS = {
    "min_clicks_for_pause": 30,
    "low_ctr_threshold": 1.0,
    "low_roas_threshold": 200.0,
    "high_roas_threshold": 400.0,
    "high_cpc_threshold": 1200.0,
}

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

# Auth / JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "xcom-dashboard-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24시간

# 마스터 계정 기본값
MASTER_EMAIL = os.getenv("MASTER_EMAIL", "master@xcom.com")
MASTER_PASSWORD = os.getenv("MASTER_PASSWORD", "xcom1234!")
