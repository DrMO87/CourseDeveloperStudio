"""Refuse a critique lane that is not an independent, sourced review.

`cite_filter.py` already refuses an issue with no citation. This gate checks
the rest of what ENGINE's three-lane promise requires of a single lane file
before `stage_gate.py` combines lanes into a stage verdict: which lane this
is, what draft it hashed as input, what it actually checked, and either the
issues it found or an explicit record that it found none. A lane that never
says who it is or what it looked at is not independent review — it is a file
that happens to sit in the right directory.
"""

from __future__ import annotations

import json

from swarm.gates import FAIL, PASS, GateResult, register

REQUIRED_ISSUE_FIELDS = ("id", "loc", "explanation")
SEVERITIES = ("low", "medium", "high")


def parse_lane(text: str) -> dict:
    """Parse and structurally validate one critique lane payload. Raises ValueError."""
    try:
        doc = json.loads(text.removeprefix("\ufeff"))
    except (json.JSONDecodeError, TypeError) as exc:
        raise ValueError(f"lane payload is not valid JSON: {exc}") from exc
    if not isinstance(doc, dict):
        raise ValueError("lane payload is not a JSON object")

    lane = doc.get("lane")
    if not isinstance(lane, str) or not lane.strip():
        raise ValueError("lane payload declares no `lane` identity")
    if not isinstance(doc.get("input_hash"), str) or not doc["input_hash"].strip():
        raise ValueError(f"lane {lane!r} declares no `input_hash` of the draft it reviewed")

    checklist = doc.get("checklist")
    if (
        not isinstance(checklist, list)
        or not checklist
        or any(not isinstance(c, str) or not c.strip() for c in checklist)
    ):
        raise ValueError(f"lane {lane!r} declares no `checklist` of what it inspected")

    reviewed_no_issues = doc.get("reviewed_no_issues") is True
    issues = doc.get("issues", [])
    if not isinstance(issues, list):
        raise ValueError(f"lane {lane!r} `issues` must be a list")
    if not issues and not reviewed_no_issues:
        raise ValueError(
            f"lane {lane!r} has no issues and no explicit `reviewed_no_issues: true` "
            "record — an empty file is not a reviewed-clean result"
        )

    seen_ids: set[str] = set()
    cited_claims: set[str] = set()
    for issue in issues:
        if not isinstance(issue, dict):
            raise ValueError(f"lane {lane!r} issue {issue!r} is not a mapping")
        iid = issue.get("id")
        if not isinstance(iid, str) or not iid.strip():
            raise ValueError(f"lane {lane!r} has an issue with no `id`")
        if iid in seen_ids:
            raise ValueError(f"lane {lane!r} issue id {iid!r} is used more than once")
        seen_ids.add(iid)

        missing = [f for f in REQUIRED_ISSUE_FIELDS if not isinstance(issue.get(f), str) or not issue[f].strip()]
        severity = issue.get("severity")
        if severity not in SEVERITIES:
            missing.append("severity")
        cites = issue.get("cites")
        if not isinstance(cites, list) or not cites or any(not isinstance(c, str) or not c.strip() for c in cites):
            if "cites" not in missing:
                missing.append("cites")
        if missing:
            raise ValueError(f"lane {lane!r} issue {iid!r} missing field(s): {', '.join(sorted(set(missing)))}")
        cited_claims.update(cites)

    doc["_lane"] = lane
    doc["_issue_ids"] = sorted(seen_ids)
    doc["_issue_severities"] = {i["id"]: i["severity"] for i in issues}
    doc["_cited_claims"] = sorted(cited_claims)
    doc["_reviewed_no_issues"] = reviewed_no_issues
    return doc


@register("critique-lane")
def critique_lane(text: str) -> GateResult:
    try:
        doc = parse_lane(text)
    except ValueError as exc:
        return GateResult("critique-lane", FAIL, str(exc))
    detail = f"lane {doc['_lane']!r}: {len(doc['_issue_ids'])} issue(s)"
    if doc["_reviewed_no_issues"] and not doc["_issue_ids"]:
        detail = f"lane {doc['_lane']!r}: reviewed, no issues"
    return GateResult(
        "critique-lane",
        PASS,
        detail,
        {"lane": doc["_lane"], "issues": doc["_issue_ids"]},
    )
