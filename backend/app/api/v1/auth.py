"""인증 API."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from ...database import get_db
from ...models.user import User
from ...schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """이메일/비밀번호로 로그인, JWT 토큰 반환."""
    user = db.query(User).filter_by(email=body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다."
        )
    token = create_access_token(user.id, user.email, user.role)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인된 사용자 정보."""
    return current_user


@router.get("/users", response_model=List[UserOut])
def list_users(
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """모든 사용자 목록 (관리자 전용)."""
    return db.query(User).order_by(User.created_at).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """새 사용자 생성 (관리자 전용)."""
    if body.role not in ("admin", "staff"):
        raise HTTPException(
            status_code=400, detail="역할은 'admin' 또는 'staff'만 가능합니다."
        )
    existing = db.query(User).filter_by(email=body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 이메일입니다.")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        name=body.name,
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """사용자 정보 수정 (관리자 전용)."""
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if user.role == "master":
        raise HTTPException(status_code=403, detail="마스터 계정은 수정할 수 없습니다.")
    if body.name is not None:
        user.name = body.name
    if body.role is not None:
        if body.role not in ("admin", "staff"):
            raise HTTPException(
                status_code=400, detail="역할은 'admin' 또는 'staff'만 가능합니다."
            )
        user.role = body.role
    if body.password is not None:
        user.hashed_password = hash_password(body.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """사용자 삭제 (관리자 전용, 마스터 제외)."""
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if user.role == "master":
        raise HTTPException(status_code=403, detail="마스터 계정은 삭제할 수 없습니다.")
    db.delete(user)
    db.commit()
