"""Reward & credit system for BuffQuest.

Handles credit deduction on quest creation, reward issuance on quest
verification, and refunds on quest cancellation. All transactions are
logged to the ``reward_logs`` table for auditability.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile
from app.models.quest import Quest, QuestStatus
from app.models.reward_log import RewardLog, RewardSourceType


async def deduct_quest_cost(
    db: AsyncSession,
    creator_id,
    quest: Quest,
) -> RewardLog:
    """Deduct ``cost_credits`` from the creator when posting a quest.

    Raises ``402`` if the creator does not have enough credits.
    Returns the created ``RewardLog`` entry.
    """
    result = await db.execute(select(Profile).where(Profile.id == creator_id))
    creator = result.scalar_one_or_none()
    if creator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Creator profile not found")

    if creator.credits < quest.cost_credits:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"Insufficient credits: have {creator.credits}, need {quest.cost_credits}",
        )

    creator.credits -= quest.cost_credits

    log = RewardLog(
        user_id=creator_id,
        source_type=RewardSourceType.quest_post,
        source_id=quest.id,
        credit_delta=-quest.cost_credits,
        notoriety_delta=0,
    )
    db.add(log)

    return log


async def issue_reward(
    db: AsyncSession,
    quest: Quest,
) -> RewardLog:
    """Award credits + notoriety to the hunter after quest verification.

    Transitions the quest from ``VERIFIED → REWARDED``. Raises ``409``
    if the quest is not in ``VERIFIED`` status or has already been
    rewarded (idempotency guard).
    """
    if quest.status != QuestStatus.verified:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Quest must be in 'verified' status to issue rewards",
        )

    if quest.rewarded_at is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Reward has already been issued for this quest",
        )

    result = await db.execute(select(Profile).where(Profile.id == quest.hunter_id))
    hunter = result.scalar_one_or_none()
    if hunter is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hunter profile not found")

    # Award credits and notoriety
    hunter.credits += quest.reward_credits
    hunter.notoriety += quest.reward_notoriety

    # Transition quest to REWARDED
    quest.status = QuestStatus.rewarded
    quest.rewarded_at = datetime.now(timezone.utc)

    log = RewardLog(
        user_id=quest.hunter_id,
        source_type=RewardSourceType.quest_completion,
        source_id=quest.id,
        credit_delta=quest.reward_credits,
        notoriety_delta=quest.reward_notoriety,
    )
    db.add(log)

    return log


async def refund_quest(
    db: AsyncSession,
    quest: Quest,
) -> RewardLog | None:
    """Refund ``cost_credits`` to the creator when a quest is cancelled.

    Only refunds if the quest has a non-zero cost. Returns ``None`` if
    no refund is needed (cost was 0).
    """
    if quest.cost_credits == 0:
        return None

    result = await db.execute(select(Profile).where(Profile.id == quest.creator_id))
    creator = result.scalar_one_or_none()
    if creator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Creator profile not found")

    creator.credits += quest.cost_credits

    log = RewardLog(
        user_id=quest.creator_id,
        source_type=RewardSourceType.quest_refund,
        source_id=quest.id,
        credit_delta=quest.cost_credits,
        notoriety_delta=0,
    )
    db.add(log)

    return log
