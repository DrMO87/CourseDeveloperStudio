import pytest

from swarm import paths
from swarm.config import load_course


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


def test_session_ids_include_configured_graduation_session():
    assert len(paths.SESSION_IDS) == 16
    assert paths.SESSION_IDS[0] == "L1-s1"
    assert paths.SESSION_IDS[-1] == "L2-s8"


@pytest.mark.parametrize("sid", ["L1-s1", "L1-s8", "L2-s1", "L2-s8"])
def test_validate_accepts_real_ids(sid):
    assert paths.validate_session_id(sid) == sid


@pytest.mark.parametrize("bad", ["L3-s1", "L1-s9", "L1-s0", "l1-s1", "L1 s1", "L1-s01", ""])
def test_validate_rejects_malformed_ids(bad):
    with pytest.raises(ValueError):
        paths.validate_session_id(bad)


def test_digest_path_is_derived_not_searched():
    p = paths.digest_path("L1-s3")
    assert p.name == "L1-s3.md"
    assert p.parent.name == "10-digest"


def test_artifact_path_refuses_configured_no_artifact_session():
    assert paths.validate_session_id("L2-s8") == "L2-s8"
    assert paths.produces_artifacts("L2-s8") is False
    with pytest.raises(ValueError, match="does not produce artifacts"):
        paths.digest_path("L2-s8")


def test_assets_dir_is_per_session():
    assert paths.assets_dir("L2-s4").as_posix().endswith("10-digest/_assets/L2-s4")


def test_lane_paths_never_collide_across_providers():
    lanes = {
        paths.lane_path("40-critique", "L1-s3", provider)
        for provider in ("codex", "opencode", "hermes")
    }
    assert len(lanes) == 3


def test_lane_path_rejects_unknown_provider():
    with pytest.raises(ValueError):
        paths.lane_path("40-critique", "L1-s3", "gpt5")


def test_merged_path_has_single_owner_per_session():
    assert paths.merged_path("50-patch", "L1-s3").name == "L1-s3.md"


def test_receipt_path_includes_gate_name():
    p = paths.receipt_path("L1-s3", "arabic-ratio")
    assert p.name == "L1-s3.arabic-ratio.yaml"
    assert p.parent.name == paths.COURSE.stages.receipts


def test_module_level_ranges_and_providers_come_from_course_config():
    assert paths.LEVELS == (1, 2)
    assert paths.SESSION_NUMBERS == tuple(range(1, 9))
    assert paths.PROVIDERS == frozenset({"claude", "codex", "opencode", "hermes"})


def test_for_root_binds_all_path_behavior_to_alternative_course(tmp_path):
    (tmp_path / "course.yaml").write_text(ALTERNATIVE_CONFIG, encoding="utf-8")

    bound = paths.for_root(tmp_path)

    assert bound.COURSE == load_course(tmp_path)
    assert bound.SESSION_IDS == ("L3-s1", "L3-s2", "L5-s1", "L5-s2")
    assert bound.validate_session_id("L5-s2") == "L5-s2"
    with pytest.raises(ValueError):
        bound.validate_session_id("L1-s1")
    assert bound.digest_path("L3-s1") == tmp_path / "notes" / "L3-s1.md"
    assert bound.assets_dir("L3-s1") == tmp_path / "notes" / "media" / "L3-s1"
    assert bound.provenance_path("L5-s1") == tmp_path / "sources" / "L5-s1.md"
    assert bound.receipt_path("L5-s1", "gate") == tmp_path / "audits" / "L5-s1.gate.yaml"
    assert bound.lane_path("review", "L3-s1", "alpha") == tmp_path / "review" / "L3-s1" / "alpha.json"
    assert bound.merged_path("merge", "L5-s1") == tmp_path / "merge" / "L5-s1.md"
    with pytest.raises(ValueError, match="does not produce artifacts"):
        bound.digest_path("L3-s2")
