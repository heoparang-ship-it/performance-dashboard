"""네이버 검색광고 API 실시간 데이터 서비스.

동기화(sync) 없이 네이버 API에서 직접 데이터를 가져와
kpi_calculator와 동일한 형식으로 반환합니다.
5분 TTL 인메모리 캐시로 API 호출을 최소화합니다.
"""

from __future__ import annotations

import datetime as dt
import threading
import time
from typing import Any, Dict, List, Tuple

from .naver_api import NaverAdsClient
from .analysis_engine import ActionRecommendation, evaluate_row

# ── 캐시 ──

_cache: Dict[str, Tuple[float, Any]] = {}
_cache_lock = threading.Lock()
_CACHE_TTL = 300  # 5분


def _cache_key(*args) -> str:
    return "|".join(str(a) for a in args)


def _get_cached(key: str) -> Any | None:
    with _cache_lock:
        if key in _cache:
            ts, data = _cache[key]
            if time.time() - ts < _CACHE_TTL:
                return data
            del _cache[key]
    return None


def _set_cached(key: str, data: Any) -> None:
    with _cache_lock:
        _cache[key] = (time.time(), data)


def invalidate_cache(customer_id: str | None = None) -> None:
    """캐시 무효화."""
    with _cache_lock:
        if customer_id is None:
            _cache.clear()
        else:
            keys = [k for k in _cache if customer_id in k]
            for k in keys:
                del _cache[k]


# ── 내부 헬퍼 ──

def _get_structure(client: NaverAdsClient, customer_id: str) -> Dict[str, Any]:
    """캠페인+광고그룹 구조 조회 (캐시)."""
    ck = _cache_key("structure", customer_id)
    cached = _get_cached(ck)
    if cached:
        return cached

    campaigns = client.get_campaigns(customer_id)
    adgroups = client.get_adgroups(customer_id)

    campaign_map: Dict[str, str] = {}
    for c in campaigns:
        campaign_map[c.get("nccCampaignId", "")] = c.get("name", "")

    adgroup_map: Dict[str, Dict[str, str]] = {}
    adgroup_ids: List[str] = []
    for ag in adgroups:
        ag_id = ag.get("nccAdgroupId", "")
        camp_id = ag.get("nccCampaignId", "")
        adgroup_map[ag_id] = {
            "name": ag.get("name", ""),
            "campaign_name": campaign_map.get(camp_id, ""),
            "campaign_id": camp_id,
        }
        if ag_id:
            adgroup_ids.append(ag_id)

    result = {
        "campaigns": campaigns,
        "adgroups": adgroups,
        "campaign_map": campaign_map,
        "adgroup_map": adgroup_map,
        "adgroup_ids": adgroup_ids,
    }
    _set_cached(ck, result)
    return result


def _fetch_aggregated_stats(
    client: NaverAdsClient,
    customer_id: str,
    ids: List[str],
    start_date: str,
    end_date: str,
) -> List[Dict]:
    """allTime 집계 통계 (단일 호출)."""
    if not ids:
        return []
    end_exclusive = (dt.date.fromisoformat(end_date) + dt.timedelta(days=1)).isoformat()
    ck = _cache_key("agg", customer_id, start_date, end_date, hash(tuple(sorted(ids))))
    cached = _get_cached(ck)
    if cached is not None:
        return cached

    try:
        stats = client.get_stats(
            customer_id=customer_id,
            ids=ids,
            start_date=start_date,
            end_date=end_exclusive,
            time_increment="allTime",
        )
        result = stats if isinstance(stats, list) else stats.get("data", []) if isinstance(stats, dict) else []
    except Exception:
        result = []
    _set_cached(ck, result)
    return result


def _fetch_daily_stats(
    client: NaverAdsClient,
    customer_id: str,
    ids: List[str],
    start_date: str,
    end_date: str,
) -> List[Dict]:
    """일별 통계."""
    if not ids:
        return []
    end_exclusive = (dt.date.fromisoformat(end_date) + dt.timedelta(days=1)).isoformat()
    ck = _cache_key("daily", customer_id, start_date, end_date, hash(tuple(sorted(ids))))
    cached = _get_cached(ck)
    if cached is not None:
        return cached

    try:
        stats = client.get_stats(
            customer_id=customer_id,
            ids=ids,
            start_date=start_date,
            end_date=end_exclusive,
            time_increment="daily",
        )
        result = stats if isinstance(stats, list) else stats.get("data", []) if isinstance(stats, dict) else []
    except Exception:
        result = []
    _set_cached(ck, result)
    return result


