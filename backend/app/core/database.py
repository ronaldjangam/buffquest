"""Async SQLAlchemy engine, session factory, and FastAPI dependency."""

from collections.abc import AsyncGenerator
import ssl
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


def _build_database_engine_config() -> tuple[str, dict]:
    """Normalize Postgres URLs for SQLAlchemy asyncpg.

    Neon connection strings commonly arrive as plain ``postgresql://`` URLs and
    include query params like ``sslmode`` and ``channel_binding`` that asyncpg's
    SQLAlchemy dialect does not accept directly.
    """
    database_url = get_settings().DATABASE_URL.strip().strip('"').strip("'")

    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)

    split_url = urlsplit(database_url)
    query_params = dict(parse_qsl(split_url.query, keep_blank_values=True))
    sslmode = query_params.pop("sslmode", None)
    query_params.pop("channel_binding", None)

    connect_args: dict = {}
    if sslmode and sslmode.lower() != "disable":
        connect_args["ssl"] = ssl.create_default_context()

    normalized_url = urlunsplit(
        (
            split_url.scheme,
            split_url.netloc,
            split_url.path,
            urlencode(query_params),
            split_url.fragment,
        )
    )

    return normalized_url, connect_args


# ================================
# Base Model Class
# ================================

class Base(DeclarativeBase):
    pass


# ================================
# SQLAlchemy Async Engine
# ================================

database_url, database_connect_args = _build_database_engine_config()

engine = create_async_engine(
    database_url,
    echo=False,          # set True for debugging SQL queries
    pool_pre_ping=True,  # verifies connections before using them
    connect_args=database_connect_args,
)


# ================================
# Session Factory
# ================================

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ================================
# FastAPI Dependency
# ================================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides a database session
    and automatically closes it after the request.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
