"""Tests for check_assets.py asset discovery, incl. non-micro:bit courses.

The cross-course coverage runs through main(argv) — the real CLI entry point —
because a generalisation the entry point cannot reach is not a generalisation.

The governing rule here is that discovery FAILS CLOSED. Two review iterations
were rejected for the same defect wearing different hats: when discovery could
not be resolved, the gate quietly used the micro:bit naming, found zero
references, and printed "PASS: 0 present" for a course whose every asset was
missing. Several tests below exist purely to keep that outcome unreachable —
they assert a nonzero exit where an earlier version asserted a green pass.
"""

import re
from pathlib import Path

import pytest

from swarm import check_assets

EV3_REF = re.compile(r"`((?:shot|render)[A-Za-z0-9_.\-]*\.(?:png|svg))`")

# Everything a manifest needs besides discovery. load_course validates the whole
# document, so a fixture manifest has to be a real one.
MANIFEST_BASE = """name: Test Course
audience: ages 9-12
levels: [1]
sessions_per_level: 8
providers: [claude, codex, opencode, hermes]
artifact_schedule:
  s1: true
  s2: true
  s3: true
  s4: true
  s5: true
  s6: true
  s7: true
  s8: false
stages:
  digest: 10-digest
  digest_assets: _assets
  provenance: 20-provenance
  receipts: 90-receipts
"""

MICROBIT_DISCOVERY = (
    "asset_discovery:\n"
    r"  asset_ref_pattern: '`((?:img|tata|technosquare)[A-Za-z0-9_.\-]*\.(?:png|gif|jpg|jpeg))`'"
    "\n  asset_source_files: [slides-source.md, home-summary.md]\n"
)

# A differently-named course: different asset prefixes, different source
# filenames. Raw string so the regex backslashes survive verbatim.
EV3_DISCOVERY = (
    "asset_discovery:\n"
    r"  asset_ref_pattern: '`((?:shot|render)[A-Za-z0-9_.\-]*\.(?:png|svg))`'"
    "\n  asset_source_files: [deck.md]\n"
)


def _manifest(root, discovery=MICROBIT_DISCOVERY):
    """Write a complete manifest. Adds expect_references unless the case sets it.

    Centralised so a new required discovery field is added in one place rather
    than in every inline fixture string.
    """
    root.mkdir(parents=True, exist_ok=True)
    if "expect_references" not in discovery and "asset_source_files" in discovery:
        discovery = discovery.rstrip("\n") + "\n  expect_references: true\n"
    (root / "course.yaml").write_text(MANIFEST_BASE + discovery, encoding="utf-8")
    return root


def _microbit_bundle(tmp_path):
    b = tmp_path / "mb"
    (b / "assets").mkdir(parents=True)
    for name in ("img-01.png", "tata-01.gif", "img-99.png"):
        (b / "assets" / name).write_bytes(b"x")
    (b / "slides-source.md").write_text(
        "- **Asset:** `img-01.png`\n"
        "- **Asset:** `img-02.png`\n"
        "- **Asset:** `technosquare-logo.jpg`\n",
        encoding="utf-8",
    )
    (b / "home-summary.md").write_text("- **Asset:** `tata-01.gif`\n", encoding="utf-8")
    (b / "SOURCES.md").write_text(
        "## Assets that must be CREATED before generation\n\n"
        "| `img-02.png` | to be created |", encoding="utf-8"
    )
    return b


def _bare_bundle(tmp_path, name="bare"):
    """Assets dir + both default source files, contents filled in by the test."""
    b = tmp_path / name
    (b / "assets").mkdir(parents=True)
    (b / "slides-source.md").touch()
    (b / "home-summary.md").touch()
    return b


