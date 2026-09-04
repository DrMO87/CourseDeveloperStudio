import datetime as dt

import pytest
import yaml

from swarm import stage_gate

TODAY = dt.date(2026, 9, 1)


@pytest.fixture
def vault(tmp_path):
    for stage in stage_gate.STAGE_CHAIN:
        (tmp_path / stage.directory).mkdir(parents=True, exist_ok=True)
    return tmp_path


def _evidence(vault, sid, *stages):
    """Write the minimum artifact that satisfies each named stage."""
    for name in stages:
        stage = next(s for s in stage_gate.STAGE_CHAIN if s.name == name)
        rel = stage.pattern.format(sid=sid, level=sid.split("-")[0].lstrip("L"))
        rel = rel.replace("*", "x")
        path = vault / stage.directory / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("evidence", encoding="utf-8")


def _waiver(vault, sid, stage_name, **fields):
    stage = next(s for s in stage_gate.STAGE_CHAIN if s.name == stage_name)
    path = stage_gate.waiver_path(vault, stage, sid)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(fields, sort_keys=False), encoding="utf-8")
    return path


# --- the failure this gate exists to prevent -------------------------------


def test_bundle_is_refused_when_research_and_critique_were_skipped(vault):
    """The exact EV3 shape: receipts -> digest -> provenance -> straight to bundle."""
    _evidence(vault, "L1-s1", "receipts", "digest", "provenance")
    results = stage_gate.check(vault, "L1-s1", "bundle", TODAY)
    failed = {r["stage"] for r in results if r["verdict"] == stage_gate.FAIL}
    assert {"research", "critique", "patch", "refuted", "approved", "localized"} <= failed
    assert stage_gate.receipt("L1-s1", "bundle", results)["overall"] == stage_gate.FAIL


def test_complete_chain_passes(vault):
    names = [s.name for s in stage_gate.STAGE_CHAIN]
    _evidence(vault, "L1-s1", *names[: names.index("bundle")])
    results = stage_gate.check(vault, "L1-s1", "bundle", TODAY)
    assert stage_gate.receipt("L1-s1", "bundle", results)["overall"] == stage_gate.PASS


def test_only_predecessors_are_checked(vault):
    _evidence(vault, "L1-s1", "receipts")
    assert [r["stage"] for r in stage_gate.check(vault, "L1-s1", "research", TODAY)] == [
        "receipts"
    ]


# --- waivers must be structured, authorized, and expiring -------------------


def test_valid_not_applicable_waiver_satisfies_a_stage(vault):
    _waiver(
        vault, "L1-s1", "critique",
        reason="not-applicable", authority="owner", scope="session",
        granted=dt.date(2026, 8, 31),
    )
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert ok and "not-applicable" in detail


def test_blocked_waiver_without_expiry_is_refused(vault):
    """A permanent exemption wearing a temporary label."""
    _waiver(
        vault, "L1-s1", "critique",
        reason="blocked", authority="owner", scope="session", granted=dt.date(2026, 8, 31),
    )
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok and "requires an `expires`" in detail


def test_expired_waiver_is_refused(vault):
    _waiver(
        vault, "L1-s1", "critique",
        reason="blocked", authority="owner", scope="session",
        granted=dt.date(2026, 8, 1), expires=dt.date(2026, 8, 30),
    )
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok and "expired" in detail


def test_free_text_reason_is_refused(vault):
    """'not applicable' as prose is what EV3's contract already asked for, and got."""
    _waiver(
        vault, "L1-s1", "critique",
        reason="we didn't have time", authority="owner", scope="session",
        granted=dt.date(2026, 8, 31),
    )
    ok, _ = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok


def test_waiver_missing_authority_is_refused(vault):
    _waiver(vault, "L1-s1", "critique", reason="not-applicable", scope="session",
            granted=dt.date(2026, 8, 31))
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok and "authority" in detail


def test_waiver_scope_must_match_the_stage(vault):
    _waiver(vault, "L1-s1", "critique", reason="not-applicable", authority="owner",
            scope="level", granted=dt.date(2026, 8, 31))
    ok, detail = stage_gate.check_stage(
        vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY
    )
    assert not ok and "scope" in detail


def test_superseded_waiver_must_name_what_covers_it(vault):
    _waiver(vault, "L1-s1", "critique", reason="superseded", authority="owner",
            scope="session", granted=dt.date(2026, 8, 31))
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok and "covered_by" in detail


def test_malformed_waiver_is_refused_not_ignored(vault):
    stage = stage_gate._BY_NAME["critique"]
    stage_gate.waiver_path(vault, stage, "L1-s1").write_text("[: not yaml", encoding="utf-8")
    ok, _ = stage_gate.check_stage(vault, stage, "L1-s1", TODAY)
    assert not ok


def test_a_waiver_file_is_not_itself_evidence(vault):
    """A waiver lives in the stage directory; it must never glob as an artifact."""
    _waiver(vault, "L1-s1", "patch", reason="not-applicable", authority="owner",
            scope="session", granted=dt.date(2026, 8, 31))
    stage = stage_gate._BY_NAME["patch"]
    hits = [p for p in (vault / stage.directory).glob("L1-s1.*")]
    assert hits, "fixture wrote nothing"
    ok, detail = stage_gate.check_stage(vault, stage, "L1-s1", TODAY)
    assert ok and "waived" in detail  # satisfied as a waiver, not counted as an artifact


