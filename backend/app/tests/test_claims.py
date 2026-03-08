"""Tests for ``POST /api/quests/{quest_id}/claim``."""

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.models.quest import Quest, QuestStatus

from .conftest import MOCK_USER_ID, OTHER_USER_ID

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_quest(
    quest_id: int = 1,
    creator_id: str = OTHER_USER_ID,
    hunter_id: str | None = None,
    status: QuestStatus = QuestStatus.OPEN,
) -> MagicMock:
    """Return a mock Quest row."""
    q = MagicMock(spec=Quest)
    q.id = quest_id
    q.creator_id = creator_id
    q.hunter_id = hunter_id
    q.status = status
    q.title = "Test Quest"
    q.description = "A test quest description"
    q.building_zone_id = 1
    q.cost_credits = 0
    q.reward_credits = 10
    q.reward_notoriety = 5
    q.moderation_status = "pending"
    q.moderation_reason = None
    q.created_at = datetime.now(timezone.utc)
    q.updated_at = datetime.now(timezone.utc)
    q.claimed_at = None
    q.completed_at = None
    q.verified_at = None
    q.rewarded_at = None
    q.expires_at = None
    return q


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_claim_quest_success(mock_user, mock_db, client):
    """Claiming an open quest by a non-creator succeeds."""
    quest = _make_quest(creator_id=OTHER_USER_ID, status=QuestStatus.OPEN)

    # First execute (the UPDATE ... RETURNING) returns the quest
    updated_quest = _make_quest(
        creator_id=OTHER_USER_ID,
        hunter_id=MOCK_USER_ID,
        status=QuestStatus.CLAIMED,
    )
    updated_quest.claimed_at = datetime.now(timezone.utc)

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = updated_quest
    mock_db.execute.return_value = result_mock

    resp = await client.post("/api/quests/1/claim")
    assert resp.status_code == 200


async def test_claim_quest_not_found(mock_user, mock_db, client):
    """Claiming a nonexistent quest returns 404."""
    # UPDATE returns None (no rows matched)
    update_result = MagicMock()
    update_result.scalar_one_or_none.return_value = None

    # SELECT also returns None (quest doesn't exist)
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = None

    mock_db.execute.side_effect = [update_result, select_result]

    resp = await client.post("/api/quests/999/claim")
    assert resp.status_code == 404


async def test_claim_own_quest(mock_user, mock_db, client):
    """Cannot claim a quest you created — returns 403."""
    # UPDATE returns None (creator_id != user_id guard failed)
    update_result = MagicMock()
    update_result.scalar_one_or_none.return_value = None

    # SELECT finds the quest, and creator_id == MOCK_USER_ID
    existing_quest = _make_quest(creator_id=MOCK_USER_ID)
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = existing_quest

    mock_db.execute.side_effect = [update_result, select_result]

    resp = await client.post("/api/quests/1/claim")
    assert resp.status_code == 403


async def test_claim_already_claimed_quest(mock_user, mock_db, client):
    """Claiming a quest that is already claimed returns 409."""
    # UPDATE returns None (status != OPEN guard failed)
    update_result = MagicMock()
    update_result.scalar_one_or_none.return_value = None

    # SELECT finds the quest in CLAIMED status
    existing_quest = _make_quest(
        creator_id=OTHER_USER_ID,
        status=QuestStatus.CLAIMED,
        hunter_id=uuid.uuid4(),
    )
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = existing_quest

    mock_db.execute.side_effect = [update_result, select_result]

    resp = await client.post("/api/quests/1/claim")
    assert resp.status_code == 409
