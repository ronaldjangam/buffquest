"""Tests for moderation endpoints (``/api/moderation/…``)."""

from unittest.mock import MagicMock

import pytest

from app.models.quest import ModerationStatus, Quest

from .conftest import OTHER_USER_ID

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_quest(
    quest_id: int = 1,
    moderation_status: ModerationStatus = ModerationStatus.PENDING,
    moderation_reason: str | None = None,
) -> MagicMock:
    """Return a mock Quest with moderation fields."""
    q = MagicMock(spec=Quest)
    q.id = quest_id
    q.creator_id = OTHER_USER_ID
    q.title = "Pick up a notebook from Norlin"
    q.description = "Grab the blue notebook from the front desk and bring it to Eaton."
    q.moderation_status = moderation_status
    q.moderation_reason = moderation_reason
    return q


# ---------------------------------------------------------------------------
# POST /moderation/review
# ---------------------------------------------------------------------------

async def test_review_quest_success(mock_user, mock_db, client):
    """Reviewing a safe quest approves it."""
    quest = _make_quest()

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = quest
    mock_db.execute.return_value = result_mock

    resp = await client.post("/api/moderation/review", params={"quest_id": 1})
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "approved"
    assert data["reason"] is None


async def test_review_quest_not_found(mock_user, mock_db, client):
    """Reviewing a nonexistent quest returns 404."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = result_mock

    resp = await client.post("/api/moderation/review", params={"quest_id": 999})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /moderation/{quest_id}
# ---------------------------------------------------------------------------

async def test_get_moderation_status_success(mock_user, mock_db, client):
    """Getting moderation status for an existing quest returns 200."""
    quest = _make_quest(moderation_status=ModerationStatus.APPROVED)

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = quest
    mock_db.execute.return_value = result_mock

    resp = await client.get("/api/moderation/1")
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == ModerationStatus.APPROVED


async def test_get_moderation_status_not_found(mock_user, mock_db, client):
    """Getting moderation status for a nonexistent quest returns 404."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = result_mock

    resp = await client.get("/api/moderation/999")
    assert resp.status_code == 404
