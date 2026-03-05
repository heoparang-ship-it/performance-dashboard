"""네이버 검색광고 API 엔드포인트."""

from __future__ import annotations

import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.security import get_current_user
from ...database import get_db
from ...models.setting import Setting
from ...models.user import User
from ...schemas.naver_api import (
    NaverAccountOverview,
    NaverAdgroupInfo,
    NaverApiCredentials,
    NaverApiCredentialsOut,
    NaverCampaignInfo,
    NaverConnectionTest,
    NaverCustomer,
)
from ...services.naver_api import NaverAdsClient

router = APIRouter(prefix="/naver", tags=["naver"])

SETTINGS_KEY = "naver_api_credentials"


def _get_credentials(db: Session) -> dict | None:
    """저장된 API 인증 정보 조회."""
    setting = db.query(Setting).filter_by(key=SETTINGS_KEY).first()
    if not setting:
        return None
    return json.loads(setting.value)


def _get_client(db: Session) -> NaverAdsClient:
    """저장된 인증 정보로 클라이언트 생성."""
    creds = _get_credentials(db)
    if not creds:
        raise HTTPException(status_code=400, detail="네이버 API 인증 정보가 설정되지 않았습니다.")
    return NaverAdsClient(
        api_key=creds["api_key"],
        secret_key=creds["secret_key"],
        customer_id=creds["customer_id"],
    )


# ── API 인증 정보 관리 ──


@router.get("/credentials", response_model=NaverApiCredentialsOut)
def get_credentials(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """저장된 API 인증 정보 조회 (마스킹)."""
    creds = _get_credentials(db)
    if not creds:
        return NaverApiCredentialsOut(
            api_key_masked="",
            customer_id="",
            is_configured=False,
        )
    return NaverApiCredentialsOut(
        api_key_masked=creds["api_key"][:4] + "****" + creds["api_key"][-4:] if len(creds["api_key"]) > 8 else "****",
        customer_id=creds["customer_id"],
        is_configured=True,
    )


@router.post("/credentials")
def save_credentials(body: NaverApiCredentials, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """API 인증 정보 저장."""
    value = json.dumps({
        "api_key": body.api_key,
        "secret_key": body.secret_key,
        "customer_id": body.customer_id,
    })

    setting = db.query(Setting).filter_by(key=SETTINGS_KEY).first()
    if setting:
        setting.value = value
    else:
        setting = Setting(key=SETTINGS_KEY, value=value)
        db.add(setting)

    db.commit()
    return {"success": True, "message": "인증 정보가 저장되었습니다."}


@router.delete("/credentials")
def delete_credentials(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """API 인증 정보 삭제."""
    db.query(Setting).filter_by(key=SETTINGS_KEY).delete()
    db.commit()
    return {"success": True, "message": "인증 정보가 삭제되었습니다."}


# ── 연결 테스트 ──


@router.post("/test-connection", response_model=NaverConnectionTest)
def test_connection(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """API 연결 테스트."""
    client = _get_client(db)
    result = client.test_connection()
    return NaverConnectionTest(**result)


# ── 담당 광고주 목록 ──


@router.get("/customers", response_model=List[NaverCustomer])
def get_customers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """담당 중인 광고주 목록."""
    client = _get_client(db)
    try:
        raw = client.get_managed_customers()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"네이버 API 오류: {e}")

    customers = []
    for item in raw:
        # 새 API (2025.08~): masterCustomerId, adAccountNo 등
        # 기존 API: customerId, customerName
        cust_id = str(
            item.get("masterCustomerId")
            or item.get("customerId")
            or item.get("adAccountNo")
            or ""
        )
        name = (
            item.get("customerName")
            or item.get("name")
            or item.get("adAccountName")
            or ""
        )
        login_id = item.get("loginId", "")
        if cust_id:
            customers.append(NaverCustomer(
                customer_id=cust_id,
                name=name,
                login_id=login_id,
            ))
    return customers


# ── 광고주 계정 구조 조회 ──


@router.get("/accounts/{customer_id}/overview", response_model=NaverAccountOverview)
def get_account_overview(customer_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """광고주의 캠페인/광고그룹 구조 조회."""
    client = _get_client(db)

    try:
        campaigns_raw = client.get_campaigns(customer_id)
        adgroups_raw = client.get_adgroups(customer_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"네이버 API 오류: {e}")

    campaigns = [
        NaverCampaignInfo(
            campaign_id=c.get("nccCampaignId", ""),
            name=c.get("name", ""),
            campaign_type=c.get("campaignTp", ""),
            status=c.get("status", ""),
            budget=c.get("dailyBudget", 0) or 0,
        )
        for c in campaigns_raw
    ]

    adgroups = [
        NaverAdgroupInfo(
            adgroup_id=ag.get("nccAdgroupId", ""),
            campaign_id=ag.get("nccCampaignId", ""),
            name=ag.get("name", ""),
            status=ag.get("status", ""),
            bid_amount=ag.get("bidAmt", 0) or 0,
        )
        for ag in adgroups_raw
    ]

    # 키워드 총 수: 광고그룹이 많으면 시간 초과하므로 스킵
    # (113개 광고그룹 × 개별 API 호출 = 타임아웃)
    keywords_count = 0

    return NaverAccountOverview(
        customer_id=customer_id,
        campaigns=campaigns,
        adgroups=adgroups,
        keywords_count=keywords_count,
    )


    # sync 엔드포인트 제거됨 — 실시간 API 사용
