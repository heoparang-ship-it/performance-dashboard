"""일별 성과 데이터 모델."""

from __future__ import annotations

import datetime as dt

from sqlalchemy import Date, DateTime, Float, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class DailyPerformance(Base):
    __tablename__ = "daily_performance"
    __table_args__ = (
        UniqueConstraint("store_id", "date", "entity_type", "entity_id", name="uq_store_date_entity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String, nullable=False)  # campaign, adgroup, keyword
    entity_id: Mapped[str] = mapped_column(String, nullable=False)
    campaign_name: Mapped[str | None] = mapped_column(String, nullable=True)
    adgroup_name: Mapped[str | None] = mapped_column(String, nullable=True)
    keyword_text: Mapped[str | None] = mapped_column(String, nullable=True)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    cost: Mapped[int] = mapped_column(Integer, default=0)
    conversions: Mapped[int] = mapped_column(Integer, default=0)
    revenue: Mapped[int] = mapped_column(Integer, default=0)
    data_source: Mapped[str] = mapped_column(String, default="csv")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())
