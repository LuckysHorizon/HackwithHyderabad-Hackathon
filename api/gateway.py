"""Gateway: the hot path.

    message
      -> resolve identity (hashed)
      -> recall memory in parallel (unless memory disabled — the A/B arm)
      -> Risk Engine scores it, citing memory
      -> Orchestrator maps score -> action
      -> target bot replies, gated by the action
      -> async retain the transcript + publish a decision event

Keeping this in one place makes the "memory on vs off" comparison a single flag.
"""
from __future__ import annotations

import time
from typing import Any

from api.agents import bots
from api.events import publish
from api.identity import resolve
from api.memory.client import MemoryClient, RecallBundle
from api.models import ChatRequest, ChatResponse, Decision
from api.orchestrator import verification_required
from api.risk import assess

_memory: MemoryClient | None = None
# session_id -> [{"role","content"}]  (running transcript, in-memory for the demo)
_sessions: dict[str, list[dict[str, str]]] = {}
# session_id -> list of decision event dicts (newest last)
_session_decisions: dict[str, list[dict[str, Any]]] = {}
# session_id -> latest meta (tenant, identity, source, verdict if any)
_session_meta: dict[str, dict[str, Any]] = {}


def memory() -> MemoryClient:
    global _memory
    if _memory is None:
        _memory = MemoryClient()
    return _memory


async def aclose() -> None:
    if _memory is not None:
        await _memory.aclose()


def _summary(history: list[dict[str, str]]) -> str:
    turns = history[-6:]
    return "\n".join(f"{t['role']}: {t['content']}" for t in turns) or "(new session)"


async def handle(req: ChatRequest) -> ChatResponse:
    t0 = time.perf_counter()
    ident = resolve(req.session_id, req.hints)

    history = _sessions.setdefault(req.session_id, [])
    summary = _summary(history)
    history.append({"role": "user", "content": req.text})

    if req.memory_enabled:
        bundle = await memory().recall_for_decision(
            tenant=req.tenant, identity_id=ident.identity_id,
            message=req.text, session_summary=summary)
        ident.is_new = len(bundle.identity_history) == 0
    else:
        bundle = RecallBundle()  # memory-off arm: no context at all

    risk = await assess(tenant=req.tenant, identity_id=ident.identity_id,
                        message=req.text, bundle=bundle, is_new_identity=ident.is_new)
    action = risk.recommended_action

    bot_result = await bots.run(req.tenant, list(history), action)
    reply = bot_result.reply
    history.append({"role": "assistant", "content": reply})

    latency_ms = int((time.perf_counter() - t0) * 1000)

    if req.memory_enabled:
        try:
            await memory().retain_session(
                tenant=req.tenant, identity_id=ident.identity_id,
                session_id=req.session_id, source=req.source,
                turns=history, last_action=action)
        except Exception:  # noqa: BLE001 - never fail the response on retain
            pass

    decision = Decision(
        session_id=req.session_id, identity_id=ident.identity_id, tenant=req.tenant,
        score=risk.risk_score, action=action, tactics=risk.tactics,
        evidence=risk.evidence, linked_identities=risk.linked_identities,
        latency_ms=latency_ms)
    event = _emit(req, ident, risk, decision, bot_result)

    # per-session history for the analyst queue / detail view
    _session_decisions.setdefault(req.session_id, []).append(event)
    _session_meta[req.session_id] = {
        "tenant": req.tenant, "identity_id": ident.identity_id,
        "source": req.source, "memory_enabled": req.memory_enabled}

    return ChatResponse(
        reply=reply, action=action, score=risk.risk_score, tactics=risk.tactics,
        evidence_ids=[e.memory_id for e in risk.evidence],
        verification_required=verification_required(action))


