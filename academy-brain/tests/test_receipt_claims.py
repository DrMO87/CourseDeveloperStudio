import yaml

from swarm import gates
from swarm.gates import receipt_claims

VALID = {
    "kind": "specialist-receipt",
    "claims": [
        {
            "id": "C1",
            "statement": "the loop repeats 3 times",
            "source": "intro-loops",
            "locator": "page:4",
            "excerpt": "Repeat the body 3 times.",
        }
    ],
    "holes": [{"id": "H1", "description": "page 5's diagram cannot yet be read"}],
}


def test_valid_receipt_passes():
    result = receipt_claims.receipt_claims(yaml.safe_dump(VALID))
    assert result.verdict == gates.PASS
    assert result.evidence["claims"] == ["C1"]
    assert result.evidence["holes"] == ["H1"]


def test_ordinary_gate_receipt_does_not_pass_as_specialist():
    ordinary = yaml.safe_dump({"id": "L1-s1", "overall": "PASS", "gates": []})
    assert receipt_claims.receipt_claims(ordinary).verdict == gates.FAIL


def test_missing_claims_fails():
    doc = {**VALID, "claims": []}
    assert receipt_claims.receipt_claims(yaml.safe_dump(doc)).verdict == gates.FAIL


def test_claim_missing_a_required_field_fails():
    doc = {**VALID, "claims": [{"id": "C1", "statement": "x"}]}
    assert receipt_claims.receipt_claims(yaml.safe_dump(doc)).verdict == gates.FAIL


def test_duplicate_claim_id_fails():
    claim = VALID["claims"][0]
    doc = {**VALID, "claims": [claim, claim]}
    assert receipt_claims.receipt_claims(yaml.safe_dump(doc)).verdict == gates.FAIL


def test_non_string_claim_id_fails_without_crashing():
    doc = {**VALID, "claims": [{**VALID["claims"][0], "id": []}]}
    assert receipt_claims.receipt_claims(yaml.safe_dump(doc)).verdict == gates.FAIL


def test_non_list_holes_fails_even_when_empty():
    doc = {**VALID, "holes": {}}
    assert receipt_claims.receipt_claims(yaml.safe_dump(doc)).verdict == gates.FAIL


def test_malformed_yaml_fails_not_crashes():
    assert receipt_claims.receipt_claims("[: not yaml").verdict == gates.FAIL


def test_registered_under_expected_name():
    assert "receipt-claims" in gates.REGISTRY
