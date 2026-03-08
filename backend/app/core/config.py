"""Centralized application settings loaded from environment variables.

Uses pydantic-settings to validate and expose every env var the app
needs.  Import ``get_settings`` anywhere as a FastAPI dependency or
plain function call.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Validated environment configuration for BuffQuest."""

    # ---- Required (no default – fails fast if missing) ----
    DATABASE_URL: str
    BETTER_AUTH_SECRET: str = ""

    # ---- Empty-string defaults for dev convenience ----
    NEXT_PUBLIC_MAPBOX_TOKEN: str = ""
    GEMINI_API_KEY: str = ""
    BETTER_AUTH_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=(BACKEND_ROOT / ".env", BACKEND_ROOT / ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached ``Settings`` instance.

    Use as a FastAPI dependency::

        @router.get("/example")
        async def example(settings: Settings = Depends(get_settings)):
            ...
    """
    return Settings()  # type: ignore[call-arg]
