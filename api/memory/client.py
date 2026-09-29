"""Async wrapper over the Hindsight cloud client.

Owns tag conventions, the recall fan-out used on the hot path, and retains.
Tenant isolation is enforced with tags_match="all_strict"/"any_strict" — the SDK
default "any" would leak untagged/global memories across tenants.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any

from hindsight_client import Hindsight

from api.config import settings


# --- tag builders (one place so retain/recall always agree) ---
def tenant_tag(t: str) -> str: return f"tenant:{t}"
def identity_tag(i: str) -> str: return f"identity:{i}"
def session_tag(s: str) -> str: return f"session:{s}"
def source_tag(s: str) -> str: return f"source:{s}"
def tactic_tag(t: str) -> str: return f"tactic:{t}"
def verdict_tag(v: str) -> str: return f"verdict:{v}"


@dataclass
class RecallBundle:
    """The four parallel recalls that feed one risk decision."""
    identity_history: list[Any] = field(default_factory=list)
    linked_identities: list[Any] = field(default_factory=list)
    antigens: list[Any] = field(default_factory=list)
    tolerance: list[Any] = field(default_factory=list)


class MemoryClient:
    def __init__(self) -> None:
        self.hs = Hindsight(
            base_url=settings.hindsight_base_url,
            api_key=settings.hindsight_api_key,
            timeout=30.0,
        )
        self.traffic = settings.traffic_bank
        self.antigens = settings.antigen_bank
        self.dream = settings.dream_bank

    async def aclose(self) -> None:
        try:
            await self.hs.aclose()
        except Exception:
            pass

    # ---- retain (write side) ----
    async def retain_session(self, *, tenant: str, identity_id: str, session_id: str,
                             source: str, turns: list[dict], last_action: str) -> Any:
        """Upsert the running transcript for a session (idempotent on session_id)."""
        return await self.hs.aretain(
            bank_id=self.traffic,
            content=json.dumps(turns, ensure_ascii=False),
            document_id=f"session-{session_id}",
            tags=[tenant_tag(tenant), identity_tag(identity_id),
                  session_tag(session_id), source_tag(source)],
            metadata={"identity": identity_id, "tenant": tenant, "last_action": last_action},
            context=f"{tenant} support session {session_id}",
            retain_async=True,
        )

    async def retain_antigen(self, *, text: str, tactic: str, origin: str,
                            source: str, verdict: str) -> Any:
        """Record a confirmed/dismissed attack. `text` must already be sanitised
        of real identifiers before it reaches this shared cross-tenant bank."""
        return await self.hs.aretain(
            bank_id=self.antigens,
            content=text,
            tags=[verdict_tag(verdict), tactic_tag(tactic),
                  f"origin:{origin}", source_tag(source)],
            context=f"{verdict} attack, tactic={tactic}",
            retain_async=False,
        )

    # ---- recall (read side) ----
    async def _recall(self, bank: str, query: str, tags: list[str],
                      tags_match: str, types: list[str] | None = None,
                      max_tokens: int = 1500) -> list[Any]:
        try:
            r = await self.hs.arecall(
                bank_id=bank, query=query[:1800], tags=tags,
                tags_match=tags_match, types=types, max_tokens=max_tokens,
            )
            return getattr(r, "results", None) or []
        except Exception:
            return []  # fail closed-ish: no memory beats a crashed hot path

    async def recall_for_decision(self, *, tenant: str, identity_id: str,
                                  message: str, session_summary: str) -> RecallBundle:
        """Four recalls in parallel — the memory half of the hot path."""
        q_hist = "What has this customer asked for, claimed, or been refused before?"
        q_link = f"Sessions mentioning the same booking refs, phone, or named people as: {message}"
        q_attack = f"{session_summary}\nCurrent message: {message}"
        hist, linked, anti, tol = await asyncio.gather(
            self._recall(self.traffic, q_hist,
                         [tenant_tag(tenant), identity_tag(identity_id)], "all_strict"),
            self._recall(self.traffic, q_link, [tenant_tag(tenant)], "any_strict"),
            self._recall(self.antigens, q_attack, [verdict_tag("confirmed")], "any_strict"),
            self._recall(self.antigens, q_attack, [verdict_tag("dismissed")], "any_strict"),
        )
        return RecallBundle(identity_history=hist, linked_identities=linked,
                            antigens=anti, tolerance=tol)

    # ---- mental models (curated, refreshed off the hot path) ----
    async def get_mental_model(self, bank: str, mm_id: str) -> Any | None:
        try:
            return await self.hs.aget_mental_model(
                bank_id=bank, mental_model_id=mm_id, detail="content")
        except Exception:
            return None

    # ---- antigen library (for the Campaigns screen) ----
    async def list_antigens(self, verdict: str = "confirmed",
                            max_tokens: int = 6000) -> list[dict[str, Any]]:
        try:
            r = await self.hs.arecall(
                bank_id=self.antigens,
                query="social-engineering attack tactics used against support agents",
                tags=[verdict_tag(verdict)], tags_match="any_strict",
                max_tokens=max_tokens)
        except Exception:
            return []
        out, seen = [], set()
        for it in (getattr(r, "results", None) or []):
            d = it.model_dump() if hasattr(it, "model_dump") else {}
            text = d.get("text") or d.get("content") or ""
            key = text[:80]
            if key in seen:
                continue
            seen.add(key)
            tags = d.get("tags") or []
            tactics = [t.split("tactic:", 1)[1] for t in tags if t.startswith("tactic:")]
            out.append({"id": d.get("id"), "text": text, "tactics": tactics, "tags": tags})
        return out

    # ---- dream cycle (off the hot path) ----
    async def reflect_over_antigens(self, *, query: str, schema: dict[str, Any],
                                    max_tokens: int = 1800) -> dict[str, Any] | None:
        """Ask Hindsight to reflect over the confirmed-antigen bank and return
        structured insight. This is the memory system dreaming: consolidating
        many single attacks into higher-order campaign patterns."""
        try:
            r = await self.hs.areflect(
                bank_id=self.antigens, query=query, budget="low",
                tags=[verdict_tag("confirmed")], tags_match="any_strict",
                response_schema=schema, max_tokens=max_tokens)
        except Exception:
            return None
        so = getattr(r, "structured_output", None)
        if isinstance(so, str):
            try:
                so = json.loads(so)
            except Exception:
                so = None
        return so if isinstance(so, dict) else None

    async def retain_dream(self, *, title: str, text: str, tactics: list[str]) -> Any:
        """Persist one synthesized insight into the dream bank."""
        return await self.hs.aretain(
            bank_id=self.dream, content=f"{title}\n{text}",
            tags=[source_tag("dream"), *[tactic_tag(t) for t in tactics if t]],
            context=f"emerging campaign: {title}",
            retain_async=False)

    async def list_dreams(self, max_tokens: int = 6000) -> list[dict[str, Any]]:
        try:
            r = await self.hs.arecall(
                bank_id=self.dream,
                query="emerging cross-tenant attack campaigns and what to watch for",
                tags=[source_tag("dream")], tags_match="any_strict",
                max_tokens=max_tokens)
        except Exception:
            return []
        out, seen = [], set()
        for it in (getattr(r, "results", None) or []):
            d = it.model_dump() if hasattr(it, "model_dump") else {}
            text = d.get("text") or d.get("content") or ""
            key = text[:80]
            if key in seen:
                continue
            seen.add(key)
            tags = d.get("tags") or []
            tactics = [t.split("tactic:", 1)[1] for t in tags if t.startswith("tactic:")]
            out.append({"id": d.get("id"), "text": text, "tactics": tactics})
        return out
