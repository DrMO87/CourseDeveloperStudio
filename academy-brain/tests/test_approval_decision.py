import hashlib

import yaml

from swarm import gates
from swarm.gates import approval_decision

CONTENT = "A fixed-count loop repeats the statements inside its body three times."


def _valid_doc():
    return {
        "kind": "approval-decision",
        "actor": "reviewer-name",
        "authority": "specialist_council",
        "content": CONTENT,
        "content_hash": hashlib.sha256(CONTENT.encode("utf-8")).hexdigest(),
        "upstream": [
            {"stage": "provenance", "hash": "abc123"},
            {"stage": "refuted", "hash": "def456"},
        ],
        "rationale": "All high-severity issues addressed and refuted; no open holes in scope.",
    }


def _wrap(doc):
    return "# Approval\n\n```yaml\n" + yaml.safe_dump(doc) + "```\n"


def test_valid_approval_passes():
    result = approval_decision.approval_decision(_wrap(_valid_doc()))
    assert result.verdict == gates.PASS
    assert result.evidence["upstream"] == ["provenance", "refuted"]


def test_bad_authority_fails():
    doc = {**_valid_doc(), "authority": "someone_important"}
    assert approval_decision.approval_decision(_wrap(doc)).verdict == gates.FAIL


def test_content_hash_mismatch_fails():
    doc = {**_valid_doc(), "content_hash": "0" * 64}
    assert approval_decision.approval_decision(_wrap(doc)).verdict == gates.FAIL


def test_short_content_fails():
    doc = {**_valid_doc(), "content": "Too short.", "content_hash": hashlib.sha256(b"Too short.").hexdigest()}
    assert approval_decision.approval_decision(_wrap(doc)).verdict == gates.FAIL


def test_no_upstream_fails():
    doc = {**_valid_doc(), "upstream": []}
    assert approval_decision.approval_decision(_wrap(doc)).verdict == gates.FAIL


def test_upstream_entry_missing_hash_fails():
    doc = {**_valid_doc(), "upstream": [{"stage": "provenance"}]}
    assert approval_decision.approval_decision(_wrap(doc)).verdict == gates.FAIL


def test_duplicate_upstream_stage_fails():
    link = _valid_doc()["upstream"][0]
    doc = {**_valid_doc(), "upstream": [link, link]}
    assert approval_decision.approval_decision(_wrap(doc)).verdict == gates.FAIL


def test_missing_rationale_fails():
    doc = dict(_valid_doc())
    del doc["rationale"]
    assert approval_decision.approval_decision(_wrap(doc)).verdict == gates.FAIL


def test_registered_under_expected_name():
    assert "approval-decision" in gates.REGISTRY
