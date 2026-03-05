"""스토어 스키마."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class StoreCreate(BaseModel):
    name: str
    description: str | None = None
    customer_id: str | None = None


class StoreUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class StoreOut(BaseModel):
    id: int
    name: str
    description: str | None
    customer_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
