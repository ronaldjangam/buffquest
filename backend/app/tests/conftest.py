"""Shared pytest fixtures for route-level tests.

Uses FastAPI dependency overrides to mock the database session and
authenticated user, so tests run without a live database.
"""

import os
from unittest.mock import AsyncMock, MagicMock

# Ensure required env vars exist *before* any app imports trigger
# pydantic-settings validation.
os.environ.setdefault("BETTER_AUTH_SECRET", "test-secret-for-pytest")
os.environ.setdefault("BETTER_AUTH_URL", "http://localhost:3000")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
get_settings.cache_clear()          # pick up the env vars we just set

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app as fastapi_app

# Import ALL models so SQLAlchemy relationship() references resolve
# when route handlers instantiate ORM objects during tests.
from app.models import attendance as _m1     # noqa: F401
from app.models import building_zone as _m2  # noqa: F401
from app.models import message as _m3        # noqa: F401
from app.models import profile as _m4        # noqa: F401
from app.models import quest as _m5          # noqa: F401
from app.models import reward_log as _m6     # noqa: F401

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MOCK_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
OTHER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _override_deps():
    """Override FastAPI deps for every test, then clear overrides after."""
    yield
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def mock_db():
    """Provide an ``AsyncMock`` standing in for ``AsyncSession``.

    The mock's ``execute`` method returns a ``MagicMock`` by default;
    individual tests should configure ``.scalar_one_or_none`` /
    ``.scalars().all()`` return values as needed.
    """
    session = AsyncMock()
    session.add = MagicMock()
    session.delete = MagicMock()

    # Default: execute() returns a result proxy mock
    result_mock = MagicMock()
    session.execute.return_value = result_mock

    async def _get_mock_db():
        yield session

    fastapi_app.dependency_overrides[get_db] = _get_mock_db
    return session


@pytest.fixture
def mock_user(mock_db):
    """Override ``get_current_user`` to return ``MOCK_USER_ID``."""

    async def _mock_current_user():
        return MOCK_USER_ID

    fastapi_app.dependency_overrides[get_current_user] = _mock_current_user
    return MOCK_USER_ID


@pytest_asyncio.fixture
async def client():
    """Async httpx client wired to the FastAPI app."""
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
