"""전체 종합 대시보드 API."""

from __future__ import annotations

import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...database import get_db
from ...models.store import Store
from ...models.setting import Setting
from ...schemas.naver_api import (
    AdCreativesSummary,
    AdExtensionsSummary,
    BidSimulationRequest,
    BizMoneyBalance,
    KeywordToolRequest,
    KeywordToolResult,
    QualityIndexSummary,
)
from ...services.naver_api import NaverAdsClient
from ...services.naver_realtime import (
    get_ad_creatives_summary,
    get_ad_extensions_summary,
    get_bizmoney_balance,
    get_keyword_insights,
    get_quality_index_summary,
)

router = APIRouter(prefix="/all-in-one", tags=["all-in-one"])

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


@router.get("/bizmoney", response_model=BizMoneyBalance)
def bizmoney(
    store_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """비즈머니 잔액."""
    client, customer_id = _resolve_client(store_id, db)
    result = get_bizmoney_balance(client, customer_id)
    return BizMoneyBalance(
        bizmoney=result.get("bizmoney", 0),
        budget_lock=result.get("budgetLock", 0),
        refund=result.get("refund", 0),
    )


@router.get("/quality-index", response_model=QualityIndexSummary)
def quality_index(
    store_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """품질지수 분포."""
    client, customer_id = _resolve_client(store_id, db)
    return get_quality_index_summary(client, customer_id)


@router.get("/ad-creatives", response_model=AdCreativesSummary)
def ad_creatives(
    store_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """광고 소재 현황."""
    client, customer_id = _resolve_client(store_id, db)
    return get_ad_creatives_summary(client, customer_id)


@router.get("/ad-extensions", response_model=AdExtensionsSummary)
def ad_extensions(
    store_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """확장소재 현황."""
    client, customer_id = _resolve_client(store_id, db)
    return get_ad_extensions_summary(client, customer_id)


@router.post("/keyword-tool", response_model=List[KeywordToolResult])
def keyword_tool(
    body: KeywordToolRequest,
    store_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """키워드 도구."""
    if not body.keywords:
        raise HTTPException(status_code=400, detail="키워드를 하나 이상 입력하세요.")
    client, customer_id = _resolve_client(store_id, db)
    return get_keyword_insights(client, customer_id, body.keywords)


@router.post("/bid-simulation")
def bid_simulation(
    body: BidSimulationRequest,
    store_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """입찰 시뮬레이션."""
    client, customer_id = _resolve_client(store_id, db)
    try:
        result = client.get_bid_simulation(
            customer_id=customer_id,
            keyword_id=body.keyword_id,
            bid=body.bid,
            device=body.device,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"시뮬레이션 오류: {e}")
