"""설정 API."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...config import DEFAULT_THRESHOLDS
from ...core.security import get_current_user
from ...database import get_db
from ...models.setting import Setting
from ...models.user import User
from ...schemas.settings import ThresholdSettings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/thresholds", response_model=ThresholdSettings)
def get_thresholds(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    setting = db.query(Setting).filter_by(key="thresholds").first()
    if setting:
        data = json.loads(setting.value)
        return ThresholdSettings(**data)
    return ThresholdSettings(**DEFAULT_THRESHOLDS)


@router.put("/thresholds", response_model=ThresholdSettings)
def update_thresholds(body: ThresholdSettings, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    setting = db.query(Setting).filter_by(key="thresholds").first()
    value = json.dumps(body.model_dump())

    if setting:
        setting.value = value
    else:
        setting = Setting(key="thresholds", value=value)
        db.add(setting)

    db.commit()
    return body