def _sum_stats(stats: List[Dict]) -> Dict[str, int]:
    """통계 리스트 합산."""
    imp = sum(s.get("impCnt", 0) or 0 for s in stats)
    clk = sum(s.get("clkCnt", 0) or 0 for s in stats)
    cost = sum(s.get("salesAmt", 0) or 0 for s in stats)
    conv = sum(s.get("ccnt", 0) or 0 for s in stats)
    rev = sum(s.get("convAmt", 0) or 0 for s in stats)
    return {"impressions": imp, "clicks": clk, "cost": cost, "conversions": conv, "revenue": rev}


def _calc_kpis(d: Dict[str, int]) -> Dict[str, Any]:
    """기본 메트릭에서 KPI 계산."""
    imp, clk, cost, conv, rev = d["impressions"], d["clicks"], d["cost"], d["conversions"], d["revenue"]
    return {
        **d,
        "ctr": round((clk / imp * 100) if imp > 0 else 0, 2),
        "roas": round((rev / cost * 100) if cost > 0 else 0, 1),
        "cpa": int(cost / conv) if conv > 0 else 0,
        "avg_cpc": int(cost / clk) if clk > 0 else 0,
        "aov": int(rev / conv) if conv > 0 else 0,
    }


def delta_pct(current: float, previous: float) -> float | None:
    """변화율 계산."""
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 1)


def _calc_date_ranges(
    period_days: int, end_date: dt.date
) -> Tuple[dt.date, dt.date, dt.date, dt.date]:
    """기간별 현재/이전 날짜 범위 계산.

    - 7일: 이번주 월요일~오늘 vs 지난주 월~일 (주간 정렬)
    - 14/30일: 롤링 윈도우
    """
    if period_days == 7:
        days_since_monday = end_date.weekday()  # 0=월요일
        this_monday = end_date - dt.timedelta(days=days_since_monday)
        current_start = this_monday
        current_end = end_date
        prev_sunday = this_monday - dt.timedelta(days=1)
        prev_monday = prev_sunday - dt.timedelta(days=6)
        return current_start, current_end, prev_monday, prev_sunday
    else:
        current_start = end_date - dt.timedelta(days=period_days - 1)
        current_end = end_date
        prev_end = current_start - dt.timedelta(days=1)
        prev_start = prev_end - dt.timedelta(days=period_days - 1)
        return current_start, current_end, prev_start, prev_end


# ── 공개 함수: 대시보드 ──

def get_daily_summary_with_delta(
    client: NaverAdsClient,
    customer_id: str,
    target_date: dt.date,
) -> Dict[str, Any]:
    """KPI 요약 + 전일 대비 delta."""
    structure = _get_structure(client, customer_id)
    ag_ids = structure["adgroup_ids"]

    current_stats = _fetch_aggregated_stats(
        client, customer_id, ag_ids,
        target_date.isoformat(), target_date.isoformat(),
    )
    current = _calc_kpis(_sum_stats(current_stats))

    prev_date = target_date - dt.timedelta(days=1)
    prev_stats = _fetch_aggregated_stats(
        client, customer_id, ag_ids,
        prev_date.isoformat(), prev_date.isoformat(),
    )
    previous = _calc_kpis(_sum_stats(prev_stats))

    current["date"] = target_date.isoformat()
    current["deltas"] = {
        "revenue": delta_pct(current["revenue"], previous["revenue"]),
        "cost": delta_pct(current["cost"], previous["cost"]),
        "roas": delta_pct(current["roas"], previous["roas"]),
        "conversions": delta_pct(current["conversions"], previous["conversions"]),
        "clicks": delta_pct(current["clicks"], previous["clicks"]),
        "ctr": delta_pct(current["ctr"], previous["ctr"]),
    }
    return current


def get_trend_data(
    client: NaverAdsClient,
    customer_id: str,
    start_date: dt.date,
    end_date: dt.date,
) -> List[Dict[str, Any]]:
    """일별 트렌드."""
    structure = _get_structure(client, customer_id)
    ag_ids = structure["adgroup_ids"]

    daily = _fetch_daily_stats(
        client, customer_id, ag_ids,
        start_date.isoformat(), end_date.isoformat(),
    )

    by_date: Dict[str, Dict[str, int]] = {}
    for s in daily:
        d = s.get("statDt", "")
        if not d:
            continue
        if d not in by_date:
            by_date[d] = {"impressions": 0, "clicks": 0, "cost": 0, "conversions": 0, "revenue": 0}
        by_date[d]["impressions"] += s.get("impCnt", 0) or 0
        by_date[d]["clicks"] += s.get("clkCnt", 0) or 0
        by_date[d]["cost"] += s.get("salesAmt", 0) or 0
        by_date[d]["conversions"] += s.get("ccnt", 0) or 0
        by_date[d]["revenue"] += s.get("convAmt", 0) or 0

    results = []
    for d in sorted(by_date.keys()):
        data = by_date[d]
        roas = (data["revenue"] / data["cost"] * 100) if data["cost"] > 0 else 0.0
        results.append({
            "date": d,
            "cost": data["cost"],
            "revenue": data["revenue"],
            "conversions": data["conversions"],
            "clicks": data["clicks"],
            "impressions": data["impressions"],
            "roas": round(roas, 1),
        })
    return results


