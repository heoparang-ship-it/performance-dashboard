"""대시보드 API — 실시간 네이버 API 연동."""

from __future__ import annotations

import datetime as dt
import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...database import get_db
from ...models.store import Store
from ...models.setting import Setting
from ...schemas.action import ActionItemOut
from ...schemas.performance import KpiSummary, TrendPoint
from ...services.naver_api import NaverAdsClient
from ...services.naver_realtime import (
    get_daily_summary_with_delta,
    get_realtime_alerts,
    get_trend_data,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

SETTINGS_KEY = "naver_api_credentials"


def _resolve_client(store_id: int, db: Session):
    """store_id → NaverAdsClient + customer_id."""
    store = db.query(Store).filter_by(id=store_id).first()
    if not store or not store.customer_id:
        raise HTTPException(status_code=400, detail="스토어에 연결된 광고주가 없습니다.")

    setting = db.query(Setting).filter_by(key=SETTINGS_KEY).first()
    if not setting:
        raise HTTPException(status_code=400, detail="네이버 API 인증 정보가 설정되지 않았습니다.")
    creds = json.loads(setting.value)

    client = NaverAdsClient(
        api_key=creds["api_key"],
        secret_key=creds["secret_key"],
        customer_id=creds["customer_id"],
    )
    return client, store.customer_id


@router.get("/summary", response_model=KpiSummary)
def dashboard_summary(
    store_id: int = Query(..., description="스토어 ID (필수)"),
    date: dt.date | None = Query(None),
    db: Session = Depends(get_db),
):
    client, customer_id = _resolve_client(store_id, db)
    target = date or dt.date.today()
    result = get_daily_summary_with_delta(client, customer_id, target)

    # 오늘 데이터 없으면 어제로 fallback
    if result.get("impressions", 0) == 0 and result.get("clicks", 0) == 0 and date is None:
        yesterday = target - dt.timedelta(days=1)
        result = get_daily_summary_with_delta(client, customer_id, yesterday)

    return result


@router.get("/trend", response_model=List[TrendPoint])
def dashboard_trend(
    store_id: int = Query(..., description="스토어 ID (필수)"),
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    client, customer_id = _resolve_client(store_id, db)
    end = dt.date.today()
    start = end - dt.timedelta(days=days - 1)
    return get_trend_data(client, customer_id, start, end)


@router.get("/alerts", response_model=List[ActionItemOut])
def dashboard_alerts(
    store_id: int = Query(..., description="스토어 ID (필수)"),
    date: dt.date | None = Query(None),
    db: Session = Depends(get_db),
):
    client, customer_id = _resolve_client(store_id, db)
    target = date or dt.date.today()
    alerts = get_realtime_alerts(client, customer_id, target)

    # 오늘 알림 없으면 어제로 fallback
    if not alerts and date is None:
        yesterday = target - dt.timedelta(days=1)
        alerts = get_realtime_alerts(client, customer_id, yesterday)

    return alerts
