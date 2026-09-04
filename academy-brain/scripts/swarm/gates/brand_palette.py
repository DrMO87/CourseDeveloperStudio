"""Enforce the real Techno Square palette and reject retired placeholders."""

from __future__ import annotations

import re

from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register

APPROVED = frozenset({"#231F20", "#FFED10", "#585858", "#FFFFFF"})
RETIRED = frozenset({"#F5B301", "#1A1A1A"})

_HEX = re.compile(r"#[0-9A-Fa-f]{6}")


@register("brand-palette")
def check(text: str) -> GateResult:
    """Fail if any retired brand color appears."""
    found = {m.upper() for m in _HEX.findall(text)}
    if not found:
        return GateResult("brand-palette", UNVERIFIED, "no hex colors found", {})

    retired = sorted(found & RETIRED)
    if retired:
        return GateResult(
            "brand-palette",
            FAIL,
            f"retired brand color(s) present: {', '.join(retired)}",
            {"retired": retired, "found": sorted(found)},
        )
    return GateResult(
        "brand-palette", PASS, "no retired colors", {"found": sorted(found)}
    )
