"""Refuse a provenance file that names a path instead of tracing a claim.

Checks the file's own structure: every traced claim maps to a specific
source, revision, and locator. Whether the named claim ids actually exist in
this session's specialist receipt is a cross-file question — a single-file
gate cannot see the receipt, so `stage_gate.py` performs that half of the
check itself.
"""

from __future__ import annotations

import yaml

from swarm.gates import FAIL, PASS, GateResult, register

REQUIRED_LINK_FIELDS = ("claim", "source", "revision", "locator", "excerpt")


def parse_provenance(text: str) -> dict:
    """Parse and structurally validate a provenance map. Raises ValueError."""
    try:
        doc = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise ValueError(f"provenance does not parse: {exc}") from exc
    if not isinstance(doc, dict):
        raise ValueError("provenance is not a YAML mapping")
    if doc.get("kind") != "provenance-map":
        raise ValueError("missing or wrong `kind` (expected 'provenance-map')")

    links = doc.get("links")
    if not isinstance(links, list) or not links:
        raise ValueError("provenance declares no `links`")

    claim_ids: list[str] = []
    for link in links:
        if not isinstance(link, dict):
            raise ValueError(f"link {link!r} is not a mapping")
        missing = [
            f
            for f in REQUIRED_LINK_FIELDS
            if not isinstance(link.get(f), str) or not link[f].strip()
        ]
        if missing:
            raise ValueError(
                f"link for claim {link.get('claim', '?')!r} missing field(s): "
                f"{', '.join(missing)}"
            )
        claim_ids.append(link["claim"])

    doc["_claim_ids"] = claim_ids
    return doc


@register("provenance-map")
def provenance_map(text: str) -> GateResult:
    try:
        doc = parse_provenance(text)
    except ValueError as exc:
        return GateResult("provenance-map", FAIL, str(exc))
    return GateResult(
        "provenance-map",
        PASS,
        f"{len(doc['_claim_ids'])} claim(s) traced to a source",
        {"claims": doc["_claim_ids"]},
    )
