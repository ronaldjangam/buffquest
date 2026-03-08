"""Quest endpoints - ``/quests/…``."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.building_zone import BuildingZone
from app.models.quest import ModerationStatus, Quest, QuestStatus
from app.schemas.quest import QuestCreate, QuestRead, QuestUpdate
from app.schemas.reward import RewardResult
from app.services.quest_service import (
    cancel_quest_service,
    complete_quest_service,
    create_quest_service,
    update_quest_service,
    verify_quest_service,
)
from app.services.reward_service import issue_reward

router = APIRouter(prefix="/quests", tags=["quests"])


# ------------------------------------------------------------------
# GET /quests
# ------------------------------------------------------------------
@router.get("/", response_model=list[QuestRead])
async def list_quests(
    building_zone_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List quests, optionally filtered by building zone or status."""
    stmt = (
        select(Quest, BuildingZone.name.label("building_name"), BuildingZone.latitude, BuildingZone.longitude)
        .join(BuildingZone, Quest.building_zone_id == BuildingZone.id)
        .where(Quest.moderation_status == ModerationStatus.approved)
    )
    if building_zone_id is not None:
        stmt = stmt.where(Quest.building_zone_id == building_zone_id)
    if status_filter is not None:
        stmt = stmt.where(Quest.status == status_filter)
    stmt = stmt.order_by(Quest.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)

    quests_response = []
    for row in result.all():
        quest, building_name, latitude, longitude = row
        quest_out = QuestRead.model_validate(quest)
        quest_out.building_name = building_name
        quest_out.latitude = latitude
        quest_out.longitude = longitude
        quests_response.append(quest_out)
        
    return quests_response


# ------------------------------------------------------------------
# GET /quests/{quest_id}
# ------------------------------------------------------------------
@router.get("/{quest_id}", response_model=QuestRead)
async def get_quest(
    quest_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single quest by ID."""
    stmt = (
        select(Quest, BuildingZone.name.label("building_name"), BuildingZone.latitude, BuildingZone.longitude)
        .join(BuildingZone, Quest.building_zone_id == BuildingZone.id)
        .where(Quest.id == quest_id)
        .where(Quest.moderation_status == ModerationStatus.approved)
    )
    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")

    quest, building_name, latitude, longitude = row
    quest_out = QuestRead.model_validate(quest)
    quest_out.building_name = building_name
    quest_out.latitude = latitude
    quest_out.longitude = longitude
    return quest_out


# ------------------------------------------------------------------
# POST /quests
# ------------------------------------------------------------------
@router.post("/", response_model=QuestRead, status_code=status.HTTP_201_CREATED)
async def create_quest(
    payload: QuestCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Create a new quest (deducts cost_credits from creator)."""
    quest = await create_quest_service(db, user_id, payload, settings)
    
    await db.commit()
    await db.refresh(quest)
    return quest


# ------------------------------------------------------------------
# PATCH /quests/{quest_id}
# ------------------------------------------------------------------
@router.patch("/{quest_id}", response_model=QuestRead)
async def update_quest(
    quest_id: int,
    payload: QuestUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a quest (only allowed while status is ``open``, creator only)."""
    quest = await update_quest_service(db, quest_id, user_id, payload)
    
    await db.commit()
    await db.refresh(quest)
    return quest


# ------------------------------------------------------------------
# POST /quests/{quest_id}/cancel
# ------------------------------------------------------------------
@router.post("/{quest_id}/cancel", response_model=QuestRead)
async def cancel_quest(
    quest_id: int,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a quest (creator only, must be ``open`` or ``claimed``). Refunds credits."""
    quest = await cancel_quest_service(db, quest_id, user_id)
    
    await db.commit()
    await db.refresh(quest)
    return quest


# ------------------------------------------------------------------
# POST /quests/{quest_id}/complete
# ------------------------------------------------------------------
@router.post("/{quest_id}/complete", response_model=QuestRead)
async def complete_quest(
    quest_id: int,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a quest as completed (hunter only, must be ``claimed``)."""
    quest = await complete_quest_service(db, quest_id, user_id)
    
    await db.commit()
    await db.refresh(quest)
    return quest


# ------------------------------------------------------------------
# POST /quests/{quest_id}/verify
# ------------------------------------------------------------------
@router.post("/{quest_id}/verify", response_model=QuestRead)
async def verify_quest(
    quest_id: int,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a completed quest (creator only, must be ``completed``)."""
    quest = await verify_quest_service(db, quest_id, user_id)
    
    await db.commit()
    await db.refresh(quest)
    return quest


# ------------------------------------------------------------------
# POST /quests/{quest_id}/reward
# ------------------------------------------------------------------
@router.post("/{quest_id}/reward", response_model=RewardResult)
async def reward_quest(
    quest_id: int,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue rewards for a verified quest (creator only).

    Transitions ``VERIFIED → REWARDED`` and awards credits + notoriety
    to the hunter. Can only be called once per quest.
    """
    result = await db.execute(select(Quest).where(Quest.id == quest_id))
    quest = result.scalar_one_or_none()
    if quest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")
    if quest.creator_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the quest creator")

    log = await issue_reward(db, quest)

    await db.commit()
    await db.refresh(quest)

    return RewardResult(
        quest_id=quest.id,
        hunter_id=quest.hunter_id,
        credits_awarded=quest.reward_credits,
        notoriety_awarded=quest.reward_notoriety,
        status=quest.status.value,
    )
