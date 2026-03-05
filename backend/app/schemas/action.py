"""액션 추천 스키마."""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel


class ActionItemOut(BaseModel):
    id: int
    store_id: int
    date: dt.date
    priority: int
    level: str
    campaign: str | None
    adgroup: str | None
    keyword: str | None
    reason: str
    action: str
    status: str
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class ActionStatusUpdate(BaseModel):
    status: str  # "done" | "dismissed"
