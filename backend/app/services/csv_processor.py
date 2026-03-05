"""CSV 업로드 처리 서비스."""

from __future__ import annotations

import csv
import hashlib
import io
from datetime import date
from typing import Dict, List, Tuple

from sqlalchemy.orm import Session

from ..core.column_mapping import build_column_map, safe_get
from ..core.parsers import parse_float
from ..models.action_item import ActionItem
from ..models.daily_performance import DailyPerformance
from ..models.upload import Upload
from .analysis_engine import ActionRecommendation, evaluate_row


def _generate_entity_id(campaign: str, adgroup: str, keyword: str) -> str:
    """캠페인+광고그룹+키워드 조합으로 고유 ID 생성."""
    raw = f"{campaign}|{adgroup}|{keyword}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def process_csv(
    db: Session,
    store_id: int,
    file_content: bytes,
    filename: str,
    target_date: date | None = None,
    thresholds: Dict[str, float] | None = None,
) -> Dict:
    """CSV를 파싱하여 DB에 저장하고 액션을 생성한다."""
    if target_date is None:
        target_date = date.today()

    if thresholds is None:
        from ..config import DEFAULT_THRESHOLDS
        thresholds = DEFAULT_THRESHOLDS

    # CSV 파싱
    text = file_content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        raise ValueError("CSV 헤더를 찾을 수 없습니다.")

    mapping = build_column_map(list(reader.fieldnames))

    required = ["impressions", "clicks", "cost", "conversions"]
    missing = [k for k in required if k not in mapping]
    if missing:
        raise ValueError(f"필수 컬럼 누락: {', '.join(missing)}")

    rows_processed = 0
    rows_inserted = 0
    total_cost = 0
    total_revenue = 0
    total_conversions = 0
    all_actions: List[ActionRecommendation] = []

    for row in reader:
        rows_processed += 1

        campaign = safe_get(row, mapping, "campaign", "(캠페인 미지정)")
        adgroup = safe_get(row, mapping, "adgroup", "(광고그룹 미지정)")
        keyword = safe_get(row, mapping, "keyword", "(키워드 미지정)")
        entity_id = _generate_entity_id(campaign, adgroup, keyword)

        impressions = int(parse_float(safe_get(row, mapping, "impressions", "0")))
        clicks = int(parse_float(safe_get(row, mapping, "clicks", "0")))
        cost = int(parse_float(safe_get(row, mapping, "cost", "0")))
        conversions = int(parse_float(safe_get(row, mapping, "conversions", "0")))
        revenue = int(parse_float(safe_get(row, mapping, "revenue", "0")))

        total_cost += cost
        total_revenue += revenue
        total_conversions += conversions

        # date 컬럼이 있으면 사용, 없으면 target_date 사용
        row_date_str = safe_get(row, mapping, "date", "")
        if row_date_str:
            try:
                from datetime import datetime
                for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d"):
                    try:
                        row_date = datetime.strptime(row_date_str.strip(), fmt).date()
                        break
                    except ValueError:
                        continue
                else:
                    row_date = target_date
            except Exception:
                row_date = target_date
        else:
            row_date = target_date

        # UPSERT: 기존 데이터가 있으면 업데이트
        existing = db.query(DailyPerformance).filter_by(
            store_id=store_id,
            date=row_date,
            entity_type="keyword",
            entity_id=entity_id,
        ).first()

        if existing:
            existing.impressions = impressions
            existing.clicks = clicks
            existing.cost = cost
            existing.conversions = conversions
            existing.revenue = revenue
            existing.campaign_name = campaign
            existing.adgroup_name = adgroup
            existing.keyword_text = keyword
        else:
            perf = DailyPerformance(
                store_id=store_id,
                date=row_date,
                entity_type="keyword",
                entity_id=entity_id,
                campaign_name=campaign,
                adgroup_name=adgroup,
                keyword_text=keyword,
                impressions=impressions,
                clicks=clicks,
                cost=cost,
                conversions=conversions,
                revenue=revenue,
                data_source="csv",
            )
            db.add(perf)
            rows_inserted += 1

        # 규칙 엔진 실행
        actions = evaluate_row(
            row=row,
            mapping=mapping,
            min_clicks_for_pause=int(thresholds.get("min_clicks_for_pause", 30)),
            low_ctr_threshold=float(thresholds.get("low_ctr_threshold", 1.0)),
            low_roas_threshold=float(thresholds.get("low_roas_threshold", 200.0)),
            high_roas_threshold=float(thresholds.get("high_roas_threshold", 400.0)),
            high_cpc_threshold=float(thresholds.get("high_cpc_threshold", 1200.0)),
        )
        all_actions.extend(actions)

    # 액션 아이템 저장 (기존 해당 날짜 데이터 삭제 후 재생성)
    db.query(ActionItem).filter_by(store_id=store_id, date=target_date).delete()

    for a in all_actions:
        item = ActionItem(
            store_id=store_id,
            date=target_date,
            priority=a.priority,
            level=a.level,
            campaign=a.campaign,
            adgroup=a.adgroup,
            keyword=a.keyword,
            reason=a.reason,
            action=a.action,
            status="pending",
        )
        db.add(item)

    # 업로드 이력 저장
    upload_record = Upload(
        store_id=store_id,
        filename=filename,
        row_count=rows_processed,
    )
    db.add(upload_record)

    db.commit()

    overall_roas = (total_revenue / total_cost * 100) if total_cost > 0 else 0.0

    return {
        "upload_id": upload_record.id,
        "filename": filename,
        "rows_processed": rows_processed,
        "rows_inserted": rows_inserted,
        "rows_updated": rows_processed - rows_inserted,
        "columns_detected": list(mapping.keys()),
        "summary": {
            "total_cost": total_cost,
            "total_revenue": total_revenue,
            "total_conversions": total_conversions,
            "roas": round(overall_roas, 1),
        },
        "actions_generated": len(all_actions),
    }
