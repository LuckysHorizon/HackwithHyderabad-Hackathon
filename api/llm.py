"""Groq LLM access: forced-tool-call JSON with model + key fallback.

The Risk Engine needs structured output it can trust, so we use function
calling with a single forced tool and parse its arguments. Two API keys and
two models give us resilience against rate limits during a live demo.
"""
from __future__ import annotations

import json
from typing import Any

from groq import AsyncGroq

from api.config import settings


def _keys() -> list[str]:
    ks = [settings.groq_api_key, settings.groq_api_key_backup]
    return [k for k in ks if k]


def _models() -> list[str]:
    ms = [settings.groq_model, settings.groq_model_fallback]
    seen, out = set(), []
    for m in ms:
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


async def call_tool(messages: list[dict], *, tool_name: str,
                    tool_schema: dict, temperature: float = 0.0) -> dict[str, Any]:
    """Call Groq forcing `tool_name`; return its parsed arguments as a dict.

    Tries every (model, key) combination before giving up. Raises the last
    error only if all combinations fail — callers decide how to fail safe.
    """
    tools = [{
        "type": "function",
        "function": {"name": tool_name,
                     "description": tool_schema.get("description", ""),
                     "parameters": tool_schema},
    }]
    tool_choice = {"type": "function", "function": {"name": tool_name}}

    last_err: Exception | None = None
    for model in _models():
        for key in _keys():
            client = AsyncGroq(api_key=key)
            try:
                resp = await client.chat.completions.create(
                    model=model, messages=messages, tools=tools,
                    tool_choice=tool_choice, temperature=temperature,
                    max_tokens=1200,
                )
                call = resp.choices[0].message.tool_calls[0]
                return json.loads(call.function.arguments)
            except Exception as e:  # noqa: BLE001 - try next combo
                last_err = e
            finally:
                await client.close()
    raise RuntimeError(f"all Groq attempts failed: {last_err}")


async def chat(messages: list[dict], *, tools: list[dict] | None = None,
               temperature: float = 0.3, max_tokens: int = 700) -> Any:
    """General chat turn for the target bots. Returns the raw message object
    (has .content and optionally .tool_calls). Falls back across models/keys."""
    kwargs: dict[str, Any] = {"temperature": temperature, "max_tokens": max_tokens}
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    last_err: Exception | None = None
    for model in _models():
        for key in _keys():
            client = AsyncGroq(api_key=key)
            try:
                resp = await client.chat.completions.create(
                    model=model, messages=messages, **kwargs)
                return resp.choices[0].message
            except Exception as e:  # noqa: BLE001
                last_err = e
            finally:
                await client.close()
    raise RuntimeError(f"all Groq attempts failed: {last_err}")
