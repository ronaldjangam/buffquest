"""Quest claim endpoint - ``/quests/{quest_id}/claim``."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.quest import Quest, QuestStatus
from app.schemas.quest import QuestClaimCreate, QuestRead
from app.services.claim_service import process_quest_claim

router = APIRouter(prefix="/quests", tags=["claims"])


# ------------------------------------------------------------------
# POST /quests/{quest_id}/claim
# ------------------------------------------------------------------
@router.post("/{quest_id}/claim", response_model=QuestRead)
async def claim_quest(
    quest_id: int,
    payload: QuestClaimCreate | None = None,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Atomically claim a quest with physical proximity verification.

    Delegates conditional UPDATE prevents to `process_quest_claim` which 
    ensures the hunter is physically within 150m of the building zone
    before granting the quest lock.
    """
    quest = await process_quest_claim(db, quest_id, user_id, payload)
    
    await db.commit()
    await db.refresh(quest)
    return quest
