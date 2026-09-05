"""Deterministic pre-flight checks on the fully-resolved NBLM prompt text.

STEP 11 Phase B, Batch 3, option (b) (docs/tickets/handoffs/step11-nblm-prompt-authoring.md,
Part 1's per-gate-kind mapping table row 174). This runs against the fully-resolved
(post-option-(a)-templating) prompt text, before any NotebookLM quota is spent — never
against generated PDF content, and never with an LLM call.

Input is a JSON object (not the raw prompt file) so this stays a REGISTRY[str] -> GateResult
function like every other gate here, while still receiving the resolved facts a caller (the
worker's cascade reevaluator) already knows and this gate must never guess:

    {
      "promptText": "<the fully rendered prompt file text>",
      "expectedDurationText": "45 minutes",       # verbatim resolved duration text, or omit
      "expectedAudienceText": "ages 9-12",         # verbatim resolved audience text, or omit
      "expectedBrandingText": "...",               # verbatim resolved branding clause, or omit
      "forbiddenStrings": ["..."]                  # org BoundaryTerms.ForbiddenStrings, or omit
    }

Six checks, per the mapping table row:
1. Parser structure — exactly one deck-a and one summary section resolve; deck-b is
   optional but at most one. Unlike generate_session.py's own `parse_prompts` (which
   `setdefault`s on the first match), a duplicate recognized heading is a FAIL here.
2. Audience marker — the resolved audience string appears verbatim.
3. Branding markers — the resolved branding/mascot clause appears verbatim.
4. Duration — the resolved duration string appears verbatim.
5. Forbidden content — the prompt instruction text itself contains none of the org's
   forbidden strings.
6. Required sections — the summary deck's own instructions name all five mandatory
   bullets (Today I Learned / New Words / Review at Home / Parent Talk / Mini Activity).

The heading/fence regex below mirrors generate_session.py's private `_SECTION`/
`_FIRST_FENCE` exactly (parse_prompts's own contract) but is duplicated rather than
imported: generate_session.py imports `swarm.gates` at module scope, so importing back
from a module inside `swarm.gates` would be circular.
"""

from __future__ import annotations

import json
import re

from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register

_SECTION = re.compile(r"^## (?P<head>.+?)\n(?P<body>.*?)(?=^## |\Z)", re.S | re.M)
_FIRST_FENCE = re.compile(r"```\n(?P<body>.*?)\n```", re.S)

REQUIRED_SUMMARY_SECTIONS: tuple[str, ...] = (
    "Today I Learned",
    "New Words",
    "Review at Home",
    "Parent Talk",
    "Mini Activity",
)


def _classify(head: str) -> str | None:
    h = head.lower()
    if "pass b" in h:
        return "deck-b"
    if "notebook b" in h:
        return "summary"
    if "notebook a" in h:
        return "deck-a"
    return None


def _sections(prompt_text: str) -> tuple[dict[str, int], dict[str, str]]:
    """(counts per recognized key, first fenced instructions body per key)."""
    counts: dict[str, int] = {}
    fenced: dict[str, str] = {}
    for match in _SECTION.finditer(prompt_text):
        key = _classify(match.group("head"))
        if key is None:
            continue
        counts[key] = counts.get(key, 0) + 1
        if key not in fenced:
            fence = _FIRST_FENCE.search(match.group("body"))
            if fence:
                fenced[key] = fence.group("body")
    return counts, fenced


@register("nblm-prompt-preflight")
def nblm_prompt_preflight(text: str) -> GateResult:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        return GateResult("nblm-prompt-preflight", UNVERIFIED, f"payload does not parse as JSON: {exc}")
    if not isinstance(payload, dict):
        return GateResult("nblm-prompt-preflight", UNVERIFIED, "payload is not a JSON object")

    prompt_text = payload.get("promptText")
    if not isinstance(prompt_text, str) or not prompt_text.strip():
        return GateResult("nblm-prompt-preflight", UNVERIFIED, "payload has no non-empty 'promptText'")

    problems: list[str] = []
    counts, fenced = _sections(prompt_text)

    for key in ("deck-a", "summary"):
        if counts.get(key, 0) == 0:
            problems.append(f"no {key} section found")
        elif key not in fenced:
            problems.append(f"no {key} prompt block found")
    for key, count in counts.items():
        if count > 1:
            problems.append(f"{key} section appears {count} times — exactly one is allowed")

    expected_duration = payload.get("expectedDurationText")
    if expected_duration and expected_duration not in prompt_text:
        problems.append(f"resolved duration {expected_duration!r} does not appear in the rendered prompt")

    expected_audience = payload.get("expectedAudienceText")
    if expected_audience and expected_audience not in prompt_text:
        problems.append(f"resolved audience descriptor {expected_audience!r} does not appear in the rendered prompt")

    expected_branding = payload.get("expectedBrandingText")
    if expected_branding and expected_branding not in prompt_text:
        problems.append(f"resolved branding clause {expected_branding!r} does not appear in the rendered prompt")

    forbidden = payload.get("forbiddenStrings") or []
    found_forbidden = [f for f in forbidden if isinstance(f, str) and f and f in prompt_text]
    if found_forbidden:
        problems.append(f"forbidden string(s) present in prompt instructions: {', '.join(sorted(found_forbidden))}")

    summary_body = fenced.get("summary", "")
    missing_sections = [s for s in REQUIRED_SUMMARY_SECTIONS if s not in summary_body]
    if missing_sections and counts.get("summary", 0) == 1:
        # A missing/duplicated summary section is already reported above; only pile on
        # the required-sections check when there is exactly one summary body to check.
        problems.append(f"summary prompt missing required section(s): {', '.join(missing_sections)}")

    evidence = {
        "sectionCounts": counts,
        "missingSummarySections": missing_sections,
        "forbiddenFound": sorted(found_forbidden),
    }
    if problems:
        return GateResult("nblm-prompt-preflight", FAIL, "; ".join(problems), evidence)
    return GateResult(
        "nblm-prompt-preflight", PASS,
        "prompt structure, resolved fields, and required sections verified", evidence,
    )
