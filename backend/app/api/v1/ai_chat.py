"""엑스컴AI 채팅 엔드포인트 - Claude Sonnet 4.6 연동."""

from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...core.security import get_current_user
from ...database import get_db
from ...models.setting import Setting
from ...models.user import User

router = APIRouter(prefix="/ai", tags=["ai"])

CLAUDE_API_KEY_SETTING = "claude_api_key"


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = None  # 현재 대시보드 데이터 요약


class ChatResponse(BaseModel):
    reply: str


class ApiKeyRequest(BaseModel):
    api_key: str


@router.get("/api-key-status")
def get_api_key_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Claude API 키 설정 상태."""
    setting = db.query(Setting).filter_by(key=CLAUDE_API_KEY_SETTING).first()
    if not setting:
        return {"is_configured": False, "masked_key": ""}
    key = setting.value
    masked = key[:8] + "****" + key[-4:] if len(key) > 12 else "****"
    return {"is_configured": True, "masked_key": masked}


@router.post("/api-key")
def save_api_key(body: ApiKeyRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Claude API 키 저장."""
    setting = db.query(Setting).filter_by(key=CLAUDE_API_KEY_SETTING).first()
    if setting:
        setting.value = body.api_key
    else:
        setting = Setting(key=CLAUDE_API_KEY_SETTING, value=body.api_key)
        db.add(setting)
    db.commit()
    return {"success": True, "message": "API 키가 저장되었습니다."}


@router.delete("/api-key")
def delete_api_key(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Claude API 키 삭제."""
    db.query(Setting).filter_by(key=CLAUDE_API_KEY_SETTING).delete()
    db.commit()
    return {"success": True}


SYSTEM_PROMPT = """당신은 '엑스컴AI'입니다. 10년차 퍼포먼스 마케터 전문 AI 어시스턴트입니다.

역할:
- 네이버 검색광고 성과 분석 전문가
- 퍼포먼스 마케팅 전략 수립 및 최적화 조언
- ROAS, CTR, CPC, CPA 등 핵심 지표 분석
- 광고 소재, 키워드, 입찰가 최적화 추천
- 예산 배분 및 스케일링 전략 제안

대화 스타일:
- 한국어로 답변
- 구체적인 수치와 함께 실행 가능한 조언 제공
- 업계 베스트 프랙티스 기반 추천
- 필요시 표나 구조화된 형태로 정리
- 간결하지만 핵심을 놓치지 않는 답변

현재 관리 중인 광고주의 데이터를 기반으로 질문에 답변합니다.
"""


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """엑스컴AI 채팅."""
    import requests

    setting = db.query(Setting).filter_by(key=CLAUDE_API_KEY_SETTING).first()
    if not setting:
        raise HTTPException(status_code=400, detail="Claude API 키가 설정되지 않았습니다. 설정 페이지에서 API 키를 입력해주세요.")

    api_key = setting.value

    # 메시지 구성
    messages = []
    for msg in body.messages:
        messages.append({"role": msg.role, "content": msg.content})

    # 시스템 프롬프트에 컨텍스트 추가
    system = SYSTEM_PROMPT
    if body.context:
        system += f"\n\n현재 대시보드 데이터:\n{body.context}"

    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 2048,
                "system": system,
                "messages": messages,
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()

        reply = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                reply += block["text"]

        return ChatResponse(reply=reply)
    except requests.exceptions.HTTPError as e:
        error_detail = e.response.text if e.response else str(e)
        raise HTTPException(status_code=502, detail=f"Claude API 오류: {error_detail}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 채팅 오류: {str(e)}")
