"""스토어 관리 API."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...database import get_db
from ...models.store import Store
from ...schemas.store import StoreCreate, StoreOut, StoreUpdate

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("", response_model=List[StoreOut])
def list_stores(
    synced_only: bool = Query(False, description="(하위호환) linked_only와 동일"),
    linked_only: bool = Query(False, description="광고주 연결된 스토어만 반환"),
    db: Session = Depends(get_db),
):
    query = db.query(Store)
    if linked_only or synced_only:
        query = query.filter(Store.customer_id.isnot(None))
    return query.order_by(Store.created_at).all()


@router.post("", response_model=StoreOut, status_code=201)
def create_store(body: StoreCreate, db: Session = Depends(get_db)):
    store = Store(name=body.name, description=body.description, customer_id=body.customer_id)
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.post("/link-customer", response_model=StoreOut)
def link_customer_store(body: StoreCreate, db: Session = Depends(get_db)):
    """광고주 customer_id로 스토어 찾거나 생성."""
    if not body.customer_id:
        raise HTTPException(status_code=400, detail="customer_id가 필요합니다.")

    existing = db.query(Store).filter_by(customer_id=body.customer_id).first()
    if existing:
        existing.name = body.name
        db.commit()
        db.refresh(existing)
        return existing

    store = Store(name=body.name, customer_id=body.customer_id)
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.get("/{store_id}", response_model=StoreOut)
def get_store(store_id: int, db: Session = Depends(get_db)):
    store = db.query(Store).filter_by(id=store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="스토어를 찾을 수 없습니다.")
    return store


@router.put("/{store_id}", response_model=StoreOut)
def update_store(store_id: int, body: StoreUpdate, db: Session = Depends(get_db)):
    store = db.query(Store).filter_by(id=store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="스토어를 찾을 수 없습니다.")
    if body.name is not None:
        store.name = body.name
    if body.description is not None:
        store.description = body.description
    db.commit()
    db.refresh(store)
    return store


@router.delete("/{store_id}", status_code=204)
def delete_store(store_id: int, db: Session = Depends(get_db)):
    store = db.query(Store).filter_by(id=store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="스토어를 찾을 수 없습니다.")
    db.delete(store)
    db.commit()
