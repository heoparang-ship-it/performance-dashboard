"""기존 analyze_naver_ads.py에서 추출한 컬럼 매핑 로직."""

from __future__ import annotations

from typing import Dict, List

from .parsers import normalize_header

COLUMN_ALIASES: Dict[str, List[str]] = {
    "campaign": ["campaign", "campaign_name", "캠페인", "캠페인명"],
    "adgroup": ["adgroup", "ad_group", "adgroup_name", "광고그룹", "광고그룹명"],
    "keyword": ["keyword", "키워드"],
    "impressions": ["impressions", "노출수"],
    "clicks": ["clicks", "클릭수"],
    "cost": ["cost", "spend", "광고비", "비용"],
    "conversions": ["conversions", "전환수", "전환"],
    "revenue": ["revenue", "매출", "전환매출"],
    "avg_cpc": ["avg_cpc", "cpc", "평균클릭비용"],
    "ctr": ["ctr", "클릭률"],
    "roas": ["roas"],
    "date": ["date", "날짜", "일자", "기간"],
}


def build_column_map(headers: List[str]) -> Dict[str, str]:
    norm = {normalize_header(h): h for h in headers}
    result: Dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            alias_norm = normalize_header(alias)
            if alias_norm in norm:
                result[canonical] = norm[alias_norm]
                break
    return result


def safe_get(row: Dict[str, str], mapping: Dict[str, str], key: str, default: str = "") -> str:
    real = mapping.get(key)
    if not real:
        return default
    return row.get(real, default)
