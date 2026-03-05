"""기존 analyze_naver_ads.py의 규칙 엔진을 그대로 마이그레이션."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from ..core.column_mapping import safe_get
from ..core.parsers import parse_float


@dataclass
class ActionRecommendation:
    priority: int
    level: str
    campaign: str
    adgroup: str
    keyword: str
    reason: str
    action: str


def evaluate_row(
    row: Dict[str, str],
    mapping: Dict[str, str],
    min_clicks_for_pause: int = 30,
    low_ctr_threshold: float = 1.0,
    low_roas_threshold: float = 200.0,
    high_roas_threshold: float = 400.0,
    high_cpc_threshold: float = 1200.0,
) -> List[ActionRecommendation]:
    """기존 evaluate_row 로직을 그대로 보존."""
    campaign = safe_get(row, mapping, "campaign", "(캠페인 미지정)")
    adgroup = safe_get(row, mapping, "adgroup", "(광고그룹 미지정)")
    keyword = safe_get(row, mapping, "keyword", "(키워드 미지정)")

    impressions = parse_float(safe_get(row, mapping, "impressions", "0"))
    clicks = parse_float(safe_get(row, mapping, "clicks", "0"))
    cost = parse_float(safe_get(row, mapping, "cost", "0"))
    conversions = parse_float(safe_get(row, mapping, "conversions", "0"))
    revenue = parse_float(safe_get(row, mapping, "revenue", "0"))

    ctr = parse_float(safe_get(row, mapping, "ctr", "0"))
    if ctr == 0 and impressions > 0:
        ctr = (clicks / impressions) * 100

    avg_cpc = parse_float(safe_get(row, mapping, "avg_cpc", "0"))
    if avg_cpc == 0 and clicks > 0:
        avg_cpc = cost / clicks

    roas = parse_float(safe_get(row, mapping, "roas", "0"))
    if roas == 0 and cost > 0:
        roas = (revenue / cost) * 100

    actions: List[ActionRecommendation] = []

    # 규칙 1: 클릭 충분 + 전환 0 → 일시중지
    if clicks >= min_clicks_for_pause and conversions <= 0:
        actions.append(
            ActionRecommendation(
                priority=100,
                level="HIGH",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"클릭 {clicks:.0f}회, 전환 0건",
                action="해당 키워드 일시중지 또는 입찰가 20~40% 하향",
            )
        )

    # 규칙 2: 노출 많음 + CTR 낮음 → 문안 재점검
    if impressions >= 500 and ctr < low_ctr_threshold:
        actions.append(
            ActionRecommendation(
                priority=90,
                level="HIGH",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"CTR {ctr:.2f}% (기준 {low_ctr_threshold:.2f}% 미만)",
                action="광고문안/키워드 매칭 재점검, 비관련 검색어 제외",
            )
        )

    # 규칙 3: ROAS 낮음 → 입찰 하향
    if cost >= 30000 and roas > 0 and roas < low_roas_threshold:
        actions.append(
            ActionRecommendation(
                priority=80,
                level="MEDIUM",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"ROAS {roas:.1f}% (목표 {low_roas_threshold:.1f}% 미만)",
                action="입찰가 10~25% 하향, 랜딩/상품 경쟁력 검토",
            )
        )

    # 규칙 4: CPC 높음 + 전환 0 → 품질지수 개선
    if avg_cpc > high_cpc_threshold and conversions <= 0:
        actions.append(
            ActionRecommendation(
                priority=75,
                level="MEDIUM",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"평균 CPC {avg_cpc:.0f}원 (기준 {high_cpc_threshold:.0f}원 초과)",
                action="입찰가 하향 + 품질지수 개선(문안/랜딩 연관성)",
            )
        )

    # 규칙 5: ROAS + 전환 우수 → 확대
    if roas >= high_roas_threshold and conversions >= 2:
        actions.append(
            ActionRecommendation(
                priority=60,
                level="MEDIUM",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"ROAS {roas:.1f}%, 전환 {conversions:.0f}건",
                action="성과 상위 키워드 예산 증액 또는 입찰가 10~15% 상향 테스트",
            )
        )

    # 규칙 6: 데이터 부족 → 확장
    if impressions < 100 and clicks < 3:
        actions.append(
            ActionRecommendation(
                priority=40,
                level="LOW",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"데이터 부족 (노출 {impressions:.0f}, 클릭 {clicks:.0f})",
                action="매칭 확장/유사 키워드 추가 후 데이터 확보",
            )
        )

    return actions
