import yaml

from swarm import gates
from swarm.gates import patch_adjudication

VALID = {
    "kind": "patch-adjudication",
    "revision": "L1-s2-patch-r1",
    "entries": [
        {
            "issue_id": "I1",
            "disposition": "applied",
            "old_text": "four executions",
            "new_text": "three executions",
            "rationale": "C1 says three; source page 4 confirms three repeats.",
        },
        {
            "issue_id": "I3",
            "disposition": "withheld",
            "rationale": "source set does not support nested-loop expansion",
        },
    ],
}


def _wrap(doc):
    return "# Patch\n\n```yaml\n" + yaml.safe_dump(doc) + "```\n"


def test_valid_patch_passes():
    result = patch_adjudication.patch_adjudication(_wrap(VALID))
    assert result.verdict == gates.PASS
    assert result.evidence["issues"] == ["I1", "I3"]


def test_heading_only_fails():
    assert patch_adjudication.patch_adjudication("# Patch\n").verdict == gates.FAIL


def test_wrong_kind_fails():
    doc = {**VALID, "kind": "something-else"}
    assert patch_adjudication.patch_adjudication(_wrap(doc)).verdict == gates.FAIL


def test_missing_revision_fails():
    doc = dict(VALID)
    del doc["revision"]
    assert patch_adjudication.patch_adjudication(_wrap(doc)).verdict == gates.FAIL


def test_applied_entry_without_new_text_fails():
    entry = {**VALID["entries"][0]}
    del entry["new_text"]
    doc = {**VALID, "entries": [entry]}
    assert patch_adjudication.patch_adjudication(_wrap(doc)).verdict == gates.FAIL


def test_applied_entry_with_identical_old_and_new_text_fails():
    entry = {**VALID["entries"][0], "new_text": VALID["entries"][0]["old_text"]}
    doc = {**VALID, "entries": [entry]}
    assert patch_adjudication.patch_adjudication(_wrap(doc)).verdict == gates.FAIL


def test_withheld_entry_needs_no_old_or_new_text():
    doc = {**VALID, "entries": [VALID["entries"][1]]}
    assert patch_adjudication.patch_adjudication(_wrap(doc)).verdict == gates.PASS


def test_bad_disposition_fails():
    doc = {**VALID, "entries": [{**VALID["entries"][0], "disposition": "maybe"}]}
    assert patch_adjudication.patch_adjudication(_wrap(doc)).verdict == gates.FAIL


def test_duplicate_issue_id_fails():
    entry = VALID["entries"][0]
    doc = {**VALID, "entries": [entry, entry]}
    assert patch_adjudication.patch_adjudication(_wrap(doc)).verdict == gates.FAIL


def test_registered_under_expected_name():
    assert "patch-adjudication" in gates.REGISTRY
