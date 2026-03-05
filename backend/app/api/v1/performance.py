"""광고 성과 API — 실시간 네이버 API 연동."""

from __future__ import annotations

import datetime as dt
import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...database import get_db
from ...models.store import Store
from ...models.setting import Setting
from ...schemas.performance import (
    AdgroupPerformance,
    AdgroupPerfWithDelta,
    CampaignPerformance,
    CampaignPerfWithDelta,
    KeywordPerformance,
    KeywordPerfWithDelta,
)
from ...services.naver_api import NaverAdsClient
from ...services.naver_realtime import (
    get_adgroup_performance,
    get_adgroup_performance_with_delta,
    get_campaign_performance,
    get_campaign_performance_with_delta,
    get_keyword_performance,
    get_keyword_performance_with_delta,
)

router = APIRouter(prefix="/performance", tags=["performance"])

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


@router.get("/campaigns", response_model=List[CampaignPerformance])
def campaigns(
    store_id: int = Query(..., description="스토어 ID (필수)"),
    start: dt.date | None = Query(None),
    end: dt.date | None = Query(None),
    sort_by: str = Query("cost"),
    sort_dir: str = Query("desc"),
    db: Session = Depends(get_db),
):
    client, customer_id = _resolve_client(store_id, db)
    end_date = end or dt.date.today()
    start_date = start or (end_date - dt.timedelta(days=6))
    return get_campaign_performance(client, customer_id, start_date, end_date, sort_by, sort_dir)


@router.get("/campaigns/with-delta", response_model=List[CampaignPerfWithDelta])
def campaigns_with_delta(
    store_id: int = Query(..., description="스토어 ID (필수)"),
    period: int = Query(7, ge=1, le=30, description="비교 기간 (일)"),
    db: Session = Depends(get_db),
):
    client, customer_id = _resolve_client(store_id, db)
    end_date = dt.date.today()
    return get_campaign_performance_with_delta(client, customer_id, end_date, period)


@router.get("/adgroups", response_model=List[AdgroupPerformance])
def adgroups(
    store_id: int = Query(..., description="스토어 ID (필수)"),
    campaign: str | None = Query(None),
    start: dt.date | None = Query(None),
    end: dt.date | None = Query(None),
    db: Session = Depends(get_db),
):
    client, customer_id = _resolve_client(store_id, db)
    end_date = end or dt.date.today()
    start_date = start or (end_date - dt.timedelta(days=6))
    return get_adgroup_performance(client, customer_id, campaign, start_date, end_date)


@router.get("/adgroups/with-delta", response_model=List[AdgroupPerfWithDelta])
def adgroups_with_delta(
    store_id: int = Query(..., description="스토어 ID (필수)"),
    campaign: str | None = Query(None, description="캠페인명 필터"),
    period: int = Query(7, ge=1, le=30, description="비교 기간 (일)"),
    db: Session = Depends(get_db),
):
    client, customer_id = _resolve_client(store_id, db)
    end_date = dt.date.today()
    return get_adgroup_performance_with_delta(client, customer_id, end_date, campaign, period)


@router.get("/keywords", response_model=List[KeywordPerformance])
def keywords(
    store_id: int = Query(..., description="스토어 ID (필수)"),
    adgroup: str | None = Query(None),
    start: dt.date | None = Query(None),
    end: dt.date | None = Query(None),
    db: Session = Depends(get_db),
):
    client, customer_id = _resolve_client(store_id, db)
    end_date = end or dt.date.today()
    start_date = start or (end_date - dt.timedelta(days=6))
    return get_keyword_performance(client, customer_id, adgroup, start_date, end_date)


@router.get("/keywords/with-delta", response_model=List[KeywordPerfWithDelta])
def keywords_with_delta(
    store_id: int = Query(..., description="스토어 ID (필수)"),
    campaign: str | None = Query(None, description="캠페인명 필터"),
    adgroup: str | None = Query(None, description="광고그룹명 필터"),
    period: int = Query(7, ge=1, le=30, description="비교 기간 (일)"),
    db: Session = Depends(get_db),
):
    client, customer_id = _resolve_client(store_id, db)
    end_date = dt.date.today()
    return get_keyword_performance_with_delta(client, customer_id, end_date, campaign, adgroup, period)


@router.get("/adgroup-ads")
def adgroup_ads(
    store_id: int = Query(..., description="스토어 ID (필수)"),
    adgroup_id: str = Query(..., description="광고그룹 ID (nccAdgroupId)"),
    db: Session = Depends(get_db),
):
    """광고그룹의 소재(광고) 목록."""
    client, customer_id = _resolve_client(store_id, db)
    try:
        ads = client.get_ads(customer_id, adgroup_id)
        if not isinstance(ads, list):
            ads = []
    except Exception:
        ads = []

    result = []
    for ad in ads:
        ref = ad.get("referenceData") or {}
        ad_obj = ad.get("ad") or {}
        # 쇼핑광고: referenceData.productTitle, 텍스트광고: headline/subject
        headline = (
            ad.get("headline")
            or ad_obj.get("headline")
            or ad.get("subject")
            or ref.get("productTitle")
            or ref.get("productName")
            or ""
        )
        description = (
            ad.get("description")
            or ad_obj.get("description")
            or ""
        )
        result.append({
            "ad_id": ad.get("nccAdId", ""),
            "type": ad.get("type", ""),
            "status": ad.get("status", ""),
            "inspect_status": ad.get("inspectStatus", ""),
            "headline": headline,
            "description": description,
            "pc_channel_id": ad.get("pcChannelId", ""),
            "mobile_channel_id": ad.get("mobileChannelId", ""),
            "product_title": ref.get("productTitle", ""),
            "price": ref.get("lowPrice", ""),
            "image_url": ref.get("imageUrl", ""),
            "mall_name": ref.get("mallName", ""),
            "review_count": ref.get("reviewCountSum", ""),
            "purchase_count": ref.get("purchaseCnt", ""),
            "category": ref.get("fullMallCatNm", ""),
        })
    return result