def _ev3_course(tmp_path):
    """A differently-named course: its own manifest declares its discovery."""
    root = _manifest(tmp_path / "ev3-course", EV3_DISCOVERY)
    b = root / "bundles" / "e1-s1"
    (b / "assets").mkdir(parents=True)
    (b / "assets" / "shot-arm.png").write_bytes(b"x")
    (b / "assets" / "render-arm.svg").write_bytes(b"x")
    (b / "assets" / "img-orphan.png").write_bytes(b"x")  # matches no pattern: UNUSED
    (b / "deck.md").write_text(
        "`shot-arm.png` and `render-arm.svg`, plus missing `shot-gyro.png`\n",
        encoding="utf-8",
    )
    # micro:bit-style reference in a file that is NOT an EV3 source: ignored.
    (b / "slides-source.md").write_text("- **Asset:** `img-01.png`\n", encoding="utf-8")
    return b


# --------------------------------------------------------------------------
# the CLI generalises
# --------------------------------------------------------------------------


def test_main_cli_finds_differently_named_course(tmp_path, capsys):
    """main() generalises via the course manifest — this test would have caught C0-03.

    Under micro:bit naming this bundle yields zero references and a green PASS;
    the manifest-declared deck.md/shot-* discovery must flip it to a real FAIL.
    """
    b = _ev3_course(tmp_path)
    rc = check_assets.main(["check_assets.py", str(b)])
    out = capsys.readouterr().out
    assert rc == 1
    assert "  OK         shot-arm.png\n" in out
    assert "  OK         render-arm.svg\n" in out
    assert "  DANGLING   shot-gyro.png\n" in out
    assert "\nFAIL: 1 dangling asset reference(s)" in out
    assert "  TO-CREATE  " not in out
    assert "img-01.png" not in out  # slides-source.md is not an EV3 source file
    assert "UNUSED     img-orphan.png" in out


def test_main_cli_on_microbit_course(tmp_path, capsys):
    b = _microbit_bundle(tmp_path)
    _manifest(tmp_path)
    rc = check_assets.main(["check_assets.py", str(b)])
    out = capsys.readouterr().out
    assert rc == 1  # technosquare-logo.jpg is referenced, undeclared, missing
    assert "  OK         img-01.png\n" in out
    assert "  TO-CREATE  img-02.png\n" in out
    assert "  DANGLING   technosquare-logo.jpg\n" in out
    assert "  UNUSED     img-99.png" in out


def test_nearest_manifest_wins(tmp_path, capsys):
    """A bundle is governed by the closest course.yaml above it, not the outermost."""
    outer = _manifest(tmp_path / "outer", MICROBIT_DISCOVERY)
    inner = _manifest(outer / "inner", EV3_DISCOVERY)
    b = inner / "b1"
    (b / "assets").mkdir(parents=True)
    (b / "deck.md").write_text("`shot-arm.png`\n", encoding="utf-8")

    assert check_assets.main(["check_assets.py", str(b)]) == 1
    assert "DANGLING   shot-arm.png" in capsys.readouterr().out


# --------------------------------------------------------------------------
# fail-closed: every one of these used to be a silent green pass
# --------------------------------------------------------------------------


def test_no_manifest_anywhere_is_an_error_not_a_default(tmp_path, capsys):
    """C0-03. No manifest must never mean 'assume micro:bit'."""
    b = tmp_path / "orphan"
    (b / "assets").mkdir(parents=True)
    (b / "deck.md").write_text("`shot-missing.png`\n", encoding="utf-8")

    rc = check_assets.main(["check_assets.py", str(b)])
    assert rc == 2
    assert "no course.yaml found" in capsys.readouterr().err


def test_manifest_without_discovery_is_an_error(tmp_path, capsys):
    """C0-06. The same bug as C0-03 under a different fallback condition."""
    root = tmp_path / "no-discovery"
    root.mkdir()
    (root / "course.yaml").write_text(MANIFEST_BASE, encoding="utf-8")
    b = root / "b1"
    (b / "assets").mkdir(parents=True)

    rc = check_assets.main(["check_assets.py", str(b)])
    assert rc == 2
    assert "asset_discovery" in capsys.readouterr().err


