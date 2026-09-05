"""Render the NBLM prompt file's guided template with resolved per-job fields.

STEP 11 Phase B, Batch 3, option (a) (docs/tickets/handoffs/step11-nblm-prompt-authoring.md,
Part 1). The static `nblm-student-deck-prompts.md` a course ships today is, per that
handoff, converted into a guided template with named `$FIELD` placeholders inside its
fenced prompt bodies (`string.Template` syntax — stdlib, no new dependency). This module
resolves those placeholders against real facts the worker already knows
(`CourseSession.DurationMinutes`, `CourseProject.TargetAgeBand`, the organization's display
name and mascot/branding policy) and writes the fully-resolved file back to the same path
`generate_session.py`'s own `parse_prompts` reads.

Rendering is idempotent: a file with no `$FIELD` markers left (already rendered) simply
comes back unchanged, so re-running this as the cascade's tier-1 "restore an exact
approved template" fact-correction (Part 2's per-gate-kind mapping table, NBLM-prompt row)
is safe to repeat.

What this module deliberately does NOT do: it does not invent or rewrite any of Techno
Square's (or any other course's) actual prompt prose — converting a specific course's
existing static file into templated form the first time is a one-time content migration
for whoever owns that vault, not an engine change. Nothing here is called by
generate_session.py's own pipeline; like extract_pdf_text.py / extract_pdf_colors.py, this
is a side-channel script CourseDeveloper.Infrastructure shells out to (see
NblmPromptTemplateRenderer.cs), keeping generate_session.py's existing contract untouched.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from string import Template

# Bump when the placeholder contract below changes (a field is added, removed, or
# renamed) so a rendered file's provenance can be traced to the exact contract it used.
TEMPLATE_VERSION = 1

FIELD_NAMES: tuple[str, ...] = (
    "SESSION_DURATION_MINUTES",
    "AUDIENCE_DESCRIPTOR",
    "ORG_DISPLAY_NAME",
    "BRANDING_CLAUSE",
)


def render(template_text: str, fields: dict[str, str]) -> str:
    """Substitute every `$FIELD`/`${FIELD}` marker in `template_text`.

    Strict substitution (not `safe_substitute`): a template referencing a name outside
    `fields` raises `KeyError` rather than silently leaving `$UNKNOWN` in generated
    output NotebookLM would treat as literal prose.
    """
    missing = [name for name in FIELD_NAMES if name not in fields]
    if missing:
        raise ValueError(f"missing required render field(s): {', '.join(missing)}")
    return Template(template_text).substitute(fields)


def rendered_sha256(rendered_text: str) -> str:
    return hashlib.sha256(rendered_text.encode("utf-8")).hexdigest()


def _demo() -> None:
    template = "## Notebook A\n\n```\nTeach for $SESSION_DURATION_MINUTES minutes to $AUDIENCE_DESCRIPTOR. $BRANDING_CLAUSE ($ORG_DISPLAY_NAME)\n```\n"
    fields = {
        "SESSION_DURATION_MINUTES": "45",
        "AUDIENCE_DESCRIPTOR": "ages 9-12",
        "ORG_DISPLAY_NAME": "Techno Square",
        "BRANDING_CLAUSE": "No mascot is configured for this organization.",
    }
    rendered = render(template, fields)
    assert "$SESSION_DURATION_MINUTES" not in rendered
    assert "45 minutes" in rendered
    assert "Techno Square" in rendered

    # Idempotent: rendering the already-rendered text again is a no-op, since it has no
    # $FIELD markers left for Template.substitute to touch.
    twice = render(rendered, fields)
    assert twice == rendered

    try:
        render(template, {k: v for k, v in fields.items() if k != "BRANDING_CLAUSE"})
    except ValueError as exc:
        assert "BRANDING_CLAUSE" in str(exc)
    else:
        raise AssertionError("expected a missing required field to raise ValueError")

    assert rendered_sha256("x") == rendered_sha256("x")
    assert rendered_sha256("x") != rendered_sha256("y")
    print("self-check passed")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("prompt_path", nargs="?", type=Path, help="the file to render in place")
    ap.add_argument("--duration-minutes", type=str, help="CourseSession.DurationMinutes, as text")
    ap.add_argument("--audience", type=str, help="CourseProject.TargetAgeBand")
    ap.add_argument("--org-name", type=str, help="Organization.Name")
    ap.add_argument("--branding-clause", type=str, help="resolved mascot/branding clause")
    ap.add_argument("--output", type=Path, default=None, help="defaults to prompt_path (render in place)")
    ap.add_argument("--self-check", action="store_true")
    args = ap.parse_args(argv)

    if args.self_check:
        _demo()
        return 0

    if args.prompt_path is None:
        ap.error("prompt_path is required")
    if not args.prompt_path.is_file():
        print(f"ERROR: no such file: {args.prompt_path}", file=sys.stderr)
        return 2

    fields = {
        "SESSION_DURATION_MINUTES": args.duration_minutes,
        "AUDIENCE_DESCRIPTOR": args.audience,
        "ORG_DISPLAY_NAME": args.org_name,
        "BRANDING_CLAUSE": args.branding_clause,
    }
    missing_args = [f"--{flag}" for flag, value in (
        ("duration-minutes", args.duration_minutes),
        ("audience", args.audience),
        ("org-name", args.org_name),
        ("branding-clause", args.branding_clause),
    ) if value is None]
    if missing_args:
        ap.error(f"missing required argument(s): {', '.join(missing_args)}")

    try:
        rendered = render(args.prompt_path.read_text(encoding="utf-8"), fields)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    output_path = args.output or args.prompt_path
    output_path.write_text(rendered, encoding="utf-8")
    print(json.dumps({
        "renderedPath": str(output_path),
        "renderedSha256": rendered_sha256(rendered),
        "templateVersion": TEMPLATE_VERSION,
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
