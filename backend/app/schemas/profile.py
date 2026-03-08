"""Pydantic schemas for the ``user`` table."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ProfileRead(BaseModel):
    """Full profile response returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str | None = None
    name: str | None = None
    credits: int
    notoriety: int
    email_verified: bool | None = None
    is_verified_student: bool | None = None
    image: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProfileUpdate(BaseModel):
    """Fields a user may update on their own profile."""

    name: str | None = Field(None, min_length=1, max_length=100)
    image: str | None = None


class ProfileStats(BaseModel):
    """Lightweight credits / notoriety summary."""

    model_config = ConfigDict(from_attributes=True)

    credits: int
    notoriety: int
