"""Business logic orchestration for all Quest operations (Creation, Updates, Status)."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.quest import ModerationStatus, Quest, QuestStatus
from app.schemas.quest import QuestCreate, QuestUpdate
from app.services.moderation_service import moderate_quest_content
from app.services.reward_service import deduct_quest_cost, refund_quest

async def create_quest_service(
    db: AsyncSession,
    user_id: str,
    payload: QuestCreate,
    settings: Settings,
) -> Quest:
    """Create a new quest and deduct cost_credits from the creator."""
    moderation = await moderate_quest_content(payload.title, payload.description, settings)
    if moderation.status == ModerationStatus.rejected:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            moderation.reason or "Quest rejected by moderation.",
        )

    quest = Quest(
        creator_id=user_id,
        title=payload.title,
        description=payload.description,
        building_zone_id=payload.building_zone_id,
        cost_credits=payload.cost_credits,
        reward_credits=payload.reward_credits,
        reward_notoriety=payload.reward_notoriety,
        expires_at=payload.expires_at,
        status=QuestStatus.open,
        moderation_status=moderation.status,
        moderation_reason=moderation.reason,
    )
    db.add(quest)
    await db.flush()  # get quest.id before logging

    if quest.cost_credits > 0:
        await deduct_quest_cost(db, user_id, quest)

    return quest

async def update_quest_service(
    db: AsyncSession,
    quest_id: int,
    user_id: str,
    payload: QuestUpdate
) -> Quest:
    """Update a quest if still open and owned by creator."""
    result = await db.execute(select(Quest).where(Quest.id == quest_id))
    quest = result.scalar_one_or_none()
    
    if quest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")
    if quest.creator_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the quest creator")
    if quest.status != QuestStatus.open:
        raise HTTPException(status.HTTP_409_CONFLICT, "Quest is no longer open")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(quest, field, value)

    return quest

async def cancel_quest_service(
    db: AsyncSession,
    quest_id: int,
    user_id: str
) -> Quest:
    """Cancel a quest and refund cost_credits if allowed."""
    result = await db.execute(select(Quest).where(Quest.id == quest_id))
    quest = result.scalar_one_or_none()
    
    if quest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")
    if quest.creator_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the quest creator")
    if quest.status not in (QuestStatus.open, QuestStatus.claimed):
        raise HTTPException(status.HTTP_409_CONFLICT, "Quest cannot be cancelled in its current state")

    quest.status = QuestStatus.cancelled
    await refund_quest(db, quest)

    return quest

async def complete_quest_service(
    db: AsyncSession,
    quest_id: int,
    user_id: str
) -> Quest:
    """Mark a claimed quest as completed by the hunter."""
    result = await db.execute(select(Quest).where(Quest.id == quest_id))
    quest = result.scalar_one_or_none()
    
    if quest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")
    if quest.hunter_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the quest hunter")
    if quest.status != QuestStatus.claimed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Quest is not currently claimed")

    quest.status = QuestStatus.completed
    quest.completed_at = datetime.now(timezone.utc)
    return quest

async def verify_quest_service(
    db: AsyncSession,
    quest_id: int,
    user_id: str
) -> Quest:
    """Mark a completed quest as verified by the creator."""
    result = await db.execute(select(Quest).where(Quest.id == quest_id))
    quest = result.scalar_one_or_none()
    
    if quest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")
    if quest.creator_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the quest creator")
    if quest.status != QuestStatus.completed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Quest is not in completed state")

    quest.status = QuestStatus.verified
    quest.verified_at = datetime.now(timezone.utc)
    return quest
