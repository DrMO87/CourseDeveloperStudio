"""Lane E: instantiating an empty course must produce a working, EMPTY course.

The plan calls for proof rather than grep: create the course, load its manifest
back, import the copied modules, derive paths from the new manifest, and only
then check that no trace of the source course's naming survived.

The failure this suite exists to prevent is a scaffolder that reports success
having written a manifest nobody validated, or having copied one course's
content into the next one.
"""

import dataclasses
import re
import subprocess
import sys
from pathlib import Path

import pytest

from swarm import config, new_course

VAULT = Path(__file__).resolve().parents[1]

EV3_SEED = new_course.Seed(
    slug="kids-ev3",
    name="Techno Square EV3 kids track",
    audience="ages 9-12, no prior programming",
    subject="LEGO MINDSTORMS EV3",
    levels=(1, 2),
    sessions_per_level=8,
    providers=("claude", "codex"),
    artifact_schedule=(True,) * 7 + (False,),
    asset_ref_pattern=r"`((?:shot|render)[A-Za-z0-9_.\-]*\.(?:png|svg))`",
    asset_source_files=("slides-source.md",),
    expect_references=True,
)


@pytest.fixture
def course(tmp_path):
    target = tmp_path / "ev3"
    cfg = new_course.create(EV3_SEED, target, VAULT)
    return target, cfg


# --------------------------------------------------------------------------
# it produces a real, loadable course
# --------------------------------------------------------------------------


def test_manifest_is_loaded_back_not_merely_written(course):
    target, cfg = course

    assert cfg == config.load_course(target)
    assert cfg.levels == (1, 2)
    assert cfg.sessions_per_level == 8
    assert cfg.providers == frozenset({"claude", "codex"})
    assert cfg.produces_artifacts("L2-s7") is True
    assert cfg.produces_artifacts("L2-s8") is False


def test_discovery_comes_from_the_new_manifest(course):
    target, cfg = course
    d = cfg.asset_discovery

    assert d.expect_references is True
    assert d.source_files == ("slides-source.md",)
    assert d.ref.search("`shot-arm.png`")
    assert not d.ref.search("`img-01.png`"), "the source course's naming must not carry over"


def test_paths_bind_to_the_new_course(course):
    from swarm import paths

    target, _ = course
    bound = paths.for_root(target)

    assert bound.SESSION_IDS[0] == "L1-s1"
    assert len(bound.SESSION_IDS) == 16
    assert bound.digest_path("L1-s1") == target / "10-digest" / "L1-s1.md"
    with pytest.raises(ValueError, match="does not produce artifacts"):
        bound.digest_path("L2-s8")


def test_topology_is_derived_from_the_manifest(course):
    target, _ = course
    text = (target / "topology.md").read_text(encoding="utf-8")

    assert "| L1-s1 | yes |" in text
    assert "| L2-s8 | no |" in text
    assert "claude, codex" in text


def test_topology_uses_the_loaded_course_name():
    loaded = config.CourseConfig(
        name="Validated Course",
        audience="ages 9-12",
        track="",
        levels=(1,),
        sessions_per_level=1,
        providers=frozenset({"claude"}),
        artifact_schedule=(True,),
        asset_discovery=config.AssetDiscovery(
            ref=re.compile("`(img-[^`]+[.]png)`"),
            source_files=("slides-source.md",),
            expect_references=True,
        ),
        stages=config.StageDirectories(
            digest="10-digest",
            digest_assets="_assets",
            provenance="20-provenance",
            receipts="90-receipts",
        ),
    )

    text = new_course.topology_text(EV3_SEED, loaded)

    assert text.startswith("# Validated Course — topology")


def test_stage_tree_exists_and_is_empty(course):
    target, _ = course

    for rel in new_course.STAGE_DIRS:
        d = target / rel
        assert d.is_dir(), rel
        if rel == "75-bundle":  # carries the templates, which are not content
            assert {p.name for p in d.iterdir()} <= {
                "_TEMPLATE-blueprint.md",
                "_TEMPLATE-debugging-lab.md",
            }
        elif rel == "knowledge":  # carries the schema, which is not content
            assert [p.name for p in d.iterdir()] == ["_schema"]
            assert {p.name for p in (d / "_schema").iterdir()} == {"intake-schema.yaml"}
        elif rel == "80-generation":  # carries the deck-prompt template, not content
            assert {p.name for p in d.iterdir()} == {"nblm-student-deck-prompts.md"}
        else:
            assert list(d.iterdir()) == [], f"{rel} must start empty"


