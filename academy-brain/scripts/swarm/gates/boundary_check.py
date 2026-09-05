"""Detect trainer-only content leaking into student-facing output.

Brain OS, Academy_Language_and_Output_Rules.md, Student-Facing Content Rule:
student-facing outputs must NOT include trainer scripts, trainer timing,
internal trainer notes, assessment checklists, classroom management notes,
private methodology, or long pedagogical explanations.

The marker list below covers the leaks that name themselves. Two items of that
rule have no reliable surface form and are NOT checked here — private
methodology and long pedagogical explanation are judged by agent/human review
per `00-contracts/brand-and-output.md` §6.
"""

from __future__ import annotations

import re

from swarm import org_config
from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register

TRAINER_MARKERS: tuple[str, ...] = (
    "trainer note",
    "trainer script",
    "trainer question",
    "expected answer",
    "common mistakes",
    "classroom management",
    "assessment checklist",
    "minutes for this",
    "trainer timing",
    "session flow",
    "trainer flow",
    "debugging note",
    "reflection question",
    "exit ticket",
    "ملاحظة للمدرب",
    "إجابة متوقعة",
    "دليل المدرب",
)

# Trainer-guide session flow is stated as a clock-time timeline (`00:00-00:10`)
# per brand-and-output.md §1d. That format is trainer-only by function, and no
# plain-word marker catches it.
#
# The obvious learner-side false positive — a video timestamp range — is not one:
# the academy teaches no video clips, and §7 already makes a video-only student
# slide a defect, confining video URLs to the Trainer Guide. Do not widen or
# weaken this pattern to admit them.
TRAINER_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "clock-time timeline",
        re.compile(
            r"\b(?:[01]?\d|2[0-3]):[0-5]\d\s*[-–—]\s*"
            r"(?:[01]?\d|2[0-3]):[0-5]\d\b"
        ),
    ),
)


@register("trainer-boundary")
def check(text: str, *, config: org_config.OrgConfig | None = None) -> GateResult:
    """Fail if any trainer-only marker appears in student-facing text.

    STEP 12: TRAINER_MARKERS/TRAINER_PATTERNS are a mandatory baseline that always runs —
    an institute cannot silently erase academy-wide leakage detection. Any per-job
    OrgConfig's ``boundary_terms.forbidden_strings`` are additive institute-specific terms
    unioned on top of that baseline, never a replacement.
    """
    if not text.strip():
        return GateResult("trainer-boundary", UNVERIFIED, "no content to scan", {})

    cfg = config or org_config.TECHNO_SQUARE_DEFAULT
    lowered = text.lower()
    markers = TRAINER_MARKERS + cfg.boundary_terms.forbidden_strings
    matches = [m for m in markers if m.lower() in lowered]
    matches += [name for name, pattern in TRAINER_PATTERNS if pattern.search(text)]

    if matches:
        return GateResult(
            "trainer-boundary",
            FAIL,
            f"{len(matches)} trainer-only marker(s) in student output",
            {"matches": matches},
        )
    return GateResult("trainer-boundary", PASS, "no trainer content detected", {})
