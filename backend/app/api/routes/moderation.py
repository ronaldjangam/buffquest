"""Moderation endpoints - ``/moderation/…``.

The AI moderation pipeline is a placeholder for now. These endpoints
define the contract that integration will fulfill.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.models.quest import ModerationStatus, Quest
from app.schemas.moderation import ModerationResult
from app.services.moderation_service import moderate_quest_content

router = APIRouter(prefix="/moderation", tags=["moderation"])


# ------------------------------------------------------------------
# POST /moderation/review
# ------------------------------------------------------------------
@router.post("/review", response_model=ModerationResult)
async def review_quest(
    quest_id: int,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Submit a quest for moderation review."""
    result = await db.execute(select(Quest).where(Quest.id == quest_id))
    quest = result.scalar_one_or_none()
    if quest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")

    decision = await moderate_quest_content(quest.title, quest.description, settings)
    quest.moderation_status = decision.status
    quest.moderation_reason = decision.reason
    await db.commit()

    return ModerationResult(status=quest.moderation_status, reason=quest.moderation_reason)


# ------------------------------------------------------------------
# GET /moderation/{quest_id}
# ------------------------------------------------------------------
@router.get("/{quest_id}", response_model=ModerationResult)
async def get_moderation_status(
    quest_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get the current moderation status of a quest."""
    result = await db.execute(select(Quest).where(Quest.id == quest_id))
    quest = result.scalar_one_or_none()
    if quest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")

    return ModerationResult(
        status=quest.moderation_status,
        reason=quest.moderation_reason,
    )
