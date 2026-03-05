"""KPI 계산 서비스."""

from __future__ import annotations

import datetime as dt
from typing import Any, Dict, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.daily_performance import DailyPerformance


def get_daily_summary(
    db: Session,
    store_id: int | None,
    target_date: dt.date,
) -> Dict[str, Any]:
    """특정 날짜의 KPI 요약을 반환."""
    query = db.query(
        func.sum(DailyPerformance.impressions).label("impressions"),
        func.sum(DailyPerformance.clicks).label("clicks"),
        func.sum(DailyPerformance.cost).label("cost"),
        func.sum(DailyPerformance.conversions).label("conversions"),
        func.sum(DailyPerformance.revenue).label("revenue"),
    ).filter(DailyPerformance.date == target_date)

    if store_id is not None:
        query = query.filter(DailyPerformance.store_id == store_id)

    row = query.one()

    impressions = row.impressions or 0
    clicks = row.clicks or 0
    cost = row.cost or 0
    conversions = row.conversions or 0
    revenue = row.revenue or 0

    ctr = (clicks / impressions * 100) if impressions > 0 else 0.0
    roas = (revenue / cost * 100) if cost > 0 else 0.0
    cpa = (cost / conversions) if conversions > 0 else 0
    avg_cpc = (cost / clicks) if clicks > 0 else 0
    aov = (revenue / conversions) if conversions > 0 else 0

    return {
        "date": target_date.isoformat(),
        "impressions": impressions,
        "clicks": clicks,
        "cost": cost,
        "conversions": conversions,
        "revenue": revenue,
        "ctr": round(ctr, 2),
        "roas": round(roas, 1),
        "cpa": int(cpa),
        "avg_cpc": int(avg_cpc),
        "aov": int(aov),
    }


def delta_pct(curr_val: float, prev_val: float) -> float | None:
    """변화율(%) 계산. 이전 값이 0이면 None."""
    if prev_val == 0:
        return None
    return round((curr_val - prev_val) / prev_val * 100, 1)


def get_daily_summary_with_delta(
    db: Session,
    store_id: int | None,
    target_date: dt.date,
) -> Dict[str, Any]:
    """KPI 요약 + 전일 대비 변화율."""
    current = get_daily_summary(db, store_id, target_date)
    prev_date = target_date - dt.timedelta(days=1)
    previous = get_daily_summary(db, store_id, prev_date)

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
    db: Session,
    store_id: int | None,
    start_date: dt.date,
    end_date: dt.date,
) -> List[Dict[str, Any]]:
    """기간별 일별 트렌드 데이터."""
    query = db.query(
        DailyPerformance.date,
        func.sum(DailyPerformance.cost).label("cost"),
        func.sum(DailyPerformance.revenue).label("revenue"),
        func.sum(DailyPerformance.conversions).label("conversions"),
        func.sum(DailyPerformance.clicks).label("clicks"),
        func.sum(DailyPerformance.impressions).label("impressions"),
    ).filter(
        DailyPerformance.date >= start_date,
        DailyPerformance.date <= end_date,
    ).group_by(DailyPerformance.date).order_by(DailyPerformance.date)

    if store_id is not None:
        query = query.filter(DailyPerformance.store_id == store_id)

    results = []
    for row in query.all():
        cost = row.cost or 0
        revenue = row.revenue or 0
        roas = (revenue / cost * 100) if cost > 0 else 0.0
        results.append({
            "date": row.date.isoformat(),
            "cost": cost,
            "revenue": revenue,
            "conversions": row.conversions or 0,
            "clicks": row.clicks or 0,
            "impressions": row.impressions or 0,
            "roas": round(roas, 1),
        })

    return results


def get_campaign_performance(
    db: Session,
    store_id: int | None,
    start_date: dt.date,
    end_date: dt.date,
    sort_by: str = "cost",
    sort_dir: str = "desc",
) -> List[Dict[str, Any]]:
    """캠페인별 성과 집계."""
    query = db.query(
        DailyPerformance.campaign_name,
        func.sum(DailyPerformance.impressions).label("impressions"),
        func.sum(DailyPerformance.clicks).label("clicks"),
        func.sum(DailyPerformance.cost).label("cost"),
        func.sum(DailyPerformance.conversions).label("conversions"),
        func.sum(DailyPerformance.revenue).label("revenue"),
    ).filter(
        DailyPerformance.date >= start_date,
        DailyPerformance.date <= end_date,
    ).group_by(DailyPerformance.campaign_name)

    if store_id is not None:
        query = query.filter(DailyPerformance.store_id == store_id)

    rows = query.all()
    results = []
    for row in rows:
        impressions = row.impressions or 0
        clicks = row.clicks or 0
        cost = row.cost or 0
        conversions = row.conversions or 0
        revenue = row.revenue or 0

        results.append({
            "campaign_name": row.campaign_name or "(미지정)",
            "impressions": impressions,
            "clicks": clicks,
            "cost": cost,
            "conversions": conversions,
            "revenue": revenue,
            "ctr": round((clicks / impressions * 100) if impressions > 0 else 0, 2),
            "roas": round((revenue / cost * 100) if cost > 0 else 0, 1),
            "cpa": int(cost / conversions) if conversions > 0 else 0,
            "avg_cpc": int(cost / clicks) if clicks > 0 else 0,
        })

    reverse = sort_dir == "desc"
    results.sort(key=lambda x: x.get(sort_by, 0) or 0, reverse=reverse)
    return results


