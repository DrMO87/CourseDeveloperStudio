"""Refuse a digest that is only extraction wearing a synthesis label.

`digest_office.py`/`run_digest.py` deliberately stay mechanical — zero LLM
cost, slide text and notes copied verbatim. That is correct and this gate
does not touch it. What it checks is the separate synthesis block a
specialist must add on top before a digest counts as understood rather than
merely extracted: an explanation tied to real claims, not a second copy of
the slide text.
"""

from __future__ import annotations

import re

import yaml

from swarm.gates import FAIL, PASS, GateResult, register

_YAML_FENCE = re.compile(
    r"^```yaml[ \t]*\r?\n(.*?)\r?\n```[ \t]*\r?$", re.DOTALL | re.MULTILINE
)

MIN_EXPLANATION_WORDS = 8


def parse_synthesis(text: str) -> dict:
    """Extract and structurally validate the ```yaml synthesis block. Raises ValueError."""
    matches = list(_YAML_FENCE.finditer(text))
    if not matches:
        raise ValueError(
            "no ```yaml synthesis block found — this digest is extraction "
            "only, with no objective-linked explanation added on top"
        )
    errors: list[str] = []
    for match in matches:
        try:
            return _parse_synthesis_block(match.group(1))
        except ValueError as exc:
            errors.append(str(exc))
    raise ValueError(f"no valid synthesis block found; last: {errors[-1]}")


def _parse_synthesis_block(block: str) -> dict:
    try:
        doc = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        raise ValueError(f"synthesis block does not parse: {exc}") from exc
    if not isinstance(doc, dict):
        raise ValueError("synthesis block is not a YAML mapping")
    if doc.get("kind") != "digest-synthesis":
        raise ValueError("yaml block present but missing `kind: digest-synthesis`")

    explanation = str(doc.get("explanation", "")).strip()
    word_count = len(explanation.split())
    if word_count < MIN_EXPLANATION_WORDS:
        raise ValueError(
            f"`explanation` is too short ({word_count} word(s)) to be a real "
            "explanation rather than a copied fragment"
        )

    claims = doc.get("claims")
    if (
        not isinstance(claims, list)
        or not claims
        or any(not isinstance(claim, str) or not claim.strip() for claim in claims)
    ):
        raise ValueError("synthesis declares no supporting `claims`")

    holes = doc.get("holes", [])
    if not isinstance(holes, list):
        raise ValueError("`holes` must be a list")

    doc["_claims"] = list(claims)
    doc["_holes"] = list(holes)
    return doc


@register("digest-synthesis")
def digest_synthesis(text: str) -> GateResult:
    try:
        doc = parse_synthesis(text)
    except ValueError as exc:
        return GateResult("digest-synthesis", FAIL, str(exc))
    return GateResult(
        "digest-synthesis",
        PASS,
        f"{len(doc['_claims'])} claim(s) cited, {len(doc['_holes'])} hole(s)",
        {"claims": doc["_claims"], "holes": doc["_holes"]},
    )
