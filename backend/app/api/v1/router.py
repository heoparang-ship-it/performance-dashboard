"""V1 API 라우터 통합."""

from __future__ import annotations

from fastapi import APIRouter

from .actions import router as actions_router
from .ai_chat import router as ai_router
from .all_in_one import router as all_in_one_router
from .auth import router as auth_router
from .dashboard import router as dashboard_router
from .naver import router as naver_router
from .performance import router as performance_router
from .settings import router as settings_router
from .stores import router as stores_router
from .upload import router as upload_router

router = APIRouter(prefix="/api/v1")

router.include_router(auth_router)
router.include_router(stores_router)
router.include_router(upload_router)
router.include_router(dashboard_router)
router.include_router(performance_router)
router.include_router(actions_router)
router.include_router(settings_router)
router.include_router(naver_router)
router.include_router(ai_router)
router.include_router(all_in_one_router)
