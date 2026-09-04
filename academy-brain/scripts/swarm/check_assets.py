"""Verify every asset a bundle references either exists or is declared to-be-created.

Codex found four dangling references in the L1-s1 deck: slides pointed at
`img-05.png` for four different jobs it cannot do, and at `img-20.png` for the
debugging bugs it does not contain, while the correct filenames sat unreferenced
in SOURCES.md. Nothing caught it, because the gates read text and never looked
at the filesystem.

Usage:  python scripts/swarm/check_assets.py 75-bundle/L1-s1

Asset discovery
---------------
Discovery is NOT hardcoded and NOT defaulted. main() walks up from the bundle
directory to the nearest course.yaml and reads its required section

    asset_discovery:
      asset_ref_pattern: "`((?:shot|render)[A-Za-z0-9_.\-]*\.(?:png|svg))`"
      asset_source_files: [deck.md]

through the canonical loader in config.py, which owns the schema. There is no
second parser here: one file, one set of rules.

Everything fails closed. No manifest, no asset_discovery section, a malformed
pattern, or a configured source file that is not on disk are all errors with a
nonzero exit — never a fallback to another course's naming. A silent fallback
reports "PASS: 0 present" on a course whose every asset is missing, which is
the exact defect this gate exists to catch and the reason the first two
iterations of it were rejected.

Direct callers of audit()/unused() keep the historical override channel: the
module globals REF and SOURCE_FILES are read at call time, so assigning
``check_assets.REF = re.compile(...)`` changes subsequent results. These remain
the micro:bit defaults and are used by no CLI path.

Decided policies
----------------
- Matching is case-sensitive: `IMG-01.PNG` on a slide is a dangling reference
  even when img-01.png exists.
- Source file names are validated by config.py as single names inside the
  bundle: absolute paths and "../outside.md" are refused at load time, so this
  gate can never be pointed at another course's files.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from swarm import config  # noqa: E402

class DiscoveryError(ValueError):
    """Discovery could not be resolved. Never defaulted around."""


REF = re.compile(r"`((?:img|tata|technosquare)[A-Za-z0-9_.\-]*\.(?:png|gif|jpg|jpeg))`")
SOURCE_FILES = ("slides-source.md", "home-summary.md")

MANIFEST_NAME = "course.yaml"


def _refs(
    bundle: Path,
    ref: re.Pattern[str],
    source_files: tuple[str, ...],
) -> set[str]:
    """Filenames referenced by the bundle's source files (containment: see docstring)."""
    refs: set[str] = set()
    missing = []
    root = Path(bundle).resolve()
    for name in source_files:
        f = bundle / name
        # Lexical containment is not containment: a symlink inside the bundle
        # can point at another course's deck, and auditing that one reports PASS
        # on this one. Resolve first, then prove the result is still inside.
        try:
            resolved = f.resolve()
            resolved.relative_to(root)
        except (OSError, ValueError) as exc:
            raise DiscoveryError(
                f"{bundle}: source file {name!r} resolves outside the bundle "
                f"({exc}) — refusing to audit another course's files"
            ) from exc
        if not f.is_file():
            # A typo'd source file used to be skipped, turning the whole audit
            # into an empty pass. Absence is a configuration error, not a hint.
            missing.append(name)
            continue
        try:
            text = f.read_text(encoding="utf-8")
        except (UnicodeError, OSError) as exc:
            # An unreadable source file is a configuration error with a clear
            # cause, not a traceback. Crashing here also hid the fact that the
            # audit never examined that file at all.
            raise DiscoveryError(
                f"{bundle}: source file {name!r} is not readable as UTF-8 ({exc})"
            ) from exc
        refs |= set(ref.findall(text))
    if missing:
        raise DiscoveryError(
            f"{bundle}: configured source file(s) not found: {', '.join(sorted(missing))}"
        )
    return refs


def _assets_on_disk(bundle: Path) -> set[str]:
    """Names of the real asset files in ``bundle/assets``.

    Every case below is a refusal rather than a guess, because each one quietly
    SHRINKS the set of assets the audit believes exists — and a smaller set means
    fewer dangling references, which reads as a cleaner gate:

    * ``assets`` present but not a directory (a file, a broken link)
    * ``assets`` a symlink or junction pointing outside the bundle
    * an entry that is a directory wearing an image name
    * an entry whose resolved path escapes the assets directory

    A MISSING ``assets`` directory is not an error: an early bundle may declare
    every asset as to-be-created. Those references still land in TO-CREATE or
    DANGLING, so nothing is hidden by allowing it.
    """
    assets = bundle / "assets"
    if not assets.exists():
        # exists() follows the link, so a BROKEN assets symlink lands here looking
        # exactly like an absent directory — and absent is legal. Separate them
        # first, or a bundle whose assets/ points nowhere audits as "everything is
        # still to be created" and passes.
        if assets.is_symlink():
            raise DiscoveryError(
                f"{bundle}: assets/ is a symlink that resolves to nothing. Refusing "
                "to audit as though the directory were simply absent."
            )
        return set()

    root = Path(bundle).resolve()
    try:
        resolved = assets.resolve()
        resolved.relative_to(root)
    except (OSError, ValueError) as exc:
        raise DiscoveryError(
            f"{bundle}: assets/ resolves outside the bundle ({exc}) — refusing to "
            "count another course's files as this course's assets"
        ) from exc
    if not assets.is_dir():
        raise DiscoveryError(
            f"{bundle}: assets/ exists but is not a directory. Every reference "
            "would be reported missing against an empty set."
        )

    try:
        entries = list(resolved.iterdir())
    except OSError as exc:
        raise DiscoveryError(
            f"{bundle}: assets/ could not be listed ({exc})"
        ) from exc

    names: set[str] = set()
    for entry in entries:
        try:
            target = entry.resolve()
            target.relative_to(resolved)
        except (OSError, ValueError) as exc:
            raise DiscoveryError(
                f"{bundle}: assets/{entry.name} resolves outside assets/ ({exc})"
            ) from exc
        if target.is_dir():
            raise DiscoveryError(
                f"{bundle}: assets/{entry.name} is a directory, not an asset file"
            )
        if not target.is_file():
            raise DiscoveryError(
                f"{bundle}: assets/{entry.name} is not a regular file (broken link?)"
            )
        names.add(entry.name)
    return names


