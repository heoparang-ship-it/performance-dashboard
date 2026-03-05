"""네이버 검색광고 API 관련 스키마."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class NaverApiCredentials(BaseModel):
    """API 인증 정보."""
    api_key: str
    secret_key: str
    customer_id: str


class NaverApiCredentialsOut(BaseModel):
    """API 인증 정보 응답 (secret 마스킹)."""
    api_key_masked: str
    customer_id: str
    is_configured: bool


class NaverConnectionTest(BaseModel):
    """연결 테스트 결과."""
    success: bool
    client_count: int = 0
    campaigns_count: int = 0
    error: str | None = None


class NaverCustomer(BaseModel):
    """담당 광고주 정보."""
    customer_id: str
    name: str = ""
    login_id: str = ""


class NaverSyncRequest(BaseModel):
    """동기화 요청."""
    customer_id: str
    store_id: int
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD


class NaverSyncResult(BaseModel):
    """동기화 결과."""
    success: bool
    campaigns_count: int = 0
    adgroups_count: int = 0
    keywords_count: int = 0
    stats_rows_saved: int = 0
    error: str | None = None


class NaverCampaignInfo(BaseModel):
    """캠페인 정보."""
    campaign_id: str
    name: str
    campaign_type: str = ""
    status: str = ""
    budget: int = 0


class NaverAdgroupInfo(BaseModel):
    """광고그룹 정보."""
    adgroup_id: str
    campaign_id: str
    name: str
    status: str = ""
    bid_amount: int = 0


class NaverKeywordInfo(BaseModel):
    """키워드 정보."""
    keyword_id: str
    adgroup_id: str
    keyword: str
    status: str = ""
    bid_amount: int = 0


class NaverAccountOverview(BaseModel):
    """광고주 계정 전체 구조."""
    customer_id: str
    customer_name: str = ""
    campaigns: List[NaverCampaignInfo] = []
    adgroups: List[NaverAdgroupInfo] = []
    keywords_count: int = 0


# ── 전체 종합 대시보드용 스키마 ──


class BizMoneyBalance(BaseModel):
    """비즈머니 잔액."""
    bizmoney: int = 0
    budget_lock: int = 0
    refund: int = 0


class QualityIndexDistribution(BaseModel):
    """품질지수 분포."""
    high: int = 0
    medium: int = 0
    low: int = 0
    total: int = 0


class QualityIndexDetail(BaseModel):
    """키워드별 품질지수."""
    keyword_id: str = ""
    keyword: str = ""
    quality_index: int = 0
    adgroup_id: str = ""
    adgroup_name: str = ""
    campaign_name: str = ""


class QualityIndexSummary(BaseModel):
    """품질지수 요약."""
    distribution: QualityIndexDistribution = QualityIndexDistribution()
    details: List[QualityIndexDetail] = []


class AdCreativeItem(BaseModel):
    """개별 광고 소재."""
    ad_id: str = ""
    adgroup_name: str = ""
    campaign_name: str = ""
    type: str = ""
    status: str = ""
    inspect_status: str = ""
    headline: str = ""
    description: str = ""


class AdCreativesSummary(BaseModel):
    """광고 소재 요약."""
    total: int = 0
    status_counts: Dict[str, int] = {}
    recent_ads: List[AdCreativeItem] = []


class AdExtensionsSummary(BaseModel):
    """확장소재 요약."""
    total: int = 0
    by_type: Dict[str, int] = {}


class KeywordToolResult(BaseModel):
    """키워드 도구 결과."""
    keyword: str = ""
    monthly_pc_qc_cnt: int = 0
    monthly_mobile_qc_cnt: int = 0
    comp_idx: str = ""
    pl_avg_depth: int = 0


class KeywordToolRequest(BaseModel):
    """키워드 도구 요청."""
    keywords: List[str]


class BidSimulationRequest(BaseModel):
    """입찰 시뮬레이션 요청."""
    keyword_id: str
    bid: int
    device: str = "PC"
