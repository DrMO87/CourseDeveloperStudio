import yaml

from swarm import gates
from swarm.gates import digest_synthesis

BLOCK = {
    "kind": "digest-synthesis",
    "explanation": "A fixed-count loop repeats its body a set number of times before continuing.",
    "claims": ["C1"],
    "holes": [],
}


def _doc(block: dict) -> str:
    return "# L1-s1\n\n## Slide 1\n\nbody text\n\n```yaml\n" + yaml.safe_dump(block) + "```\n"


def test_valid_synthesis_passes():
    result = digest_synthesis.digest_synthesis(_doc(BLOCK))
    assert result.verdict == gates.PASS
    assert result.evidence["claims"] == ["C1"]


def test_skips_unrelated_yaml_fence_and_accepts_crlf_synthesis_block():
    text = (
        "# L1-s1\r\n\r\n```yaml\r\nmetadata: only\r\n```\r\n\r\n"
        + _doc(BLOCK).replace("\n", "\r\n")
    )
    assert digest_synthesis.digest_synthesis(text).verdict == gates.PASS


def test_extraction_only_digest_with_no_block_fails():
    assert digest_synthesis.digest_synthesis("# L1-s1\n\n## Slide 1\n\nbody text\n").verdict == gates.FAIL


def test_wrong_kind_fails():
    doc = {**BLOCK, "kind": "something-else"}
    assert digest_synthesis.digest_synthesis(_doc(doc)).verdict == gates.FAIL


def test_short_explanation_fails():
    doc = {**BLOCK, "explanation": "too short"}
    assert digest_synthesis.digest_synthesis(_doc(doc)).verdict == gates.FAIL


def test_no_claims_fails():
    doc = {**BLOCK, "claims": []}
    assert digest_synthesis.digest_synthesis(_doc(doc)).verdict == gates.FAIL


def test_non_string_claim_id_fails():
    doc = {**BLOCK, "claims": [[]]}
    assert digest_synthesis.digest_synthesis(_doc(doc)).verdict == gates.FAIL


def test_non_list_holes_fails_even_when_empty():
    doc = {**BLOCK, "holes": {}}
    assert digest_synthesis.digest_synthesis(_doc(doc)).verdict == gates.FAIL


def test_registered_under_expected_name():
    assert "digest-synthesis" in gates.REGISTRY
