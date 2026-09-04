import json

from swarm import gates
from swarm.gates import cite_filter

PAYLOAD = {
    "issues": [
        {
            "loc": "slide-7",
            "severity": "high",
            "type": "pedagogy",
            "problem": "flashing introduced before predict step",
            "fix": "insert predict-then-run beat",
            "cites": ["microbit.org/teach/units/music#lesson-2"],
        },
        {
            "loc": "slide-9",
            "severity": "medium",
            "type": "pedagogy",
            "problem": "needs more energy",
            "fix": "add a game",
            "cites": [],
        },
        {
            "loc": "slide-11",
            "severity": "low",
            "type": "content",
            "problem": "vague wording",
            "fix": "tighten",
        },
    ]
}


def test_keeps_cited_issues():
    kept, _ = cite_filter.filter_issues(PAYLOAD)
    assert len(kept) == 1
    assert kept[0]["loc"] == "slide-7"


def test_drops_empty_cites():
    _, dropped = cite_filter.filter_issues(PAYLOAD)
    assert {d["loc"] for d in dropped} == {"slide-9", "slide-11"}


def test_blank_string_cite_does_not_count():
    kept, _ = cite_filter.filter_issues({"issues": [{"loc": "s1", "cites": ["  "]}]})
    assert kept == []


def test_check_fails_when_everything_uncited():
    payload = json.dumps({"issues": [{"loc": "s1", "cites": []}]})
    assert cite_filter.check(payload).verdict == gates.FAIL


def test_check_passes_when_all_cited():
    payload = json.dumps({"issues": [{"loc": "s1", "cites": ["microbit.org/x"]}]})
    assert cite_filter.check(payload).verdict == gates.PASS


def test_malformed_json_is_unverified_not_pass():
    assert cite_filter.check("{not json").verdict == gates.UNVERIFIED


def test_registered_under_expected_name():
    assert "cite-filter" in gates.REGISTRY
