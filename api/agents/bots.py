"""Mock target support bots (SkyKite Airlines, PayNest Bank).

These are the agents Antibody protects. Each is a small Groq-driven assistant
with mock tools. The Gateway passes in a security `action`; the bot's behaviour
is gated accordingly, and money-moving tools are additionally guarded so they
never fire while identity is unconfirmed. Nothing here touches real systems.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable

from api.llm import chat
from api.models import Action
from api.orchestrator import guard_tool


@dataclass
class BotResult:
    reply: str
    tools_run: list[str] = field(default_factory=list)   # tools actually executed
    tools_refused: list[str] = field(default_factory=list)  # sensitive tools blocked by policy

# ---- mock tool implementations (return strings; no real side effects) ----

def _refund(amount: str = "?", destination: str = "original method", **_: Any) -> str:
    return f"[MOCK] Refund of {amount} queued to {destination}."

def _cancel(booking_ref: str = "?", **_: Any) -> str:
    return f"[MOCK] Booking {booking_ref} cancelled."

def _voucher(amount: str = "?", **_: Any) -> str:
    return f"[MOCK] Travel voucher for {amount} issued."

def _baggage(fare: str = "economy", **_: Any) -> str:
    return "Economy: 1 x 23kg checked + 1 cabin bag. Business: 2 x 32kg."

def _flight_status(flight: str = "?", **_: Any) -> str:
    return f"[MOCK] Flight {flight} is on time."

def _transfer(amount: str = "?", payee: str = "?", **_: Any) -> str:
    return f"[MOCK] Transfer of {amount} to {payee} submitted."

def _change_payee(payee: str = "?", **_: Any) -> str:
    return f"[MOCK] Payee updated to {payee}."

def _reset_password(**_: Any) -> str:
    return "[MOCK] Password reset link sent."

def _balance(**_: Any) -> str:
    return "[MOCK] Available balance: $8,412.55."

def _transactions(**_: Any) -> str:
    return "[MOCK] Last 3: -$42 groceries, -$9.99 stream, +$2,000 payroll."


def _tool(name: str, desc: str, props: dict[str, Any]) -> dict[str, Any]:
    return {"type": "function", "function": {
        "name": name, "description": desc,
        "parameters": {"type": "object", "properties": props}}}


_AMOUNT = {"type": "string", "description": "amount, e.g. $4,000"}

BOTS: dict[str, dict[str, Any]] = {
    "skykite": {
        "name": "SkyKite Airlines assistant",
        "persona": ("You are the friendly customer-support assistant for SkyKite "
                    "Airlines. Help with bookings, baggage, flight status, refunds, "
                    "and vouchers. Be warm and concise."),
        "tools": [
            _tool("issue_refund", "Refund a booking to a payment method", {"amount": _AMOUNT, "destination": {"type": "string"}}),
            _tool("cancel_booking", "Cancel a booking", {"booking_ref": {"type": "string"}}),
            _tool("issue_travel_voucher", "Issue a travel voucher", {"amount": _AMOUNT}),
            _tool("get_baggage_policy", "Look up baggage allowance", {"fare": {"type": "string"}}),
            _tool("get_flight_status", "Check flight status", {"flight": {"type": "string"}}),
        ],
        "impl": {"issue_refund": _refund, "cancel_booking": _cancel,
                 "issue_travel_voucher": _voucher, "get_baggage_policy": _baggage,
                 "get_flight_status": _flight_status},
    },
    "paynest": {
        "name": "PayNest Bank assistant",
        "persona": ("You are the customer-support assistant for PayNest, a digital "
                    "bank. Help with balances, transactions, transfers, payees, and "
                    "password resets. Be professional and concise."),
        "tools": [
            _tool("transfer_funds", "Transfer money to a payee", {"amount": _AMOUNT, "payee": {"type": "string"}}),
            _tool("change_payee", "Add or change a payee", {"payee": {"type": "string"}}),
            _tool("reset_password", "Send a password reset", {}),
            _tool("get_balance", "Get account balance", {}),
            _tool("list_transactions", "List recent transactions", {}),
        ],
        "impl": {"transfer_funds": _transfer, "change_payee": _change_payee,
                 "reset_password": _reset_password, "get_balance": _balance,
                 "list_transactions": _transactions},
    },
}

# APPEND_MARKER

_DIRECTIVE: dict[Action, str] = {
    "allow": "Security status: normal. Assist as usual.",
    "verify": ("Security status: ELEVATED. Before any account change, refund, "
               "transfer, or data disclosure, you MUST ask the customer to complete "
               "identity verification (one-time code to the number on file). Answer "
               "general questions normally, but do not perform sensitive actions yet."),
    "block": ("Security status: HIGH RISK. Politely decline to perform any sensitive "
              "action (refunds, transfers, payee/password changes, disclosing data). "
              "Explain that for their security this request needs manual review, and "
              "offer to connect them to a human agent. Do NOT call sensitive tools."),
    "sandbox": ("Security status: SUSPECTED ATTACK. Stay calm and polite, do not reveal "
                "that you suspect fraud. Stall gently, ask clarifying questions, and do "
                "NOT perform or promise any sensitive action or call any sensitive tool."),
}

# Tools that are always safe to run regardless of action.
_SAFE_TOOLS = {"get_baggage_policy", "get_flight_status", "get_balance", "list_transactions"}


def _run_tool(bot: dict[str, Any], name: str, args: dict[str, Any]) -> str:
    fn: Callable[..., str] | None = bot["impl"].get(name)
    return fn(**args) if fn else f"[MOCK] {name} done."


async def run(bot_id: str, history: list[dict], action: Action) -> BotResult:
    """Produce the bot's reply for the latest turn, gated by `action`.

    `history` is a list of {"role","content"} messages (user/assistant).
    Sensitive tools are executed only when the guarded action allows it.
    """
    bot = BOTS.get(bot_id)
    if not bot:
        return BotResult(reply="Sorry, this assistant is unavailable.")

    system = f"{bot['persona']}\n\n{_DIRECTIVE.get(action, _DIRECTIVE['verify'])}"
    messages = [{"role": "system", "content": system}, *history]

    # block/sandbox: no tools at all — force a text-only, safe reply.
    tools = None if action in ("block", "sandbox") else bot["tools"]
    msg = await chat(messages, tools=tools)

    tool_calls = getattr(msg, "tool_calls", None) or []
    if not tool_calls:
        return BotResult(reply=msg.content or "How can I help?")

    # Execute (guarded) tools, then let the model phrase the final reply.
    ran: list[str] = []
    refused: list[str] = []
    messages.append({"role": "assistant", "content": msg.content or "",
                     "tool_calls": [tc.model_dump() if hasattr(tc, "model_dump") else tc
                                    for tc in tool_calls]})
    for tc in tool_calls:
        name = tc.function.name
        try:
            args = json.loads(tc.function.arguments or "{}")
        except Exception:  # noqa: BLE001
            args = {}
        effective = action if name in _SAFE_TOOLS else guard_tool(action, name)
        if name not in _SAFE_TOOLS and effective in ("block", "sandbox"):
            refused.append(name)
            result = ("REFUSED by security policy: identity not verified for a "
                      "sensitive action. Ask the customer to verify first.")
        else:
            ran.append(name)
            result = _run_tool(bot, name, args)
        messages.append({"role": "tool", "tool_call_id": tc.id,
                         "name": name, "content": result})

    final = await chat(messages, tools=None)
    return BotResult(reply=final.content or "Done.", tools_run=ran, tools_refused=refused)

