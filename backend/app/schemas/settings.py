"""설정 스키마."""

from __future__ import annotations

from pydantic import BaseModel


class ThresholdSettings(BaseModel):
    min_clicks_for_pause: int = 30
    low_ctr_threshold: float = 1.0
    low_roas_threshold: float = 200.0
    high_roas_threshold: float = 400.0
    high_cpc_threshold: float = 1200.0
