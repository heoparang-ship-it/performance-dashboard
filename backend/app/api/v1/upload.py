"""CSV 업로드 API."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from ...database import get_db
from ...models.store import Store
from ...schemas.upload import UploadResult
from ...services.csv_processor import process_csv

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/csv", response_model=UploadResult)
async def upload_csv(
    file: UploadFile = File(...),
    store_id: int = Query(..., description="업로드 대상 스토어 ID"),
    target_date: date | None = Query(None, description="데이터 날짜 (기본: 오늘)"),
    db: Session = Depends(get_db),
):
    # 스토어 존재 확인
    store = db.query(Store).filter_by(id=store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="스토어를 찾을 수 없습니다.")

    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV 파일만 업로드 가능합니다.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    try:
        result = process_csv(
            db=db,
            store_id=store_id,
            file_content=content,
            filename=file.filename,
            target_date=target_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result