def get_realtime_alerts(
    client: NaverAdsClient,
    customer_id: str,
    target_date: dt.date,
) -> List[Dict[str, Any]]:
    """실시간 알림 생성."""
    structure = _get_structure(client, customer_id)
    ag_ids = structure["adgroup_ids"]
    ag_map = structure["adgroup_map"]

    stats = _fetch_aggregated_stats(
        client, customer_id, ag_ids,
        target_date.isoformat(), target_date.isoformat(),
    )

    alerts: List[Dict[str, Any]] = []
    alert_id = 1
    identity = {k: k for k in ["campaign", "adgroup", "keyword", "impressions", "clicks", "cost", "conversions", "revenue", "ctr", "avg_cpc", "roas"]}

    for s in stats:
        ag_id = s.get("id", "")
        ag_info = ag_map.get(ag_id, {})
        imp = s.get("impCnt", 0) or 0
        clk = s.get("clkCnt", 0) or 0
        cost = s.get("salesAmt", 0) or 0
        conv = s.get("ccnt", 0) or 0
        rev = s.get("convAmt", 0) or 0
        ctr = (clk / imp * 100) if imp > 0 else 0
        avg_cpc = (cost / clk) if clk > 0 else 0
        roas = (rev / cost * 100) if cost > 0 else 0

        row = {
            "campaign": ag_info.get("campaign_name", ""),
            "adgroup": ag_info.get("name", ""),
            "keyword": "",
            "impressions": str(imp), "clicks": str(clk), "cost": str(cost),
            "conversions": str(conv), "revenue": str(rev),
            "ctr": str(ctr), "avg_cpc": str(avg_cpc), "roas": str(roas),
        }

        actions = evaluate_row(row, identity)
        for a in actions:
            alerts.append({
                "id": alert_id,
                "store_id": 0,
                "date": target_date.isoformat(),
                "priority": a.priority,
                "level": a.level,
                "campaign": a.campaign,
                "adgroup": a.adgroup,
                "keyword": a.keyword,
                "reason": a.reason,
                "action": a.action,
                "status": "pending",
                "created_at": dt.datetime.now().isoformat(),
            })
            alert_id += 1

    alerts.sort(key=lambda x: x["priority"], reverse=True)
    return alerts[:10]


# ── 공개 함수: 캠페인 성과 ──

def get_campaign_performance(
    client: NaverAdsClient,
    customer_id: str,
    start_date: dt.date,
    end_date: dt.date,
    sort_by: str = "cost",
    sort_dir: str = "desc",
) -> List[Dict[str, Any]]:
    """캠페인별 집계 성과."""
    structure = _get_structure(client, customer_id)
    ag_ids = structure["adgroup_ids"]
    ag_map = structure["adgroup_map"]

    stats = _fetch_aggregated_stats(
        client, customer_id, ag_ids,
        start_date.isoformat(), end_date.isoformat(),
    )

    by_camp: Dict[str, Dict[str, int]] = {}
    for s in stats:
        ag_id = s.get("id", "")
        camp_name = ag_map.get(ag_id, {}).get("campaign_name", "(미지정)")
        if camp_name not in by_camp:
            by_camp[camp_name] = {"impressions": 0, "clicks": 0, "cost": 0, "conversions": 0, "revenue": 0}
        by_camp[camp_name]["impressions"] += s.get("impCnt", 0) or 0
        by_camp[camp_name]["clicks"] += s.get("clkCnt", 0) or 0
        by_camp[camp_name]["cost"] += s.get("salesAmt", 0) or 0
        by_camp[camp_name]["conversions"] += s.get("ccnt", 0) or 0
        by_camp[camp_name]["revenue"] += s.get("convAmt", 0) or 0

    results = []
    for name, d in by_camp.items():
        kpis = _calc_kpis(d)
        kpis["campaign_name"] = name
        results.append(kpis)

    reverse = sort_dir == "desc"
    results.sort(key=lambda x: x.get(sort_by, 0) or 0, reverse=reverse)
    return results


