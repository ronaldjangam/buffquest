"""SQLAlchemy model for the ``building_zones`` table."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Double, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BuildingZone(Base):
    """Maps to ``public.building_zones``.

    Each supported campus building acts as a quest hub with either a
    radius-based or polygon-based geofence.
    """

    __tablename__ = "building_zones"
    __table_args__ = {"schema": "public"}

    # ── columns ──────────────────────────────────────────────
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Double)
    longitude: Mapped[float | None] = mapped_column(Double)
    radius_meters: Mapped[float | None] = mapped_column(Double)
    polygon_geojson: Mapped[dict | None] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # ── relationships ────────────────────────────────────────
    quests = relationship("Quest", back_populates="building_zone")
    attendance_submissions = relationship(
        "AttendanceSubmission", back_populates="building_zone"
    )
