"""Enforce an institute's target English/Arabic ratio (Techno Square's default: 30/70).

STEP 12: TARGET_ARABIC/TOLERANCE used to be hardcoded module constants. They now come
from the per-job OrgConfig (see ``swarm.org_config``), defaulting to Techno Square's own
0.70/0.10 for any standalone/manual invocation that supplies none. The Arabic/Latin
Unicode classifiers below stay fixed — not every institute wants Arabic/English at all
(see the ticket), but generalizing to a third script is a separate, explicitly-authorized
algorithm change, not silently in scope here.
"""

from __future__ import annotations

from swarm import org_config
from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register

_ARABIC_RANGES = ((0x0600, 0x06FF), (0x0750, 0x077F), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF))


def _is_arabic(ch: str) -> bool:
    code = ord(ch)
    return any(lo <= code <= hi for lo, hi in _ARABIC_RANGES)


def _is_latin(ch: str) -> bool:
    return ("a" <= ch <= "z") or ("A" <= ch <= "Z")


@register("arabic-ratio")
def check(text: str, *, config: org_config.OrgConfig | None = None) -> GateResult:
    """Compare Arabic letter share against the configured target."""
    cfg = config or org_config.TECHNO_SQUARE_DEFAULT
    target_arabic = cfg.language_policy.target_ratio
    tolerance = cfg.language_policy.tolerance

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

    if abs(ratio - target_arabic) <= tolerance:
        return GateResult("arabic-ratio", PASS, f"ratio {ratio:.0%} within tolerance", evidence)

    direction = "too little Arabic" if ratio < target_arabic else "too little English"
    return GateResult(
        "arabic-ratio",
        FAIL,
        f"ratio {ratio:.0%} vs target {target_arabic:.0%} — {direction}",
        evidence,
    )