def get_adgroup_performance(
    db: Session,
    store_id: int | None,
    campaign_name: str | None,
    start_date: dt.date,
    end_date: dt.date,
) -> List[Dict[str, Any]]:
    """광고그룹별 성과 집계."""
    query = db.query(
        DailyPerformance.campaign_name,
        DailyPerformance.adgroup_name,
        func.sum(DailyPerformance.impressions).label("impressions"),
        func.sum(DailyPerformance.clicks).label("clicks"),
        func.sum(DailyPerformance.cost).label("cost"),
        func.sum(DailyPerformance.conversions).label("conversions"),
        func.sum(DailyPerformance.revenue).label("revenue"),
    ).filter(
        DailyPerformance.date >= start_date,
        DailyPerformance.date <= end_date,
    ).group_by(DailyPerformance.campaign_name, DailyPerformance.adgroup_name)

    if store_id is not None:
        query = query.filter(DailyPerformance.store_id == store_id)
    if campaign_name:
        query = query.filter(DailyPerformance.campaign_name == campaign_name)

    results = []
    for row in query.all():
        impressions = row.impressions or 0
        clicks = row.clicks or 0
        cost = row.cost or 0
        conversions = row.conversions or 0
        revenue = row.revenue or 0

        results.append({
            "campaign_name": row.campaign_name or "(미지정)",
            "adgroup_name": row.adgroup_name or "(미지정)",
            "impressions": impressions,
            "clicks": clicks,
            "cost": cost,
            "conversions": conversions,
            "revenue": revenue,
            "ctr": round((clicks / impressions * 100) if impressions > 0 else 0, 2),
            "roas": round((revenue / cost * 100) if cost > 0 else 0, 1),
            "cpa": int(cost / conversions) if conversions > 0 else 0,
            "avg_cpc": int(cost / clicks) if clicks > 0 else 0,
        })

    results.sort(key=lambda x: x["cost"], reverse=True)
    return results


def get_keyword_performance(
    db: Session,
    store_id: int | None,
    adgroup_name: str | None,
    start_date: dt.date,
    end_date: dt.date,
) -> List[Dict[str, Any]]:
    """키워드별 성과 집계."""
    query = db.query(
        DailyPerformance.campaign_name,
        DailyPerformance.adgroup_name,
        DailyPerformance.keyword_text,
        func.sum(DailyPerformance.impressions).label("impressions"),
        func.sum(DailyPerformance.clicks).label("clicks"),
        func.sum(DailyPerformance.cost).label("cost"),
        func.sum(DailyPerformance.conversions).label("conversions"),
        func.sum(DailyPerformance.revenue).label("revenue"),
    ).filter(
        DailyPerformance.date >= start_date,
        DailyPerformance.date <= end_date,
    ).group_by(
        DailyPerformance.campaign_name,
        DailyPerformance.adgroup_name,
        DailyPerformance.keyword_text,
    )

    if store_id is not None:
        query = query.filter(DailyPerformance.store_id == store_id)
    if adgroup_name:
        query = query.filter(DailyPerformance.adgroup_name == adgroup_name)

    results = []
    for row in query.all():
        impressions = row.impressions or 0
        clicks = row.clicks or 0
        cost = row.cost or 0
        conversions = row.conversions or 0
        revenue = row.revenue or 0

        results.append({
            "campaign_name": row.campaign_name or "(미지정)",
            "adgroup_name": row.adgroup_name or "(미지정)",
            "keyword": row.keyword_text or "(미지정)",
            "impressions": impressions,
            "clicks": clicks,
            "cost": cost,
            "conversions": conversions,
            "revenue": revenue,
            "ctr": round((clicks / impressions * 100) if impressions > 0 else 0, 2),
            "roas": round((revenue / cost * 100) if cost > 0 else 0, 1),
            "cpa": int(cost / conversions) if conversions > 0 else 0,
            "avg_cpc": int(cost / clicks) if clicks > 0 else 0,
        })

    results.sort(key=lambda x: x["cost"], reverse=True)
    return results