def get_campaign_performance_with_delta(
    client: NaverAdsClient,
    customer_id: str,
    end_date: dt.date,
    period_days: int = 7,
) -> List[Dict[str, Any]]:
    """캠페인 성과 + 이전 기간 대비 delta."""
    current_start, current_end, prev_start, prev_end = _calc_date_ranges(period_days, end_date)

    current = get_campaign_performance(client, customer_id, current_start, current_end)
    previous = get_campaign_performance(client, customer_id, prev_start, prev_end)

    # 캠페인별 소재명 수집
    structure = _get_structure(client, customer_id)
    ag_map = structure["adgroup_map"]
    camp_ad_names: Dict[str, List[str]] = {}
    for ag_id, info in ag_map.items():
        camp = info.get("campaign_name", "")
        if camp not in camp_ad_names:
            camp_ad_names[camp] = []
        names = _get_ad_names_for_adgroup(client, customer_id, ag_id)
        camp_ad_names[camp].extend(names)

    prev_map = {c["campaign_name"]: c for c in previous}
    for c in current:
        prev = prev_map.get(c["campaign_name"])
        if prev:
            c["deltas"] = {
                "cost": delta_pct(c["cost"], prev["cost"]),
                "clicks": delta_pct(c["clicks"], prev["clicks"]),
                "ctr": delta_pct(c["ctr"], prev["ctr"]),
                "roas": delta_pct(c["roas"], prev["roas"]),
                "conversions": delta_pct(c["conversions"], prev["conversions"]),
                "revenue": delta_pct(c["revenue"], prev["revenue"]),
            }
        else:
            c["deltas"] = None
        ad_names = camp_ad_names.get(c["campaign_name"], [])
        c["recommendation"] = _evaluate_performance_row(c, ad_names if ad_names else None)
    return current


# ── 공개 함수: 광고그룹 성과 ──

def get_adgroup_performance(
    client: NaverAdsClient,
    customer_id: str,
    campaign_name: str | None,
    start_date: dt.date,
    end_date: dt.date,
) -> List[Dict[str, Any]]:
    """광고그룹별 성과."""
    structure = _get_structure(client, customer_id)
    ag_ids = structure["adgroup_ids"]
    ag_map = structure["adgroup_map"]

    stats = _fetch_aggregated_stats(
        client, customer_id, ag_ids,
        start_date.isoformat(), end_date.isoformat(),
    )

    results = []
    for s in stats:
        ag_id = s.get("id", "")
        info = ag_map.get(ag_id, {})
        camp = info.get("campaign_name", "(미지정)")
        if campaign_name and camp != campaign_name:
            continue

        d = {
            "impressions": s.get("impCnt", 0) or 0,
            "clicks": s.get("clkCnt", 0) or 0,
            "cost": s.get("salesAmt", 0) or 0,
            "conversions": s.get("ccnt", 0) or 0,
            "revenue": s.get("convAmt", 0) or 0,
        }
        kpis = _calc_kpis(d)
        kpis["campaign_name"] = camp
        kpis["adgroup_name"] = info.get("name", "(미지정)")
        kpis["adgroup_id"] = ag_id
        results.append(kpis)

    results.sort(key=lambda x: x["cost"], reverse=True)
    return results


def _get_ad_details_for_adgroup(
    client: NaverAdsClient,
    customer_id: str,
    adgroup_id: str,
) -> List[Dict[str, str]]:
    """광고그룹의 소재 상세 (이름 + 카테고리)."""
    if not adgroup_id:
        return []
    ck = _cache_key("ad_details", customer_id, adgroup_id)
    cached = _get_cached(ck)
    if cached is not None:
        return cached
    try:
        ads = client.get_ads(customer_id, adgroup_id)
        if not isinstance(ads, list):
            ads = []
    except Exception:
        ads = []
    details = []
    for ad in ads:
        ref = ad.get("referenceData") or {}
        name = (
            ad.get("headline")
            or (ad.get("ad") or {}).get("headline")
            or ad.get("subject")
            or ref.get("productTitle")
            or ref.get("productName")
            or ""
        )
        category = ref.get("fullMallCatNm", "")
        cat_keywords = set()
        if category:
            for part in category.replace(">", "/").split("/"):
                part = part.strip()
                if part and len(part) >= 2:
                    cat_keywords.add(part.lower())
        details.append({
            "name": name,
            "category": category,
            "cat_keywords": cat_keywords,
            "ad_type": ad.get("type", ""),
        })
    _set_cached(ck, details)
    return details


def _get_ad_names_for_adgroup(
    client: NaverAdsClient,
    customer_id: str,
    adgroup_id: str,
) -> List[str]:
    """광고그룹의 소재(상품)명 목록."""
    details = _get_ad_details_for_adgroup(client, customer_id, adgroup_id)
    return [d["name"] for d in details if d["name"]]