def test_scaffolded_deck_prompt_file_satisfies_the_runtime_parser():
    from swarm.generate_session import parse_prompts

    prompt_file = VAULT / "80-generation/nblm-student-deck-prompts.md"
    prompts = parse_prompts(prompt_file.read_text(encoding="utf-8"))

    assert set(prompts) == {"deck-a", "deck-b", "summary"}
    assert prompts["deck-a"].startswith("Generate a student slide deck")
    assert prompts["deck-b"].startswith("Continue the SAME student deck")
    assert prompts["summary"].startswith("Generate the student summary deck")


def test_new_course_inherits_standing_pipeline_contracts(course):
    target, _ = course

    for rel in (
        "00-contracts/pipeline-lessons.md",
        "00-contracts/pdf-intake-sop.md",
        "00-contracts/pedagogy.md",
        "00-contracts/track-pedagogy.md",
    ):
        assert (target / rel).read_bytes() == (VAULT / rel).read_bytes()


def test_track_is_optional_and_omitted_when_undeclared(course):
    """EV3_SEED declares no track — the manifest must not invent one."""
    target, cfg = course

    assert cfg.track == ""
    assert "track:" not in (target / "course.yaml").read_text(encoding="utf-8")


def test_track_is_written_when_declared(tmp_path):
    seed = dataclasses.replace(EV3_SEED, track="stem-engineering")
    target = tmp_path / "tracked"

    cfg = new_course.create(seed, target, VAULT)

    assert cfg.track == "stem-engineering"
    assert "track: stem-engineering" in (target / "course.yaml").read_text(encoding="utf-8")


def test_new_course_inherits_a_specialist_template(course):
    """The portability hole: contracts addressed an agent the new vault lacked.

    Every course needs its own domain specialist, and pedagogy.md assigns the
    pedagogy record to that agent. A scaffolder that copies the rules but not
    the role produces a course whose doctrine addresses nobody.
    """
    target, _ = course
    rel = ".claude/agents/_TEMPLATE-course-specialist.md"
    assert (target / rel).is_file(), "new course has no specialist template"
    assert (target / rel).read_bytes() == (VAULT / rel).read_bytes()


def test_the_specialist_is_instantiated_not_merely_copied(course):
    """A template is a role nobody holds until the placeholders are filled.

    An agent file still saying `COURSE` names no skill, writes to
    `knowledge/COURSE/`, and answers to none of pedagogy.md's rules under any
    name the course actually uses.
    """
    target, _ = course
    agent = target / ".claude/agents/kids-ev3-specialist.md"
    assert agent.is_file(), "new course has no instantiated specialist"
    text = agent.read_text(encoding="utf-8")

    assert "COURSE" not in text, "placeholders survived instantiation"
    assert "SUBJECT" not in text
    assert "name: kids-ev3-specialist" in text
    assert "required_skill: kids-ev3-course-specialist" in text
    assert "knowledge/kids-ev3/source-catalog.yaml" in text
    assert "LEGO MINDSTORMS EV3" in text, "the subject was not substituted"

    # The human-facing fill-in markers must survive as markers, not dissolve
    # into the slug — they are the only signal that the file is unfinished.
    assert f"TODO(kids-ev3):" in text


def test_specialist_instantiation_refuses_a_drifted_template(tmp_path):
    root = tmp_path / "course"
    template = root / new_course.SPECIALIST_TEMPLATE
    template.parent.mkdir(parents=True)
    template.write_text(
        (VAULT / new_course.SPECIALIST_TEMPLATE)
        .read_text(encoding="utf-8")
        .replace("Copied into every new course", "Used by every new course"),
        encoding="utf-8",
    )

    with pytest.raises(new_course.ScaffoldError, match="template header"):
        new_course._instantiate_specialist(EV3_SEED, root)

    assert not (root / ".claude/agents/kids-ev3-specialist.md").exists()


def test_subject_text_is_not_treated_as_a_template_placeholder(tmp_path):
    root = tmp_path / "course"
    template = root / new_course.SPECIALIST_TEMPLATE
    template.parent.mkdir(parents=True)
    template.write_bytes((VAULT / new_course.SPECIALIST_TEMPLATE).read_bytes())
    seed = dataclasses.replace(EV3_SEED, subject="SUBJECT and COURSE design")

    rel = new_course._instantiate_specialist(seed, root)

    text = (root / rel).read_text(encoding="utf-8")
    assert "SUBJECT and COURSE design" in text


def test_the_specialist_skill_is_instantiated_not_merely_copied(course):
    target, _ = course
    skill = target / ".claude/skills/kids-ev3-course-specialist/SKILL.md"
    assert skill.is_file(), "new course has no instantiated specialist skill"
    text = skill.read_text(encoding="utf-8")

    assert "name: kids-ev3-course-specialist" in text
    assert "knowledge/kids-ev3/source-catalog.yaml" in text
    assert "LEGO MINDSTORMS EV3" in text
    assert "TODO(kids-ev3):" in text


