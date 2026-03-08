from datetime import datetime
from enum import Enum
from typing import Dict, Optional
from fastapi import HTTPException, status
from pydantic import BaseModel

class QuestStatus(str, Enum):
    open = "open"
    OPEN = "open"
    claimed = "claimed"
    CLAIMED = "claimed"
    completed = "completed"
    COMPLETED = "completed"
    verified = "verified"
    VERIFIED = "verified"
    rewarded = "rewarded"
    REWARDED = "rewarded"
    cancelled = "cancelled"
    CANCELLED = "cancelled"
    expired = "expired"
    EXPIRED = "expired"


class QuestMachineState(BaseModel):
    id: str
    creator_id: str
    title: str
    description: str
    status: QuestStatus = QuestStatus.open
    created_at: datetime
    hunter_id: Optional[str] = None
    claimed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# In-memory dictionary acting as a temporary database for quests
quest_db: Dict[str, QuestMachineState] = {}


def claim_quest(quest_id: str, user_id: str) -> QuestMachineState:
    """
    Claims an open quest for the given user.
    """
    if quest_id not in quest_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest not found")

    quest = quest_db[quest_id]

    if quest.status != QuestStatus.open:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Quest is not open for claiming")

    if quest.creator_id == user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot claim your own quest")

    # Update quest state
    quest.hunter_id = user_id
    quest.status = QuestStatus.claimed
    quest.claimed_at = datetime.utcnow()

    return quest


def complete_quest(quest_id: str, user_id: str) -> QuestMachineState:
    """
    Marks an in-progress quest as pending verification by the assigned hunter.
    """
    if quest_id not in quest_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest not found")

    quest = quest_db[quest_id]

    if quest.status != QuestStatus.claimed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Quest is not claimed")

    if quest.hunter_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the assigned hunter can complete this quest")

    # Update quest state
    quest.status = QuestStatus.completed
    quest.completed_at = datetime.utcnow()

    return quest
