"""Pydantic schemas for the ``quests`` table."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class QuestCreate(BaseModel):
    """Payload for creating a new quest."""

    title: str = Field(..., min_length=5, max_length=120)
    description: str = Field(..., min_length=10, max_length=2000)
    building_zone_id: int
    cost_credits: int = Field(default=0, ge=0)
    reward_credits: int = Field(default=0, ge=0)
    reward_notoriety: int = Field(default=0, ge=0)
    expires_at: datetime | None = None
    moderation_status: str | None = None


class QuestUpdate(BaseModel):
    """Fields that may be changed while a quest is still ``open``."""

    title: str | None = Field(None, min_length=5, max_length=120)
    description: str | None = Field(None, min_length=10, max_length=2000)


class QuestRead(BaseModel):
    """Full quest response returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    creator_id: str
    hunter_id: str | None = None
    title: str
    description: str
    building_zone_id: int
    building_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    cost_credits: int
    reward_credits: int
    reward_notoriety: int
    status: str
    moderation_status: str
    moderation_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    claimed_at: datetime | None = None
    completed_at: datetime | None = None
    verified_at: datetime | None = None
    rewarded_at: datetime | None = None
    expires_at: datetime | None = None


class QuestClaimCreate(BaseModel):
    """Payload for claiming a quest requiring physical proximity."""
    user_lat: float | None = None
    user_lon: float | None = None
