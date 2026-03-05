"""액션 추천 API."""

from __future__ import annotations

import datetime as dt
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...core.security import get_current_user
from ...database import get_db
from ...models.action_item import ActionItem
from ...models.user import User
from ...schemas.action import ActionItemOut, ActionStatusUpdate

router = APIRouter(prefix="/actions", tags=["actions"])


@router.get("", response_model=List[ActionItemOut])
def list_actions(
    store_id: int | None = Query(None),
    level: str | None = Query(None, description="HIGH, MEDIUM, LOW"),
    status: str | None = Query(None, description="pending, done, dismissed"),
    date: dt.date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ActionItem)

    if store_id is not None:
        query = query.filter(ActionItem.store_id == store_id)
    if level:
        query = query.filter(ActionItem.level == level.upper())
    if status:
        query = query.filter(ActionItem.status == status)
    if date:
        query = query.filter(ActionItem.date == date)

    return query.order_by(ActionItem.priority.desc()).all()


@router.patch("/{action_id}", response_model=ActionItemOut)
def update_action_status(
    action_id: int,
    body: ActionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ActionItem).filter_by(id=action_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="액션을 찾을 수 없습니다.")

    if body.status not in ("done", "dismissed", "pending"):
        raise HTTPException(status_code=400, detail="상태는 pending, done, dismissed 중 하나여야 합니다.")

    item.status = body.status
    db.commit()
    db.refresh(item)
    return item
