import yaml

from swarm import gates
from swarm.gates import bundle_sources

VALID = {
    "kind": "bundle-sources",
    "claims": [
        {"id": "C1", "source": "fixture-source", "revision": "fixture-rev", "locator": "page:1"},
        {"id": "C2", "source": "fixture-source", "revision": "fixture-rev", "locator": "page:2"},
    ],
}


def _wrap(doc):
    return "# Sources\n\n```yaml\n" + yaml.safe_dump(doc) + "```\n"


def test_valid_sources_passes():
    result = bundle_sources.bundle_sources(_wrap(VALID))
    assert result.verdict == gates.PASS
    assert result.evidence["claims"] == ["C1", "C2"]


def test_no_yaml_block_fails():
    assert bundle_sources.bundle_sources("# Sources\n\nJust prose.\n").verdict == gates.FAIL


def test_wrong_kind_fails():
    doc = {**VALID, "kind": "sources"}
    assert bundle_sources.bundle_sources(_wrap(doc)).verdict == gates.FAIL


def test_no_claims_fails():
    doc = {**VALID, "claims": []}
    assert bundle_sources.bundle_sources(_wrap(doc)).verdict == gates.FAIL


def test_claim_missing_locator_fails():
    claim = {k: v for k, v in VALID["claims"][0].items() if k != "locator"}
    doc = {**VALID, "claims": [claim]}
    assert bundle_sources.bundle_sources(_wrap(doc)).verdict == gates.FAIL


def test_duplicate_claim_id_fails():
    claim = VALID["claims"][0]
    doc = {**VALID, "claims": [claim, claim]}
    assert bundle_sources.bundle_sources(_wrap(doc)).verdict == gates.FAIL


def test_registered_under_expected_name():
    assert "bundle-sources" in gates.REGISTRY
