"""SQLAlchemy model for the ``reward_logs`` table."""

import enum
from datetime import datetime

from sqlalchemy import BigInteger, Enum, ForeignKey, Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RewardSourceType(str, enum.Enum):
    quest_post = "quest_post"
    QUEST_POST = "quest_post"
    quest_completion = "quest_completion"
    QUEST_COMPLETION = "quest_completion"
    quest_refund = "quest_refund"
    QUEST_REFUND = "quest_refund"
    attendance_reward = "attendance_reward"
    ATTENDANCE_REWARD = "attendance_reward"
    manual_adjustment = "manual_adjustment"
    MANUAL_ADJUSTMENT = "manual_adjustment"


class RewardLog(Base):
    """Maps to ``public.reward_logs``.

    An immutable audit log of every credit/notoriety change for a user.
    """

    __tablename__ = "reward_logs"
    __table_args__ = {"schema": "public"}

    # ── columns ──────────────────────────────────────────────
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("public.user.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_type: Mapped[RewardSourceType] = mapped_column(
        Enum(RewardSourceType, name="reward_source_type", schema="public", create_type=False),
        nullable=False,
    )
    source_id: Mapped[int | None] = mapped_column(BigInteger)
    credit_delta: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    notoriety_delta: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── relationships ────────────────────────────────────────
    user = relationship("Profile", back_populates="reward_logs")
