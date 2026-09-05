from swarm import generate_session as gs
from swarm import paths


ALTERNATIVE_CONFIG = """\
name: Test Course
audience: ages 9-12
levels: [3, 5]
sessions_per_level: 2
providers: [alpha, beta]
artifact_schedule:
  s1: true
  s2: false
stages:
  digest: notes
  digest_assets: media
  provenance: sources
  receipts: audits
asset_discovery:
  asset_ref_pattern: '`(img-[^`]+[.]png)`'
  asset_source_files: [slides-source.md]
  expect_references: true
"""


def test_asset_mapping_relative_paths_can_bind_to_the_job_root(tmp_path):
    mapping = (
        "| id | slide | path | class | status |\n"
        "|---|---|---|---|---|\n"
        "| img-1 | 1 | assets/img-1.png | REFERENCE | Produced and mapped |\n"
    )

    [asset] = gs.parse_asset_mapping(mapping, vault=tmp_path)

    assert asset.path == tmp_path / "assets" / "img-1.png"


def test_main_binds_legacy_path_users_to_per_job_root_and_reports_pedagogy(tmp_path, monkeypatch, capsys):
    # main intentionally changes the process default for downstream legacy
    # imports; register it with monkeypatch so this test restores suite state.
    monkeypatch.setattr(paths, "_default", paths._default)
    (tmp_path / "course.yaml").write_text(ALTERNATIVE_CONFIG, encoding="utf-8")
    bundle = tmp_path / "75-bundle" / "L3-s1"
    bundle.mkdir(parents=True)
    (bundle / "ASSET-MAPPING.md").write_text("unused", encoding="utf-8")
    prompts = tmp_path / "80-generation" / "nblm-student-deck-prompts.md"
    prompts.parent.mkdir()
    prompts.write_text("unused", encoding="utf-8")

    def assert_legacy_validator_uses_job_root(sid):
        assert paths.validate_session_id(sid) == "L3-s1"

    monkeypatch.setattr(gs, "enforce_stage_chain", assert_legacy_validator_uses_job_root)
    monkeypatch.setattr(gs, "parse_asset_mapping", lambda text, **kwargs: [])
    monkeypatch.setattr(gs, "enforce_blueprint_gate", lambda path: None)
    monkeypatch.setattr(gs, "enforce_asset_gate", lambda assets: None)
    monkeypatch.setattr(gs, "reconcile_slides", lambda bundle, assets: None)
    monkeypatch.setattr(gs, "parse_prompts", lambda text: {})
    monkeypatch.setattr(gs, "build_plan", lambda sid, assets, prompts: [])
    monkeypatch.setattr(gs, "preflight", lambda plan: [])

    assert gs.main(["L3-s1", "--root", str(tmp_path)]) == 0
    result_line = capsys.readouterr().out.strip().splitlines()[-1]
    assert '"pedagogy": {"gate": "pedagogy-coverage", "verdict": "UNVERIFIED"' in result_line
