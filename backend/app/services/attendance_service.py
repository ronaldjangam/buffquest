"""Business logic for attendance checking."""

from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceSubmission, AttendanceVerificationStatus
from app.models.profile import Profile
from app.models.reward_log import RewardLog, RewardSourceType
from app.schemas.attendance import AttendanceSubmissionCreate
from app.services.location_service import verify_user_in_zone


def _looks_like_uploaded_image(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized.startswith("data:image/") or normalized.startswith("http://") or normalized.startswith("https://")


def _determine_attendance_status(payload: AttendanceSubmissionCreate) -> AttendanceVerificationStatus:
    now = datetime.now(timezone.utc)
    window_start = payload.scheduled_start_time - timedelta(hours=2)
    window_end = payload.scheduled_start_time + timedelta(hours=3)

    if not _looks_like_uploaded_image(payload.schedule_image_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a valid schedule image before checking in.",
        )

    if not _looks_like_uploaded_image(payload.class_photo_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a valid class photo before checking in.",
        )

    if not (window_start <= now <= window_end):
        return AttendanceVerificationStatus.pending

    return AttendanceVerificationStatus.approved

async def process_attendance_checkin(
    db: AsyncSession,
    user_id: str,
    payload: AttendanceSubmissionCreate
) -> AttendanceSubmission:
    """Validate attendance proofs, location, duplicates, and issue rewards when approved."""
    
    today = date.today()
    stmt = (
        select(AttendanceSubmission)
        .where(
            AttendanceSubmission.user_id == user_id,
            AttendanceSubmission.class_name == payload.class_name,
            func.date(AttendanceSubmission.submission_time) == today,
            AttendanceSubmission.verification_status == AttendanceVerificationStatus.approved
        )
    )
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You have already checked into '{payload.class_name}' today."
        )

    # Ensure profile exists before issuing rewards and saving submission
    result_profile = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result_profile.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found."
        )

    # Validate physical presence if checking into a designated campus building
    if (
        payload.building_zone_id is not None
        and payload.user_lat is not None
        and payload.user_lon is not None
    ):
        await verify_user_in_zone(
            db=db,
            building_zone_id=payload.building_zone_id,
            user_lat=payload.user_lat,
            user_lon=payload.user_lon,
            allowed_radius_meters=150.0
        )

    verification_status = _determine_attendance_status(payload)

    submission = AttendanceSubmission(
        user_id=user_id,
        schedule_image_url=payload.schedule_image_url,
        class_photo_url=payload.class_photo_url,
        class_name=payload.class_name,
        building_zone_id=payload.building_zone_id,
        scheduled_start_time=payload.scheduled_start_time,
        verification_status=verification_status,
        reward_issued=verification_status == AttendanceVerificationStatus.approved,
    )
    db.add(submission)
    
    if verification_status == AttendanceVerificationStatus.approved:
        profile.credits += 5
        reward_log = RewardLog(
            user_id=user_id,
            source_type=RewardSourceType.attendance_reward,
            credit_delta=5,
            notoriety_delta=0
        )
        db.add(reward_log)

    return submission