def test_configured_source_file_missing_is_an_error(tmp_path, capsys):
    """C0-07. A typo'd source name turned the whole audit into an empty pass."""
    root = _manifest(
        tmp_path / "typo",
        "asset_discovery:\n"
        r"  asset_ref_pattern: '`(shot-[^`]+\.png)`'"
        "\n  asset_source_files: [dekk.md]\n",
    )
    b = root / "b1"
    (b / "assets").mkdir(parents=True)
    (b / "deck.md").write_text("`shot-missing.png`\n", encoding="utf-8")

    rc = check_assets.main(["check_assets.py", str(b)])
    assert rc == 2
    assert "configured source file(s) not found: dekk.md" in capsys.readouterr().err


def test_multi_group_pattern_is_refused(tmp_path, capsys):
    """C0-09. findall() returns tuples past one group, and the audit dies mid-run."""
    root = _manifest(
        tmp_path / "groups",
        "asset_discovery:\n"
        r"  asset_ref_pattern: '`((shot|render)-([^.]+)\.(png|svg))`'"
        "\n  asset_source_files: [deck.md]\n",
    )
    b = root / "b1"
    (b / "assets").mkdir(parents=True)
    (b / "deck.md").write_text("`shot-arm.png`\n", encoding="utf-8")

    rc = check_assets.main(["check_assets.py", str(b)])
    assert rc == 2
    assert "exactly one capture group" in capsys.readouterr().err


def test_source_file_escaping_the_bundle_is_refused(tmp_path, capsys):
    """C0-10. An escaping source path audits another course and passes this one."""
    root = _manifest(
        tmp_path / "escape",
        "asset_discovery:\n"
        r"  asset_ref_pattern: '`(shot-[^`]+\.png)`'"
        "\n  asset_source_files: ['../../other/deck.md']\n",
    )
    b = root / "b1"
    (b / "assets").mkdir(parents=True)

    rc = check_assets.main(["check_assets.py", str(b)])
    assert rc == 2
    assert "must be one file name inside the bundle" in capsys.readouterr().err


@pytest.mark.parametrize(
    "discovery, expected",
    [
        ("asset_discovery:\n  asset_ref_patterns: ['oops']\n", "unknown asset_discovery"),
        (
            "asset_discovery:\n  asset_ref_pattern: '`([unclosed'\n"
            "  asset_source_files: [deck.md]\n",
            "not a valid regex",
        ),
        ("asset_discovery: 'a string'\n", "must be a mapping"),
        (
            "asset_discovery:\n"
            r"  asset_ref_pattern: '`(shot-[^`]+\.png)`'"
            "\n  asset_source_files: []\n",
            "non-empty list",
        ),
        (
            "asset_discovery:\n  asset_source_files: [deck.md]\n",
            "missing field(s): asset_discovery.asset_ref_pattern",
        ),
    ],
)
def test_malformed_discovery_fails_loudly(tmp_path, capsys, discovery, expected):
    """A malformed section must never degrade into another course's naming."""
    root = _manifest(tmp_path / "bad", discovery)
    b = root / "b1"
    b.mkdir(parents=True)

    rc = check_assets.main(["check_assets.py", str(b)])
    assert rc == 2
    assert expected in capsys.readouterr().err


def test_unparseable_manifest_fails_loudly(tmp_path, capsys):
    root = tmp_path / "broken"
    root.mkdir()
    (root / "course.yaml").write_text("levels: [1\n  bad: :\n", encoding="utf-8")
    b = root / "b1"
    b.mkdir()

    rc = check_assets.main(["check_assets.py", str(b)])
    assert rc == 2
    assert "invalid YAML" in capsys.readouterr().err


# --------------------------------------------------------------------------
# the direct API: module globals still steer it, resolved at call time
# --------------------------------------------------------------------------


def test_microbit_shape_default_params(tmp_path):
    """One-arg audit on a micro:bit-shaped bundle behaves exactly as today."""
    b = _microbit_bundle(tmp_path)
    ok, to_create, dangling = check_assets.audit(b)
    assert ok == ["img-01.png", "tata-01.gif"]
    assert to_create == ["img-02.png"]
    assert dangling == ["technosquare-logo.jpg"]
    assert check_assets.unused(b) == ["img-99.png"]


