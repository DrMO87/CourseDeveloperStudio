import yaml

from swarm import gates
from swarm.gates import provenance_map

VALID = {
    "kind": "provenance-map",
    "links": [
        {
            "claim": "C1",
            "source": "intro-loops",
            "revision": "abc123",
            "locator": "page:4",
            "excerpt": "Repeat the body 3 times.",
        }
    ],
}


def test_valid_provenance_passes():
    result = provenance_map.provenance_map(yaml.safe_dump(VALID))
    assert result.verdict == gates.PASS
    assert result.evidence["claims"] == ["C1"]


def test_wrong_kind_fails():
    doc = {**VALID, "kind": "something-else"}
    assert provenance_map.provenance_map(yaml.safe_dump(doc)).verdict == gates.FAIL


def test_no_links_fails():
    doc = {**VALID, "links": []}
    assert provenance_map.provenance_map(yaml.safe_dump(doc)).verdict == gates.FAIL


def test_link_missing_a_required_field_fails():
    doc = {"kind": "provenance-map", "links": [{"claim": "C1"}]}
    assert provenance_map.provenance_map(yaml.safe_dump(doc)).verdict == gates.FAIL


def test_non_string_claim_id_fails():
    doc = {**VALID, "links": [{**VALID["links"][0], "claim": []}]}
    assert provenance_map.provenance_map(yaml.safe_dump(doc)).verdict == gates.FAIL


def test_malformed_yaml_fails_not_crashes():
    assert provenance_map.provenance_map("[: not yaml").verdict == gates.FAIL


def test_registered_under_expected_name():
    assert "provenance-map" in gates.REGISTRY
