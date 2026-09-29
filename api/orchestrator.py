"""Orchestrator: deterministic policy that turns a risk score into an action.

Kept separate from the Risk Engine (the LLM) on purpose — the mapping from
score to allow/verify/block/sandbox is a policy decision we want auditable and
testable without a model in the loop. Fail safe, not open.
"""
from __future__ import annotations

from api.models import Action

# Score bands. Tuned for demo legibility; edit here, nowhere else.
VERIFY_AT = 40
BLOCK_AT = 70
SANDBOX_AT = 90

# Tools that move money / leak data — these get an extra guard on top of score.
MONEY_MOVING_TOOLS = {
    "transfer_funds", "issue_refund", "change_payee", "reset_password",
    "change_email", "cancel_booking", "issue_travel_voucher",
}


def map_action(score: int) -> Action:
    """Pure score → action. The single source of truth for the bands."""
    if score >= SANDBOX_AT:
        return "sandbox"
    if score >= BLOCK_AT:
        return "block"
    if score >= VERIFY_AT:
        return "verify"
    return "allow"


def guard_tool(action: Action, tool_name: str) -> Action:
    """Escalate a borderline action when the pending tool moves money/data.

    An 'allow' that would fire a money-moving tool while any suspicion exists
    should still be verified; we never let a money-moving call through on a
    'verify' — it must be blocked until identity is confirmed out of band.
    """
    if tool_name not in MONEY_MOVING_TOOLS:
        return action
    if action == "verify":
        return "block"
    return action


def verification_required(action: Action) -> bool:
    return action in ("verify", "block", "sandbox")
