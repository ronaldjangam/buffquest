"""Business logic separation for quest claiming operations."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quest import Quest, QuestStatus
from app.schemas.quest import QuestClaimCreate
from app.services.location_service import verify_user_in_zone

async def process_quest_claim(
    db: AsyncSession,
    quest_id: int,
    user_id: str,
    payload: QuestClaimCreate | None
) -> Quest:
    """Validate geofence location and atomically claim the quest."""
    has_coordinates = (
        payload is not None
        and payload.user_lat is not None
        and payload.user_lon is not None
    )

    if has_coordinates:
        stmt_get = select(Quest).where(Quest.id == quest_id)
        result_get = await db.execute(stmt_get)
        target_quest = result_get.scalar_one_or_none()

        if not target_quest:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")

        if target_quest.creator_id == user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot claim your own quest")

        if target_quest.status != QuestStatus.open or target_quest.hunter_id is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Quest is no longer available for claiming")

        await verify_user_in_zone(
            db=db,
            building_zone_id=target_quest.building_zone_id,
            user_lat=payload.user_lat,
            user_lon=payload.user_lon,
            allowed_radius_meters=150.0,
        )

    stmt = (
        update(Quest)
        .where(
            Quest.id == quest_id,
            Quest.status == QuestStatus.open,
            Quest.hunter_id.is_(None),
            Quest.creator_id != user_id,
        )
        .values(
            hunter_id=user_id,
            status=QuestStatus.claimed,
            claimed_at=datetime.now(timezone.utc),
        )
        .returning(Quest)
    )
    
    result = await db.execute(stmt)
    quest = result.scalar_one_or_none()

    if quest is not None:
        return quest

    result_existing = await db.execute(select(Quest).where(Quest.id == quest_id))
    existing_quest = result_existing.scalar_one_or_none()
    if existing_quest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")
    if existing_quest.creator_id == user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot claim your own quest")

    raise HTTPException(
        status.HTTP_409_CONFLICT,
        "Quest is no longer available for claiming",
    )
