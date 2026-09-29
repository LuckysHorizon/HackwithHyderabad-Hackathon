"""Core data models shared across the Gateway hot path and workers."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Action = Literal["allow", "verify", "block", "sandbox"]
Stage = Literal["probing", "escalating", "extraction", "benign"]
VerdictKind = Literal["confirmed", "dismissed"]
LinkStrength = Literal["strong", "soft"]

# Controlled tactic vocabulary (mirrors the antibody-traffic entity labels).
TACTICS = [
    "authority_claim",
    "loyalty_claim",
    "urgency_pressure",
    "policy_manipulation",
    "instruction_injection",
    "account_hopping",
    "none",
]


class Evidence(BaseModel):
    memory_id: str
    why: str


class Link(BaseModel):
    identity_id: str
    strength: LinkStrength
    reason: str


class Identity(BaseModel):
    identity_id: str
    hashed_keys: list[str] = Field(default_factory=list)  # phone, email, PNR, device
    linked: list[Link] = Field(default_factory=list)
    trusted: bool = False
    is_new: bool = True


class RiskResult(BaseModel):
    """Raw output of the Risk Engine LLM call (enforced JSON)."""
    risk_score: int = 0  # 0-100
    tactics: list[str] = Field(default_factory=list)
    stage: Stage = "benign"
    evidence: list[Evidence] = Field(default_factory=list)
    linked_identities: list[str] = Field(default_factory=list)
    tolerance_match: bool = False
    recommended_action: Action = "allow"
    explanation: str = ""


class Decision(BaseModel):
    session_id: str
    identity_id: str
    tenant: str
    score: int
    action: Action
    tactics: list[str] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    linked_identities: list[str] = Field(default_factory=list)
    latency_ms: int = 0


class Verdict(BaseModel):
    session_id: str
    verdict: VerdictKind
    tactic: Optional[str] = None
    analyst: str = "system"
    note: Optional[str] = None
    ts: datetime = Field(default_factory=datetime.utcnow)


# ---- API request/response ----

class ChatHints(BaseModel):
    account_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    device_id: Optional[str] = None
    pnr: Optional[str] = None


class ChatRequest(BaseModel):
    tenant: str
    session_id: str
    text: str
    hints: ChatHints = Field(default_factory=ChatHints)
    memory_enabled: bool = True
    source: Literal["live", "replay", "scamme", "dream"] = "live"


class ChatResponse(BaseModel):
    reply: str
    action: Action
    score: int
    tactics: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    verification_required: bool = False
