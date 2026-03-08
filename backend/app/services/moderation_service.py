"""Quest moderation service with Gemini support and safe fallback heuristics."""

from __future__ import annotations

import json
from dataclasses import dataclass

import httpx

from app.core.config import Settings
from app.models.quest import ModerationStatus


@dataclass(slots=True)
class ModerationDecision:
    status: ModerationStatus
    reason: str | None = None


BLOCKED_KEYWORDS = {
    "alcohol": "Requests involving alcohol are not allowed.",
    "beer": "Requests involving alcohol are not allowed.",
    "weed": "Requests involving drugs are not allowed.",
    "drugs": "Requests involving drugs are not allowed.",
    "exam answers": "Academic dishonesty is not allowed.",
    "take attendance": "Proxy attendance is not allowed.",
    "proxy attendance": "Proxy attendance is not allowed.",
    "take my exam": "Academic dishonesty is not allowed.",
    "cheat": "Academic dishonesty is not allowed.",
    "fake id": "Illegal or unsafe requests are not allowed.",
    "weapon": "Unsafe requests are not allowed.",
    "stalk": "Harassment or unsafe requests are not allowed.",
    "dorm room": "Private residence tasks are not allowed at launch.",
    "apartment": "Private residence tasks are not allowed at launch.",
}


def _fallback_moderation(title: str, description: str) -> ModerationDecision:
    content = f"{title}\n{description}".lower()

    for keyword, reason in BLOCKED_KEYWORDS.items():
        if keyword in content:
            return ModerationDecision(status=ModerationStatus.rejected, reason=reason)

    if len(title.strip()) < 5 or len(description.strip()) < 10:
        return ModerationDecision(
            status=ModerationStatus.rejected,
            reason="Quest needs clearer title and instructions before posting.",
        )

    return ModerationDecision(status=ModerationStatus.approved, reason=None)


async def moderate_quest_content(title: str, description: str, settings: Settings) -> ModerationDecision:
    """Moderate quest content with Gemini when available, otherwise use local heuristics."""

    if not settings.GEMINI_API_KEY:
        return _fallback_moderation(title, description)

    prompt = (
        "You are moderating BuffQuest, a CU Boulder campus task app. "
        "Approve only tasks that are safe, campus-relevant, and realistically completable. "
        "Reject cheating, proxy attendance, drugs, alcohol, harassment, unsafe requests, "
        "and private residence tasks. Respond in strict JSON with keys status and reason. "
        "Status must be one of approved, pending, rejected.\n\n"
        f"Title: {title}\nDescription: {description}"
    )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

        text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "{}")
        )
        parsed = json.loads(text)
        status_value = str(parsed.get("status", "approved")).lower()
        reason = parsed.get("reason")

        if status_value not in {"approved", "pending", "rejected"}:
            return _fallback_moderation(title, description)

        return ModerationDecision(
            status=ModerationStatus(status_value),
            reason=reason if isinstance(reason, str) and reason.strip() else None,
        )
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, IndexError, ValueError):
        return _fallback_moderation(title, description)