"""Refuse an approval record that isn't bound to the content it approves.

`enforce_blueprint_gate()` (`generate_session.py`) already requires exact
status, typed authority, and no unresolved gap markers on the bundle's own
blueprint — that check is untouched here. What is missing before this batch
is an evidential link from the `60-approved` stage's metadata to the actual
reviewed English revision and its upstream evidence: a decision that names a
hash without checking it is a self-asserted approval, not a settled one.
This gate checks the record's own structure; `stage_gate.py` recomputes each
`upstream` stage's real current hash, since a single-file gate cannot see
the rest of the vault.
"""

from __future__ import annotations

import hashlib
import re

import yaml

from swarm.gates import FAIL, PASS, GateResult, register

_YAML_FENCE = re.compile(
    r"^```yaml[ \t]*\r?\n(.*?)\r?\n```[ \t]*\r?$", re.DOTALL | re.MULTILINE
)

# Mirrors generate_session.py's APPROVAL_KINDS — the same closed vocabulary of
# who was competent to settle a decision, duplicated here because this module
# judges a different artifact (60-approved content, not the bundle blueprint)
# and gates/ modules do not import the generation pipeline.
AUTHORITIES = ("specialist_council", "owner_business", "physical_action_required")

MIN_CONTENT_WORDS = 8


def parse_approval(text: str) -> dict:
    """Extract and structurally validate the ```yaml approval block. Raises ValueError."""
    matches = list(_YAML_FENCE.finditer(text))
    if not matches:
        raise ValueError(
            "no ```yaml approval block found — an approval record must bind "
            "a decision to the actual settled content, not just declare status"
        )
    errors: list[str] = []
    for match in matches:
        try:
            return _parse_approval_block(match.group(1))
        except ValueError as exc:
            errors.append(str(exc))
    raise ValueError(f"no valid approval block found; last: {errors[-1]}")


def _parse_approval_block(block: str) -> dict:
    try:
        doc = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        raise ValueError(f"approval block does not parse: {exc}") from exc
    if not isinstance(doc, dict):
        raise ValueError("approval block is not a YAML mapping")
    if doc.get("kind") != "approval-decision":
        raise ValueError("missing or wrong `kind` (expected 'approval-decision')")
    if not isinstance(doc.get("actor"), str) or not doc["actor"].strip():
        raise ValueError("approval block declares no `actor`")
    if doc.get("authority") not in AUTHORITIES:
        raise ValueError(f"approval `authority` {doc.get('authority')!r} is not one of {AUTHORITIES}")
    if not isinstance(doc.get("rationale"), str) or not doc["rationale"].strip():
        raise ValueError("approval block declares no `rationale`")

    content = doc.get("content")
    if not isinstance(content, str) or len(content.split()) < MIN_CONTENT_WORDS:
        raise ValueError(
            f"approval `content` is too short to be the settled explanation, "
            f"not just a label (need >= {MIN_CONTENT_WORDS} words)"
        )
    content_hash = doc.get("content_hash")
    if not isinstance(content_hash, str) or not content_hash.strip():
        raise ValueError("approval block declares no `content_hash`")
    if content_hash != hashlib.sha256(content.encode("utf-8")).hexdigest():
        raise ValueError("approval `content_hash` does not match the sha256 of `content`")

    upstream = doc.get("upstream")
    if not isinstance(upstream, list) or not upstream:
        raise ValueError("approval block binds to no `upstream` evidence")
    seen_stages: set[str] = set()
    for link in upstream:
        if not isinstance(link, dict):
            raise ValueError(f"upstream link {link!r} is not a mapping")
        stage = link.get("stage")
        if not isinstance(stage, str) or not stage.strip():
            raise ValueError(f"upstream link {link!r} declares no `stage`")
        if stage in seen_stages:
            raise ValueError(f"upstream stage {stage!r} is bound more than once")
        seen_stages.add(stage)
        if not isinstance(link.get("hash"), str) or not link["hash"].strip():
            raise ValueError(f"upstream link for stage {stage!r} declares no `hash`")

    doc["_upstream"] = {link["stage"]: link["hash"] for link in upstream}
    return doc


@register("approval-decision")
def approval_decision(text: str) -> GateResult:
    try:
        doc = parse_approval(text)
    except ValueError as exc:
        return GateResult("approval-decision", FAIL, str(exc))
    return GateResult(
        "approval-decision",
        PASS,
        f"settled by {doc['actor']!r} under {doc['authority']}, bound to {len(doc['_upstream'])} upstream stage(s)",
        {"upstream": sorted(doc["_upstream"])},
    )
