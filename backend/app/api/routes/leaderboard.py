"""Leaderboard endpoint - ``/leaderboard``."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.profile import ProfileRead
from app.services.leaderboard_service import get_top_users_service

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


# ------------------------------------------------------------------
# GET /leaderboard
# ------------------------------------------------------------------
@router.get("/", response_model=list[ProfileRead])
async def get_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Return top users ranked by notoriety (descending)."""
    return await get_top_users_service(db, limit, offset)
