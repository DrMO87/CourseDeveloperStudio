"""Enforce an institute's brand palette and reject its retired placeholders.

STEP 12: RETIRED (and APPROVED, though the algorithm below never enforces it as an
allowlist — see the check() docstring) used to be Techno Square's literal hex codes,
hardcoded here. They now come from the per-job OrgConfig (see ``swarm.org_config``),
defaulting to Techno Square's own values for any standalone/manual invocation that
supplies none.
"""

from __future__ import annotations

import re

from swarm import org_config
from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register

_HEX = re.compile(r"#[0-9A-Fa-f]{6}")


@register("brand-palette")
def check(text: str, *, config: org_config.OrgConfig | None = None) -> GateResult:
    """Fail if any retired brand color appears.

    Retired-only rejection is deliberate and unchanged by STEP 12: APPROVED is never
    enforced as an allowlist, only RETIRED is checked. A color absent from both sets
    still passes.
    """
    cfg = config or org_config.TECHNO_SQUARE_DEFAULT
    found = {m.upper() for m in _HEX.findall(text)}
    if not found:
        return GateResult("brand-palette", UNVERIFIED, "no hex colors found", {})

    retired = sorted(found & cfg.brand_palette.retired)
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
