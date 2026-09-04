"""Enforce the Brain OS 30/70 English/Arabic ratio."""

from __future__ import annotations

from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register

TARGET_ARABIC = 0.70
TOLERANCE = 0.10

_ARABIC_RANGES = ((0x0600, 0x06FF), (0x0750, 0x077F), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF))


def _is_arabic(ch: str) -> bool:
    code = ord(ch)
    return any(lo <= code <= hi for lo, hi in _ARABIC_RANGES)


def _is_latin(ch: str) -> bool:
    return ("a" <= ch <= "z") or ("A" <= ch <= "Z")


@register("arabic-ratio")
def check(text: str) -> GateResult:
    """Compare Arabic letter share against the 70% target."""
    arabic = sum(1 for ch in text if _is_arabic(ch))
    latin = sum(1 for ch in text if _is_latin(ch))
    total = arabic + latin

    if total == 0:
        return GateResult(
            "arabic-ratio",
            UNVERIFIED,
            "no alphabetic content to measure",
            {"arabic": 0, "latin": 0},
        )

    ratio = arabic / total
    evidence = {"arabic_ratio": round(ratio, 3), "arabic": arabic, "latin": latin}

    if abs(ratio - TARGET_ARABIC) <= TOLERANCE:
        return GateResult("arabic-ratio", PASS, f"ratio {ratio:.0%} within tolerance", evidence)

    direction = "too little Arabic" if ratio < TARGET_ARABIC else "too little English"
    return GateResult(
        "arabic-ratio",
        FAIL,
        f"ratio {ratio:.0%} vs target {TARGET_ARABIC:.0%} — {direction}",
        evidence,
    )
