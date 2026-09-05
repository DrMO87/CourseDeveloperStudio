import json

from swarm import gates
from swarm.gates import critique_lane

VALID = {
    "lane": "codex",
    "input_hash": "sha256:deadbeef",
    "checklist": ["source boundaries", "objective coverage"],
    "issues": [
        {
            "id": "I1",
            "severity": "high",
            "loc": "10-digest/L1-s2.md:3",
            "explanation": "Draft says four executions; source C1 says three.",
            "cites": ["C1"],
        }
    ],
}

CLEAN = {
    "lane": "hermes",
    "input_hash": "sha256:cafef00d",
    "checklist": ["source boundaries"],
    "reviewed_no_issues": True,
    "issues": [],
}


def test_valid_lane_with_issues_passes():
    result = critique_lane.critique_lane(json.dumps(VALID))
    assert result.verdict == gates.PASS
    assert result.evidence["lane"] == "codex"
    assert result.evidence["issues"] == ["I1"]


def test_clean_lane_with_explicit_no_issues_passes():
    result = critique_lane.critique_lane(json.dumps(CLEAN))
    assert result.verdict == gates.PASS


def test_empty_issues_without_explicit_flag_fails():
    doc = {**VALID, "issues": [], "reviewed_no_issues": False}
    assert critique_lane.critique_lane(json.dumps(doc)).verdict == gates.FAIL


def test_missing_lane_identity_fails():
    doc = dict(VALID)
    del doc["lane"]
    assert critique_lane.critique_lane(json.dumps(doc)).verdict == gates.FAIL


def test_missing_input_hash_fails():
    doc = dict(VALID)
    del doc["input_hash"]
    assert critique_lane.critique_lane(json.dumps(doc)).verdict == gates.FAIL


def test_missing_checklist_fails():
    doc = {**VALID, "checklist": []}
    assert critique_lane.critique_lane(json.dumps(doc)).verdict == gates.FAIL


def test_issue_without_citation_fails():
    doc = {**VALID, "issues": [{**VALID["issues"][0], "cites": []}]}
    assert critique_lane.critique_lane(json.dumps(doc)).verdict == gates.FAIL


def test_issue_with_bad_severity_fails():
    doc = {**VALID, "issues": [{**VALID["issues"][0], "severity": "urgent"}]}
    assert critique_lane.critique_lane(json.dumps(doc)).verdict == gates.FAIL


def test_duplicate_issue_id_fails():
    issue = VALID["issues"][0]
    doc = {**VALID, "issues": [issue, issue]}
    assert critique_lane.critique_lane(json.dumps(doc)).verdict == gates.FAIL


def test_malformed_json_fails_not_crashes():
    assert critique_lane.critique_lane("{not json").verdict == gates.FAIL


def test_utf8_bom_is_accepted():
    assert critique_lane.critique_lane("\ufeff" + json.dumps(VALID)).verdict == gates.PASS


def test_reviewed_clean_lane_rejects_non_list_issues():
    doc = {**CLEAN, "issues": {}}
    assert critique_lane.critique_lane(json.dumps(doc)).verdict == gates.FAIL


def test_registered_under_expected_name():
    assert "critique-lane" in gates.REGISTRY
