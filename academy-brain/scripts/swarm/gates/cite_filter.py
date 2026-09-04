"""Reject change proposals that cite no source.

Agents may reorganize freely; they may not invent curriculum. This is the
property that makes an unsupervised pipeline safe.
"""

from __future__ import annotations

import json

from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register


def _has_citation(issue: dict) -> bool:
    cites = issue.get("cites") or []
    return any(isinstance(c, str) and c.strip() for c in cites)


def filter_issues(payload: dict) -> tuple[list[dict], list[dict]]:
    """Split issues into (kept, dropped) on whether they cite a source."""
    issues = payload.get("issues") or []
    kept = [i for i in issues if _has_citation(i)]
    dropped = [i for i in issues if not _has_citation(i)]
    return kept, dropped


@register("cite-filter")
def check(text: str) -> GateResult:
    """Verdict on a raw critique payload."""
    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return GateResult("cite-filter", UNVERIFIED, "payload is not valid JSON", {})

    kept, dropped = filter_issues(payload)
    evidence = {
        "kept": len(kept),
        "dropped": len(dropped),
        "dropped_locs": [i.get("loc") for i in dropped],
    }

    if not kept and dropped:
        return GateResult(
            "cite-filter", FAIL, "every proposed change is uncited", evidence
        )
    return GateResult(
        "cite-filter", PASS, f"{len(kept)} cited, {len(dropped)} dropped", evidence
    )
