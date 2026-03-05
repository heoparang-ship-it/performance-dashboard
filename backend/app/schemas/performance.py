"""성과 데이터 스키마."""

from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel


class KpiSummary(BaseModel):
    date: str
    impressions: int
    clicks: int
    cost: int
    conversions: int
    revenue: int
    ctr: float
    roas: float
    cpa: int
    avg_cpc: int
    aov: int
    deltas: Dict[str, float | None] | None = None


class TrendPoint(BaseModel):
    date: str
    cost: int
    revenue: int
    conversions: int
    clicks: int
    impressions: int
    roas: float


class CampaignPerformance(BaseModel):
    campaign_name: str
    impressions: int
    clicks: int
    cost: int
    conversions: int
    revenue: int
    ctr: float
    roas: float
    cpa: int
    avg_cpc: int


class AdgroupPerformance(BaseModel):
    campaign_name: str
    adgroup_name: str
    adgroup_id: str = ""
    impressions: int
    clicks: int
    cost: int
    conversions: int
    revenue: int
    ctr: float
    roas: float
    cpa: int
    avg_cpc: int


class KeywordPerformance(BaseModel):
    campaign_name: str
    adgroup_name: str
    keyword: str
    impressions: int
    clicks: int
    cost: int
    conversions: int
    revenue: int
    ctr: float
    roas: float
    cpa: int
    avg_cpc: int


class PerformanceDeltas(BaseModel):
    cost: float | None = None
    clicks: float | None = None
    ctr: float | None = None
    roas: float | None = None
    conversions: float | None = None
    revenue: float | None = None


class AIRecommendation(BaseModel):
    level: str = ""
    reason: str = ""
    action: str = ""


class CampaignPerfWithDelta(CampaignPerformance):
    deltas: PerformanceDeltas | None = None
    recommendation: AIRecommendation | None = None


class AdgroupPerfWithDelta(AdgroupPerformance):
    deltas: PerformanceDeltas | None = None
    recommendation: AIRecommendation | None = None


class KeywordPerfWithDelta(KeywordPerformance):
    deltas: PerformanceDeltas | None = None


class StoreComparison(BaseModel):
    store_id: int
    store_name: str
    cost: int
    revenue: int
    conversions: int
    roas: float
