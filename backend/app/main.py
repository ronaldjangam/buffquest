"""BuffQuest API entry point."""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import traceback
from fastapi.responses import JSONResponse

import app.models  # noqa: F401

from app.api.routes import (
    attendance,
    auth,
    claims,
    leaderboard,
    messages,
    moderation,
    quests,
    users,
)

app = FastAPI(title="BuffQuest API", version="0.1.0")

# -- CORS --
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Routers --
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(quests.router, prefix="/api")
app.include_router(claims.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(moderation.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger = logging.getLogger("buffquest.error")
    logger.exception("Unhandled exception occurred")
    print(f"CRASH: {exc}", file=sys.stderr)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )
