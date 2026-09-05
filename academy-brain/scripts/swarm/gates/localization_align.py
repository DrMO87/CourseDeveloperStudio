"""Refuse a localized file that could exist without translation happening.

A character-ratio check (`arabic_ratio.py`) cannot detect a dropped negation,
a changed number, or a mistranslated code identifier — Arabic prose with the
wrong number in it still hits the target ratio. This gate checks the
alignment structure comparison doc §3.9 asks for: each English segment
carries its Arabic counterpart, its source claims, and every digit or
inline-code span from the English side must survive into the Arabic side
byte-for-byte. Whether those claims actually resolve, and whether the
declared upstream hash is current, are cross-file questions `stage_gate.py`
answers by reading provenance and the approved stage; a single-file gate
cannot see them.
"""

from __future__ import annotations

import re

import yaml

from swarm.gates import FAIL, PASS, GateResult, register
from swarm.gates.arabic_ratio import _is_arabic

_YAML_FENCE = re.compile(
    r"^```yaml[ \t]*\r?\n(.*?)\r?\n```[ \t]*\r?$", re.DOTALL | re.MULTILINE
)
_DIGIT_RUN = re.compile(r"\d+")
_INLINE_CODE = re.compile(r"`[^`]+`")

REQUIRED_BOUND_STAGE = "approved"


def parse_localization(text: str) -> dict:
    """Extract and structurally validate the ```yaml alignment block. Raises ValueError."""
    matches = list(_YAML_FENCE.finditer(text))
    if not matches:
        raise ValueError(
            "no ```yaml localization block found — a localized file must align "
            "English and Arabic segments, not just carry translated prose"
        )
    errors: list[str] = []
    for match in matches:
        try:
            return _parse_localization_block(match.group(1))
        except ValueError as exc:
            errors.append(str(exc))
    raise ValueError(f"no valid localization block found; last: {errors[-1]}")


def _parse_localization_block(block: str) -> dict:
    try:
        doc = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        raise ValueError(f"localization block does not parse: {exc}") from exc
    if not isinstance(doc, dict):
        raise ValueError("localization block is not a YAML mapping")
    if doc.get("kind") != "localization-alignment":
        raise ValueError("missing or wrong `kind` (expected 'localization-alignment')")

    bound_to = doc.get("bound_to")
    if not isinstance(bound_to, dict):
        raise ValueError("localization block declares no `bound_to` (stage, hash)")
    bound_stage = bound_to.get("stage")
    if bound_stage != REQUIRED_BOUND_STAGE:
        raise ValueError(
            f"localization `bound_to.stage` is {bound_stage!r} — must be "
            f"{REQUIRED_BOUND_STAGE!r}, the settled English snapshot"
        )
    bound_hash = bound_to.get("hash")
    if not isinstance(bound_hash, str) or not bound_hash.strip():
        raise ValueError("localization `bound_to.hash` is missing or empty")

    segments = doc.get("segments")
    if not isinstance(segments, list) or not segments:
        raise ValueError("localization block declares no `segments`")

    seen_ids: set[str] = set()
    all_claims: set[str] = set()
    for seg in segments:
        if not isinstance(seg, dict):
            raise ValueError(f"segment {seg!r} is not a mapping")
        sid = seg.get("id")
        if not isinstance(sid, str) or not sid.strip():
            raise ValueError(f"segment {seg!r} declares no `id`")
        if sid in seen_ids:
            raise ValueError(f"segment id {sid!r} is used more than once")
        seen_ids.add(sid)

        claims = seg.get("claims")
        if (
            not isinstance(claims, list)
            or not claims
            or any(not isinstance(c, str) or not c.strip() for c in claims)
        ):
            raise ValueError(f"segment {sid!r} declares no `claims`")
        all_claims.update(claims)

        english = seg.get("english")
        arabic = seg.get("arabic")
        if not isinstance(english, str) or not english.strip():
            raise ValueError(f"segment {sid!r} declares no `english`")
        if not isinstance(arabic, str) or not arabic.strip():
            raise ValueError(f"segment {sid!r} declares no `arabic`")
        if not any(_is_arabic(ch) and ch.isalpha() for ch in arabic):
            raise ValueError(f"segment {sid!r} `arabic` contains no Arabic letters")

        missing_digits = sorted({m for m in _DIGIT_RUN.findall(english) if m not in arabic})
        if missing_digits:
            raise ValueError(
                f"segment {sid!r} drops or changes number(s) from English to "
                f"Arabic: {', '.join(missing_digits)}"
            )
        missing_code = sorted({m for m in _INLINE_CODE.findall(english) if m not in arabic})
        if missing_code:
            raise ValueError(
                f"segment {sid!r} drops or alters code identifier(s) from "
                f"English to Arabic: {', '.join(missing_code)}"
            )

    doc["_segment_ids"] = sorted(seen_ids)
    doc["_cited_claims"] = sorted(all_claims)
    doc["_bound_stage"] = bound_stage
    doc["_bound_hash"] = bound_hash
    return doc


@register("localization-align")
def localization_align(text: str) -> GateResult:
    try:
        doc = parse_localization(text)
    except ValueError as exc:
        return GateResult("localization-align", FAIL, str(exc))
    return GateResult(
        "localization-align",
        PASS,
        f"{len(doc['_segment_ids'])} segment(s) aligned, bound to {doc['_bound_stage']!r}",
        {"segments": doc["_segment_ids"], "claims": doc["_cited_claims"]},
    )
