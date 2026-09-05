"""Refuse a specialist receipt that is just a filename, not a sourced claim.

`90-receipts/` already holds two legitimate YAML writers: `gate_runner.py`'s
gate receipts and `generate_session.py`'s production receipts. Neither is a
specialist reading a source and authoring claims — the step
`00-contracts/pdf-intake-sop.md` actually describes. This gate distinguishes
that third kind from the other two so an ordinary gate receipt can no longer
pass as one.
"""

from __future__ import annotations

import yaml

from swarm.gates import FAIL, PASS, GateResult, register

REQUIRED_CLAIM_FIELDS = ("id", "statement", "source", "locator", "excerpt")


def parse_receipt(text: str) -> dict:
    """Parse and structurally validate a specialist receipt. Raises ValueError."""
    try:
        doc = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise ValueError(f"receipt does not parse: {exc}") from exc
    if not isinstance(doc, dict):
        raise ValueError("receipt is not a YAML mapping")
    if doc.get("kind") != "specialist-receipt":
        raise ValueError(
            "missing or wrong `kind` (expected 'specialist-receipt') — an "
            "ordinary gate/production receipt does not satisfy the sourced-"
            "receipt requirement"
        )

    claims = doc.get("claims")
    if not isinstance(claims, list) or not claims:
        raise ValueError("receipt declares no `claims`")

    seen_ids: set[str] = set()
    for claim in claims:
        if not isinstance(claim, dict):
            raise ValueError(f"claim {claim!r} is not a mapping")
        missing = [
            f
            for f in REQUIRED_CLAIM_FIELDS
            if not isinstance(claim.get(f), str) or not claim[f].strip()
        ]
        if missing:
            raise ValueError(
                f"claim {claim.get('id', '?')!r} missing field(s): {', '.join(missing)}"
            )
        cid = claim["id"]
        if cid in seen_ids:
            raise ValueError(f"claim id {cid!r} is used more than once")
        seen_ids.add(cid)

    holes = doc.get("holes", [])
    if not isinstance(holes, list):
        raise ValueError("`holes` must be a list")
    hole_ids: set[str] = set()
    for hole in holes:
        if (
            not isinstance(hole, dict)
            or not isinstance(hole.get("id"), str)
            or not hole["id"].strip()
            or not isinstance(hole.get("description"), str)
            or not hole["description"].strip()
        ):
            raise ValueError(f"hole {hole!r} needs a non-empty `id` and `description`")
        hole_ids.add(hole["id"])

    doc["_claim_ids"] = sorted(seen_ids)
    doc["_hole_ids"] = sorted(hole_ids)
    return doc


@register("receipt-claims")
def receipt_claims(text: str) -> GateResult:
    try:
        doc = parse_receipt(text)
    except ValueError as exc:
        return GateResult("receipt-claims", FAIL, str(exc))
    return GateResult(
        "receipt-claims",
        PASS,
        f"{len(doc['_claim_ids'])} sourced claim(s), {len(doc['_hole_ids'])} hole(s)",
        {"claims": doc["_claim_ids"], "holes": doc["_hole_ids"]},
    )