def test_call_time_pattern_override_changes_results(tmp_path, monkeypatch):
    """Module-global REF overrides resolve at call time (C0-02 regression guard).

    Definition-time binding froze the default into the signature and made this
    override silently dead; it must keep steering the one-argument API.
    """
    b = _bare_bundle(tmp_path, "shot-bundle")
    (b / "assets" / "shot-arm.png").write_bytes(b"x")
    (b / "slides-source.md").write_text("`shot-arm.png`\n", encoding="utf-8")

    assert check_assets.audit(b) == ([], [], [])  # default pattern never sees shot-*

    monkeypatch.setattr(check_assets, "REF", EV3_REF)
    assert check_assets.audit(b) == (["shot-arm.png"], [], [])


def test_call_time_source_files_override_changes_results(tmp_path, monkeypatch):
    """SOURCE_FILES overrides resolve at call time too."""
    b = _bare_bundle(tmp_path, "deck-bundle")
    (b / "assets" / "img-x.png").write_bytes(b"x")
    (b / "deck.md").write_text("`img-x.png`\n", encoding="utf-8")

    assert check_assets.audit(b) == ([], [], [])  # default sources never read deck.md

    monkeypatch.setattr(check_assets, "SOURCE_FILES", ("deck.md",))
    assert check_assets.audit(b) == (["img-x.png"], [], [])


def test_declared_source_file_missing_raises(tmp_path, monkeypatch):
    """The direct API fails closed for the same reason the CLI does."""
    b = tmp_path / "only-home"
    (b / "assets").mkdir(parents=True)
    (b / "home-summary.md").write_text("- **Asset:** `tata-01.gif`\n", encoding="utf-8")

    with pytest.raises(check_assets.DiscoveryError, match="slides-source.md"):
        check_assets.audit(b)

    monkeypatch.setattr(check_assets, "SOURCE_FILES", ("home-summary.md",))
    ok, _, dangling = check_assets.audit(b)
    assert ok == [] and dangling == ["tata-01.gif"]


# --------------------------------------------------------------------------
# reference recognition
# --------------------------------------------------------------------------


def test_empty_bundle_under_a_course_expecting_references_fails(tmp_path, capsys):
    """The distinction this file exists to preserve.

    "Nothing referenced" is a pass only where the course declares assets
    optional. Under expect_references: true it is the reported symptom of a
    pattern that matches nothing — which is exactly how a course with every
    asset missing used to report success.

    The direct API is unaffected: it has no manifest and no policy, so it still
    reports an honest empty result.
    """
    root = _manifest(tmp_path)  # micro:bit discovery, expect_references: true
    b = _bare_bundle(root)
    assert check_assets.audit(b) == ([], [], [])
    assert check_assets.unused(b) == []
    assert check_assets.main(["check_assets.py", str(b)]) == 1
    assert "declares expect_references: true" in capsys.readouterr().out


def test_missing_assets_dir_is_dangling_not_crash(tmp_path):
    b = tmp_path / "no-assets"
    b.mkdir(parents=True)
    (b / "slides-source.md").write_text("`img-lost.png`\n", encoding="utf-8")
    (b / "home-summary.md").touch()
    ok, to_create, dangling = check_assets.audit(b)
    assert ok == []
    assert to_create == []
    assert dangling == ["img-lost.png"]
    assert check_assets.unused(b) == []


def test_matching_is_case_sensitive(tmp_path):
    """Documented policy: exact case, at both layers.

    A recognised reference (`img-Camera.png`) matches no on-disk file whose name
    differs in case; and a fully uppercased name (IMG-UPPER.png) is not even
    recognised, because the known prefixes are lowercase.
    """
    b = _bare_bundle(tmp_path, "case")
    (b / "assets" / "img-camera.png").write_bytes(b"x")
    (b / "slides-source.md").write_text("`img-Camera.png`\n`IMG-UPPER.png`\n", encoding="utf-8")
    ok, to_create, dangling = check_assets.audit(b)
    assert ok == []
    assert dangling == ["img-Camera.png"]
    assert check_assets.unused(b) == ["img-camera.png"]


