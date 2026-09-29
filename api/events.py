"""Tiny in-process event bus + decision log for the dashboard / threat feed."""
from __future__ import annotations

import asyncio
from collections import deque
from typing import Any

_subscribers: set[asyncio.Queue] = set()
_recent: deque[dict[str, Any]] = deque(maxlen=200)


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _subscribers.discard(q)


def recent() -> list[dict[str, Any]]:
    return list(_recent)


def publish(event: dict[str, Any]) -> None:
    """Fire-and-forget: record and push to all live subscribers."""
    _recent.append(event)
    for q in list(_subscribers):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass
