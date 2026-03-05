"""액션 추천 모델."""

from __future__ import annotations

import datetime as dt

from sqlalchemy import Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ActionItem(Base):
    __tablename__ = "action_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False)
    level: Mapped[str] = mapped_column(String, nullable=False)  # HIGH, MEDIUM, LOW
    campaign: Mapped[str | None] = mapped_column(String, nullable=True)
    adgroup: Mapped[str | None] = mapped_column(String, nullable=True)
    keyword: Mapped[str | None] = mapped_column(String, nullable=True)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending, done, dismissed
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())
