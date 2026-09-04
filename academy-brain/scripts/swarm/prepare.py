"""Reduce a bundle artifact to the text a gate should actually judge.

Gates measure learner-facing prose. A 75-bundle file also carries YAML
frontmatter, NBLM rendering directives (asset/TATA bindings), and provenance
tables — none of which a learner ever sees. Measuring them made arabic-ratio
read 26% on a file whose prose is fine, and made trainer-boundary fire on the
word "trainer" inside `audience: no trainer notes`.

Also reports the artifact's declared audience so the runner can pick gates that
apply to it. A trainer guide is trainer-only English by design; running the
student-facing gates on it produces confident nonsense.
"""

from __future__ import annotations

import re

STUDENT = "student"
TRAINER = "trainer"

# Lines that exist to instruct the renderer, never shown to a learner.
_DIRECTIVE = re.compile(
    r"^\s*[-*]?\s*\*\*(TATA|Asset|Assets|Visual|Note|Speaker notes)[^*]*\*\*\s*:?",
    re.IGNORECASE,
)
# Bracketed editorial markers, e.g. [REPLACES video slide], [FIXED — patch ...].
_MARKER = re.compile(r"\[(?:REPLACES|FIXED|NEW|Verified)[^\]]*\]", re.IGNORECASE)
# A Trainer Guide's own internal-use declaration (brand-and-output.md §2). The
# only body-level audience signal trusted here: it is a positive self-statement,
# not a negated one, and appears in no student artifact.
_INTERNAL_ONLY = re.compile(r"\binternal use only\b", re.IGNORECASE)
# Trailing provenance sections that document the work rather than teach.
_TAIL = re.compile(
    r"^##+\s+(Interaction-law changelog|QA notes|Asset provenance|"
    r"Rendering rules|Hard exclusions|Slide budget note).*$",
    re.IGNORECASE,
)


def split_frontmatter(raw: str) -> tuple[dict, str]:
    """Return (frontmatter dict, body). Missing or broken frontmatter -> ({}, raw)."""
    if not raw.startswith("---"):
        return {}, raw
    parts = raw.split("---", 2)
    if len(parts) < 3:
        return {}, raw
    try:
        import yaml

        meta = yaml.safe_load(parts[1]) or {}
    except Exception:
        return {}, parts[2]
    if not isinstance(meta, dict):
        meta = {}
    return meta, parts[2]


def audience_of(meta: dict, body: str = "") -> str:
    """Classify the artifact. Frontmatter first, then the body's own declaration.

    Defaults to student (stricter). A shipped Trainer Guide can carry only lock
    metadata in its frontmatter — no audience/type/role — which read as student
    and put the trainer gates on a trainer artifact. Such a guide declares
    itself in the body instead, with the phrase brand-and-output.md §2 requires.
    """
    if _INTERNAL_ONLY.search(body):
        return TRAINER

    blob = " ".join(
        str(meta.get(k, "")) for k in ("audience", "type", "role")
    ).lower()
    # Strip negations first. Both artifact kinds describe themselves partly by
    # what they are NOT ("no trainer-only content", "never student-facing"), and
    # a naive substring match reads those as positive declarations.
    for negation in (
        "no trainer-only content",
        "no trainer notes",
        "never student-facing",
        "not student-facing",
        "no trainer content",
    ):
        blob = blob.replace(negation, " ")

    if "student" in blob:
        return STUDENT
    if "trainer" in blob:
        return TRAINER
    return STUDENT


def learner_text(raw: str) -> tuple[str, str]:
    """Strip everything a learner never reads. Returns (text, audience)."""
    meta, body = split_frontmatter(raw)
    audience = audience_of(meta, body)

    kept: list[str] = []
    in_tail = False
    for line in body.splitlines():
        if _TAIL.match(line):
            in_tail = True
            continue
        if in_tail:
            # A new non-tail heading ends the skipped section.
            if line.startswith("## ") and not _TAIL.match(line):
                in_tail = False
            else:
                continue
        if _DIRECTIVE.match(line):
            continue
        if line.lstrip().startswith(">"):  # blockquoted rendering instructions
            continue
        kept.append(_MARKER.sub("", line))

    return "\n".join(kept), audience


# Which gates make sense for which audience.
GATES_FOR = {
    STUDENT: ("arabic-ratio", "trainer-boundary", "brand-palette"),
    TRAINER: ("brand-palette",),
}


def applicable(gate_names: list[str], audience: str) -> tuple[list[str], list[str]]:
    """Split requested gates into (runnable, not-applicable) for this audience."""
    allowed = GATES_FOR.get(audience, GATES_FOR[STUDENT])
    run = [g for g in gate_names if g in allowed]
    skip = [g for g in gate_names if g not in allowed]
    return run, skip


def _demo() -> None:
    raw = (
        "---\n"
        "audience: STUDENT-FACING — no trainer notes\n"
        "type: student-slides-source\n"
        "---\n"
        "> Rendering rules: logo on every slide.\n"
        "## Slide 1\n"
        "ده كلام عربي كتير قوي للطلاب\n"
        "- **TATA:** tata_idea.png\n"
        "- **Asset:** img-05.png\n"
        "**[REPLACES video slide]**\n"
        "## QA notes\n"
        "trainer note leaks here and lots of latin words\n"
    )
    text, aud = learner_text(raw)
    assert aud == STUDENT, aud
    assert "tata_idea" not in text, "asset directive not stripped"
    assert "Rendering rules" not in text, "blockquote not stripped"
    assert "REPLACES" not in text, "editorial marker not stripped"
    assert "trainer note" not in text, "QA tail not stripped"
    assert "كلام عربي" in text, "learner prose was dropped"

    trainer_meta = {"audience": "TRAINER ONLY — internal use, never student-facing"}
    assert audience_of(trainer_meta) == TRAINER, "trainer guide misread as student"
    assert audience_of({"type": "student-summary-deck-source"}) == STUDENT
    # Regression: negated self-descriptions must not flip the classification.
    assert audience_of(
        {"audience": "STUDENT + PARENT — no trainer-only content"}
    ) == STUDENT, "negation read as a trainer declaration"
    assert audience_of(
        {"type": "trainer-guide-draft", "audience": "TRAINER ONLY — never student-facing"}
    ) == TRAINER
    run, skip = applicable(["arabic-ratio", "trainer-boundary"], TRAINER)
    assert run == [] and len(skip) == 2, (run, skip)
    print("prepare.py self-check OK")


if __name__ == "__main__":
    _demo()
