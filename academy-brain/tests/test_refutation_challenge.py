import yaml

from swarm import gates
from swarm.gates import refutation_challenge

CHALLENGED = {
    "kind": "refutation-record",
    "reviewer": "opencode",
    "no_high_severity_patches": False,
    "challenges": [
        {
            "issue_id": "I1",
            "challenged_assertion": "Any three-repeat loop draws three marks",
            "reasoning": "Counterexample: two draw statements per iteration draws six marks.",
            "result": "defeated",
        }
    ],
}

APPLICABILITY = {
    "kind": "refutation-record",
    "reviewer": "opencode",
    "no_high_severity_patches": True,
    "challenges": [],
}


def _wrap(doc):
    return "# Refutation\n\n```yaml\n" + yaml.safe_dump(doc) + "```\n"


def test_valid_challenge_passes():
    result = refutation_challenge.refutation_challenge(_wrap(CHALLENGED))
    assert result.verdict == gates.PASS
    assert result.evidence["challenged"] == ["I1"]


def test_applicability_record_with_no_challenges_passes():
    result = refutation_challenge.refutation_challenge(_wrap(APPLICABILITY))
    assert result.verdict == gates.PASS


def test_empty_challenges_without_declared_applicability_fails():
    doc = {**APPLICABILITY, "no_high_severity_patches": False}
    assert refutation_challenge.refutation_challenge(_wrap(doc)).verdict == gates.FAIL


def test_applicability_record_rejects_non_list_challenges():
    doc = {**APPLICABILITY, "challenges": {}}
    assert refutation_challenge.refutation_challenge(_wrap(doc)).verdict == gates.FAIL


def test_missing_reviewer_fails():
    doc = dict(CHALLENGED)
    del doc["reviewer"]
    assert refutation_challenge.refutation_challenge(_wrap(doc)).verdict == gates.FAIL


def test_bad_result_fails():
    doc = {**CHALLENGED, "challenges": [{**CHALLENGED["challenges"][0], "result": "maybe"}]}
    assert refutation_challenge.refutation_challenge(_wrap(doc)).verdict == gates.FAIL


def test_challenge_missing_reasoning_fails():
    challenge = {**CHALLENGED["challenges"][0]}
    del challenge["reasoning"]
    doc = {**CHALLENGED, "challenges": [challenge]}
    assert refutation_challenge.refutation_challenge(_wrap(doc)).verdict == gates.FAIL


def test_duplicate_challenge_issue_id_fails():
    challenge = CHALLENGED["challenges"][0]
    doc = {**CHALLENGED, "challenges": [challenge, challenge]}
    assert refutation_challenge.refutation_challenge(_wrap(doc)).verdict == gates.FAIL


def test_registered_under_expected_name():
    assert "refutation-challenge" in gates.REGISTRY
