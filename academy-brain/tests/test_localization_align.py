import yaml

from swarm import gates
from swarm.gates import localization_align

VALID = {
    "kind": "localization-alignment",
    "bound_to": {"stage": "approved", "hash": "abc123"},
    "segments": [
        {
            "id": "A2.1",
            "claims": ["C1"],
            "english": "Repeat the body 3 times.",
            "arabic": "كرّر الأوامر داخل الحلقة 3 مرات.",
        }
    ],
}


def _wrap(doc):
    return "# Localization\n\n```yaml\n" + yaml.safe_dump(doc, allow_unicode=True) + "```\n"


def test_valid_alignment_passes():
    result = localization_align.localization_align(_wrap(VALID))
    assert result.verdict == gates.PASS
    assert result.evidence["segments"] == ["A2.1"]


def test_wrong_bound_stage_fails():
    doc = {**VALID, "bound_to": {"stage": "digest", "hash": "abc123"}}
    assert localization_align.localization_align(_wrap(doc)).verdict == gates.FAIL


def test_missing_bound_hash_fails():
    doc = {**VALID, "bound_to": {"stage": "approved"}}
    assert localization_align.localization_align(_wrap(doc)).verdict == gates.FAIL


def test_no_segments_fails():
    doc = {**VALID, "segments": []}
    assert localization_align.localization_align(_wrap(doc)).verdict == gates.FAIL


def test_segment_missing_claims_fails():
    seg = {**VALID["segments"][0]}
    del seg["claims"]
    doc = {**VALID, "segments": [seg]}
    assert localization_align.localization_align(_wrap(doc)).verdict == gates.FAIL


def test_arabic_with_no_arabic_script_fails():
    seg = {**VALID["segments"][0], "arabic": "Repeat the body 3 times."}
    doc = {**VALID, "segments": [seg]}
    assert localization_align.localization_align(_wrap(doc)).verdict == gates.FAIL


def test_arabic_punctuation_without_arabic_letters_fails():
    seg = {**VALID["segments"][0], "arabic": "Repeat the body 3 times،"}
    doc = {**VALID, "segments": [seg]}
    assert localization_align.localization_align(_wrap(doc)).verdict == gates.FAIL


def test_a_dropped_number_fails():
    seg = {**VALID["segments"][0], "arabic": "كرّر الأوامر داخل الحلقة أربع مرات."}
    doc = {**VALID, "segments": [seg]}
    result = localization_align.localization_align(_wrap(doc))
    assert result.verdict == gates.FAIL
    assert "3" in result.detail


def test_a_changed_number_fails():
    seg = {**VALID["segments"][0], "arabic": "كرّر الأوامر داخل الحلقة 4 مرات."}
    doc = {**VALID, "segments": [seg]}
    assert localization_align.localization_align(_wrap(doc)).verdict == gates.FAIL


def test_a_dropped_code_span_fails():
    seg = {
        "id": "A2.2",
        "claims": ["C2"],
        "english": "Call `forever()` to repeat the block.",
        "arabic": "استدعِ الدالة لتكرار الكتلة.",
    }
    doc = {**VALID, "segments": [seg]}
    result = localization_align.localization_align(_wrap(doc))
    assert result.verdict == gates.FAIL
    assert "forever" in result.detail


def test_duplicate_segment_id_fails():
    seg = VALID["segments"][0]
    doc = {**VALID, "segments": [seg, seg]}
    assert localization_align.localization_align(_wrap(doc)).verdict == gates.FAIL


def test_registered_under_expected_name():
    assert "localization-align" in gates.REGISTRY
