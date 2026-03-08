"""SQLAlchemy model for the ``user`` table."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Profile(Base):
    """Maps to ``user`` (better-auth table)."""

    __tablename__ = "user"
    __table_args__ = {"schema": "public"}

    # ── columns ──────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String, primary_key=True
    )
    name: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(
        Text, unique=True, index=True
    )
    email_verified: Mapped[bool] = mapped_column("emailVerified", Boolean, nullable=False, default=False)
    image: Mapped[str | None] = mapped_column(Text)
    credits: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    notoriety: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    is_verified_student: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime(timezone=True), nullable=False
    )

    # ── relationships ────────────────────────────────────────
    created_quests = relationship(
        "Quest", back_populates="creator", foreign_keys="Quest.creator_id"
    )
    hunted_quests = relationship(
        "Quest", back_populates="hunter", foreign_keys="Quest.hunter_id"
    )
    messages = relationship("Message", back_populates="sender")
    attendance_submissions = relationship(
        "AttendanceSubmission", back_populates="user"
    )
    reward_logs = relationship("RewardLog", back_populates="user")

    @property
    def display_name(self) -> str | None:
        return self.name

    @property
    def profile_image_url(self) -> str | None:
        return self.image
