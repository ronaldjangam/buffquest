"""Unit tests for the reward service.

Uses unittest.mock to simulate async database sessions so we can test
the reward logic without requiring a real Postgres connection.
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.quest import QuestStatus
from app.models.reward_log import RewardSourceType
from app.services.reward_service import deduct_quest_cost, issue_reward, refund_quest


# ── helpers ──────────────────────────────────────────────────────────

def _make_profile(credits=100, notoriety=10):
    """Create a mock Profile object."""
    profile = MagicMock()
    profile.id = uuid.uuid4()
    profile.credits = credits
    profile.notoriety = notoriety
    return profile


def _make_quest(creator_id, hunter_id=None, cost=10, reward_credits=20,
                reward_notoriety=5, quest_status=QuestStatus.VERIFIED,
                rewarded_at=None):
    """Create a mock Quest object with real enum values."""
    quest = MagicMock()
    quest.id = 1
    quest.creator_id = creator_id
    quest.hunter_id = hunter_id
    quest.cost_credits = cost
    quest.reward_credits = reward_credits
    quest.reward_notoriety = reward_notoriety
    quest.status = quest_status
    quest.rewarded_at = rewarded_at
    return quest


def _make_db_session(profile=None):
    """Create a mock AsyncSession that returns the given profile on select."""
    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = profile
    db.execute.return_value = result_mock
    return db


# ── deduct_quest_cost tests ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_deduct_quest_cost_success():
    """Credits decrease and a reward log is created."""
    creator = _make_profile(credits=100)
    quest = _make_quest(creator_id=creator.id, cost=25, quest_status=QuestStatus.OPEN)
    db = _make_db_session(profile=creator)

    log = await deduct_quest_cost(db, creator.id, quest)

    assert creator.credits == 75
    assert log.credit_delta == -25
    assert log.source_type == RewardSourceType.QUEST_POST
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_deduct_quest_cost_insufficient():
    """402 when creator doesn't have enough credits."""
    creator = _make_profile(credits=5)
    quest = _make_quest(creator_id=creator.id, cost=25, quest_status=QuestStatus.OPEN)
    db = _make_db_session(profile=creator)

    with pytest.raises(HTTPException) as exc_info:
        await deduct_quest_cost(db, creator.id, quest)

    assert exc_info.value.status_code == 402
    assert creator.credits == 5  # unchanged


@pytest.mark.asyncio
async def test_deduct_quest_cost_creator_not_found():
    """404 when creator profile does not exist."""
    quest = _make_quest(creator_id=uuid.uuid4(), cost=10, quest_status=QuestStatus.OPEN)
    db = _make_db_session(profile=None)

    with pytest.raises(HTTPException) as exc_info:
        await deduct_quest_cost(db, quest.creator_id, quest)

    assert exc_info.value.status_code == 404


# ── issue_reward tests ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_issue_reward_success():
    """Hunter gets credits + notoriety, quest transitions to REWARDED."""
    hunter = _make_profile(credits=50, notoriety=10)
    quest = _make_quest(
        creator_id=uuid.uuid4(),
        hunter_id=hunter.id,
        reward_credits=20,
        reward_notoriety=5,
        quest_status=QuestStatus.VERIFIED,
        rewarded_at=None,
    )
    db = _make_db_session(profile=hunter)

    log = await issue_reward(db, quest)

    assert hunter.credits == 70
    assert hunter.notoriety == 15
    assert quest.status == QuestStatus.REWARDED
    assert quest.rewarded_at is not None
    assert log.credit_delta == 20
    assert log.notoriety_delta == 5
    assert log.source_type == RewardSourceType.QUEST_COMPLETION


@pytest.mark.asyncio
async def test_issue_reward_already_rewarded():
    """409 when quest has already been rewarded."""
    quest = _make_quest(
        creator_id=uuid.uuid4(),
        hunter_id=uuid.uuid4(),
        quest_status=QuestStatus.VERIFIED,
        rewarded_at=datetime.now(timezone.utc),
    )
    db = _make_db_session()

    with pytest.raises(HTTPException) as exc_info:
        await issue_reward(db, quest)

    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_issue_reward_wrong_status():
    """409 when quest is not in VERIFIED status."""
    quest = _make_quest(
        creator_id=uuid.uuid4(),
        hunter_id=uuid.uuid4(),
        quest_status=QuestStatus.COMPLETED,
        rewarded_at=None,
    )
    db = _make_db_session()

    with pytest.raises(HTTPException) as exc_info:
        await issue_reward(db, quest)

    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_issue_reward_hunter_not_found():
    """404 when hunter profile does not exist."""
    quest = _make_quest(
        creator_id=uuid.uuid4(),
        hunter_id=uuid.uuid4(),
        quest_status=QuestStatus.VERIFIED,
        rewarded_at=None,
    )
    db = _make_db_session(profile=None)

    with pytest.raises(HTTPException) as exc_info:
        await issue_reward(db, quest)

    assert exc_info.value.status_code == 404


# ── refund_quest tests ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refund_quest_success():
    """Creator gets credits back, log created."""
    creator = _make_profile(credits=50)
    quest = _make_quest(creator_id=creator.id, cost=15, quest_status=QuestStatus.OPEN)
    db = _make_db_session(profile=creator)

    log = await refund_quest(db, quest)

    assert creator.credits == 65
    assert log.credit_delta == 15
    assert log.source_type == RewardSourceType.QUEST_REFUND
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_refund_quest_zero_cost():
    """No refund when quest cost is 0."""
    quest = _make_quest(creator_id=uuid.uuid4(), cost=0, quest_status=QuestStatus.OPEN)
    db = _make_db_session()

    result = await refund_quest(db, quest)

    assert result is None
    db.add.assert_not_called()
