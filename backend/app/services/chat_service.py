"""Real-time Chat orchestration service for BuffQuest."""

from fastapi import WebSocket

class ConnectionManager:
    """Manages active WebSocket connections per quest."""

    def __init__(self):
        # Maps quest_id -> list of active WebSocket connections
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, quest_id: int, websocket: WebSocket):
        """Accept a connection and register it for the quest."""
        await websocket.accept()
        if quest_id not in self.active_connections:
            self.active_connections[quest_id] = []
        self.active_connections[quest_id].append(websocket)

    def disconnect(self, quest_id: int, websocket: WebSocket):
        """Remove a connection."""
        if quest_id in self.active_connections:
            if websocket in self.active_connections[quest_id]:
                self.active_connections[quest_id].remove(websocket)
            if not self.active_connections[quest_id]:
                self.active_connections.pop(quest_id, None)

    async def broadcast(self, quest_id: int, message: dict):
        """Send a JSON payload to all active connections in a quest."""
        if quest_id in self.active_connections:
            for connection in self.active_connections[quest_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()