def _emit(req: ChatRequest, ident: Any, risk: Any, decision: Decision,
          bot_result: Any) -> dict[str, Any]:
    event = {
        "type": "decision",
        "tenant": req.tenant,
        "session_id": req.session_id,
        "identity_id": ident.identity_id,
        "memory_enabled": req.memory_enabled,
        "source": req.source,
        "message": req.text,
        "score": risk.risk_score,
        "action": decision.action,
        "tactics": risk.tactics,
        "stage": risk.stage,
        "evidence": [e.model_dump() for e in risk.evidence],
        "linked_identities": risk.linked_identities,
        "tolerance_match": risk.tolerance_match,
        "explanation": risk.explanation,
        "latency_ms": decision.latency_ms,
        "tools_run": list(getattr(bot_result, "tools_run", [])),
        "tools_refused": list(getattr(bot_result, "tools_refused", [])),
        "ts": time.time(),
    }
    publish(event)
    return event


# ---- read accessors for the API surface ----

def transcript(session_id: str) -> list[dict[str, str]]:
    return list(_sessions.get(session_id, []))


def session_detail(session_id: str) -> dict[str, Any] | None:
    if session_id not in _session_meta:
        return None
    meta = _session_meta[session_id]
    return {"session_id": session_id, **meta,
            "turns": transcript(session_id),
            "decisions": list(_session_decisions.get(session_id, []))}


def queue(min_score: int = 40) -> list[dict[str, Any]]:
    """Latest decision per session whose score crossed the flag threshold."""
    out = []
    for sid, decisions in _session_decisions.items():
        if not decisions:
            continue
        top = max(decisions, key=lambda d: d["score"])
        latest = decisions[-1]
        if top["score"] < min_score:
            continue
        out.append({
            "session_id": sid, "tenant": latest["tenant"],
            "identity_id": latest["identity_id"], "score": top["score"],
            "action": top["action"], "tactics": top["tactics"],
            "last_message": latest["message"], "ts": latest["ts"],
            "verdict": _session_meta.get(sid, {}).get("verdict"),
        })
    out.sort(key=lambda d: d["ts"], reverse=True)
    return out


def set_verdict(session_id: str, verdict: str) -> None:
    _session_meta.setdefault(session_id, {})["verdict"] = verdict


def identity_graph(min_score: int = 0) -> dict[str, Any]:
    """Actor-linking graph built from decisions the Risk Engine has linked.

    Nodes = identities we've seen; edges = "same actor" links the Risk Engine
    drew between the acting identity and others it recognised (account hopping).
    """
    nodes: dict[str, dict[str, Any]] = {}
    edges: dict[tuple[str, str], dict[str, Any]] = {}

    def touch(identity_id: str, tenant: str | None = None) -> dict[str, Any]:
        n = nodes.get(identity_id)
        if n is None:
            n = {"id": identity_id, "tenant": tenant, "sessions": set(),
                 "max_score": 0, "action": "allow", "tactics": set(), "flagged": False}
            nodes[identity_id] = n
        if tenant and not n["tenant"]:
            n["tenant"] = tenant
        return n

    for sid, decisions in _session_decisions.items():
        if not decisions:
            continue
        top = max(decisions, key=lambda d: d["score"])
        iid = top["identity_id"]
        n = touch(iid, top.get("tenant"))
        n["sessions"].add(sid)
        if top["score"] > n["max_score"]:
            n["max_score"] = top["score"]
            n["action"] = top["action"]
        for t in top.get("tactics", []):
            if t and t != "none":
                n["tactics"].add(t)
        if _session_meta.get(sid, {}).get("verdict") == "confirmed" or top["score"] >= 70:
            n["flagged"] = True
        for other in top.get("linked_identities", []):
            if not other or other == iid:
                continue
            touch(other, top.get("tenant"))
            key = tuple(sorted((iid, other)))
            e = edges.get(key)
            if e is None:
                edges[key] = {"source": key[0], "target": key[1], "weight": 1}
            else:
                e["weight"] += 1

    node_list = [{**n, "sessions": len(n["sessions"]), "tactics": sorted(n["tactics"])}
                 for n in nodes.values() if n["max_score"] >= min_score or n["flagged"]]
    keep = {n["id"] for n in node_list}
    edge_list = [e for e in edges.values() if e["source"] in keep and e["target"] in keep]
    return {"nodes": node_list, "edges": edge_list}
