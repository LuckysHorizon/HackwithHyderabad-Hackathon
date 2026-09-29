"""Risk Engine: the LLM that scores one customer message against memory.

Input  = current message + the four recall streams (identity history, linked
          sessions, confirmed antigens, dismissed/tolerance patterns).
Output = a RiskResult with a 0-100 score, tactics, stage, and cited evidence.

Design commitments: cite real memory_ids or none; protect legitimate customers
(low scores when memory shows a known-good pattern); fail safe if the LLM is down.
"""
from __future__ import annotations

from typing import Any

from api.llm import call_tool
from api.memory.client import RecallBundle
from api.models import Evidence, RiskResult, TACTICS
from api.orchestrator import map_action

_TOOL = "report_risk"
_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": "Report the risk assessment of the current customer message.",
    "properties": {
        "risk_score": {"type": "integer", "minimum": 0, "maximum": 100,
                       "description": "0-39 benign, 40-69 suspicious, 70-89 likely attack, 90-100 confirmed/severe."},
        "tactics": {"type": "array", "items": {"type": "string", "enum": TACTICS},
                    "description": "Social-engineering tactics present. Use [\"none\"] if benign."},
        "stage": {"type": "string", "enum": ["probing", "escalating", "extraction", "benign"]},
        "evidence": {"type": "array", "description": "Cite the [memory_id]s from CONTEXT that justify the score. Empty list if nothing in memory applies — never invent an id.",
                     "items": {"type": "object",
                               "properties": {"memory_id": {"type": "string"},
                                              "why": {"type": "string"}},
                               "required": ["memory_id", "why"]}},
        "linked_identities": {"type": "array", "items": {"type": "string"},
                              "description": "identity_ids from CONTEXT that appear to be the same actor as this session."},
        "tolerance_match": {"type": "boolean",
                            "description": "true if this closely matches a DISMISSED/legitimate pattern in CONTEXT — protect that customer with a low score."},
        "explanation": {"type": "string", "description": "One or two analyst-facing sentences."},
    },
    "required": ["risk_score", "tactics", "stage", "evidence", "tolerance_match", "explanation"],
}

_SYSTEM = (
    "You are the Risk Engine of an immune-memory layer that sits in front of a "
    "customer-support AI. You score a single incoming customer message for "
    "social-engineering / fraud risk, using MEMORY of past sessions as evidence.\n"
    "Principles:\n"
    "- Cite evidence by the exact [memory_id] shown in CONTEXT. If nothing in "
    "memory is relevant, return an empty evidence list — never fabricate an id.\n"
    "- Attacks unfold slowly across sessions: an individually-innocent message "
    "can be part of an escalating pattern. Weigh the history.\n"
    "- Protect real customers. If CONTEXT shows this matches a known-good / "
    "dismissed pattern, set tolerance_match=true and score low.\n"
    "- Money-moving or data-extraction requests backed by authority/urgency "
    "claims and a thin or conflicting history score high.\n"
    "Respond ONLY by calling the report_risk tool."
)


def _text_of(item: Any) -> str:
    for attr in ("content", "text", "summary", "memory"):
        v = getattr(item, attr, None) or (item.get(attr) if isinstance(item, dict) else None)
        if v:
            return str(v)
    return str(item)


def _id_of(item: Any) -> str:
    for attr in ("memory_id", "id", "unit_id", "document_id"):
        v = getattr(item, attr, None) or (item.get(attr) if isinstance(item, dict) else None)
        if v:
            return str(v)
    return "unknown"


def _fmt(items: list[Any], label: str) -> str:
    if not items:
        return f"{label}: (none)"
    lines = [f"{label}:"]
    for it in items[:8]:
        lines.append(f"  [{_id_of(it)}] {_text_of(it)[:400]}")
    return "\n".join(lines)


def _context(bundle: RecallBundle) -> str:
    return "\n\n".join([
        _fmt(bundle.identity_history, "THIS CUSTOMER'S HISTORY"),
        _fmt(bundle.linked_identities, "OTHER SESSIONS WITH SHARED IDENTIFIERS/PEOPLE"),
        _fmt(bundle.antigens, "CONFIRMED ATTACK PATTERNS (any tenant)"),
        _fmt(bundle.tolerance, "KNOWN-GOOD / DISMISSED PATTERNS"),
    ])


def _safe_result() -> RiskResult:
    r = RiskResult(risk_score=45, stage="benign",
                   explanation="Risk Engine unavailable — defaulting to verify (fail safe).")
    r.recommended_action = map_action(r.risk_score)
    return r


async def assess(*, tenant: str, identity_id: str, message: str,
                 bundle: RecallBundle, is_new_identity: bool) -> RiskResult:
    user = (
        f"TENANT: {tenant}\n"
        f"THIS IDENTITY: {identity_id} (new_to_us={is_new_identity})\n\n"
        f"CONTEXT (memory):\n{_context(bundle)}\n\n"
        f"CURRENT MESSAGE:\n{message}"
    )
    try:
        args = await call_tool(
            [{"role": "system", "content": _SYSTEM},
             {"role": "user", "content": user}],
            tool_name=_TOOL, tool_schema=_SCHEMA,
        )
    except Exception:
        return _safe_result()

    score = max(0, min(100, int(args.get("risk_score", 0))))
    evidence = [Evidence(memory_id=str(e.get("memory_id", "")), why=str(e.get("why", "")))
                for e in (args.get("evidence") or []) if e.get("memory_id")]
    tactics = [t for t in (args.get("tactics") or []) if t in TACTICS] or ["none"]
    result = RiskResult(
        risk_score=score,
        tactics=tactics,
        stage=args.get("stage") if args.get("stage") in ("probing", "escalating", "extraction", "benign") else "benign",
        evidence=evidence,
        linked_identities=[str(x) for x in (args.get("linked_identities") or [])],
        tolerance_match=bool(args.get("tolerance_match", False)),
        explanation=str(args.get("explanation", "")),
    )
    result.recommended_action = map_action(result.risk_score)
    return result