def test_only_backticked_asset_shaped_spans_are_references(tmp_path):
    b = _bare_bundle(tmp_path)
    (b / "slides-source.md").write_text(
        "`img-real.png`\n"
        "plain text mention of img-naked.png without backticks\n"
        "`foo-unrelated.png` wrong prefix\n"
        "see docs at https://example.com/img-url.png\n",
        encoding="utf-8",
    )
    ok, to_create, dangling = check_assets.audit(b)
    assert ok == []
    assert to_create == []
    assert dangling == ["img-real.png"]
    for ignored in ("img-naked.png", "foo-unrelated.png", "img-url.png"):
        assert ignored not in dangling


def test_dangling_reference(tmp_path):
    b = _bare_bundle(tmp_path)
    (b / "slides-source.md").write_text("`img-ghost.png`\n", encoding="utf-8")
    assert check_assets.audit(b)[2] == ["img-ghost.png"]


def test_to_create_reference_declared_in_sources_md(tmp_path):
    b = _bare_bundle(tmp_path)
    (b / "slides-source.md").write_text("`img-later.png`\n", encoding="utf-8")
    (b / "SOURCES.md").write_text(
        "## Assets that must be CREATED before generation\n\n"
        "| `img-later.png` | to be created |", encoding="utf-8"
    )
    ok, to_create, dangling = check_assets.audit(b)
    assert to_create == ["img-later.png"]
    assert dangling == []


# --------------------------------------------------------------------------
# review iteration 3: three more ways to reach a green gate on an empty check
# --------------------------------------------------------------------------


def test_declared_expectation_is_enforced_not_inferred(tmp_path, capsys):
    """C0-12/C0-16. A regex can compile, carry one group, and match nothing.

    The first attempt at this INFERRED the mistake from "no references but
    assets/ is full". That is not an invariant — assets/ legitimately holds
    helper scripts and intermediate frames (L1-s1's own does) and assets may be
    staged before the deck cites them. A gate that cries wolf gets switched off.
    So the course declares the expectation and only that is enforced.
    """
    root = _manifest(
        tmp_path / "nomatch",
        "asset_discovery:\n  asset_ref_pattern: '((?!))'\n"
        "  asset_source_files: [deck.md]\n  expect_references: true\n",
    )
    b = root / "b1"
    (b / "assets").mkdir(parents=True)
    (b / "deck.md").write_text("`shot-missing.png`\n", encoding="utf-8")

    assert check_assets.main(["check_assets.py", str(b)]) == 1
    assert "declares expect_references: true" in capsys.readouterr().out


def test_zero_references_pass_when_the_course_says_so(tmp_path, capsys):
    """The other half of the policy: an asset-free course must not be failed.

    Guards C0-16 — the heuristic version failed this legitimate configuration.
    """
    root = _manifest(
        tmp_path / "assetless",
        "asset_discovery:\n  asset_ref_pattern: '`(shot-[^`]+[.]png)`'\n"
        "  asset_source_files: [deck.md]\n  expect_references: false\n",
    )
    b = root / "b1"
    (b / "assets").mkdir(parents=True)
    (b / "assets" / "staged-early.png").write_bytes(b"x")  # staged, not yet cited
    (b / "deck.md").write_text("no references yet\n", encoding="utf-8")

    assert check_assets.main(["check_assets.py", str(b)]) == 0
    assert "PASS: 0 present" in capsys.readouterr().out


def test_expect_references_must_be_declared(tmp_path, capsys):
    """It is required, not defaulted: the course states its own policy."""
    root = tmp_path / "undeclared"
    root.mkdir()
    (root / "course.yaml").write_text(
        MANIFEST_BASE + "asset_discovery:\n"
        "  asset_ref_pattern: '`(shot-[^`]+[.]png)`'\n"
        "  asset_source_files: [deck.md]\n",
        encoding="utf-8",
    )
    b = root / "b1"
    b.mkdir()

    assert check_assets.main(["check_assets.py", str(b)]) == 2
    assert "expect_references" in capsys.readouterr().err


