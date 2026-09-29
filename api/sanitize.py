"""Scrub real-looking identifiers out of text before it reaches the shared,
cross-tenant antigen bank. Antigens describe *tactics*, never a real customer.
"""
from __future__ import annotations

import re

_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[email]"),
    (re.compile(r"\b(?:\d[ -]?){13,19}\b"), "[card]"),        # card-length digit runs
    (re.compile(r"\b\+?\d[\d\s().-]{6,}\d\b"), "[phone]"),     # phone-ish sequences
    (re.compile(r"\b(?=[A-Z0-9]{6}\b)(?=[A-Z0-9]*\d)[A-Z0-9]{6}\b"), "[PNR]"),  # 6-char alnum w/ a digit
    (re.compile(r"\bsk-cust-\d+\b", re.I), "[account]"),
    (re.compile(r"\bACCT-\d+\b", re.I), "[account]"),
]


def sanitize(text: str) -> str:
    out = text
    for pat, repl in _RULES:
        out = pat.sub(repl, out)
    return out
