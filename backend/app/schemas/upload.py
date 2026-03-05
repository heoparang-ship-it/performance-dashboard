"""업로드 스키마."""

from __future__ import annotations

from typing import Dict, List

from pydantic import BaseModel


class UploadResult(BaseModel):
    upload_id: int
    filename: str
    rows_processed: int
    rows_inserted: int
    rows_updated: int
    columns_detected: List[str]
    summary: Dict[str, int | float]
    actions_generated: int
