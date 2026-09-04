"""Instantiate an empty course from this vault's scaffolding.

Lane E of `docs/PLAN-academy-template-and-ev3.md`. The owner never touches git
template mechanics; this script is the whole interface.

What it does: create the stage tree, write a validated `course.yaml`, write a
`topology.md` derived from that manifest, and prove the result loads. What it
must never do: copy course CONTENT. A scaffolder that copies one course's
lessons into the next one produces a vault that looks populated and is wrong,
and the wrongness is invisible until a child reads a micro:bit slide in an EV3
lesson.

Refusals, all of them deliberate:

* a non-empty target — never merge into someone's work
* a target inside the source vault — a course nested in a course has two
  manifests above every bundle, and `discovery_for` walks upward
* any network access — there is none in this module, by construction
* a manifest it cannot load back — writing an invalid manifest and reporting
  success is the fail-open this vault keeps finding
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import yaml

from . import config

# Copied verbatim into a new course. Code, schemas, templates, and academy brand
# assets only: no lesson content, research, or receipts. Everything here is
# course-neutral or is a template with placeholders.
SCAFFOLD_FILES = (
    "pyproject.toml",
    "00-contracts/brand-and-output.md",
    "00-contracts/rubric.md",
    "00-contracts/pipeline-lessons.md",
    "00-contracts/pedagogy.md",
    "00-contracts/track-pedagogy.md",
    "00-contracts/pdf-intake-sop.md",
    # The live memory below is instantiated under the path the specialist reads.
    # Copying this vault's operational history would be course-content leakage.
    "00-contracts/_TEMPLATE-agent-memory.md",
    "knowledge/_schema/intake-schema.yaml",
    "75-bundle/_TEMPLATE-blueprint.md",
    "75-bundle/_TEMPLATE-debugging-lab.md",
    # generate_session.py hard-requires this at 80-generation/; without it
    # every course's generation step fails at the first HARD STOP.
    "80-generation/nblm-student-deck-prompts.md",
    # The specialist template. Without this a new course inherits the pipeline
    # and the contracts but no domain authority to run them, and every rule in
    # pedagogy.md addresses an agent that does not exist in the new vault.
    ".claude/agents/_TEMPLATE-course-specialist.md",
    # The specialist's operating doctrine. The agent file names this skill as
    # `required_skill`; without it the generated agent points at a skill that
    # does not exist.
    ".claude/skills/_TEMPLATE-course-specialist/SKILL.md",
)
SCAFFOLD_DIRS = (
    "scripts",
    "tests",
    # Academy brand assets. Copied whole so each course repo stands alone; later
    # brand updates must be synchronized explicitly into existing courses.
    "Techno Square identity",
)
# Created empty. These are where a course's own work accumulates.
STAGE_DIRS = (
    "10-digest",
    "20-provenance",
    "30-research",
    "40-critique",
    "50-patch",
    "55-refuted",
    "60-approved",
    "70-localized",
    "75-bundle",
    "80-generation",
    "90-receipts",
    "knowledge",
)

SPECIALIST_TEMPLATE = ".claude/agents/_TEMPLATE-course-specialist.md"
SPECIALIST_SKILL_TEMPLATE = ".claude/skills/_TEMPLATE-course-specialist/SKILL.md"
AGENT_MEMORY_TEMPLATE = "00-contracts/_TEMPLATE-agent-memory.md"
AGENT_MEMORY = "00-contracts/agent-memory.md"

_SPECIALIST_HEADER = (
    "# COURSE-specialist — TEMPLATE\n"
    "\n"
    "Copied into every new course by `scripts/swarm/new_course.py`. Replace `COURSE`\n"
    "with the course slug and `SUBJECT` with the domain, then fill the marked\n"
    "sections. Everything NOT marked is academy doctrine and is not yours to soften."
)

_SPECIALIST_SKILL_HEADER = (
    "Copied into every new course by `scripts/swarm/new_course.py`. Replace `COURSE`\n"
    "with the course slug and `SUBJECT` with the domain, then fill every inline\n"
    "fill-in comment marking a course-specific decision. Everything NOT marked is\n"
    "academy doctrine and is not yours to soften."
)

_SLUG = re.compile(r"[a-z][a-z0-9-]{1,63}")


class ScaffoldError(RuntimeError):
    """The course could not be created. Never partially reported as success."""


@dataclass(frozen=True)
class Seed:
    """Everything about a new course that is not derivable from the template."""

    slug: str
    name: str
    audience: str  # the learner age band / experience level (pedagogy.md §4)
    subject: str  # the domain the specialist is authoritative over
    levels: tuple[int, ...]
    sessions_per_level: int
    providers: tuple[str, ...]
    artifact_schedule: tuple[bool, ...]
    asset_ref_pattern: str
    asset_source_files: tuple[str, ...]
    expect_references: bool
    # Optional pedagogical category (00-contracts/track-pedagogy.md). "" means
    # undeclared, unlike audience/subject which are required.
    track: str = ""

    def validate(self) -> None:
        if not isinstance(self.track, str) or "\n" in self.track or "\r" in self.track:
            raise ScaffoldError(f"track {self.track!r} must be a single-line string")
        if not _SLUG.fullmatch(self.slug):
            raise ScaffoldError(
                f"slug {self.slug!r} must be lowercase letters, digits and hyphens"
            )
        if (
            not isinstance(self.name, str)
            or not self.name.strip()
            or "\n" in self.name
            or "\r" in self.name
        ):
            raise ScaffoldError(f"name {self.name!r} must be a non-empty string")
        for field in ("audience", "subject"):
            value = getattr(self, field)
            if (
                not isinstance(value, str)
                or not value.strip()
                or "\n" in value
                or "\r" in value
            ):
                raise ScaffoldError(
                    f"{field} {value!r} must be a non-empty single-line string"
                )
        if not self.levels or any(
            not isinstance(n, int) or isinstance(n, bool) or n <= 0 for n in self.levels
        ):
            raise ScaffoldError(
                f"levels {self.levels!r} must be a non-empty tuple of positive ints"
            )
        if (
            not isinstance(self.sessions_per_level, int)
            or isinstance(self.sessions_per_level, bool)
            or self.sessions_per_level <= 0
        ):
            raise ScaffoldError(
                f"sessions_per_level {self.sessions_per_level!r} must be a positive int"
            )
        if not self.providers or any(
            not isinstance(p, str) or not p for p in self.providers
        ):
            raise ScaffoldError(
                f"providers {self.providers!r} must be a non-empty tuple of "
                "non-empty strings"
            )
        if not self.asset_source_files or any(
            not isinstance(s, str) or not s for s in self.asset_source_files
        ):
            raise ScaffoldError(
                f"asset_source_files {self.asset_source_files!r} must be a "
                "non-empty tuple of non-empty strings"
            )
        try:
            compiled = re.compile(self.asset_ref_pattern)
        except re.error as exc:
            raise ScaffoldError(
                f"asset_ref_pattern {self.asset_ref_pattern!r} does not compile ({exc})"
            ) from exc
        if compiled.groups != 1:
            raise ScaffoldError(
                f"asset_ref_pattern {self.asset_ref_pattern!r} must have exactly "
                f"one capture group (it has {compiled.groups})"
            )
        if len(self.artifact_schedule) != self.sessions_per_level:
            raise ScaffoldError(
                f"artifact_schedule has {len(self.artifact_schedule)} entries for "
                f"{self.sessions_per_level} sessions per level — one per session, in order"
            )


def manifest_text(seed: Seed) -> str:
    """The course.yaml body. Written through yaml.safe_dump, never f-strings.

    Hand-built YAML is how a regex containing a backslash or a colon becomes a
    parse error in a file nobody reads until a gate fails.
    """
    doc = {
        "name": seed.name,
        "audience": seed.audience,
        **({"track": seed.track} if seed.track else {}),
        "levels": list(seed.levels),
        "sessions_per_level": seed.sessions_per_level,
        "providers": list(seed.providers),
        "artifact_schedule": {
            f"s{n}": bool(v) for n, v in enumerate(seed.artifact_schedule, start=1)
        },
        "stages": {
            "digest": "10-digest",
            "digest_assets": "_assets",
            "provenance": "20-provenance",
            "receipts": "90-receipts",
        },
        "asset_discovery": {
            "asset_ref_pattern": seed.asset_ref_pattern,
            "asset_source_files": list(seed.asset_source_files),
            "expect_references": seed.expect_references,
        },
    }
    header = (
        f"# {seed.name}\n"
        f"# Generated by scripts/swarm/new_course.py. The single runtime manifest:\n"
        f"# every script reads this rather than hardcoding a course's shape.\n"
    )
    return header + yaml.safe_dump(doc, sort_keys=False, allow_unicode=True)


def topology_text(seed: Seed, course: config.CourseConfig) -> str:
    """Derived from the loaded manifest, not from the seed.

    Reading it back is the point: a topology generated from the seed would agree
    with the seed even when the manifest on disk says something else.
    """
    lines = [
        f"# {course.name} — topology",
        "",
        "Generated from `course.yaml`. Do not edit by hand; edit the manifest.",
        "",
        f"- levels: {', '.join(str(n) for n in course.levels)}",
        f"- sessions per level: {course.sessions_per_level}",
        f"- providers: {', '.join(sorted(course.providers))}",
        "",
        "| Session | Artifacts |",
        "| --- | --- |",
    ]
    for level in course.levels:
        for n in range(1, course.sessions_per_level + 1):
            sid = f"L{level}-s{n}"
            lines.append(f"| {sid} | {'yes' if course.produces_artifacts(sid) else 'no'} |")
    lines.append("")
    return "\n".join(lines)


def _check_target(target: Path, source: Path) -> None:
    target = Path(target)
    source = Path(source).resolve()
    if target.exists() and any(target.iterdir()):
        raise ScaffoldError(
            f"{target} is not empty. Refusing to scaffold into existing work — "
            "choose an empty directory or move what is there."
        )
    resolved = target.resolve() if target.exists() else target.absolute()
    try:
        resolved.relative_to(source)
    except ValueError:
        return
    raise ScaffoldError(
        f"{target} is inside the source vault {source}. A course nested in a course "
        "puts two manifests above every bundle, and discovery resolves the nearer "
        "one — the new course would silently govern the old one's assets."
    )


def _copy_scaffold(source: Path, target: Path) -> list[str]:
    copied: list[str] = []
    for rel in SCAFFOLD_DIRS:
        src = source / rel
        if not src.is_dir():
            raise ScaffoldError(f"scaffold directory {rel!r} is missing from {source}")
        shutil.copytree(
            src,
            target / rel,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache"),
        )
        copied.append(rel + "/")
    for rel in SCAFFOLD_FILES:
        src = source / rel
        if not src.is_file():
            raise ScaffoldError(f"scaffold file {rel!r} is missing from {source}")
        dst = target / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        copied.append(rel)
    return copied


def _fill_course_placeholders(template: str, seed: Seed) -> str:
    """Turn `COURSE`/`SUBJECT` template syntax into this course's own text.

    Order matters: TODO markers first (so they stay legible as markers rather
    than becoming `<!-- kids-ev3: ... -->`), then the bare `COURSE` pass, then
    `SUBJECT` LAST — a legitimate subject string is inserted only after both
    template tokens are gone, so it can never be mistaken for template syntax.
    """
    return (
        template.replace("<!-- COURSE:", f"<!-- TODO({seed.slug}):")
        .replace("COURSE", seed.slug)
        .replace("SUBJECT", seed.subject)
    )


def _instantiate_specialist(seed: Seed, root: Path) -> str:
    """Write the course's own specialist beside the template it came from.

    Copying the template alone is not enough. An agent file that still says
    `COURSE` addresses nobody: its `required_skill` names no skill, its allowed
    writes point at `knowledge/COURSE/`, and every rule in pedagogy.md is
    addressed to an agent that does not exist under any name the course uses.

    The template stays too — it is the neutral definition, and a course may need
    a second specialist later.
    """
    template = (root / SPECIALIST_TEMPLATE).read_text(encoding="utf-8")
    if template.count(_SPECIALIST_HEADER) != 1:
        raise ScaffoldError(
            f"{SPECIALIST_TEMPLATE} template header drifted; refusing to generate "
            "an agent that may still call itself a template"
        )
    if "<!-- COURSE:" not in template:
        raise ScaffoldError(
            f"{SPECIALIST_TEMPLATE} has no COURSE fill-in markers; refusing to "
            "present an unfinished specialist as complete"
        )
    body = _fill_course_placeholders(
        template.replace(
            _SPECIALIST_HEADER,
            f"# {seed.slug}-specialist\n"
            f"\n"
            f"Generated by `scripts/swarm/new_course.py` from "
            f"`{SPECIALIST_TEMPLATE}`.\nFill every `TODO({seed.slug})` marker. "
            f"Everything NOT marked is academy\ndoctrine and is not yours to soften.",
        ),
        seed,
    )
    rel = f".claude/agents/{seed.slug}-specialist.md"
    (root / rel).write_text(body, encoding="utf-8")
    return rel


def _instantiate_specialist_skill(seed: Seed, root: Path) -> str:
    """Write the course's own specialist skill beside the template it came from.

    The generated agent (`_instantiate_specialist`) declares
    `required_skill: <slug>-course-specialist`. Without this, that skill name
    resolves to nothing and the specialist has a role but no operating doctrine.
    """
    template = (root / SPECIALIST_SKILL_TEMPLATE).read_text(encoding="utf-8")
    if template.count(_SPECIALIST_SKILL_HEADER) != 1:
        raise ScaffoldError(
            f"{SPECIALIST_SKILL_TEMPLATE} template header drifted; refusing to "
            "generate a skill that may still describe itself as a template"
        )
    if "<!-- COURSE:" not in template:
        raise ScaffoldError(
            f"{SPECIALIST_SKILL_TEMPLATE} has no COURSE fill-in markers; refusing "
            "to present an unfinished skill as complete"
        )
    body = _fill_course_placeholders(
        template.replace(
            _SPECIALIST_SKILL_HEADER,
            f"Generated by `scripts/swarm/new_course.py` from "
            f"`{SPECIALIST_SKILL_TEMPLATE}`.\nFill every `TODO({seed.slug})` "
            f"marker. Everything NOT marked is academy\ndoctrine and is not "
            f"yours to soften.",
        ),
        seed,
    )
    rel = f".claude/skills/{seed.slug}-course-specialist/SKILL.md"
    (root / rel).parent.mkdir(parents=True, exist_ok=True)
    (root / rel).write_text(body, encoding="utf-8")
    return rel


def _instantiate_agent_memory(root: Path) -> str:
    """Install neutral starter memory at the path every specialist requires."""
    source = root / AGENT_MEMORY_TEMPLATE
    target = root / AGENT_MEMORY
    shutil.copy2(source, target)
    return AGENT_MEMORY


def create(seed: Seed, target: Path, source: Path) -> config.CourseConfig:
    """Create the course and return the manifest as loaded back from disk.

    Everything is built in a temporary sibling directory first and moved into
    ``target`` only after the generated manifest loads. A scaffolder that dies
    halfway through writing the real target leaves a directory that looks like
    started work, and the next run then refuses the target as non-empty.
    """
    seed.validate()
    target = Path(target)
    source = Path(source)
    _check_target(target, source)

    target.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f"{target.name}.tmp-", dir=target.parent))
    try:
        for rel in STAGE_DIRS:
            (staging / rel).mkdir(parents=True, exist_ok=True)
        _copy_scaffold(source, staging)
        _instantiate_specialist(seed, staging)
        _instantiate_specialist_skill(seed, staging)
        _instantiate_agent_memory(staging)

        (staging / "course.yaml").write_text(manifest_text(seed), encoding="utf-8")

        # Load it BACK. Writing a manifest and reporting success without reading it
        # is exactly the shape of defect this vault has rejected five times.
        try:
            course = config.load_course(staging)
        except config.CourseConfigError as exc:
            raise ScaffoldError(
                f"the generated manifest does not load: {exc}. The staged course "
                f"was discarded; nothing was written to {target}."
            ) from exc

        (staging / "topology.md").write_text(topology_text(seed, course), encoding="utf-8")
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise

    if target.exists():
        # _check_target already refused anything non-empty, so this can only be
        # an empty directory sitting exactly on the target path — it holds no
        # work, and the rename below needs the path free.
        target.rmdir()
    staging.rename(target)
    return course


def _seed_from_args(ns: argparse.Namespace) -> Seed:
    schedule = tuple(
        n not in set(ns.no_artifact_sessions) for n in range(1, ns.sessions_per_level + 1)
    )
    return Seed(
        slug=ns.slug,
        name=ns.name or ns.slug,
        audience=ns.audience,
        subject=ns.subject or ns.name or ns.slug,
        levels=tuple(ns.levels),
        sessions_per_level=ns.sessions_per_level,
        providers=tuple(ns.providers),
        artifact_schedule=schedule,
        asset_ref_pattern=ns.asset_ref_pattern,
        asset_source_files=tuple(ns.asset_source_files),
        expect_references=not ns.no_expect_references,
        track=ns.track,
    )


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        prog="new_course.py",
        description="Create an empty course from this vault's scaffolding.",
    )
    ap.add_argument("slug", help="lowercase course slug, e.g. kids-ev3")
    ap.add_argument("target", type=Path, help="empty directory to create the course in")
    ap.add_argument("--name", default=None, help="human course name")
    ap.add_argument(
        "--audience",
        required=True,
        help="learner age band or experience level, e.g. 'ages 9-12, no prior "
        "programming'. Declared once here and referenced everywhere (pedagogy.md §4)",
    )
    ap.add_argument(
        "--subject",
        default=None,
        help="the domain the specialist is authoritative over, e.g. 'LEGO MINDSTORMS "
        "EV3' (default: --name)",
    )
    ap.add_argument(
        "--track",
        default="",
        help="optional pedagogical category — one of early-childhood-tech, "
        "kids-hardware, kids-software, stem-engineering, professional-technology "
        "(00-contracts/track-pedagogy.md). Omit if the course has not declared one",
    )
    ap.add_argument("--levels", type=int, nargs="+", default=[1, 2])
    ap.add_argument("--sessions-per-level", type=int, default=8)
    ap.add_argument(
        "--no-artifact-sessions",
        type=int,
        nargs="*",
        default=[8],
        help="session numbers that produce no artifacts (default: the graduation session)",
    )
    ap.add_argument(
        "--providers", nargs="+", default=["claude", "codex", "opencode", "hermes"]
    )
    ap.add_argument(
        "--asset-ref-pattern",
        required=True,
        help="regex with EXACTLY ONE capture group: the asset filename as referenced",
    )
    ap.add_argument("--asset-source-files", nargs="+", required=True)
    ap.add_argument(
        "--no-expect-references",
        action="store_true",
        help="allow a bundle to reference no assets at all (rare; usually a typo'd pattern)",
    )
    ap.add_argument(
        "--source",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="vault to copy scaffolding from (default: this one)",
    )
    ns = ap.parse_args(argv[1:])

    try:
        course = create(_seed_from_args(ns), ns.target, ns.source)
    except ScaffoldError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 2

    sessions = len(course.levels) * course.sessions_per_level
    with_artifacts = sum(
        course.produces_artifacts(f"L{lv}-s{n}")
        for lv in course.levels
        for n in range(1, course.sessions_per_level + 1)
    )
    print(f"created {ns.target}")
    print(f"  audience: {course.audience}")
    print(f"  specialist: .claude/agents/{ns.slug}-specialist.md")
    print(f"  {sessions} session(s), {with_artifacts} producing artifacts")
    print(f"  providers: {', '.join(sorted(course.providers))}")
    print("  course.yaml validated by load_course; topology.md derived from it")
    print("\nNo course content was copied. The stage directories are empty on purpose.")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main(sys.argv))
