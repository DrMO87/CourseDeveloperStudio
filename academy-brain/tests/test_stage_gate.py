import datetime as dt
import hashlib
import json

import pytest
import yaml

from swarm import stage_gate

TODAY = dt.date(2026, 9, 1)


@pytest.fixture
def vault(tmp_path):
    for stage in stage_gate.STAGE_CHAIN:
        (tmp_path / stage.directory).mkdir(parents=True, exist_ok=True)
    return tmp_path


# STEP 9 R1-R4: these four stages now require real structural content, not
# just a present file. "C1" is shared between RECEIPTS_CONTENT and
# PROVENANCE_CONTENT so a test that writes both gets a resolving trace.
RECEIPTS_CONTENT = yaml.safe_dump(
    {
        "kind": "specialist-receipt",
        "claims": [
            {
                "id": "C1",
                "statement": "fixture claim",
                "source": "fixture-source",
                "locator": "page:1",
                "excerpt": "fixture excerpt",
            }
        ],
        "holes": [],
    }
)
RESEARCH_CONTENT = (
    "# Research\n\n```yaml\n"
    + yaml.safe_dump(
        {
            "objective": "O1",
            "tasks": [
                {"id": "A1", "prompt": "fixture task", "key": "K1", "cites": ["C1"]}
            ],
        }
    )
    + "```\n"
)
DIGEST_CONTENT = (
    "# L1-s1\n\n```yaml\n"
    + yaml.safe_dump(
        {
            "kind": "digest-synthesis",
            "explanation": "This fixture explanation has enough words to pass the length check.",
            "claims": ["C1"],
            "holes": [],
        }
    )
    + "```\n"
)
PROVENANCE_CONTENT = yaml.safe_dump(
    {
        "kind": "provenance-map",
        "links": [
            {
                "claim": "C1",
                "source": "fixture-source",
                "revision": "fixture-rev",
                "locator": "page:1",
                "excerpt": "fixture excerpt",
            }
        ],
    }
)
# STEP 9 R5-R8: critique/patch/refuted/approved gained the same treatment.
# "I1" (raised by lane "codex", severity high, citing "C1") flows through:
# critique -> patch (applies it) -> refuted (challenges it) -> approved
# (binds to the real current provenance/refuted bytes).
CRITIQUE_LANES = {
    "codex": {
        "lane": "codex",
        "input_hash": "sha256:fixture-draft",
        "checklist": ["source boundaries"],
        "issues": [
            {
                "id": "I1",
                "severity": "high",
                "loc": "10-digest/L1-s1.md:1",
                "explanation": "fixture issue",
                "cites": ["C1"],
            }
        ],
    },
    "hermes": {
        "lane": "hermes",
        "input_hash": "sha256:fixture-draft",
        "checklist": ["source boundaries"],
        "reviewed_no_issues": True,
        "issues": [],
    },
    "opencode": {
        "lane": "opencode",
        "input_hash": "sha256:fixture-draft",
        "checklist": ["source boundaries"],
        "reviewed_no_issues": True,
        "issues": [],
    },
}
PATCH_CONTENT = (
    "# Patch\n\n```yaml\n"
    + yaml.safe_dump(
        {
            "kind": "patch-adjudication",
            "revision": "L1-s1-patch-r1",
            "entries": [
                {
                    "issue_id": "I1",
                    "disposition": "applied",
                    "old_text": "four",
                    "new_text": "three",
                    "rationale": "fixture rationale",
                }
            ],
        }
    )
    + "```\n"
)
REFUTED_CONTENT = (
    "# Refutation\n\n```yaml\n"
    + yaml.safe_dump(
        {
            "kind": "refutation-record",
            "reviewer": "opencode",
            "no_high_severity_patches": False,
            "challenges": [
                {
                    "issue_id": "I1",
                    "challenged_assertion": "fixture assertion",
                    "reasoning": "fixture reasoning",
                    "result": "survived",
                }
            ],
        }
    )
    + "```\n"
)
_STRUCTURED_CONTENT = {
    "receipts": RECEIPTS_CONTENT,
    "research": RESEARCH_CONTENT,
    "digest": DIGEST_CONTENT,
    "provenance": PROVENANCE_CONTENT,
    "patch": PATCH_CONTENT,
    "refuted": REFUTED_CONTENT,
}


def _write_critique_lanes(vault, sid, lanes=None):
    directory = vault / stage_gate._BY_NAME["critique"].directory / sid
    directory.mkdir(parents=True, exist_ok=True)
    for lane_name, payload in (lanes or CRITIQUE_LANES).items():
        (directory / f"{lane_name}.json").write_text(json.dumps(payload), encoding="utf-8")


_FULL_REVIEW_LEDGER = ("receipts", "research", "digest", "provenance", "critique", "patch", "refuted")


def _write_approval(vault, sid, upstream_stages=_FULL_REVIEW_LEDGER):
    """Bind to the REAL current bytes of the named upstream stages, via the module under test."""
    content = "A fixed-count loop repeats the statements inside its body three times."
    upstream = []
    for name in upstream_stages:
        h = stage_gate._current_stage_hash(vault, name, sid)
        if h:
            upstream.append({"stage": name, "hash": h})
    doc = {
        "kind": "approval-decision",
        "actor": "reviewer-name",
        "authority": "specialist_council",
        "content": content,
        "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "upstream": upstream,
        "rationale": "fixture rationale binding this decision to real upstream evidence.",
    }
    text = "# Approval\n\n```yaml\n" + yaml.safe_dump(doc) + "```\n"
    (vault / "60-approved" / f"{sid}.md").write_text(text, encoding="utf-8")


def _evidence(vault, sid, *stages):
    """Write the minimum artifact that satisfies each named stage."""
    for name in stages:
        if name == "critique":
            _write_critique_lanes(vault, sid)
            continue
        if name == "approved":
            _write_approval(vault, sid)
            continue
        stage = next(s for s in stage_gate.STAGE_CHAIN if s.name == name)
        rel = stage.pattern.format(sid=sid, level=sid.split("-")[0].lstrip("L"))
        rel = rel.replace("*", "x")
        path = vault / stage.directory / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_STRUCTURED_CONTENT.get(name, "evidence"), encoding="utf-8")


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


# --- STEP 9 R1-R4: presence is no longer enough for these four stages -------


@pytest.mark.parametrize(
    "stage_name",
    ["receipts", "research", "digest", "provenance", "patch", "refuted", "approved"],
)
def test_placeholder_text_no_longer_satisfies_these_stages(vault, stage_name):
    """The exact defect this batch exists to close: a present-but-empty file used to pass."""
    stage = stage_gate._BY_NAME[stage_name]
    rel = stage.pattern.format(sid="L1-s1", level="1").replace("*", "x")
    path = vault / stage.directory / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("evidence", encoding="utf-8")

    ok, detail = stage_gate.check_stage(vault, stage, "L1-s1", TODAY)
    assert not ok, detail
    assert "content validation" in detail


def test_placeholder_json_no_longer_satisfies_critique(vault):
    """Critique is judged as a set, so its failure message differs from the single-file stages."""
    directory = vault / "40-critique" / "L1-s1"
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "codex.json").write_text("not json", encoding="utf-8")

    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok, detail
    assert "not valid JSON" in detail


@pytest.mark.parametrize("stage_name", ["receipts", "research", "digest"])
def test_structured_content_satisfies_these_stages(vault, stage_name):
    _evidence(vault, "L1-s1", "receipts")  # provenance's sibling; harmless for the other three
    _evidence(vault, "L1-s1", stage_name)
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME[stage_name], "L1-s1", TODAY)
    assert ok, detail


def test_provenance_resolves_against_the_specialist_receipt(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["provenance"], "L1-s1", TODAY)
    assert ok, detail
    assert "resolved" in detail


