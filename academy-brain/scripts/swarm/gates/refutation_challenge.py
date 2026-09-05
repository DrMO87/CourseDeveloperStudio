"""Refuse a refutation record that never tried to disprove anything.

A matching file used to satisfy `55-refuted/<session>.md` without examining
the patch it names. ENGINE specifies a refutation pass for high-severity
patches: a fresh reviewer tries to construct a counterexample for each one.
This gate checks that structure — a challenge per claimed high-severity
patch, or an explicit applicability record when there is none. Whether the
named patch is actually high-severity is a cross-file question `stage_gate.py`
answers by reading the critique lanes; a single-file gate cannot see them.
"""

from __future__ import annotations

import re

import yaml

from swarm.gates import FAIL, PASS, GateResult, register

_YAML_FENCE = re.compile(
    r"^```yaml[ \t]*\r?\n(.*?)\r?\n```[ \t]*\r?$", re.DOTALL | re.MULTILINE
)

RESULTS = ("survived", "defeated")


def parse_refutation(text: str) -> dict:
    """Extract and structurally validate the ```yaml refutation block. Raises ValueError."""
    matches = list(_YAML_FENCE.finditer(text))
    if not matches:
        raise ValueError(
            "no ```yaml refutation block found — a refutation record must "
            "either challenge a high-severity patch or declare there is none"
        )
    errors: list[str] = []
    for match in matches:
        try:
            return _parse_refutation_block(match.group(1))
        except ValueError as exc:
            errors.append(str(exc))
    raise ValueError(f"no valid refutation block found; last: {errors[-1]}")


def _parse_refutation_block(block: str) -> dict:
    try:
        doc = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        raise ValueError(f"refutation block does not parse: {exc}") from exc
    if not isinstance(doc, dict):
        raise ValueError("refutation block is not a YAML mapping")
    if doc.get("kind") != "refutation-record":
        raise ValueError("missing or wrong `kind` (expected 'refutation-record')")
    if not isinstance(doc.get("reviewer"), str) or not doc["reviewer"].strip():
        raise ValueError("refutation block declares no `reviewer` identity")

    no_high_severity = doc.get("no_high_severity_patches")
    if not isinstance(no_high_severity, bool):
        raise ValueError("refutation block's `no_high_severity_patches` must be true or false")

    challenges = doc.get("challenges", [])
    if not isinstance(challenges, list):
        raise ValueError("refutation block's `challenges` must be a list")
    if not challenges and not no_high_severity:
        raise ValueError(
            "refutation block has no `challenges` and does not declare "
            "`no_high_severity_patches: true` — a missing pass is not a clean pass"
        )

    seen_issue_ids: set[str] = set()
    for challenge in challenges:
        if not isinstance(challenge, dict):
            raise ValueError(f"challenge {challenge!r} is not a mapping")
        iid = challenge.get("issue_id")
        if not isinstance(iid, str) or not iid.strip():
            raise ValueError(f"challenge {challenge!r} declares no `issue_id`")
        if iid in seen_issue_ids:
            raise ValueError(f"issue id {iid!r} is challenged more than once")
        seen_issue_ids.add(iid)

        for field in ("challenged_assertion", "reasoning"):
            if not isinstance(challenge.get(field), str) or not challenge[field].strip():
                raise ValueError(f"challenge {iid!r} declares no `{field}`")
        result = challenge.get("result")
        if result not in RESULTS:
            raise ValueError(f"challenge {iid!r} result {result!r} is not one of {RESULTS}")

    doc["_no_high_severity_patches"] = no_high_severity
    doc["_challenged_issue_ids"] = sorted(seen_issue_ids)
    doc["_challenge_results"] = {challenge["issue_id"]: challenge["result"] for challenge in challenges}
    return doc


@register("refutation-challenge")
def refutation_challenge(text: str) -> GateResult:
    try:
        doc = parse_refutation(text)
    except ValueError as exc:
        return GateResult("refutation-challenge", FAIL, str(exc))
    if doc["_no_high_severity_patches"] and not doc["_challenged_issue_ids"]:
        detail = "no high-severity patches to challenge"
    else:
        detail = f"{len(doc['_challenged_issue_ids'])} high-severity patch(es) challenged"
    return GateResult(
        "refutation-challenge",
        PASS,
        detail,
        {"challenged": doc["_challenged_issue_ids"]},
    )
