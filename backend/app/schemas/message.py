"""Pydantic schemas for the ``messages`` table."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageCreate(BaseModel):
    """Payload for sending a chat message within a quest."""

    text: str = Field(..., min_length=1, max_length=2000)


class MessageRead(BaseModel):
    """Full message response returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    quest_id: int
    sender_id: str
    text: str
    created_at: datetime
