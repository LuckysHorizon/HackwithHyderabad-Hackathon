"""Analyst loop: turn a human verdict into shared immunity.

Confirming an attack sanitises the flagged session and retains it to the
cross-tenant antigen bank — so every other tenant is now vaccinated against
that tactic. Dismissing records a tolerance pattern that protects that kind of
legitimate customer from future false positives.
"""
from __future__ import annotations

from typing import Any

from api import gateway
from api.events import publish
from api.sanitize import sanitize


def _attack_summary(session_id: str) -> str:
    """A compact, sanitised description of what the customer attempted."""
    turns = gateway.transcript(session_id)
    user_lines = [t["content"] for t in turns if t.get("role") == "user"]
    joined = " → ".join(user_lines[-6:]) or "(no transcript)"
    return sanitize(joined)[:1200]


async def record_verdict(*, session_id: str, verdict: str, tactic: str | None = None,
                         note: str | None = None, analyst: str = "analyst") -> dict[str, Any]:
    if verdict not in ("confirmed", "dismissed"):
        return {"ok": False, "error": "verdict must be 'confirmed' or 'dismissed'"}

    meta = gateway._session_meta.get(session_id, {})
    tenant = meta.get("tenant", "unknown")
    text = _attack_summary(session_id)
    if note:
        text = f"{text}\nAnalyst note: {sanitize(note)}"

    antigen_id = None
    try:
        resp = await gateway.memory().retain_antigen(
            text=text, tactic=(tactic or "none"), origin=tenant,
            source="live", verdict=verdict)
        antigen_id = getattr(resp, "document_id", None) or getattr(resp, "id", None)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"retain failed: {e}"}

    gateway.set_verdict(session_id, verdict)
    publish({
        "type": "verdict", "session_id": session_id, "tenant": tenant,
        "verdict": verdict, "tactic": tactic, "analyst": analyst,
        "antigen_id": str(antigen_id) if antigen_id else None,
    })
    return {"ok": True, "verdict": verdict, "antigen_id": str(antigen_id) if antigen_id else None}
