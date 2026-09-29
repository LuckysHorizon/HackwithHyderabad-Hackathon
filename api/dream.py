"""Dream Cycle: the immune system consolidating memory while off the hot path.

Between live traffic, we reflect over every confirmed antigen (across all
tenants) and let the memory system surface higher-order campaigns — clusters of
individually-logged attacks that are really one coordinated tactic. Each
synthesized insight is retained to the dream bank so the Risk Engine can cite it
later, and emitted as a `dream` event for the console.

Primary path uses Hindsight's own reflect(); if that yields nothing we fall
back to a Groq synthesis over the recalled antigen texts. Either way the output
is the same shape, so callers don't care which fired.
"""
from __future__ import annotations

import time
from typing import Any

from api import gateway
from api.events import publish
from api.llm import call_tool

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": "Consolidate many single confirmed attacks into emerging campaigns.",
    "properties": {
        "insights": {
            "type": "array",
            "description": "2-4 higher-order campaign patterns that span the confirmed antigens.",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Short campaign name, sentence case."},
                    "pattern": {"type": "string", "description": "What ties these attacks together, 1-2 sentences."},
                    "tactics": {"type": "array", "items": {"type": "string"}},
                    "recommendation": {"type": "string", "description": "What the agent should watch for next."},
                },
                "required": ["title", "pattern", "recommendation"],
            },
        }
    },
    "required": ["insights"],
}

_QUERY = ("Across every confirmed social-engineering attack in this bank, what "
          "coordinated campaigns or repeated tactics are emerging? Group single "
          "incidents into higher-order patterns support agents should anticipate.")

_SYNTH_SYSTEM = (
    "You are the Dream Cycle of an immune-memory layer. You consolidate a list of "
    "individually-confirmed social-engineering attacks into 2-4 higher-order "
    "campaign patterns that span them. Be concrete and non-repetitive; each "
    "insight should teach the agent something the raw list doesn't. Respond ONLY "
    "by calling summarize_campaigns."
)


async def _synthesize_via_groq(antigens: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not antigens:
        return None
    corpus = "\n".join(f"- ({','.join(a.get('tactics') or ['?'])}) {a.get('text','')[:300]}"
                       for a in antigens[:20])
    try:
        return await call_tool(
            [{"role": "system", "content": _SYNTH_SYSTEM},
             {"role": "user", "content": f"CONFIRMED ATTACKS:\n{corpus}"}],
            tool_name="summarize_campaigns", tool_schema=_SCHEMA)
    except Exception:
        return None


async def run_dream() -> dict[str, Any]:
    """Run one dream pass. Returns {insights: [...], source: "reflect"|"synthesis"}."""
    mc = gateway.memory()

    out = await mc.reflect_over_antigens(query=_QUERY, schema=_SCHEMA)
    source = "reflect"
    if not out or not out.get("insights"):
        antigens = await mc.list_antigens("confirmed")
        out = await _synthesize_via_groq(antigens)
        source = "synthesis"

    insights = (out or {}).get("insights") or []
    stored = []
    for ins in insights[:4]:
        title = str(ins.get("title", "")).strip()
        pattern = str(ins.get("pattern", "")).strip()
        rec = str(ins.get("recommendation", "")).strip()
        tactics = [str(t) for t in (ins.get("tactics") or [])]
        if not title:
            continue
        body = f"{pattern}\nWatch for: {rec}".strip()
        try:
            await mc.retain_dream(title=title, text=body, tactics=tactics)
        except Exception:  # noqa: BLE001 - a failed retain shouldn't drop the insight
            pass
        stored.append({"title": title, "pattern": pattern,
                       "recommendation": rec, "tactics": tactics})

    publish({"type": "dream", "source": source, "count": len(stored),
             "titles": [s["title"] for s in stored], "ts": time.time()})
    return {"insights": stored, "source": source}