def test_specialist_skill_instantiation_refuses_a_drifted_template(tmp_path):
    root = tmp_path / "course"
    template = root / new_course.SPECIALIST_SKILL_TEMPLATE
    template.parent.mkdir(parents=True)
    template.write_text(
        (VAULT / new_course.SPECIALIST_SKILL_TEMPLATE)
        .read_text(encoding="utf-8")
        .replace("Copied into every new course", "Used by every new course"),
        encoding="utf-8",
    )

    with pytest.raises(new_course.ScaffoldError, match="template header"):
        new_course._instantiate_specialist_skill(EV3_SEED, root)

    assert not (
        root / ".claude/skills/kids-ev3-course-specialist/SKILL.md"
    ).exists()


def test_specialist_skill_instantiation_refuses_missing_fill_markers(tmp_path):
    root = tmp_path / "course"
    template = root / new_course.SPECIALIST_SKILL_TEMPLATE
    template.parent.mkdir(parents=True)
    template.write_text(
        (VAULT / new_course.SPECIALIST_SKILL_TEMPLATE)
        .read_text(encoding="utf-8")
        .replace("<!-- COURSE:", "<!-- FILL:"),
        encoding="utf-8",
    )

    with pytest.raises(new_course.ScaffoldError, match="no COURSE fill-in markers"):
        new_course._instantiate_specialist_skill(EV3_SEED, root)

    assert not (
        root / ".claude/skills/kids-ev3-course-specialist/SKILL.md"
    ).exists()


def test_specialist_skill_preserves_template_tokens_inside_subject(tmp_path):
    root = tmp_path / "course"
    template = root / new_course.SPECIALIST_SKILL_TEMPLATE
    template.parent.mkdir(parents=True)
    template.write_bytes((VAULT / new_course.SPECIALIST_SKILL_TEMPLATE).read_bytes())
    seed = dataclasses.replace(EV3_SEED, subject="SUBJECT and COURSE design")

    rel = new_course._instantiate_specialist_skill(seed, root)

    text = (root / rel).read_text(encoding="utf-8")
    assert "SUBJECT and COURSE design" in text


def test_the_agent_memory_contract_ports(course):
    """Required reading must port without one course's operating history."""
    target, _ = course
    rel = "00-contracts/agent-memory.md"
    text = (target / rel).read_text(encoding="utf-8")

    assert "The owner is not the course's domain expert" in text
    assert "Reserve the owner only for" in text
    for source_specific in (
        "tencent/hy3",
        "opencode/x-preview",
        "Level 1 only, 6 sessions",
        "Localization (Arabic)",
        "NBLM",
        "Antigravity",
        "L1-s1 deck failed",
    ):
        assert source_specific not in text


def test_the_manifest_declares_an_audience(course):
    """pedagogy.md §4: declared once here, never inherited, never inline."""
    target, cfg = course
    assert cfg.audience == "ages 9-12, no prior programming"
    assert "audience: ages 9-12, no prior programming" in (
        target / "course.yaml"
    ).read_text(encoding="utf-8")


def test_a_course_without_an_audience_is_refused():
    """Optional-by-omission is how one course inherits another's age band."""
    seed = dataclasses.replace(EV3_SEED, audience="   ")
    with pytest.raises(new_course.ScaffoldError, match="audience"):
        seed.validate()


def test_the_pedagogy_gate_runs_in_the_new_course(course):
    """Doctrine that ports without its gate is prose again."""
    target, _ = course
    proc = subprocess.run(
        [
            sys.executable,
            "-c",
            "from swarm import gates; assert 'pedagogy-coverage' in gates.REGISTRY",
        ],
        cwd=target,
        env={"PYTHONPATH": str(target / "scripts"), "PATH": ""},
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr


def test_the_stage_gate_runs_in_the_new_course(course):
    """A new course must refuse a skipped stage on day one, not once someone wires it."""
    target, _ = course
    proc = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys; from swarm import stage_gate; "
            "r = stage_gate.check(sys.argv[1], 'L1-s1', 'bundle'); "
            "assert all(x['verdict'] == 'FAIL' for x in r), r",
            str(target),
        ],
        cwd=target,
        env={"PYTHONPATH": str(target / "scripts"), "PATH": ""},
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr


def test_no_course_content_is_copied(course):
    """The scaffolder copies code and templates. Never lessons, assets or receipts."""
    target, _ = course

    assert not (target / "10-digest" / "L1-s1.md").exists()
    assert not (target / "30-research").glob("T0*.md").__iter__().__next__() if False else True
    assert list((target / "30-research").iterdir()) == []
    assert list((target / "90-receipts").iterdir()) == []