def test_symlinked_source_escaping_the_bundle_is_refused(tmp_path):
    """C0-11. Lexical containment is not containment.

    A symlink inside the bundle can point at another course's deck; auditing
    that one reports PASS on this one.
    """
    outside = tmp_path / "other"
    outside.mkdir()
    (outside / "deck.md").write_text("nothing here\n", encoding="utf-8")

    b = tmp_path / "b"
    (b / "assets").mkdir(parents=True)
    try:
        (b / "deck.md").symlink_to(outside / "deck.md")
    except (OSError, NotImplementedError) as exc:  # Windows without the privilege
        pytest.skip(f"symlinks unavailable: {exc}")

    with pytest.raises(check_assets.DiscoveryError, match="outside the bundle"):
        check_assets._refs(b, check_assets.REF, ("deck.md",))


def test_discovery_error_is_declared_once():
    """C0-14. A botched patch left two identical class statements."""
    source = Path(check_assets.__file__).read_text(encoding="utf-8")
    assert source.count("class DiscoveryError") == 1


def test_unreadable_source_file_is_a_clean_error_not_a_traceback(tmp_path, capsys):
    """A non-UTF8 source file used to raise UnicodeDecodeError out of the CLI.

    The crash also hid the real problem: that file was never examined, so the
    audit was incomplete rather than merely noisy.
    """
    root = _manifest(
        tmp_path / "binary",
        "asset_discovery:\n"
        r"  asset_ref_pattern: '`(shot-[^`]+[.]png)`'"
        "\n  asset_source_files: [deck.md]\n",
    )
    b = root / "b1"
    (b / "assets").mkdir(parents=True)
    (b / "deck.md").write_bytes(b"\xff\xfe`shot-a.png`")

    rc = check_assets.main(["check_assets.py", str(b)])
    assert rc == 2
    assert "not readable as UTF-8" in capsys.readouterr().err


# --------------------------------------------------------------------------
# C0-15: assets/ shrinking silently. Every case here REDUCES the set of assets
# believed to exist, which means fewer dangling refs — a cleaner-looking gate.
# --------------------------------------------------------------------------


def test_assets_that_is_a_file_is_refused(tmp_path):
    b = _bare_bundle(_manifest(tmp_path))
    (b / "assets").rmdir()
    (b / "assets").write_bytes(b"not a directory")
    with pytest.raises(check_assets.DiscoveryError, match="not a directory"):
        check_assets.audit(b)


def test_directory_wearing_an_image_name_is_refused(tmp_path):
    b = _bare_bundle(_manifest(tmp_path))
    (b / "assets" / "img-01.png").mkdir()
    (b / "slides-source.md").write_text("`img-01.png`\n", encoding="utf-8")
    with pytest.raises(check_assets.DiscoveryError, match="is a directory"):
        check_assets.audit(b)


def test_missing_assets_dir_is_allowed(tmp_path):
    """Not every refusal: an early bundle may declare everything to-be-created.

    Those references still surface as TO-CREATE or DANGLING, so allowing this
    hides nothing.
    """
    root = _manifest(tmp_path)
    b = root / "early"
    b.mkdir(parents=True)
    (b / "slides-source.md").write_text("`img-later.png`\n", encoding="utf-8")
    (b / "home-summary.md").touch()
    assert check_assets.audit(b)[2] == ["img-later.png"]


# ---------------------------------------------------------------------------
# Round 5. Four fail-open paths, all found by reading rather than by running.
# ---------------------------------------------------------------------------