def test_provenance_fails_without_a_matching_receipt(vault):
    """Provenance alone, with no specialist receipt to trace its claim to."""
    _evidence(vault, "L1-s1", "provenance")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["provenance"], "L1-s1", TODAY)
    assert not ok
    assert "no valid specialist receipt" in detail


def test_provenance_rejects_a_claim_the_receipt_never_made(vault):
    other_receipt = yaml.safe_dump(
        {
            "kind": "specialist-receipt",
            "claims": [
                {
                    "id": "C9",
                    "statement": "a different claim",
                    "source": "s",
                    "locator": "page:1",
                    "excerpt": "x",
                }
            ],
        }
    )
    (vault / "90-receipts" / "L1-s1.specialist.yaml").write_text(other_receipt, encoding="utf-8")
    (vault / "20-provenance" / "L1-s1.md").write_text(PROVENANCE_CONTENT, encoding="utf-8")

    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["provenance"], "L1-s1", TODAY)
    assert not ok
    assert "C1" in detail


def test_provenance_skips_ordinary_receipts_before_the_specialist_receipt(vault):
    ordinary = {"id": "L1-s1", "overall": "PASS", "gates": []}
    (vault / "90-receipts" / "L1-s1.000-gates.yaml").write_text(
        yaml.safe_dump(ordinary), encoding="utf-8"
    )
    (vault / "90-receipts" / "L1-s1.specialist.yaml").write_text(
        RECEIPTS_CONTENT, encoding="utf-8"
    )
    (vault / "20-provenance" / "L1-s1.md").write_text(
        PROVENANCE_CONTENT, encoding="utf-8"
    )

    ok, detail = stage_gate.check_stage(
        vault, stage_gate._BY_NAME["provenance"], "L1-s1", TODAY
    )
    assert ok, detail


# --- STEP 9 R5-R8: critique/patch/refuted/approved must cross-check ---------


