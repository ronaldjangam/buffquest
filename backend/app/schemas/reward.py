"""Pydantic schemas for the reward system."""

from pydantic import BaseModel, ConfigDict


class RewardResult(BaseModel):
    """Response returned after issuing quest rewards."""

    model_config = ConfigDict(from_attributes=True)

    quest_id: int
    hunter_id: str | None = None
    credits_awarded: int
    notoriety_awarded: int
    status: str