# The heading that opens the to-be-created table. Anchored, because the filenames
# in it also appear elsewhere in SOURCES.md as EXISTING sources.
_CREATE_SECTION = re.compile(r"^#{1,6}\s*assets that must be created", re.M | re.I)
# A table row declares one file: the first cell, in backticks.
_CREATE_ROW = re.compile(r"^\|\s*`([^`|]+)`\s*\|", re.M)


def _declared_to_create(bundle: Path) -> set[str]:
    """Filenames SOURCES.md affirmatively declares as still to be created.

    A substring scan of the whole file was wrong in the way that matters: the
    L1-s1 manifest lists ``img-05.png`` as an EXISTING reference source, so a
    deleted ``img-05.png`` was classified TO-CREATE — a missing asset reported as
    planned work. A declaration has to be a row in the to-be-created table, not
    the filename appearing somewhere in the prose.

    No section means nothing is declared. Those references become DANGLING, which
    fails the gate; the quiet direction is the one that must not be the default.
    """
    manifest = bundle / "SOURCES.md"
    if not manifest.exists():
        if manifest.is_symlink():
            raise DiscoveryError(
                f"{bundle}: SOURCES.md is a symlink that resolves to nothing."
            )
        return set()

    root = Path(bundle).resolve()
    try:
        resolved = manifest.resolve()
        resolved.relative_to(root)
    except (OSError, ValueError) as exc:
        raise DiscoveryError(
            f"{bundle}: SOURCES.md resolves outside the bundle ({exc}) — refusing "
            "to let another bundle declare this one's assets to-be-created"
        ) from exc

    try:
        text = manifest.read_text(encoding="utf-8")
    except (UnicodeError, OSError) as exc:
        raise DiscoveryError(
            f"{bundle}: SOURCES.md is not readable as UTF-8 ({exc})"
        ) from exc

    start = _CREATE_SECTION.search(text)
    if start is None:
        return set()
    rest = text[start.end():]
    nxt = re.search(r"^#{1,6}\s", rest, re.M)
    section = rest[: nxt.start()] if nxt else rest
    return {m.group(1).strip() for m in _CREATE_ROW.finditer(section)}


def _audit(
    bundle: Path,
    ref: re.Pattern[str],
    source_files: tuple[str, ...],
) -> tuple[list[str], list[str], list[str]]:
    refs = _refs(bundle, ref, source_files)

    have = _assets_on_disk(bundle)

    declared = _declared_to_create(bundle)

    ok, to_create, dangling = [], [], []
    for r in sorted(refs):
        if r in have:
            ok.append(r)
        elif r in declared:
            to_create.append(r)
        else:
            dangling.append(r)
    return ok, to_create, dangling


def _unused(
    bundle: Path,
    ref: re.Pattern[str],
    source_files: tuple[str, ...],
) -> list[str]:
    refs = _refs(bundle, ref, source_files)
    return sorted(_assets_on_disk(bundle) - refs)


def audit(bundle: Path) -> tuple[list[str], list[str], list[str]]:
    """Return (ok, to_create, dangling) filenames referenced by the bundle."""
    return _audit(bundle, REF, SOURCE_FILES)


def unused(bundle: Path) -> list[str]:
    """Assets on disk that no source file references — dead weight in the upload."""
    return _unused(bundle, REF, SOURCE_FILES)