def _analyze_keyword_category_match(
    client: NaverAdsClient,
    customer_id: str,
    adgroup_id: str,
    adgroup_name: str,
) -> Dict[str, Any] | None:
    """키워드(또는 광고그룹명)와 소재 카테고리 매칭 분석.

    Returns dict with:
      - mismatched_ads: 광고그룹명과 카테고리가 불일치하는 소재 목록
      - category_conflict: 같은 그룹 내 서로 다른 카테고리 충돌
      - keyword_mismatch: 키워드와 카테고리가 안 맞는 것들
    """
    if not adgroup_id:
        return None

    ad_details = _get_ad_details_for_adgroup(client, customer_id, adgroup_id)
    if not ad_details:
        return None

    # 키워드 가져오기 (텍스트 광고용)
    kw_list = _get_keywords_for_adgroup(client, customer_id, adgroup_id)
    keywords = [kw.get("keyword", "") for kw in kw_list if kw.get("keyword")]

    issues: List[str] = []

    # 1) 광고그룹명 vs 소재 카테고리 정합성 체크
    ag_name_lower = adgroup_name.lower().strip()
    # 광고그룹명에서 핵심 단어 추출 (숫자, 공백, 기호 제거)
    ag_tokens = set()
    for token in ag_name_lower.replace("_", " ").split():
        token = token.strip()
        if token and len(token) >= 2 and not token.isdigit():
            ag_tokens.add(token)

    if ag_tokens and ad_details:
        for ad in ad_details:
            if not ad["cat_keywords"]:
                continue
            # 광고그룹명 토큰 중 카테고리에 포함되는 것이 있는지 체크
            # 또는 카테고리 키워드 중 광고그룹명에 포함되는 것이 있는지
            name_in_cat = any(
                tok in cat_kw or cat_kw in tok
                for tok in ag_tokens
                for cat_kw in ad["cat_keywords"]
            )
            cat_in_name = any(
                cat_kw in ag_name_lower
                for cat_kw in ad["cat_keywords"]
            )
            product_in_name = any(
                tok in ad["name"].lower()
                for tok in ag_tokens
            )
            if not name_in_cat and not cat_in_name and not product_in_name:
                issues.append(
                    f"'{ad['name']}'의 카테고리({ad['category']})가 "
                    f"광고그룹명 '{adgroup_name}'과 불일치"
                )

    # 2) 같은 광고그룹 내 카테고리 충돌 (최하위 카테고리 기준)
    leaf_categories = set()
    for ad in ad_details:
        if ad["category"]:
            # 마지막 카테고리 (최하위)
            parts = [p.strip() for p in ad["category"].replace(">", "/").split("/") if p.strip()]
            if parts:
                leaf_categories.add(parts[-1])
    if len(leaf_categories) > 1:
        issues.append(
            f"한 광고그룹에 다른 카테고리 소재 혼재: {', '.join(leaf_categories)}"
        )

    # 3) 텍스트 광고: 키워드 vs 소재 카테고리 매칭
    if keywords and ad_details:
        all_cat_keywords = set()
        for ad in ad_details:
            all_cat_keywords.update(ad["cat_keywords"])
        # 소재의 상품명에서도 키워드 추출
        product_tokens = set()
        for ad in ad_details:
            for token in ad["name"].lower().split():
                if len(token) >= 2:
                    product_tokens.add(token)

        mismatched_kws = []
        for kw in keywords:
            kw_lower = kw.lower()
            # 키워드가 카테고리 단어와 일부라도 매칭되는지
            in_cat = any(
                kw_lower in ck or ck in kw_lower
                for ck in all_cat_keywords
            )
            in_product = any(
                kw_lower in pt or pt in kw_lower
                for pt in product_tokens
            )
            if not in_cat and not in_product:
                mismatched_kws.append(kw)
        if mismatched_kws:
            issues.append(
                f"키워드 [{', '.join(mismatched_kws[:5])}]가 "
                f"소재 카테고리와 불일치"
            )

    if not issues:
        return None

    return {
        "issues": issues,
        "issue_count": len(issues),
    }


