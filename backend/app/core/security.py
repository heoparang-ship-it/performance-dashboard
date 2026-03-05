"""인증/보안 유틸리티."""

from __future__ import annotations

import datetime as dt

import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from ..config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from ..database import get_db
from ..models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_scheme = HTTPBearer(auto_error=True)


def hash_password(password: str) -> str:
    """비밀번호를 bcrypt로 해싱."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """비밀번호 검증."""
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, email: str, role: str) -> str:
    """JWT 액세스 토큰 생성."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": dt.datetime.utcnow() + dt.timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": dt.datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """JWT 토큰 디코딩."""
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="토큰이 만료되었습니다.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """JWT Bearer 토큰으로 현재 사용자 조회. 모든 보호 엔드포인트에서 Depends()로 사용."""
    payload = decode_token(credentials.credentials)
    user_id = int(payload["sub"])
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """master 또는 admin 역할만 허용."""
    if current_user.role not in ("master", "admin"):
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    return current_user
