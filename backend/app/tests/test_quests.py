from datetime import datetime
import pytest
from fastapi import HTTPException, status

from app.state_machine.quest_state_machine import (
    claim_quest,
    complete_quest,
    quest_db,
    QuestMachineState,
    QuestStatus,
)


@pytest.fixture(autouse=True)
def clear_db():
    """Clear the in-memory database before and after each test."""
    quest_db.clear()
    yield
    quest_db.clear()


@pytest.fixture
def open_quest() -> QuestMachineState:
    quest = QuestMachineState(
        id="q1",
        creator_id="user1",
        title="Get Coffee",
        description="Please get me an iced latte from the UMC",
        status=QuestStatus.OPEN,
        created_at=datetime.utcnow()
    )
    quest_db[quest.id] = quest
    return quest


@pytest.fixture
def claimed_quest() -> QuestMachineState:
    quest = QuestMachineState(
        id="q2",
        creator_id="user1",
        hunter_id="user2",
        title="Get Coffee",
        description="Please get me an iced latte from the UMC",
        status=QuestStatus.CLAIMED,
        created_at=datetime.utcnow(),
        claimed_at=datetime.utcnow()
    )
    quest_db[quest.id] = quest
    return quest


# --- claim_quest tests ---

def test_claim_quest_success(open_quest):
    hunter_id = "user2"
    updated_quest = claim_quest(open_quest.id, hunter_id)
    
    assert updated_quest.hunter_id == hunter_id
    assert updated_quest.status == QuestStatus.CLAIMED
    assert updated_quest.claimed_at is not None
    assert quest_db[open_quest.id] == updated_quest


def test_claim_quest_not_found():
    with pytest.raises(HTTPException) as exc_info:
        claim_quest("nonexistent_id", "user2")
    
    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc_info.value.detail == "Quest not found"


def test_claim_quest_not_open(claimed_quest):
    with pytest.raises(HTTPException) as exc_info:
        claim_quest(claimed_quest.id, "user3")
    
    assert exc_info.value.status_code == status.HTTP_409_CONFLICT
    assert exc_info.value.detail == "Quest is not open for claiming"


def test_claim_quest_self_claim(open_quest):
    with pytest.raises(HTTPException) as exc_info:
        claim_quest(open_quest.id, open_quest.creator_id)
    
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc_info.value.detail == "Cannot claim your own quest"


# --- complete_quest tests ---

def test_complete_quest_success(claimed_quest):
    hunter_id = claimed_quest.hunter_id
    updated_quest = complete_quest(claimed_quest.id, hunter_id)
    
    assert updated_quest.status == QuestStatus.COMPLETED
    assert updated_quest.completed_at is not None
    assert quest_db[claimed_quest.id] == updated_quest


def test_complete_quest_not_found():
    with pytest.raises(HTTPException) as exc_info:
        complete_quest("nonexistent_id", "user2")
    
    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
    assert exc_info.value.detail == "Quest not found"


def test_complete_quest_not_claimed(open_quest):
    with pytest.raises(HTTPException) as exc_info:
        complete_quest(open_quest.id, "user2")
    
    assert exc_info.value.status_code == status.HTTP_409_CONFLICT
    assert exc_info.value.detail == "Quest is not claimed"


def test_complete_quest_wrong_hunter(claimed_quest):
    with pytest.raises(HTTPException) as exc_info:
        complete_quest(claimed_quest.id, "user3")  # user3 is not the assigned hunter user2
    
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc_info.value.detail == "Only the assigned hunter can complete this quest"
