"""Quest chat endpoints - ``/quests/{quest_id}/messages``."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core.database import get_db
from app.core.config import get_settings
from app.core.security import get_current_user
from app.models.message import Message
from app.models.quest import Quest
from app.schemas.message import MessageCreate, MessageRead
from app.services.chat_service import manager

router = APIRouter(prefix="/quests", tags=["messages"])


# ------------------------------------------------------------------
# GET /quests/{quest_id}/messages
# ------------------------------------------------------------------
@router.get("/{quest_id}/messages", response_model=list[MessageRead])
async def list_messages(
    quest_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List chat messages for a quest.

    Only the creator and hunter of the quest may view messages.
    """
    quest = await _get_quest_or_404(quest_id, db)
    _assert_participant(quest, user_id)

    stmt = (
        select(Message)
        .where(Message.quest_id == quest_id)
        .order_by(Message.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# ------------------------------------------------------------------
# POST /quests/{quest_id}/messages
# ------------------------------------------------------------------
@router.post(
    "/{quest_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    quest_id: int,
    payload: MessageCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a chat message within an active quest session.

    Only the creator or hunter may send messages, and the quest must
    be in an active state (``claimed`` or ``completed``).
    """
    quest = await _get_quest_or_404(quest_id, db)
    _assert_participant(quest, user_id)

    if quest.status not in ("claimed", "completed"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Chat is only available while the quest is active",
        )

    message = Message(
        quest_id=quest_id,
        sender_id=user_id,
        text=payload.text,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


# ------------------------------------------------------------------
# WebSocket /quests/{quest_id}/ws
# ------------------------------------------------------------------
@router.websocket("/{quest_id}/ws")
async def chat_websocket(
    websocket: WebSocket,
    quest_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Real-time authenticated chat connection."""
    cookie_header = websocket.headers.get("cookie")
    if not cookie_header:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            settings = get_settings()
            resp = await client.get(
                f"{settings.BETTER_AUTH_URL.rstrip('/')}/api/auth/get-session",
                headers={"Cookie": cookie_header}
            )
            if resp.status_code != 200:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            data = resp.json()
            if not data or "user" not in data:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            user_id = data["user"]["id"]
        except httpx.RequestError:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
            return

    try:
        quest = await _get_quest_or_404(quest_id, db)
        _assert_participant(quest, user_id)
        if quest.status not in ("claimed", "completed"):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(quest_id, websocket)
    try:
        while True:
            text = await websocket.receive_text()
            
            message = Message(
                quest_id=quest_id,
                sender_id=user_id,
                text=text,
            )
            db.add(message)
            await db.commit()
            await db.refresh(message)
            
            payload = {
                "id": str(message.id),
                "quest_id": quest_id,
                "sender_id": user_id,
                "text": text,
                "created_at": message.created_at.isoformat()
            }
            await manager.broadcast(quest_id, payload)
            
    except WebSocketDisconnect:
        manager.disconnect(quest_id, websocket)


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------
async def _get_quest_or_404(quest_id: int, db: AsyncSession) -> Quest:
    result = await db.execute(select(Quest).where(Quest.id == quest_id))
    quest = result.scalar_one_or_none()
    if quest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quest not found")
    return quest


def _assert_participant(quest: Quest, user_id: str) -> None:
    if user_id not in (quest.creator_id, quest.hunter_id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only quest participants can access chat",
        )
