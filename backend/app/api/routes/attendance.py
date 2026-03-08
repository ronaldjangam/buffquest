"""Attendance endpoints - ``/attendance/…``."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.attendance import AttendanceSubmission
from app.schemas.attendance import AttendanceSubmissionCreate, AttendanceSubmissionRead
from app.services.attendance_service import process_attendance_checkin

router = APIRouter(prefix="/attendance", tags=["attendance"])


# ------------------------------------------------------------------
# POST /attendance/check-in
# ------------------------------------------------------------------
@router.post(
    "/check-in",
    response_model=AttendanceSubmissionRead,
    status_code=status.HTTP_201_CREATED,
)
async def check_in(
    payload: AttendanceSubmissionCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a class attendance check-in.
    
    Checks for daily duplicates per class and auto-approves,
    awarding 5 credits immediately.
    """
    # Duplicate check: same user, same class, same day
    submission = await process_attendance_checkin(db, user_id, payload)

    await db.commit()
    await db.refresh(submission)
    return submission


# ------------------------------------------------------------------
# GET /attendance/history
# ------------------------------------------------------------------
@router.get("/history", response_model=list[AttendanceSubmissionRead])
async def get_attendance_history(
    user_id: str = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated user's attendance submissions."""
    stmt = (
        select(AttendanceSubmission)
        .where(AttendanceSubmission.user_id == user_id)
        .order_by(AttendanceSubmission.submission_time.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()
