"""Auth endpoints - ``/auth/…``.

Authentication is handled by better-auth. These endpoints provide
a backend passthrough for the frontend to verify session state.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.profile import Profile
from app.schemas.profile import ProfileRead

router = APIRouter(prefix="/auth", tags=["auth"])


# ------------------------------------------------------------------
# GET /auth/me
# ------------------------------------------------------------------
@router.get("/me", response_model=ProfileRead)
async def auth_me(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the currently authenticated user's profile.

    The better-auth session is validated via ``get_current_user``,
    and this endpoint simply returns the matching profile row.
    """
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return profile
