"""FastAPI app: the Antibody Gateway HTTP/WS surface + static console."""
from __future__ import annotations

import json
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from api import analyst, dream, events, gateway
from api.models import ChatHints, ChatRequest, ChatResponse
from api.orchestrator import MONEY_MOVING_TOOLS
from api.sanitize import sanitize

WEB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await gateway.aclose()


app = FastAPI(title="Antibody Gateway", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])


# ---- core hot path ----

@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    return await gateway.handle(req)


# ---- dashboard data ----

@app.get("/feed")
async def feed() -> dict:
    return {"events": events.recent()}


@app.get("/queue")
async def queue() -> dict:
    return {"sessions": gateway.queue()}


@app.get("/session/{session_id}")
async def session(session_id: str) -> dict:
    detail = gateway.session_detail(session_id)
    if detail is None:
        raise HTTPException(404, "unknown session")
    return detail


@app.get("/campaigns")
async def campaigns() -> dict:
    confirmed = await gateway.memory().list_antigens("confirmed")
    return {"campaigns": confirmed}


# ---- identity graph ----

@app.get("/graph")
async def graph() -> dict:
    return gateway.identity_graph()


# ---- dream cycle ----

@app.get("/dream")
async def dream_list() -> dict:
    return {"insights": await gateway.memory().list_dreams()}


@app.post("/dream/run")
async def dream_run() -> dict:
    return await dream.run_dream()


# ---- eval harness report ----

_EVAL_REPORT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "eval_report.json")


@app.get("/eval")
async def eval_report() -> dict:
    if not os.path.isfile(_EVAL_REPORT):
        return {"available": False}
    try:
        with open(_EVAL_REPORT, encoding="utf-8") as f:
            return {"available": True, **json.load(f)}
    except Exception:
        return {"available": False}


@app.get("/metrics")
async def metrics() -> dict:
    evs = [e for e in events.recent() if e.get("type") == "decision"
           and e.get("source") != "dream"]
    by_action: dict[str, int] = {}
    lat = sorted(e.get("latency_ms", 0) for e in evs)
    for e in evs:
        by_action[e["action"]] = by_action.get(e["action"], 0) + 1

    def pct(p: float) -> int:
        if not lat:
            return 0
        return lat[min(len(lat) - 1, int(p * len(lat)))]

    on = [e for e in evs if e.get("memory_enabled")]
    off = [e for e in evs if not e.get("memory_enabled")]
    return {
        "total": len(evs), "by_action": by_action,
        "latency_p50": pct(0.50), "latency_p95": pct(0.95),
        "memory_on": {"n": len(on),
                      "cited": sum(1 for e in on if e.get("evidence"))},
        "memory_off": {"n": len(off),
                       "cited": sum(1 for e in off if e.get("evidence"))},
    }


# ---- analyst verdict loop ----

class VerdictBody(BaseModel):
    session_id: str
    verdict: str  # confirmed | dismissed
    tactic: str | None = None
    note: str | None = None
    analyst: str = "analyst"


@app.post("/verdict")
async def verdict(body: VerdictBody) -> dict:
    return await analyst.record_verdict(
        session_id=body.session_id, verdict=body.verdict,
        tactic=body.tactic, note=body.note, analyst=body.analyst)


# ---- Scam Me challenge ----

class ScamBody(BaseModel):
    nickname: str
    session_id: str
    text: str


_STATUS = {"allow": "Delivered", "verify": "Verification asked",
           "block": "Blocked", "sandbox": "Delivered"}  # sandbox keeps the decoy illusion

# Public challenge log (in-memory, demo scope) that feeds the big-screen scoreboard.
_SCAM_LOG: list[dict] = []


@app.post("/scamme")
async def scamme(body: ScamBody) -> dict:
    req = ChatRequest(tenant="skykite", session_id=f"scamme-{body.session_id}",
                      text=body.text, hints=ChatHints(),
                      memory_enabled=True, source="scamme")
    resp = await gateway.handle(req)
    decisions = gateway._session_decisions.get(req.session_id, [])
    ran = decisions[-1].get("tools_run", []) if decisions else []
    success = any(t in MONEY_MOVING_TOOLS for t in ran)
    status = _STATUS.get(resp.action, "Blocked")
    _SCAM_LOG.append({
        "nickname": (body.nickname or "anon")[:24], "session_id": body.session_id,
        "action": resp.action, "status": status, "success": success,
        "score": resp.score, "text": sanitize(body.text)[:140], "ts": time.time(),
    })
    return {"reply": resp.reply, "status": status,
            "action": resp.action, "score": resp.score, "success": success}


@app.get("/scoreboard-data")
async def scoreboard_data() -> dict:
    attempts = len(_SCAM_LOG)
    breached = sum(1 for a in _SCAM_LOG if a["success"])
    # one row per nickname: did they ever breach, and how many tries
    players: dict[str, dict] = {}
    for a in _SCAM_LOG:
        p = players.setdefault(a["nickname"], {"nickname": a["nickname"], "attempts": 0,
                                               "breached": False, "last_ts": 0.0})
        p["attempts"] += 1
        p["breached"] = p["breached"] or a["success"]
        p["last_ts"] = max(p["last_ts"], a["ts"])
    leaders = sorted(players.values(),
                     key=lambda p: (not p["breached"], p["attempts"], -p["last_ts"]))
    return {
        "attempts": attempts, "breached": breached, "blocked": attempts - breached,
        "leaders": leaders[:12],
        "recent": list(reversed(_SCAM_LOG[-14:])),
    }


# ---- live events ----

@app.websocket("/events")
async def events_ws(ws: WebSocket) -> None:
    await ws.accept()
    q = events.subscribe()
    try:
        for e in events.recent()[-25:]:
            await ws.send_json(e)
        while True:
            e = await q.get()
            await ws.send_json(e)
    except WebSocketDisconnect:
        pass
    finally:
        events.unsubscribe(q)


# ---- static console (mounted last so API routes win) ----

if os.path.isdir(WEB_DIR):
    app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(os.path.join(WEB_DIR, "index.html"))

    @app.get("/scamme-app")
    async def scamme_page() -> FileResponse:
        return FileResponse(os.path.join(WEB_DIR, "scamme.html"))

    @app.get("/scoreboard")
    async def scoreboard_page() -> FileResponse:
        return FileResponse(os.path.join(WEB_DIR, "scoreboard.html"))