def _evaluate_performance_row(
    row: Dict[str, Any],
    ad_names: List[str] | None = None,
    category_issues: List[str] | None = None,
) -> Dict[str, str] | None:
    """성과 데이터에 대한 AI 추천 생성 (소재명 + 카테고리 매칭 포함)."""
    clicks = row.get("clicks", 0)
    impressions = row.get("impressions", 0)
    cost = row.get("cost", 0)
    conversions = row.get("conversions", 0)
    revenue = row.get("revenue", 0)
    ctr = row.get("ctr", 0)
    roas = row.get("roas", 0)
    avg_cpc = row.get("avg_cpc", 0)

    # 소재명 텍스트 (있으면 추천에 포함)
    names_str = ""
    if ad_names:
        if len(ad_names) <= 3:
            names_str = ", ".join(f"'{n}'" for n in ad_names)
        else:
            names_str = ", ".join(f"'{n}'" for n in ad_names[:3]) + f" 외 {len(ad_names)-3}개"

    # 카테고리 이슈 텍스트
    cat_suffix = ""
    if category_issues:
        cat_suffix = " | 카테고리 분석: " + "; ".join(category_issues[:2])

    # 우선순위 높은 것부터 체크
    if clicks >= 30 and conversions <= 0:
        action = "일시중지 또는 입찰가 20~40% 하향 권장"
        if names_str:
            action = f"소재 [{names_str}] 점검 필요. {action}"
        return {
            "level": "HIGH",
            "reason": f"클릭 {clicks}회, 전환 0건",
            "action": action + cat_suffix,
        }
    if impressions >= 500 and ctr < 1.0:
        action = "광고문안/키워드 매칭 재점검, 비관련 검색어 제외"
        if names_str:
            action = f"소재 [{names_str}]의 제목/설명 개선 필요. {action}"
        return {
            "level": "HIGH",
            "reason": f"CTR {ctr:.2f}% (기준 1% 미만)",
            "action": action + cat_suffix,
        }
    if cost >= 30000 and roas > 0 and roas < 200:
        action = "입찰가 10~25% 하향, 랜딩/상품 경쟁력 검토"
        if names_str:
            action = f"소재 [{names_str}]의 랜딩페이지/가격 경쟁력 점검. {action}"
        return {
            "level": "MEDIUM",
            "reason": f"ROAS {roas:.1f}% (목표 200% 미만)",
            "action": action + cat_suffix,
        }
    if avg_cpc > 1200 and conversions <= 0:
        action = "입찰가 하향 + 품질지수 개선"
        if names_str:
            action = f"소재 [{names_str}] 품질지수 확인. {action}"
        return {
            "level": "MEDIUM",
            "reason": f"평균 CPC {avg_cpc}원 (기준 초과)",
            "action": action + cat_suffix,
        }
    # 카테고리 이슈만 있는 경우 (성과 지표는 문제없지만 매칭이 안 됨)
    if category_issues:
        return {
            "level": "MEDIUM",
            "reason": f"키워드-카테고리 불일치 ({len(category_issues)}건)",
            "action": "; ".join(category_issues[:3]),
        }
    if roas >= 400 and conversions >= 2:
        action = "예산 증액 또는 입찰가 10~15% 상향 테스트"
        if names_str:
            action = f"소재 [{names_str}] 우수 성과 유지. {action}"
        return {
            "level": "LOW",
            "reason": f"ROAS {roas:.1f}%, 전환 {conversions}건 — 우수 성과",
            "action": action,
        }
    if impressions < 100 and clicks < 3:
        action = "매칭 확장/유사 키워드 추가 후 데이터 확보"
        if names_str:
            action = f"소재 [{names_str}] 노출 부족. {action}"
        return {
            "level": "LOW",
            "reason": f"데이터 부족 (노출 {impressions}, 클릭 {clicks})",
            "action": action,
        }
    return None


def get_adgroup_performance_with_delta(
    client: NaverAdsClient,
    customer_id: str,
    end_date: dt.date,
    campaign_name: str | None = None,
    period_days: int = 7,
) -> List[Dict[str, Any]]:
    """광고그룹 성과 + delta."""
    current_start, current_end, prev_start, prev_end = _calc_date_ranges(period_days, end_date)

    current = get_adgroup_performance(client, customer_id, campaign_name, current_start, current_end)
    previous = get_adgroup_performance(client, customer_id, campaign_name, prev_start, prev_end)

    prev_map = {(a["campaign_name"], a["adgroup_name"]): a for a in previous}
    for a in current:
        prev = prev_map.get((a["campaign_name"], a["adgroup_name"]))
        if prev:
            a["deltas"] = {
                "cost": delta_pct(a["cost"], prev["cost"]),
                "clicks": delta_pct(a["clicks"], prev["clicks"]),
                "ctr": delta_pct(a["ctr"], prev["ctr"]),
                "roas": delta_pct(a["roas"], prev["roas"]),
                "conversions": delta_pct(a["conversions"], prev["conversions"]),
                "revenue": delta_pct(a["revenue"], prev["revenue"]),
            }
        else:
            a["deltas"] = None
        # 소재명 + 카테고리 매칭 분석 후 추천에 포함
        ag_id = a.get("adgroup_id", "")
        ad_names = _get_ad_names_for_adgroup(client, customer_id, ag_id)
        match_result = _analyze_keyword_category_match(
            client, customer_id, ag_id, a.get("adgroup_name", "")
        )
        cat_issues = match_result["issues"] if match_result else None
        a["recommendation"] = _evaluate_performance_row(a, ad_names, cat_issues)
    return current


# ── 공개 함수: 키워드 성과 ──

def _get_keywords_for_adgroup(
    client: NaverAdsClient,
    customer_id: str,
    adgroup_id: str,
) -> List[Dict]:
    """광고그룹의 키워드 목록 (캐시)."""
    ck = _cache_key("keywords", customer_id, adgroup_id)
    cached = _get_cached(ck)
    if cached is not None:
        return cached
    try:
        kws = client.get_keywords(customer_id, adgroup_id)
        result = kws if isinstance(kws, list) else []
    except Exception:
        result = []
    _set_cached(ck, result)
    return result


