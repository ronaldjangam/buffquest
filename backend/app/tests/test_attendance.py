"""Tests for attendance endpoints (``/api/attendance/…``)."""

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.models.attendance import AttendanceSubmission, AttendanceVerificationStatus

from .conftest import MOCK_USER_ID

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_submission(
    submission_id: int = 1,
    user_id: str = MOCK_USER_ID,
) -> MagicMock:
    """Return a mock AttendanceSubmission row."""
    sub = MagicMock(spec=AttendanceSubmission)
    sub.id = submission_id
    sub.user_id = user_id
    sub.schedule_image_url = "https://example.com/schedule.png"
    sub.class_photo_url = "https://example.com/photo.png"
    sub.class_name = "CSCI 3104"
    sub.building_zone_id = 1
    sub.scheduled_start_time = datetime.now(timezone.utc)
    sub.submission_time = datetime.now(timezone.utc)
    sub.verification_status = AttendanceVerificationStatus.PENDING
    sub.reward_issued = False
    sub.created_at = datetime.now(timezone.utc)
    return sub


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_check_in_success(mock_user, mock_db, client):
    """POST /attendance/check-in creates a submission and returns 201."""

    # db.refresh() is called after commit — simulate what the DB would
    # return by filling in server-defaulted columns on the ORM object.
    def _fake_add(obj, *args, **kwargs):
        if type(obj).__name__ == "AttendanceSubmission":
            obj.id = 1
            obj.submission_time = datetime.now(timezone.utc)
            obj.verification_status = AttendanceVerificationStatus.APPROVED
            obj.reward_issued = True
            obj.created_at = datetime.now(timezone.utc)
        else:
            obj.id = 2
            obj.created_at = datetime.now(timezone.utc)

    mock_db.add = MagicMock(side_effect=_fake_add)

    # DB sequence: 1. check dup (None), 2. get profile (mock)
    dup_result = MagicMock()
    dup_result.scalars.return_value.first.return_value = None

    profile_result = MagicMock()
    profile_mock = MagicMock()
    profile_mock.credits = 100
    profile_result.scalar_one_or_none.return_value = profile_mock

    mock_db.execute.side_effect = [dup_result, profile_result]

    resp = await client.post(
        "/api/attendance/check-in",
        json={
            "schedule_image_url": "https://example.com/schedule.png",
            "class_photo_url": "https://example.com/photo.png",
            "class_name": "CSCI 3104",
            "building_zone_id": 1,
            "scheduled_start_time": datetime.now(timezone.utc).isoformat(),
        },
    )

    assert resp.status_code == 201
    assert mock_db.add.call_count == 2
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once()


async def test_get_attendance_history(mock_user, mock_db, client):
    """GET /attendance/history returns a list of submissions."""
    submissions = [_make_submission(i) for i in range(3)]

    result_mock = MagicMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = submissions
    result_mock.scalars.return_value = scalars_mock
    mock_db.execute.return_value = result_mock

    resp = await client.get("/api/attendance/history")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 3


async def test_get_attendance_history_pagination(mock_user, mock_db, client):
    """GET /attendance/history respects limit and offset params."""
    submissions = [_make_submission(1)]

    result_mock = MagicMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = submissions
    result_mock.scalars.return_value = scalars_mock
    mock_db.execute.return_value = result_mock

    resp = await client.get("/api/attendance/history?limit=1&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1


async def test_check_in_duplicate_rejects(mock_user, mock_db, client):
    """POST /attendance/check-in rejects duplicate check-ins for the same class today."""
    dup_result = MagicMock()
    # Mocking that a submission already exists
    dup_result.scalars.return_value.first.return_value = _make_submission(1)
    mock_db.execute.return_value = dup_result

    resp = await client.post(
        "/api/attendance/check-in",
        json={
            "schedule_image_url": "https://example.com/schedule.png",
            "class_photo_url": "https://example.com/photo.png",
            "class_name": "CSCI 3104",
            "building_zone_id": 1,
            "scheduled_start_time": datetime.now(timezone.utc).isoformat(),
        },
    )

    assert resp.status_code == 409
    assert "already checked into" in resp.json()["detail"]
    mock_db.add.assert_not_called()


async def test_check_in_missing_profile_rejects(mock_user, mock_db, client):
    """POST /attendance/check-in returns 404 if profile lookup fails before saving."""
    dup_result = MagicMock()
    dup_result.scalars.return_value.first.return_value = None

    profile_result = MagicMock()
    profile_result.scalar_one_or_none.return_value = None  # Missing profile

    mock_db.execute.side_effect = [dup_result, profile_result]

    resp = await client.post(
        "/api/attendance/check-in",
        json={
            "schedule_image_url": "https://example.com/schedule.png",
            "class_photo_url": "https://example.com/photo.png",
            "class_name": "CSCI 3104",
            "building_zone_id": 1,
            "scheduled_start_time": datetime.now(timezone.utc).isoformat(),
        },
    )

    assert resp.status_code == 404
    assert resp.json()["detail"] == "User profile not found."
    mock_db.add.assert_not_called()
