"""인증 스키마."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "staff"  # "admin" | "staff"


class UserUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    password: str | None = None
