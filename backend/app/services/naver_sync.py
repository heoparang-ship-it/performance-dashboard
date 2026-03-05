"""네이버 API 데이터 → DB 동기화 서비스."""

from __future__ import annotations

import datetime as dt
import hashlib
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from ..models.daily_performance import DailyPerformance
from ..models.action_item import ActionItem
from ..services.analysis_engine import evaluate_row
from ..services.naver_api import NaverAdsClient


def sync_naver_data(
    db: Session,
    client: NaverAdsClient,
    customer_id: str,
    store_id: int,
    start_date: str,
    end_date: str,
) -> Dict[str, Any]:
    """네이버 API에서 데이터를 가져와 DB에 저장.

    광고그룹 레벨 일별 통계를 수집합니다.
    """
    # 1. 전체 데이터 수집
    data = client.sync_all_data(customer_id, start_date, end_date)

    # 광고그룹 → 캠페인 이름 매핑
    adgroup_info = {}
    for ag in data["adgroups"]:
        agid = ag.get("nccAdgroupId", "")
        adgroup_info[agid] = {
            "adgroup_name": ag.get("name", ""),
            "campaign_name": ag.get("_campaign_name", ""),
        }

    # 2. 통계 데이터를 DB에 저장
    rows_saved = 0
    for stat in data["stats"]:
        stat_id = stat.get("id", "")

        # 광고그룹 ID로 이름 매핑
        ag_info = adgroup_info.get(stat_id, {})
        campaign_name = ag_info.get("campaign_name", "")
        adgroup_name = ag_info.get("adgroup_name", "")

        # 일별 데이터 (_date 는 sync_all_data에서 주입한 날짜)
        stat_date_str = stat.get("_date") or stat.get("statDt")
        if stat_date_str:
            try:
                stat_date = dt.date.fromisoformat(stat_date_str)
            except (ValueError, TypeError):
                continue
        else:
            continue  # 날짜 없는 데이터는 건너뛰기

        impressions = stat.get("impCnt", 0) or 0
        clicks = stat.get("clkCnt", 0) or 0
        cost = stat.get("salesAmt", 0) or 0  # salesAmt = 광고비
        conversions = stat.get("ccnt", 0) or 0
        revenue = stat.get("convAmt", 0) or 0  # convAmt = 전환매출

        # 노출/클릭이 모두 0이면 건너뛰기
        if impressions == 0 and clicks == 0 and cost == 0:
            continue

        # entity_id 생성
        entity_id = hashlib.md5(
            f"{campaign_name}|{adgroup_name}".encode()
        ).hexdigest()[:12]

        # upsert
        existing = db.query(DailyPerformance).filter_by(
            store_id=store_id,
            date=stat_date,
            entity_type="adgroup",
            entity_id=entity_id,
        ).first()

        if existing:
            existing.impressions = impressions
            existing.clicks = clicks
            existing.cost = cost
            existing.conversions = conversions
            existing.revenue = revenue
            existing.campaign_name = campaign_name
            existing.adgroup_name = adgroup_name
            existing.data_source = "naver_api"
        else:
            record = DailyPerformance(
                store_id=store_id,
                date=stat_date,
                entity_type="adgroup",
                entity_id=entity_id,
                campaign_name=campaign_name,
                adgroup_name=adgroup_name,
                keyword_text=None,
                impressions=impressions,
                clicks=clicks,
                cost=cost,
                conversions=conversions,
                revenue=revenue,
                data_source="naver_api",
            )
            db.add(record)

        rows_saved += 1

    db.flush()

    # 3. 액션 추천 재생성
    _regenerate_actions(db, store_id, start_date, end_date)

    db.commit()

    return {
        "success": True,
        "campaigns_count": data["summary"]["campaigns_count"],
        "adgroups_count": data["summary"]["adgroups_count"],
        "keywords_count": data["summary"]["keywords_count"],
        "stats_rows_saved": rows_saved,
    }


def _regenerate_actions(
    db: Session,
    store_id: int,
    start_date: str,
    end_date: str,
) -> None:
    """동기화된 데이터 기반으로 액션 추천 재생성."""
    sd = dt.date.fromisoformat(start_date)
    ed = dt.date.fromisoformat(end_date)

    # 기존 API 소스 액션 삭제
    db.query(ActionItem).filter(
        ActionItem.store_id == store_id,
        ActionItem.date >= sd,
        ActionItem.date <= ed,
    ).delete()

    rows = db.query(DailyPerformance).filter(
        DailyPerformance.store_id == store_id,
        DailyPerformance.date >= sd,
        DailyPerformance.date <= ed,
    ).all()

    # API 데이터는 이미 표준 키를 사용하므로 identity 매핑
    identity_mapping = {
        "campaign": "campaign",
        "adgroup": "adgroup",
        "keyword": "keyword",
        "impressions": "impressions",
        "clicks": "clicks",
        "cost": "cost",
        "conversions": "conversions",
        "revenue": "revenue",
        "ctr": "ctr",
        "avg_cpc": "avg_cpc",
        "roas": "roas",
    }

    for row in rows:
        ctr = (row.clicks / row.impressions * 100) if row.impressions > 0 else 0
        avg_cpc = (row.cost / row.clicks) if row.clicks > 0 else 0
        roas = (row.revenue / row.cost * 100) if row.cost > 0 else 0

        row_data = {
            "campaign": row.campaign_name or "",
            "adgroup": row.adgroup_name or "",
            "keyword": row.keyword_text or "",
            "impressions": str(row.impressions),
            "clicks": str(row.clicks),
            "cost": str(row.cost),
            "conversions": str(row.conversions),
            "revenue": str(row.revenue),
            "ctr": str(ctr),
            "avg_cpc": str(avg_cpc),
            "roas": str(roas),
        }

        actions = evaluate_row(row_data, identity_mapping)

        for action in actions:
            item = ActionItem(
                store_id=store_id,
                date=row.date,
                priority=action.priority,
                level=action.level,
                campaign=row.campaign_name,
                adgroup=row.adgroup_name,
                keyword=row.keyword_text,
                reason=action.reason,
                action=action.action,
            )
            db.add(item)
