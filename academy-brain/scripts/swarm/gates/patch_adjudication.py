"""Refuse a patch that is not an adjudicated, inspectable revision.

A file with only a heading used to satisfy `50-patch/<session>.md`. ENGINE's
promise is that JUDGE resolves each critique issue with a cited rationale and
records an exact before/after text change on a new revision — not a second
unrestricted rewrite. This gate checks that structure; `stage_gate.py`
cross-checks that every `issue_id` here actually came from a real critique
lane, since a single-file gate cannot see the critique directory.
"""

from __future__ import annotations

import re

import yaml

from swarm.gates import FAIL, PASS, GateResult, register

_YAML_FENCE = re.compile(
    r"^```yaml[ \t]*\r?\n(.*?)\r?\n```[ \t]*\r?$", re.DOTALL | re.MULTILINE
)

DISPOSITIONS = ("applied", "withheld")


def parse_patch(text: str) -> dict:
    """Extract and structurally validate the ```yaml patch block. Raises ValueError."""
    matches = list(_YAML_FENCE.finditer(text))
    if not matches:
        raise ValueError(
            "no ```yaml patch block found — a patch record must adjudicate at "
            "least one critique issue, not just carry a heading"
        )
    errors: list[str] = []
    for match in matches:
        try:
            return _parse_patch_block(match.group(1))
        except ValueError as exc:
            errors.append(str(exc))
    raise ValueError(f"no valid patch block found; last: {errors[-1]}")


def _parse_patch_block(block: str) -> dict:
    try:
        doc = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        raise ValueError(f"patch block does not parse: {exc}") from exc
    if not isinstance(doc, dict):
        raise ValueError("patch block is not a YAML mapping")
    if doc.get("kind") != "patch-adjudication":
        raise ValueError("missing or wrong `kind` (expected 'patch-adjudication')")
    if not isinstance(doc.get("revision"), str) or not doc["revision"].strip():
        raise ValueError("patch block declares no `revision` identifier for the resulting draft")

    entries = doc.get("entries")
    if not isinstance(entries, list) or not entries:
        raise ValueError("patch block adjudicates no `entries`")

    seen_issue_ids: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError(f"entry {entry!r} is not a mapping")
        iid = entry.get("issue_id")
        if not isinstance(iid, str) or not iid.strip():
            raise ValueError(f"entry {entry!r} declares no `issue_id`")
        if iid in seen_issue_ids:
            raise ValueError(f"issue id {iid!r} is adjudicated more than once")
        seen_issue_ids.add(iid)

        disposition = entry.get("disposition")
        if disposition not in DISPOSITIONS:
            raise ValueError(f"entry {iid!r} disposition {disposition!r} is not one of {DISPOSITIONS}")
        if not isinstance(entry.get("rationale"), str) or not entry["rationale"].strip():
            raise ValueError(f"entry {iid!r} declares no `rationale`")

        if disposition == "applied":
            old_text, new_text = entry.get("old_text"), entry.get("new_text")
            if not isinstance(old_text, str) or not old_text.strip():
                raise ValueError(f"entry {iid!r} is applied but declares no `old_text`")
            if not isinstance(new_text, str) or not new_text.strip():
                raise ValueError(f"entry {iid!r} is applied but declares no `new_text`")
            if old_text == new_text:
                raise ValueError(f"entry {iid!r} `old_text` and `new_text` are identical")

    doc["_issue_ids"] = sorted(seen_issue_ids)
    return doc


@register("patch-adjudication")
def patch_adjudication(text: str) -> GateResult:
    try:
        doc = parse_patch(text)
    except ValueError as exc:
        return GateResult("patch-adjudication", FAIL, str(exc))
    return GateResult(
        "patch-adjudication",
        PASS,
        f"revision {doc['revision']!r}, {len(doc['_issue_ids'])} issue(s) adjudicated",
        {"revision": doc["revision"], "issues": doc["_issue_ids"]},
    )