def get_keyword_performance(
    client: NaverAdsClient,
    customer_id: str,
    adgroup_name: str | None,
    start_date: dt.date,
    end_date: dt.date,
    campaign_name: str | None = None,
) -> List[Dict[str, Any]]:
    """키워드별 성과."""
    structure = _get_structure(client, customer_id)
    ag_map = structure["adgroup_map"]

    # 대상 광고그룹 ID 찾기
    target_ids = []
    for ag_id, info in ag_map.items():
        if adgroup_name and info["name"] != adgroup_name:
            continue
        if campaign_name and info["campaign_name"] != campaign_name:
            continue
        target_ids.append(ag_id)

    results = []
    for ag_id in target_ids:
        info = ag_map[ag_id]
        keywords = _get_keywords_for_adgroup(client, customer_id, ag_id)
        kw_ids = [kw["nccKeywordId"] for kw in keywords if kw.get("nccKeywordId")]
        kw_name_map = {kw["nccKeywordId"]: kw.get("keyword", "") for kw in keywords}

        if not kw_ids:
            continue

        stats = _fetch_aggregated_stats(
            client, customer_id, kw_ids,
            start_date.isoformat(), end_date.isoformat(),
        )

        for s in stats:
            kw_id = s.get("id", "")
            d = {
                "impressions": s.get("impCnt", 0) or 0,
                "clicks": s.get("clkCnt", 0) or 0,
                "cost": s.get("salesAmt", 0) or 0,
                "conversions": s.get("ccnt", 0) or 0,
                "revenue": s.get("convAmt", 0) or 0,
            }
            kpis = _calc_kpis(d)
            kpis["campaign_name"] = info.get("campaign_name", "")
            kpis["adgroup_name"] = info.get("name", "")
            kpis["keyword"] = kw_name_map.get(kw_id, "(미지정)")
            results.append(kpis)

    results.sort(key=lambda x: x["cost"], reverse=True)
    return results


def get_keyword_performance_with_delta(
    client: NaverAdsClient,
    customer_id: str,
    end_date: dt.date,
    campaign_name: str | None = None,
    adgroup_name: str | None = None,
    period_days: int = 7,
) -> List[Dict[str, Any]]:
    """키워드 성과 + delta."""
    current_start, current_end, prev_start, prev_end = _calc_date_ranges(period_days, end_date)

    current = get_keyword_performance(
        client, customer_id, adgroup_name, current_start, current_end, campaign_name,
    )
    previous = get_keyword_performance(
        client, customer_id, adgroup_name, prev_start, prev_end, campaign_name,
    )

    prev_map = {(k["campaign_name"], k["adgroup_name"], k["keyword"]): k for k in previous}
    for k in current:
        prev = prev_map.get((k["campaign_name"], k["adgroup_name"], k["keyword"]))
        if prev:
            k["deltas"] = {
                "cost": delta_pct(k["cost"], prev["cost"]),
                "clicks": delta_pct(k["clicks"], prev["clicks"]),
                "ctr": delta_pct(k["ctr"], prev["ctr"]),
                "roas": delta_pct(k["roas"], prev["roas"]),
                "conversions": delta_pct(k["conversions"], prev["conversions"]),
                "revenue": delta_pct(k["revenue"], prev["revenue"]),
            }
        else:
            k["deltas"] = None
    return current


# ── 공개 함수: 비즈머니 ──

def get_bizmoney_balance(
    client: NaverAdsClient,
    customer_id: str,
) -> Dict[str, Any]:
    """비즈머니 잔액 조회 (캐시)."""
    ck = _cache_key("bizmoney", customer_id)
    cached = _get_cached(ck)
    if cached is not None:
        return cached

    try:
        result = client.get_bizmoney(customer_id)
        if not isinstance(result, dict):
            result = {"bizmoney": 0, "budgetLock": 0, "refund": 0}
    except Exception:
        result = {"bizmoney": 0, "budgetLock": 0, "refund": 0}

    _set_cached(ck, result)
    return result


# ── 공개 함수: 품질지수 ──