def discovery_for(bundle: Path) -> tuple[re.Pattern[str], tuple[str, ...], bool]:
    """Resolve discovery at call time from the nearest course.yaml above ``bundle``.

    Fails closed. There is no default and no fallback: auditing a course with
    another course's naming finds nothing and reports success.
    """
    current = Path(bundle).resolve()
    for candidate in (current, *current.parents):
        manifest = candidate / MANIFEST_NAME
        try:
            if not manifest.exists():
                # exists() follows the link, so a BROKEN manifest symlink lands
                # here looking exactly like an absent manifest — and absent is
                # how the walk continues upward toward an ancestor course.yaml.
                # Separate them first, or a bundle under a dangling link audits
                # under ANOTHER course's naming instead of failing.
                if manifest.is_symlink():
                    raise DiscoveryError(
                        f"{candidate}: {MANIFEST_NAME} is a symlink that resolves "
                        "to nothing. Refusing to walk past it to another course's "
                        "manifest."
                    )
                continue
            if not manifest.is_file():
                raise DiscoveryError(
                    f"{candidate}: {MANIFEST_NAME} exists but is not a regular "
                    "file. Refusing to walk past it to another course's manifest."
                )
        except OSError as exc:
            raise DiscoveryError(
                f"{candidate}: {MANIFEST_NAME} could not be inspected ({exc}) — "
                "refusing to walk past it"
            ) from exc
        # A manifest symlinked in from outside the candidate directory would let
        # another course's naming (or expect_references: false) govern this
        # bundle — the same escape _refs() already closes for source files.
        try:
            resolved = manifest.resolve()
            resolved.relative_to(candidate)
        except (OSError, ValueError) as exc:
            raise DiscoveryError(
                f"{candidate}: {MANIFEST_NAME} resolves outside this directory "
                f"({exc}) — refusing to govern this bundle with another course's "
                "manifest"
            ) from exc
        course = config.load_course(candidate)
        d = course.asset_discovery
        return d.ref, d.source_files, d.expect_references
    raise DiscoveryError(
        f"no {MANIFEST_NAME} found at or above {current}. Asset discovery is "
        "course-specific and has no default; create the manifest rather than "
        "auditing this bundle with another course's naming."
    )


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    bundle = Path(argv[1])
    try:
        ref, source_files, expect_references = discovery_for(bundle)
    except (DiscoveryError, config.CourseConfigError) as exc:
        print(f"check_assets: {exc}", file=sys.stderr)
        return 2
    try:
        ok, to_create, dangling = _audit(bundle, ref, source_files)
        unused_now = _unused(bundle, ref, source_files)
    except DiscoveryError as exc:
        print(f"check_assets: {exc}", file=sys.stderr)
        return 2
    for r in ok:
        print(f"  OK         {r}")
    for r in to_create:
        print(f"  TO-CREATE  {r}")
    for r in dangling:
        print(f"  DANGLING   {r}")
    for r in unused_now:
        print(f"  UNUSED     {r}  (on disk, referenced by nothing)")

    if dangling:
        print(f"\nFAIL: {len(dangling)} dangling asset reference(s)")
        return 1

    # A pattern can compile, carry exactly one capture group, and still match
    # nothing, and schema validation cannot tell that from a working one.
    #
    # The previous version INFERRED the mistake from "no references, yet assets/
    # is full". That is not an invariant: assets/ legitimately also holds helper
    # scripts and intermediate frames (this repo's own L1-s1 assets directory
    # contains three), and a bundle may stage assets before the deck cites them.
    # A gate that cries wolf gets switched off, which is its own fail-open.
    #
    # So the course DECLARES the expectation and the gate enforces only that.
    if expect_references and not (ok or to_create):
        print(
            "\nFAIL: this course declares expect_references: true, but discovery "
            "matched no asset references at all. Either asset_ref_pattern or "
            "asset_source_files does not match this bundle."
        )
        return 1

    print(f"\nPASS: {len(ok)} present, {len(to_create)} to create")
    return 0


def _demo() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        b = Path(d)
        (b / "assets").mkdir()
        (b / "assets" / "img-01.png").write_bytes(b"x")
        (b / "assets" / "img-99.png").write_bytes(b"x")  # never referenced
        (b / "slides-source.md").write_text(
            "- **Asset:** `img-01.png`\n"
            "- **Asset:** `img-02.png`\n"
            "- **Asset:** `img-03.png`\n",
            encoding="utf-8",
        )
        # every declared source file must exist — absence is a config error,
        # not a reason to audit less
        (b / "home-summary.md").touch()
        (b / "SOURCES.md").write_text("| `img-02.png` | to be created |", encoding="utf-8")
        ok, to_create, dangling = audit(b)
        assert ok == ["img-01.png"], ok
        assert to_create == ["img-02.png"], to_create
        assert dangling == ["img-03.png"], dangling
        assert unused(b) == ["img-99.png"], unused(b)

        # a declared source file that is not on disk must fail closed, not
        # quietly shrink the audit to an empty pass
        (b / "home-summary.md").unlink()
        try:
            audit(b)
        except DiscoveryError as exc:
            assert "home-summary.md" in str(exc), exc
        else:  # pragma: no cover
            raise AssertionError("a missing source file was silently skipped")

    # discovery itself has no default: no manifest is an error, never micro:bit
    with tempfile.TemporaryDirectory() as d:
        try:
            discovery_for(Path(d))
        except DiscoveryError as exc:
            assert "no course.yaml found" in str(exc), exc
        else:  # pragma: no cover
            raise AssertionError("discovery fell back to a default")

    print("check_assets.py self-check OK")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--self-check":
        _demo()
    else:
        sys.exit(main(sys.argv))