def test_critique_requires_all_three_documented_lanes(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance")
    _write_critique_lanes(vault, "L1-s1", lanes={"codex": CRITIQUE_LANES["codex"]})
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok
    assert "hermes" in detail and "opencode" in detail


def test_three_independent_lanes_pass(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance")
    _write_critique_lanes(vault, "L1-s1")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert ok, detail
    assert "codex" in detail and "hermes" in detail and "opencode" in detail


def test_critique_rejects_a_duplicate_lane_id(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance")
    directory = vault / "40-critique" / "L1-s1"
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "codex.json").write_text(json.dumps(CRITIQUE_LANES["codex"]), encoding="utf-8")
    (directory / "codex-2.json").write_text(json.dumps(CRITIQUE_LANES["codex"]), encoding="utf-8")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok
    assert "duplicates" in detail


def test_critique_rejects_duplicate_lane_even_with_two_other_valid_lanes(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance")
    lanes = {
        **CRITIQUE_LANES,
        "codex-copy": CRITIQUE_LANES["codex"],
    }
    _write_critique_lanes(vault, "L1-s1", lanes=lanes)
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok
    assert "duplicates" in detail


def test_critique_rejects_a_malformed_extra_lane(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance", "critique")
    directory = vault / "40-critique" / "L1-s1"
    (directory / "broken.json").write_text("not json", encoding="utf-8")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok
    assert "broken.json" in detail


def test_critique_lanes_must_review_the_same_frozen_input(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance")
    lanes = {
        **CRITIQUE_LANES,
        "hermes": {**CRITIQUE_LANES["hermes"], "input_hash": "sha256:other-draft"},
    }
    _write_critique_lanes(vault, "L1-s1", lanes=lanes)
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok
    assert "input_hash" in detail


def test_critique_rejects_conflicting_severities_for_one_issue_id(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance")
    second_issue = {**CRITIQUE_LANES["codex"]["issues"][0], "severity": "low"}
    lanes = {
        "codex": CRITIQUE_LANES["codex"],
        "hermes": {**CRITIQUE_LANES["hermes"], "issues": [second_issue], "reviewed_no_issues": False},
        "opencode": CRITIQUE_LANES["opencode"],
    }
    _write_critique_lanes(vault, "L1-s1", lanes=lanes)
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok
    assert "severity" in detail and "I1" in detail


def test_critique_citations_must_resolve_against_provenance(vault):
    _evidence(vault, "L1-s1", "receipts")  # no provenance written
    _write_critique_lanes(vault, "L1-s1")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["critique"], "L1-s1", TODAY)
    assert not ok
    assert "C1" in detail


def test_patch_accepts_an_issue_id_a_real_critique_lane_raised(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance", "critique", "patch")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["patch"], "L1-s1", TODAY)
    assert ok, detail


def test_patch_rejects_an_issue_id_no_critique_lane_raised(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance", "critique")
    bogus = PATCH_CONTENT.replace("I1", "I-not-real")
    (vault / "50-patch" / "L1-s1.md").write_text(bogus, encoding="utf-8")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["patch"], "L1-s1", TODAY)
    assert not ok
    assert "I-not-real" in detail


def test_refutation_must_challenge_a_real_high_severity_patch(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance", "critique", "patch")
    unaddressed = yaml.safe_dump(
        {"kind": "refutation-record", "reviewer": "opencode", "no_high_severity_patches": True, "challenges": []}
    )
    (vault / "55-refuted" / "L1-s1.md").write_text(f"# Refutation\n\n```yaml\n{unaddressed}```\n", encoding="utf-8")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["refuted"], "L1-s1", TODAY)
    assert not ok
    assert "I1" in detail


def test_refutation_passes_when_it_covers_the_high_severity_patch(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance", "critique", "patch", "refuted")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["refuted"], "L1-s1", TODAY)
    assert ok, detail


def test_refutation_rejects_a_defeated_high_severity_patch(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance", "critique", "patch")
    defeated = REFUTED_CONTENT.replace("result: survived", "result: defeated")
    (vault / "55-refuted" / "L1-s1.md").write_text(defeated, encoding="utf-8")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["refuted"], "L1-s1", TODAY)
    assert not ok
    assert "defeated" in detail and "I1" in detail


def test_refutation_rejects_a_challenge_to_a_non_high_severity_patch(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance", "critique")
    low_lane = {**CRITIQUE_LANES["codex"], "issues": [{**CRITIQUE_LANES["codex"]["issues"][0], "severity": "low"}]}
    _write_critique_lanes(vault, "L1-s1", lanes={"codex": low_lane, "hermes": CRITIQUE_LANES["hermes"]})
    _evidence(vault, "L1-s1", "patch", "refuted")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["refuted"], "L1-s1", TODAY)
    assert not ok
    assert "not applied high-severity" in detail


def test_refutation_rejects_a_patch_with_an_invented_issue_id(vault):
    _evidence(vault, "L1-s1", "receipts", "provenance", "critique")
    bogus_patch = PATCH_CONTENT.replace("I1", "I-not-real")
    (vault / "50-patch" / "L1-s1.md").write_text(bogus_patch, encoding="utf-8")
    applicability = yaml.safe_dump(
        {"kind": "refutation-record", "reviewer": "opencode", "no_high_severity_patches": True, "challenges": []}
    )
    (vault / "55-refuted" / "L1-s1.md").write_text(f"# Refutation\n\n```yaml\n{applicability}```\n", encoding="utf-8")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["refuted"], "L1-s1", TODAY)
    assert not ok
    assert "I-not-real" in detail


def test_refutation_applicability_record_passes_with_no_high_severity_patches(vault):
    """Withheld-only patch: no applied high-severity issue exists to challenge."""
    _evidence(vault, "L1-s1", "receipts", "provenance", "critique")
    withheld = yaml.safe_dump(
        {
            "kind": "patch-adjudication",
            "revision": "r1",
            "entries": [{"issue_id": "I1", "disposition": "withheld", "rationale": "fixture"}],
        }
    )
    (vault / "50-patch" / "L1-s1.md").write_text(f"# Patch\n\n```yaml\n{withheld}```\n", encoding="utf-8")
    clean = yaml.safe_dump(
        {"kind": "refutation-record", "reviewer": "opencode", "no_high_severity_patches": True, "challenges": []}
    )
    (vault / "55-refuted" / "L1-s1.md").write_text(f"# Refutation\n\n```yaml\n{clean}```\n", encoding="utf-8")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["refuted"], "L1-s1", TODAY)
    assert ok, detail


def test_approval_passes_when_bound_to_real_current_evidence(vault):
    _evidence(vault, "L1-s1", "receipts", "research", "digest", "provenance", "critique", "patch", "refuted", "approved")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["approved"], "L1-s1", TODAY)
    assert ok, detail


def test_approval_rejects_a_partial_review_ledger(vault):
    """A decision bound only to `receipts` is self-asserted, not settled (comparison doc §3.8)."""
    _evidence(vault, "L1-s1", "receipts", "research", "digest", "provenance", "critique", "patch", "refuted")
    _write_approval(vault, "L1-s1", upstream_stages=("receipts",))
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["approved"], "L1-s1", TODAY)
    assert not ok
    assert "resolved review ledger" in detail


def test_approval_fails_when_an_upstream_hash_is_stale(vault):
    _evidence(vault, "L1-s1", "receipts", "research", "digest", "provenance", "critique", "patch", "refuted", "approved")
    # provenance changed AFTER approval was written — the declared hash is now stale
    (vault / "20-provenance" / "L1-s1.md").write_text(PROVENANCE_CONTENT + "\n# edited\n", encoding="utf-8")
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["approved"], "L1-s1", TODAY)
    assert not ok
    assert "stale" in detail


def test_stage_hash_preserves_file_boundaries(vault):
    directory = vault / "30-research" / "L1"
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "a.md").write_bytes(b"ab")
    (directory / "b.md").write_bytes(b"c")
    first_hash = stage_gate._current_stage_hash(vault, "research", "L1-s1")

    (directory / "a.md").write_bytes(b"a")
    (directory / "b.md").write_bytes(b"bc")
    second_hash = stage_gate._current_stage_hash(vault, "research", "L1-s1")

    assert first_hash != second_hash


@pytest.mark.parametrize("stage_name", ["approved", "localized", "bundle", "generation"])
def test_approval_rejects_non_upstream_stage_names(vault, stage_name):
    _evidence(vault, "L1-s1", "receipts", "provenance", "critique", "patch", "refuted")
    stage = stage_gate._BY_NAME[stage_name]
    rel = stage.pattern.format(sid="L1-s1", level="1").replace("*", "x")
    path = vault / stage.directory / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("future evidence", encoding="utf-8")
    _write_approval(vault, "L1-s1", upstream_stages=(stage_name,))
    ok, detail = stage_gate.check_stage(vault, stage_gate._BY_NAME["approved"], "L1-s1", TODAY)
    assert not ok
    assert "not before" in detail


def test_invalid_artifact_does_not_suppress_a_valid_waiver(vault):
    (vault / "10-digest" / "L1-s1.md").write_text("extraction only", encoding="utf-8")
    _waiver(
        vault,
        "L1-s1",
        "digest",
        reason="not-applicable",
        authority="owner",
        scope="session",
        granted=dt.date(2026, 8, 31),
    )

    ok, detail = stage_gate.check_stage(
        vault, stage_gate._BY_NAME["digest"], "L1-s1", TODAY
    )
    assert ok
    assert "waived" in detail


def test_non_utf8_artifact_fails_closed_without_crashing(vault):
    (vault / "10-digest" / "L1-s1.md").write_bytes(b"\xff\xfe")
    ok, detail = stage_gate.check_stage(
        vault, stage_gate._BY_NAME["digest"], "L1-s1", TODAY
    )
    assert not ok
    assert "could not read" in detail


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
    (vault / "30-research" / "L1" / "T01.md").write_text(RESEARCH_CONTENT, encoding="utf-8")
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