def test_declared_means_a_row_in_the_create_table_not_a_mention(tmp_path):
    """C5-02. img-05.png is listed as an EXISTING source in the real L1-s1
    manifest. A substring scan classified a MISSING img-05.png as TO-CREATE —
    a broken reference reported as planned work."""
    bundle = _manifest(tmp_path / "b")
    (bundle / "slides-source.md").write_text("`img-05.png`\n", encoding="utf-8")
    (bundle / "home-summary.md").write_text("", encoding="utf-8")
    (bundle / "SOURCES.md").write_text(
        "## Sources\n\n"
        "| 6 | key project images | `assets/img-05.png` |\n\n"
        "## Assets that must be CREATED before generation\n\n"
        "| File | Derived from |\n| --- | --- |\n"
        "| `img-99.png` | `img-05.png` |\n",
        encoding="utf-8",
    )

    ok, to_create, dangling = check_assets.audit(bundle)

    assert dangling == ["img-05.png"], "a mention is not a declaration"
    assert to_create == []
    assert check_assets._declared_to_create(bundle) == {"img-99.png"}


def test_no_create_section_declares_nothing(tmp_path):
    """C5-02. Absence of the section must fail loud, not pass everything."""
    bundle = _manifest(tmp_path / "b")
    (bundle / "slides-source.md").write_text("`img-07.png`\n", encoding="utf-8")
    (bundle / "home-summary.md").write_text("", encoding="utf-8")
    (bundle / "SOURCES.md").write_text("`img-07.png` was rejected.\n", encoding="utf-8")

    assert check_assets.audit(bundle)[2] == ["img-07.png"]


def test_unlistable_assets_dir_is_a_clean_failure(tmp_path, monkeypatch):
    """C5-04. iterdir() itself sat outside the per-entry try; an OSError there
    escaped the CLI as a raw traceback instead of a gate failure."""
    bundle = _manifest(tmp_path / "b")
    (bundle / "assets").mkdir()

    def boom(self):
        raise OSError("permission denied")

    monkeypatch.setattr(Path, "iterdir", boom)
    with pytest.raises(check_assets.DiscoveryError, match="could not be listed"):
        check_assets._assets_on_disk(bundle)


def test_broken_assets_symlink_is_not_an_absent_directory(tmp_path):
    """C5-01. exists() follows the link, so a broken assets/ link looked exactly
    like the legal absent case and the bundle audited as all-to-be-created."""
    bundle = _manifest(tmp_path / "b")
    link = bundle / "assets"
    try:
        link.symlink_to(bundle / "nowhere", target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("creating symlinks needs privilege on this platform")

    with pytest.raises(check_assets.DiscoveryError, match="resolves to nothing"):
        check_assets._assets_on_disk(bundle)


# ---------------------------------------------------------------------------
# Round 6. Two more escapes of the same shape _refs() already closed.
# ---------------------------------------------------------------------------


def test_discovery_refuses_a_course_yaml_symlink_escaping_its_directory(tmp_path):
    """C6-01. An external manifest could supply another course's naming, or
    expect_references: false, and the bundle would audit under it silently."""
    outside = _manifest(tmp_path / "outside")
    candidate = tmp_path / "candidate"
    candidate.mkdir()
    try:
        (candidate / "course.yaml").symlink_to(outside / "course.yaml")
    except (OSError, NotImplementedError):
        pytest.skip("creating symlinks needs privilege on this platform")

    with pytest.raises(check_assets.DiscoveryError, match="resolves outside"):
        check_assets.discovery_for(candidate / "bundle")


def test_sources_md_symlink_escaping_the_bundle_is_refused(tmp_path):
    """C6-02. A SOURCES.md symlinked from elsewhere could declare this bundle's
    missing references TO-CREATE and clear expect_references."""
    bundle = _manifest(tmp_path / "b")
    (bundle / "slides-source.md").write_text("`img-05.png`\n", encoding="utf-8")
    (bundle / "home-summary.md").write_text("", encoding="utf-8")
    outside = tmp_path / "outside.md"
    outside.write_text(
        "## Assets that must be CREATED before generation\n\n| `img-05.png` | |",
        encoding="utf-8",
    )
    try:
        (bundle / "SOURCES.md").symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("creating symlinks needs privilege on this platform")

    with pytest.raises(check_assets.DiscoveryError, match="resolves outside"):
        check_assets._declared_to_create(bundle)