def test_copied_modules_import_from_the_new_tree(course, tmp_path):
    """Copied code must run there, not just exist there."""
    target, _ = course
    proc = subprocess.run(
        [sys.executable, "-c", "import swarm.config, swarm.check_assets, swarm.new_course"],
        cwd=target,
        env={"PYTHONPATH": str(target / "scripts"), "PATH": ""},
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr


def test_generated_course_carries_no_trace_of_the_source_course(course):
    """The plan's grep, run last — after the semantic checks, not instead of them."""
    target, _ = course
    import re

    pattern = re.compile(r"micro:?bit|makecode", re.I)
    offenders = []
    for path in target.rglob("*"):
        if not path.is_file() or path.suffix in {".pyc", ".png", ".gif", ".jpg", ".pdf"}:
            continue
        if "scripts" in path.parts or "tests" in path.parts:
            continue  # shared code and its own tests legitimately name the old course
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if pattern.search(text):
            offenders.append(str(path.relative_to(target)))

    assert offenders == [], f"source-course naming leaked into: {offenders}"


# --------------------------------------------------------------------------
# it refuses rather than guesses
# --------------------------------------------------------------------------


def test_refuses_a_non_empty_target(tmp_path):
    target = tmp_path / "taken"
    target.mkdir()
    (target / "someones-work.md").write_text("x", encoding="utf-8")

    with pytest.raises(new_course.ScaffoldError, match="not empty"):
        new_course.create(EV3_SEED, target, VAULT)


def test_refuses_a_target_inside_the_source_vault(tmp_path):
    """Two manifests above one bundle: discovery resolves the nearer one."""
    with pytest.raises(new_course.ScaffoldError, match="inside the source vault"):
        new_course.create(EV3_SEED, VAULT / "80-generation" / "nested", VAULT)


@pytest.mark.parametrize("slug", ["Kids-EV3", "kids ev3", "1course", "", "x"])
def test_refuses_a_malformed_slug(tmp_path, slug):
    seed = new_course.Seed(**{**EV3_SEED.__dict__, "slug": slug})
    with pytest.raises(new_course.ScaffoldError, match="slug"):
        new_course.create(seed, tmp_path / "c", VAULT)


@pytest.mark.parametrize("name", ["", "   ", "Course\nName", 42])
def test_refuses_a_malformed_name(tmp_path, name):
    seed = new_course.Seed(**{**EV3_SEED.__dict__, "name": name})

    with pytest.raises(new_course.ScaffoldError, match="name"):
        seed.validate()


def test_refuses_a_schedule_that_does_not_cover_every_session(tmp_path):
    seed = new_course.Seed(**{**EV3_SEED.__dict__, "artifact_schedule": (True, False)})
    with pytest.raises(new_course.ScaffoldError, match="one per session"):
        new_course.create(seed, tmp_path / "c", VAULT)


def test_an_invalid_pattern_fails_at_creation_not_at_first_audit(tmp_path):
    """A two-group pattern is refused by Seed.validate() before anything is
    written. The scaffolder must not report success and leave the defect for
    whoever runs the first asset gate."""
    seed = new_course.Seed(
        **{**EV3_SEED.__dict__, "asset_ref_pattern": r"`((shot)[^`]+\.png)`"}
    )
    with pytest.raises(new_course.ScaffoldError, match="exactly one capture group"):
        new_course.create(seed, tmp_path / "c", VAULT)


# --------------------------------------------------------------------------
# the CLI is the whole interface
# --------------------------------------------------------------------------


def test_cli_creates_a_course(tmp_path, capsys):
    target = tmp_path / "cli-course"
    rc = new_course.main(
        [
            "new_course.py",
            "kids-ev3",
            str(target),
            "--name",
            "EV3",
            "--audience",
            "ages 9-12",
            "--track",
            "stem-engineering",
            "--levels",
            "1",
            "--sessions-per-level",
            "4",
            "--no-artifact-sessions",
            "4",
            "--providers",
            "claude",
            "--asset-ref-pattern",
            r"`(shot-[^`]+\.png)`",
            "--asset-source-files",
            "slides-source.md",
            "--source",
            str(VAULT),
        ]
    )
    out = capsys.readouterr().out

    assert rc == 0
    assert "4 session(s), 3 producing artifacts" in out
    assert "No course content was copied" in out
    assert config.load_course(target).sessions_per_level == 4
    assert config.load_course(target).track == "stem-engineering"


def test_cli_reports_a_refusal_as_a_nonzero_exit(tmp_path, capsys):
    target = tmp_path / "taken"
    target.mkdir()
    (target / "x").write_text("x", encoding="utf-8")

    rc = new_course.main(
        [
            "new_course.py",
            "kids-ev3",
            str(target),
            "--audience",
            "ages 9-12",
            "--asset-ref-pattern",
            r"`(shot-[^`]+\.png)`",
            "--asset-source-files",
            "slides-source.md",
            "--source",
            str(VAULT),
        ]
    )

    assert rc == 2
    assert "FAIL" in capsys.readouterr().err