def get_quality_index_summary(
    client: NaverAdsClient,
    customer_id: str,
) -> Dict[str, Any]:
    """전체 품질지수 분포 요약."""
    ck = _cache_key("qi_summary", customer_id)
    cached = _get_cached(ck)
    if cached is not None:
        return cached

    structure = _get_structure(client, customer_id)
    ag_ids = structure["adgroup_ids"]
    ag_map = structure["adgroup_map"]

    qi_list: List[Dict] = []
    for ag_id in ag_ids:
        try:
            qi_data = client.get_quality_index(customer_id, ag_id)
            if isinstance(qi_data, list):
                for qi in qi_data:
                    qi["_adgroup_id"] = ag_id
                qi_list.extend(qi_data)
        except Exception:
            continue

    distribution = {"high": 0, "medium": 0, "low": 0, "total": 0}
    details: List[Dict] = []
    for qi in qi_list:
        score = qi.get("qualityIndex", 0) or 0
        distribution["total"] += 1
        if score >= 8:
            distribution["high"] += 1
        elif score >= 4:
            distribution["medium"] += 1
        else:
            distribution["low"] += 1

        ag_id = qi.get("_adgroup_id", "")
        details.append({
            "keyword_id": qi.get("nccKeywordId", ""),
            "keyword": qi.get("keyword", ""),
            "quality_index": score,
            "adgroup_id": ag_id,
            "adgroup_name": ag_map.get(ag_id, {}).get("name", ""),
            "campaign_name": ag_map.get(ag_id, {}).get("campaign_name", ""),
        })

    details.sort(key=lambda x: x["quality_index"])
    result = {"distribution": distribution, "details": details[:50]}
    _set_cached(ck, result)
    return result


# ── 공개 함수: 광고 소재 ──

def get_ad_creatives_summary(
    client: NaverAdsClient,
    customer_id: str,
) -> Dict[str, Any]:
    """광고 소재 현황 요약."""
    ck = _cache_key("ads_summary", customer_id)
    cached = _get_cached(ck)
    if cached is not None:
        return cached

    structure = _get_structure(client, customer_id)
    ag_ids = structure["adgroup_ids"]
    ag_map = structure["adgroup_map"]

    all_ads: List[Dict] = []
    for ag_id in ag_ids:
        try:
            ads = client.get_ads(customer_id, ag_id)
            if isinstance(ads, list):
                for ad in ads:
                    ad["_adgroup_id"] = ag_id
                all_ads.extend(ads)
        except Exception:
            continue

    status_counts: Dict[str, int] = {}
    for ad in all_ads:
        status = ad.get("inspectStatus", ad.get("status", "UNKNOWN"))
        status_counts[status] = status_counts.get(status, 0) + 1

    recent_ads = []
    for ad in all_ads[:20]:
        ag_id = ad.get("_adgroup_id", "")
        recent_ads.append({
            "ad_id": ad.get("nccAdId", ""),
            "adgroup_name": ag_map.get(ag_id, {}).get("name", ""),
            "campaign_name": ag_map.get(ag_id, {}).get("campaign_name", ""),
            "type": ad.get("type", ""),
            "status": ad.get("status", ""),
            "inspect_status": ad.get("inspectStatus", ""),
            "pc_channel_id": ad.get("pcChannelId", ""),
            "mobile_channel_id": ad.get("mobileChannelId", ""),
            "headline": ad.get("headline", ad.get("subject", "")),
            "description": ad.get("description", ""),
        })

    result = {
        "total": len(all_ads),
        "status_counts": status_counts,
        "recent_ads": recent_ads,
    }
    _set_cached(ck, result)
    return result


# ── 공개 함수: 확장소재 ──

def get_ad_extensions_summary(
    client: NaverAdsClient,
    customer_id: str,
) -> Dict[str, Any]:
    """확장소재 현황 요약."""
    ck = _cache_key("extensions_summary", customer_id)
    cached = _get_cached(ck)
    if cached is not None:
        return cached

    try:
        extensions = client.get_ad_extensions(customer_id)
        if not isinstance(extensions, list):
            extensions = []
    except Exception:
        extensions = []

    by_type: Dict[str, int] = {}
    for ext in extensions:
        ext_type = ext.get("type", "UNKNOWN")
        by_type[ext_type] = by_type.get(ext_type, 0) + 1

    result = {
        "total": len(extensions),
        "by_type": by_type,
        "extensions": extensions[:30],
    }
    _set_cached(ck, result)
    return result


# ── 공개 함수: 키워드 도구 ──

def get_keyword_insights(
    client: NaverAdsClient,
    customer_id: str,
    keywords: List[str],
) -> List[Dict[str, Any]]:
    """키워드 도구 결과."""
    sorted_kws = sorted(keywords)
    ck = _cache_key("kw_tool", customer_id, hash(tuple(sorted_kws)))
    cached = _get_cached(ck)
    if cached is not None:
        return cached

    try:
        raw = client.get_keyword_tool(customer_id, keywords)
        if isinstance(raw, dict):
            result = raw.get("keywordList", [])
        elif isinstance(raw, list):
            result = raw
        else:
            result = []
    except Exception:
        result = []

    parsed = []
    for item in result:
        parsed.append({
            "keyword": item.get("relKeyword", ""),
            "monthly_pc_qc_cnt": item.get("monthlyPcQcCnt", 0),
            "monthly_mobile_qc_cnt": item.get("monthlyMobileQcCnt", 0),
            "comp_idx": item.get("compIdx", ""),
            "pl_avg_depth": item.get("plAvgDepth", 0),
        })

    _set_cached(ck, parsed)
    return parsed
