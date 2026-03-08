"""Profile endpoints - ``/users/…``."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.profile import Profile
from app.schemas.profile import ProfileRead, ProfileStats, ProfileUpdate

router = APIRouter(prefix="/users", tags=["users"])


# ------------------------------------------------------------------
# GET /users/me
# ------------------------------------------------------------------
@router.get("/me", response_model=ProfileRead)
async def get_my_profile(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated user's own profile."""
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return profile


# ------------------------------------------------------------------
# GET /users/{user_id}
# ------------------------------------------------------------------
@router.get("/{user_id}", response_model=ProfileRead)
async def get_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return a user's public profile by ID."""
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return profile


# ------------------------------------------------------------------
# PATCH /users/me
# ------------------------------------------------------------------
@router.patch("/me", response_model=ProfileRead)
async def update_my_profile(
    payload: ProfileUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's own profile."""
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return profile


# ------------------------------------------------------------------
# GET /users/me/stats
# ------------------------------------------------------------------
@router.get("/me/stats", response_model=ProfileStats)
async def get_my_stats(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return credits and notoriety for the authenticated user."""
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return profile