def get_campaign_performance_with_delta(
    db: Session,
    store_id: int,
    end_date: dt.date,
    period_days: int = 7,
) -> List[Dict[str, Any]]:
    """캠페인별 성과 + 이전 기간 대비 변화율."""
    current_start = end_date - dt.timedelta(days=period_days - 1)
    prev_end = current_start - dt.timedelta(days=1)
    prev_start = prev_end - dt.timedelta(days=period_days - 1)

    current = get_campaign_performance(db, store_id, current_start, end_date)
    previous = get_campaign_performance(db, store_id, prev_start, prev_end)

    prev_map = {c["campaign_name"]: c for c in previous}

    for camp in current:
        prev = prev_map.get(camp["campaign_name"])
        if prev:
            camp["deltas"] = {
                "cost": delta_pct(camp["cost"], prev["cost"]),
                "clicks": delta_pct(camp["clicks"], prev["clicks"]),
                "ctr": delta_pct(camp["ctr"], prev["ctr"]),
                "roas": delta_pct(camp["roas"], prev["roas"]),
                "conversions": delta_pct(camp["conversions"], prev["conversions"]),
                "revenue": delta_pct(camp["revenue"], prev["revenue"]),
            }
        else:
            camp["deltas"] = None  # 신규 캠페인

    return current


def get_adgroup_performance_with_delta(
    db: Session,
    store_id: int,
    end_date: dt.date,
    campaign_name: str | None = None,
    period_days: int = 7,
) -> List[Dict[str, Any]]:
    """광고그룹별 성과 + 이전 기간 대비 변화율."""
    current_start = end_date - dt.timedelta(days=period_days - 1)
    prev_end = current_start - dt.timedelta(days=1)
    prev_start = prev_end - dt.timedelta(days=period_days - 1)

    current = get_adgroup_performance(db, store_id, campaign_name, current_start, end_date)
    previous = get_adgroup_performance(db, store_id, campaign_name, prev_start, prev_end)

    prev_map = {(ag["campaign_name"], ag["adgroup_name"]): ag for ag in previous}

    for ag in current:
        prev = prev_map.get((ag["campaign_name"], ag["adgroup_name"]))
        if prev:
            ag["deltas"] = {
                "cost": delta_pct(ag["cost"], prev["cost"]),
                "clicks": delta_pct(ag["clicks"], prev["clicks"]),
                "ctr": delta_pct(ag["ctr"], prev["ctr"]),
                "roas": delta_pct(ag["roas"], prev["roas"]),
                "conversions": delta_pct(ag["conversions"], prev["conversions"]),
                "revenue": delta_pct(ag["revenue"], prev["revenue"]),
            }
        else:
            ag["deltas"] = None

    return current


def get_keyword_performance_with_delta(
    db: Session,
    store_id: int,
    end_date: dt.date,
    campaign_name: str | None = None,
    adgroup_name: str | None = None,
    period_days: int = 7,
) -> List[Dict[str, Any]]:
    """키워드별 성과 + 이전 기간 대비 변화율."""
    current_start = end_date - dt.timedelta(days=period_days - 1)
    prev_end = current_start - dt.timedelta(days=1)
    prev_start = prev_end - dt.timedelta(days=period_days - 1)

    current = get_keyword_performance(db, store_id, adgroup_name, current_start, end_date)
    previous = get_keyword_performance(db, store_id, adgroup_name, prev_start, prev_end)

    # campaign filter (keyword_performance doesn't have campaign param, filter manually)
    if campaign_name:
        current = [k for k in current if k["campaign_name"] == campaign_name]
        previous = [k for k in previous if k["campaign_name"] == campaign_name]

    prev_map = {
        (k["campaign_name"], k["adgroup_name"], k["keyword"]): k for k in previous
    }

    for kw in current:
        prev = prev_map.get((kw["campaign_name"], kw["adgroup_name"], kw["keyword"]))
        if prev:
            kw["deltas"] = {
                "cost": delta_pct(kw["cost"], prev["cost"]),
                "clicks": delta_pct(kw["clicks"], prev["clicks"]),
                "ctr": delta_pct(kw["ctr"], prev["ctr"]),
                "roas": delta_pct(kw["roas"], prev["roas"]),
                "conversions": delta_pct(kw["conversions"], prev["conversions"]),
                "revenue": delta_pct(kw["revenue"], prev["revenue"]),
            }
        else:
            kw["deltas"] = None

    return current


def get_store_comparison(
    db: Session,
    start_date: dt.date,
    end_date: dt.date,
) -> List[Dict[str, Any]]:
    """스토어 간 비교 데이터."""
    from ..models.store import Store

    query = db.query(
        DailyPerformance.store_id,
        Store.name.label("store_name"),
        func.sum(DailyPerformance.cost).label("cost"),
        func.sum(DailyPerformance.revenue).label("revenue"),
        func.sum(DailyPerformance.conversions).label("conversions"),
    ).join(Store, Store.id == DailyPerformance.store_id).filter(
        DailyPerformance.date >= start_date,
        DailyPerformance.date <= end_date,
    ).group_by(DailyPerformance.store_id, Store.name)

    results = []
    for row in query.all():
        cost = row.cost or 0
        revenue = row.revenue or 0
        results.append({
            "store_id": row.store_id,
            "store_name": row.store_name,
            "cost": cost,
            "revenue": revenue,
            "conversions": row.conversions or 0,
            "roas": round((revenue / cost * 100) if cost > 0 else 0, 1),
        })

    return results
