"""Validated per-course runtime configuration."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Any

import yaml


class CourseConfigError(ValueError):
    """The course manifest is missing or violates its schema."""


@dataclass(frozen=True)
class StageDirectories:
    digest: str
    digest_assets: str
    provenance: str
    receipts: str


@dataclass(frozen=True)
class AssetDiscovery:
    """How this course names its assets and where they are referenced from.

    Lives here rather than in check_assets.py because two parsers for one file
    disagree eventually: the CLI accepted an ``asset_discovery`` section that
    ``load_course`` then rejected as an unknown field.
    """

    ref: re.Pattern[str]
    source_files: tuple[str, ...]
    expect_references: bool


@dataclass(frozen=True)
class CourseConfig:
    name: str
    # The learner age band or experience level, declared ONCE here and
    # referenced everywhere else (00-contracts/pedagogy.md §4). The first course
    # carried three different age bands across its own research files precisely
    # because every mention was written independently.
    #
    # Not to be confused with prepare.audience_of(), which reads an ARTIFACT's
    # frontmatter to decide whether a file is learner- or trainer-facing. That
    # is a different question about a different file.
    audience: str
    # The pedagogical category this course belongs to (e.g. "kids-hardware",
    # "professional-technology") — see 00-contracts/track-pedagogy.md. Distinct
    # from audience, which records the learners' age/experience. Optional and
    # unenforced today; "" means the course has not declared one.
    track: str
    levels: tuple[int, ...]
    sessions_per_level: int
    providers: frozenset[str]
    artifact_schedule: tuple[bool, ...]
    stages: StageDirectories
    asset_discovery: AssetDiscovery

    def produces_artifacts(self, sid: str) -> bool:
        """Return the manifest decision for a configured session ID."""
        if not isinstance(sid, str):
            raise ValueError(f"invalid session id {sid!r}")
        match = re.fullmatch(r"L([1-9][0-9]*)-s([1-9][0-9]*)", sid)
        if match is None:
            raise ValueError(f"invalid session id {sid!r}")
        level, session = (int(part) for part in match.groups())
        if level not in self.levels or session > self.sessions_per_level:
            raise ValueError(f"session id {sid!r} is not configured")
        return self.artifact_schedule[session - 1]


_TOP_LEVEL_FIELDS = frozenset(
    {
        "name",
        "audience",
        "track",
        "levels",
        "sessions_per_level",
        "providers",
        "artifact_schedule",
        "stages",
        "asset_discovery",
    }
)
# track is the one optional top-level field: a course that has not declared
# one omits the key entirely rather than writing an empty string.
_OPTIONAL_TOP_LEVEL_FIELDS = frozenset({"track"})
_STAGE_FIELDS = frozenset({"digest", "digest_assets", "provenance", "receipts"})
_DISCOVERY_FIELDS = frozenset(
    {"asset_ref_pattern", "asset_source_files", "expect_references"}
)


def _mapping(value: Any, field: str, source: Path) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise CourseConfigError(f"{source}: {field} must be a mapping")
    return value


def _directory(value: Any, field: str, source: Path) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CourseConfigError(f"{source}: {field} must be a non-empty directory name")
    path = Path(value)
    if path.is_absolute() or len(path.parts) != 1 or value in {".", ".."}:
        raise CourseConfigError(f"{source}: {field} must be one relative directory name")
    return value


def _asset_discovery(raw: Any, source: Path) -> AssetDiscovery:
    data = _mapping(raw, "asset_discovery", source)
    unknown = set(data) - _DISCOVERY_FIELDS
    if unknown:
        raise CourseConfigError(
            f"{source}: unknown asset_discovery field(s): {', '.join(sorted(unknown))}"
        )
    missing = _DISCOVERY_FIELDS - set(data)
    if missing:
        names = ", ".join(f"asset_discovery.{name}" for name in sorted(missing))
        raise CourseConfigError(f"{source}: missing field(s): {names}")

    pattern = data["asset_ref_pattern"]
    if not isinstance(pattern, str) or not pattern.strip():
        raise CourseConfigError(
            f"{source}: asset_discovery.asset_ref_pattern must be a non-empty regex string"
        )
    try:
        ref = re.compile(pattern)
    except re.error as exc:
        raise CourseConfigError(
            f"{source}: asset_discovery.asset_ref_pattern is not a valid regex: {exc}"
        ) from exc
    # findall() returns tuples the moment a second group appears, and every
    # downstream comparison is filename-against-string. Refuse it here rather
    # than let it surface as a TypeError mid-audit.
    if ref.groups != 1:
        raise CourseConfigError(
            f"{source}: asset_discovery.asset_ref_pattern must have exactly one capture "
            f"group (the filename); this one has {ref.groups}"
        )

    files_raw = data["asset_source_files"]
    if not isinstance(files_raw, list) or not files_raw:
        raise CourseConfigError(
            f"{source}: asset_discovery.asset_source_files must be a non-empty list "
            "of unique file names"
        )
    # Type-check every entry BEFORE hashing them. set() on a list holding a YAML
    # mapping raises an unhashable-type TypeError from inside the validator, which
    # escapes as a raw traceback and makes this error branch unreachable.
    for entry in files_raw:
        if not isinstance(entry, str) or not entry.strip():
            raise CourseConfigError(
                f"{source}: asset_discovery.asset_source_files entries must be "
                f"non-empty strings; got {entry!r}"
            )
    if len(set(files_raw)) != len(files_raw):
        raise CourseConfigError(
            f"{source}: asset_discovery.asset_source_files must be a non-empty list "
            "of unique file names"
        )
    for name in files_raw:
        # A source file is read from inside the bundle. An absolute path or a
        # ".." escape would audit a different course and report PASS on this one.
        if not isinstance(name, str) or not name.strip():
            raise CourseConfigError(
                f"{source}: asset_discovery.asset_source_files entries must be non-empty names"
            )
        path = Path(name)
        if path.is_absolute() or len(path.parts) != 1 or name in {".", ".."}:
            raise CourseConfigError(
                f"{source}: asset_discovery.asset_source_files entry {name!r} must be one "
                "file name inside the bundle"
            )
    # Declared policy, not an inferred one. A pattern can compile, carry one
    # capture group, and still match nothing; the gate cannot tell that from a
    # bundle whose assets are legitimately staged before the deck cites them.
    # So the course states which it is, and the gate enforces only that.
    expect = data["expect_references"]
    if not isinstance(expect, bool):
        raise CourseConfigError(
            f"{source}: asset_discovery.expect_references must be true or false — "
            "state whether a bundle in this course is expected to reference assets"
        )
    return AssetDiscovery(
        ref=ref, source_files=tuple(files_raw), expect_references=expect
    )


def load_course(root: Path) -> CourseConfig:
    """Load and validate ``root/course.yaml``.

    Only common artifact directories are controlled by ``stages``. Provider-lane
    and merge stages remain caller-named because pipelines own different stage sets.
    """
    source = Path(root) / "course.yaml"
    if not source.is_file():
        raise CourseConfigError(
            f"course config {source} does not exist; create course.yaml at the vault root"
        )
    try:
        raw = yaml.safe_load(source.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, yaml.YAMLError) as exc:
        raise CourseConfigError(f"{source}: invalid YAML: {exc}") from exc

    data = _mapping(raw, "document", source)
    unknown = set(data) - _TOP_LEVEL_FIELDS
    if unknown:
        raise CourseConfigError(f"{source}: unknown field(s): {', '.join(sorted(unknown))}")
    missing = (_TOP_LEVEL_FIELDS - _OPTIONAL_TOP_LEVEL_FIELDS) - set(data)
    if missing:
        raise CourseConfigError(f"{source}: missing field(s): {', '.join(sorted(missing))}")

    # The course's human name. A real field rather than the header comment it
    # used to be: generate_session.py titles every deck with it, and a title is
    # not the place to discover that the manifest never carried the name.
    name_raw = data["name"]
    if not isinstance(name_raw, str) or not name_raw.strip():
        raise CourseConfigError(f"{source}: name must be a non-empty string")
    if "\n" in name_raw or "\r" in name_raw:
        raise CourseConfigError(f"{source}: name must be single-line")

    # Required, not optional. pedagogy.md §4 forbids inheriting an audience from
    # another course, and an optional field would be inherited by omission: the
    # scaffolder would produce a course whose age band is whatever the last
    # person assumed.
    audience_raw = data["audience"]
    if not isinstance(audience_raw, str) or not audience_raw.strip():
        raise CourseConfigError(
            f"{source}: audience must be a non-empty string — the learner age band "
            "or experience level this course is written for (pedagogy.md §4)"
        )
    if "\n" in audience_raw or "\r" in audience_raw:
        raise CourseConfigError(f"{source}: audience must be single-line")

    # Optional. "" means undeclared — not every course needs a track, and
    # inventing one to satisfy a required field is worse than admitting it has
    # none (see track-pedagogy.md).
    track_raw = data.get("track", "")
    if not isinstance(track_raw, str):
        raise CourseConfigError(f"{source}: track must be a string")
    if "\n" in track_raw or "\r" in track_raw:
        raise CourseConfigError(f"{source}: track must be single-line")

    levels_raw = data["levels"]
    if (
        not isinstance(levels_raw, list)
        or not levels_raw
        or any(isinstance(level, bool) or not isinstance(level, int) or level < 1 for level in levels_raw)
        or len(set(levels_raw)) != len(levels_raw)
    ):
        raise CourseConfigError(f"{source}: levels must be a non-empty list of unique positive integers")

    sessions = data["sessions_per_level"]
    if isinstance(sessions, bool) or not isinstance(sessions, int) or sessions < 1:
        raise CourseConfigError(f"{source}: sessions_per_level must be a positive integer")

    providers_raw = data["providers"]
    if (
        not isinstance(providers_raw, list)
        or not providers_raw
        or any(not isinstance(provider, str) or not provider.strip() for provider in providers_raw)
        or len(set(providers_raw)) != len(providers_raw)
    ):
        raise CourseConfigError(f"{source}: providers must be a non-empty list of unique names")

    schedule_raw = _mapping(data["artifact_schedule"], "artifact_schedule", source)
    expected_schedule_keys = {f"s{session}" for session in range(1, sessions + 1)}
    unknown_schedule = set(schedule_raw) - expected_schedule_keys
    if unknown_schedule:
        raise CourseConfigError(
            f"{source}: unknown artifact_schedule field(s): "
            f"{', '.join(sorted(unknown_schedule))}"
        )
    missing_schedule = expected_schedule_keys - set(schedule_raw)
    if missing_schedule:
        names = ", ".join(f"artifact_schedule.{name}" for name in sorted(missing_schedule))
        raise CourseConfigError(f"{source}: missing field(s): {names}")
    for key in sorted(expected_schedule_keys):
        if not isinstance(schedule_raw[key], bool):
            raise CourseConfigError(f"{source}: artifact_schedule.{key} must be a boolean")

    stages_raw = _mapping(data["stages"], "stages", source)
    unknown_stages = set(stages_raw) - _STAGE_FIELDS
    if unknown_stages:
        raise CourseConfigError(
            f"{source}: unknown stages field(s): {', '.join(sorted(unknown_stages))}"
        )
    missing_stages = _STAGE_FIELDS - set(stages_raw)
    if missing_stages:
        names = ", ".join(f"stages.{name}" for name in sorted(missing_stages))
        raise CourseConfigError(f"{source}: missing field(s): {names}")

    return CourseConfig(
        name=name_raw.strip(),
        audience=audience_raw.strip(),
        track=track_raw.strip(),
        levels=tuple(levels_raw),
        sessions_per_level=sessions,
        providers=frozenset(providers_raw),
        artifact_schedule=tuple(
            schedule_raw[f"s{session}"] for session in range(1, sessions + 1)
        ),
        asset_discovery=_asset_discovery(data["asset_discovery"], source),
        stages=StageDirectories(
            digest=_directory(stages_raw["digest"], "stages.digest", source),
            digest_assets=_directory(stages_raw["digest_assets"], "stages.digest_assets", source),
            provenance=_directory(stages_raw["provenance"], "stages.provenance", source),
            receipts=_directory(stages_raw["receipts"], "stages.receipts", source),
        ),
    )
