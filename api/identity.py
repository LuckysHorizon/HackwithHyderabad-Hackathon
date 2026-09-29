"""Identity Resolver: turn raw hints into a stable, privacy-preserving id.

We never store raw phone/email/PNR. Each hint is HMAC-hashed with a server
salt; the identity_id is derived from the strongest available hashed key so the
same customer maps to the same id across sessions (that's what makes slow,
cross-session attacks visible). Cross-identity *linking* is done by the Risk
Engine over recalled memory — this module only resolves and hashes.
"""
from __future__ import annotations

import hashlib
import hmac

from api.config import settings
from api.models import ChatHints, Identity

# Strongest → weakest. The first present hint decides the identity_id.
_PRIORITY = ("account_id", "email", "phone", "device_id", "pnr")


def _hash(kind: str, value: str) -> str:
    norm = value.strip().lower()
    digest = hmac.new(settings.identity_salt.encode(), f"{kind}:{norm}".encode(),
                      hashlib.sha256).hexdigest()
    return f"{kind}:{digest[:16]}"


def last2(value: str) -> str:
    """UI-safe suffix — only ever reveal the last 2 chars of an identifier."""
    v = value.strip()
    return f"••{v[-2:]}" if len(v) >= 2 else "••"


def resolve(session_id: str, hints: ChatHints) -> Identity:
    present = [(k, getattr(hints, k)) for k in _PRIORITY if getattr(hints, k)]
    hashed_keys = [_hash(k, v) for k, v in present]

    if present:
        primary_kind, primary_val = present[0]
        identity_id = _hash(primary_kind, primary_val)
    else:
        # No hints: fall back to an ephemeral, session-scoped id.
        identity_id = f"anon:{hashlib.sha256(session_id.encode()).hexdigest()[:16]}"

    return Identity(identity_id=identity_id, hashed_keys=hashed_keys, is_new=True)
