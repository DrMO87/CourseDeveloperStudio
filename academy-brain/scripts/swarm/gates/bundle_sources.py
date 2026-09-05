"""Refuse a SOURCES.md that names claims without locating them.

Comparison doc §3.10: the bundle's `SOURCES.md` must carry "C1/C2, source
revisions, locators, and transformations used by this bundle" — not just
prose repeating what the digest already said. This gate checks that
structure; `stage_gate.py` cross-checks that every claim id here actually
resolves against a real provenance record, since a single-file gate cannot
see the provenance directory.
"""

from __future__ import annotations

import re

import yaml

from swarm.gates import FAIL, PASS, GateResult, register

_YAML_FENCE = re.compile(
    r"^```yaml[ \t]*\r?\n(.*?)\r?\n```[ \t]*\r?$", re.DOTALL | re.MULTILINE
)


def parse_sources(text: str) -> dict:
    """Extract and structurally validate the ```yaml sources block. Raises ValueError."""
    matches = list(_YAML_FENCE.finditer(text))
    if not matches:
        raise ValueError(
            "no ```yaml sources block found — SOURCES.md must name claims, "
            "revisions, and locators, not just restate the digest"
        )
    errors: list[str] = []
    for match in matches:
        try:
            return _parse_sources_block(match.group(1))
        except ValueError as exc:
            errors.append(str(exc))
    raise ValueError(f"no valid sources block found; last: {errors[-1]}")


def _parse_sources_block(block: str) -> dict:
    try:
        doc = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        raise ValueError(f"sources block does not parse: {exc}") from exc
    if not isinstance(doc, dict):
        raise ValueError("sources block is not a YAML mapping")
    if doc.get("kind") != "bundle-sources":
        raise ValueError("missing or wrong `kind` (expected 'bundle-sources')")

    claims = doc.get("claims")
    if not isinstance(claims, list) or not claims:
        raise ValueError("sources block declares no `claims`")

    seen_ids: set[str] = set()
    for claim in claims:
        if not isinstance(claim, dict):
            raise ValueError(f"claim {claim!r} is not a mapping")
        cid = claim.get("id")
        if not isinstance(cid, str) or not cid.strip():
            raise ValueError(f"claim {claim!r} declares no `id`")
        if cid in seen_ids:
            raise ValueError(f"claim id {cid!r} is used more than once")
        seen_ids.add(cid)

        for field in ("source", "revision", "locator"):
            if not isinstance(claim.get(field), str) or not claim[field].strip():
                raise ValueError(f"claim {cid!r} declares no `{field}`")

    doc["_claim_ids"] = sorted(seen_ids)
    return doc


@register("bundle-sources")
def bundle_sources(text: str) -> GateResult:
    try:
        doc = parse_sources(text)
    except ValueError as exc:
        return GateResult("bundle-sources", FAIL, str(exc))
    return GateResult(
        "bundle-sources",
        PASS,
        f"{len(doc['_claim_ids'])} claim(s) sourced",
        {"claims": doc["_claim_ids"]},
    )
