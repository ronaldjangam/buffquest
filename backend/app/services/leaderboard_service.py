"""Business logic for generating leaderboards and ranking arrays."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile

async def get_top_users_service(
    db: AsyncSession,
    limit: int,
    offset: int
):
    """Retrieve top users iteratively ordered by their notoriety points."""
    stmt = (
        select(Profile)
        .order_by(Profile.notoriety.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()