def test_a_level_scoped_stage_takes_a_level_named_waiver(vault):
    """One decision, one file — not one identical file per session in the level."""
    research = stage_gate._BY_NAME["research"]
    assert stage_gate.waiver_path(vault, research, "L1-s5").name == "L1.waiver.yaml"

    path = vault / research.directory / "L1.waiver.yaml"
    path.write_text(
        yaml.safe_dump({
            "reason": "not-applicable", "authority": "owner",
            "scope": "level", "granted": dt.date(2026, 8, 31),
        }),
        encoding="utf-8",
    )
    for sid in ("L1-s1", "L1-s5"):
        ok, detail = stage_gate.check_stage(vault, research, sid, TODAY)
        assert ok, (sid, detail)

    # ...and it covers only its own level.
    ok, _ = stage_gate.check_stage(vault, research, "L2-s1", TODAY)
    assert not ok


def test_a_session_scoped_waiver_is_refused_for_a_level_stage(vault):
    """Codex's scope check: the waiver must agree with the stage it sits in."""
    research = stage_gate._BY_NAME["research"]
    (vault / research.directory / "L1.waiver.yaml").write_text(
        yaml.safe_dump({
            "reason": "not-applicable", "authority": "owner",
            "scope": "session", "granted": dt.date(2026, 8, 31),
        }),
        encoding="utf-8",
    )
    ok, detail = stage_gate.check_stage(vault, research, "L1-s1", TODAY)
    assert not ok and "scope" in detail


def test_research_from_another_level_is_not_evidence(vault):
    """The hole in the original `*.md` glob: any level's research satisfied any level."""
    (vault / "30-research" / "L1").mkdir(parents=True, exist_ok=True)
    (vault / "30-research" / "L1" / "T01.md").write_text("evidence", encoding="utf-8")
    research = stage_gate._BY_NAME["research"]
    assert stage_gate.check_stage(vault, research, "L1-s1", TODAY)[0]
    assert not stage_gate.check_stage(vault, research, "L2-s1", TODAY)[0]


# --- doctrine does not run backwards ---------------------------------------


def _golden(vault, sid, name="deck-a.LOCKED-GOLDEN.pdf", sub=None):
    d = vault / "80-generation" / sid / (sub or "")
    d.mkdir(parents=True, exist_ok=True)
    locked = d / name
    locked.write_bytes(b"%PDF-1.4 locked")
    if name.endswith(".LOCKED-GOLDEN.pdf"):
        (d / name.removesuffix(".LOCKED-GOLDEN.pdf")).with_suffix(".pdf").write_bytes(
            locked.read_bytes()
        )
    return locked


def test_a_locked_session_is_not_re_judged(vault):
    """A shipped session predates this gate; failing it now improves nothing."""
    _golden(vault, "L1-s1")
    results = stage_gate.check(vault, "L1-s1", "bundle", TODAY)
    assert all(r["verdict"] == stage_gate.PASS for r in results)
    assert "not re-judged" in results[0]["detail"]


def test_a_rejected_golden_is_not_a_lock(vault):
    """_rejected/ holds incident evidence, including goldens locked in error."""
    _golden(vault, "L2-s1", name="deck-a-LOCKED-GOLDEN-IN-ERROR.pdf", sub="_rejected")
    results = stage_gate.check(vault, "L2-s1", "bundle", TODAY)
    assert any(r["verdict"] == stage_gate.FAIL for r in results)


def test_an_unlocked_session_is_still_gated(vault):
    """The grandfather clause covers shipped work only, never everything."""
    _golden(vault, "L1-s1")  # a DIFFERENT session is locked
    assert not stage_gate.is_locked(vault, "L2-s8")
    results = stage_gate.check(vault, "L2-s8", "bundle", TODAY)
    assert all(r["verdict"] == stage_gate.FAIL for r in results)


# --- guards ----------------------------------------------------------------


def test_unknown_stage_raises_rather_than_passing(vault):
    with pytest.raises(stage_gate.StageGateError):
        stage_gate.check(vault, "L1-s1", "no-such-stage", TODAY)


def test_research_from_another_level_is_not_evidence(vault):
    """Level-scoped research must not leak across levels."""
    (vault / "30-research" / "L1").mkdir()
    (vault / "30-research" / "L1" / "T01.md").write_text("research", encoding="utf-8")

    ok, _ = stage_gate.check_stage(
        vault, stage_gate._BY_NAME["research"], "L2-s1", TODAY
    )

    assert not ok


def test_empty_pdf_with_lock_name_does_not_grandfather(vault):
    _golden(vault, "L1-s1").write_bytes(b"")

    assert not stage_gate.is_locked(vault, "L1-s1")


def test_lock_must_be_byte_identical_to_the_accepted_artifact(vault):
    locked = _golden(vault, "L1-s1")
    locked.write_bytes(b"%PDF-1.7\nlocked")
    (locked.parent / "deck-a.pdf").write_bytes(b"%PDF-1.7\ndifferent")

    assert not stage_gate.is_locked(vault, "L1-s1")


def test_rejected_directory_check_is_case_insensitive(vault):
    locked = _golden(vault, "L1-s1", sub="_REJECTED")
    locked.write_bytes(b"%PDF-1.7\nsame")
    (locked.parent / "deck-a.pdf").write_bytes(b"%PDF-1.7\nsame")

    assert not stage_gate.is_locked(vault, "L1-s1")


def test_bad_session_id_is_refused(vault):
    with pytest.raises(Exception):
        stage_gate.check(vault, "../../etc", "bundle", TODAY)


def test_receipt_stamps_the_doctrine_version(vault):
    doc = stage_gate.receipt("L1-s1", "bundle", [])
    assert doc["doctrine_version"] == stage_gate.DOCTRINE_VERSION
