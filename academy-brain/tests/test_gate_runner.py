import yaml

from swarm import gate_runner, gates


def test_runs_named_gates_only():
    results = gate_runner.run_gates("#F5B301", ["brand-palette"])
    assert len(results) == 1
    assert results[0].gate == "brand-palette"


def test_unknown_gate_is_unverified_not_crash():
    results = gate_runner.run_gates("x", ["no-such-gate"])
    assert results[0].verdict == gates.UNVERIFIED


def test_any_fail_makes_overall_fail():
    results = [
        gates.GateResult("a", gates.PASS),
        gates.GateResult("b", gates.FAIL),
        gates.GateResult("c", gates.UNVERIFIED),
    ]
    assert gate_runner.overall_verdict(results) == gates.FAIL


def test_unverified_without_fail_is_unverified_not_pass():
    results = [gates.GateResult("a", gates.PASS), gates.GateResult("b", gates.UNVERIFIED)]
    assert gate_runner.overall_verdict(results) == gates.UNVERIFIED


def test_all_pass_is_pass():
    results = [gates.GateResult("a", gates.PASS), gates.GateResult("b", gates.PASS)]
    assert gate_runner.overall_verdict(results) == gates.PASS


def test_receipt_records_every_gate_never_omits(tmp_path):
    results = [
        gates.GateResult("a", gates.PASS, "fine"),
        gates.GateResult("b", gates.UNVERIFIED, "could not run"),
    ]
    path = gate_runner.write_receipt("L1-s1", results, tmp_path)
    data = yaml.safe_load(path.read_text(encoding="utf-8"))

    assert data["id"] == "L1-s1"
    assert data["overall"] == gates.UNVERIFIED
    assert {g["gate"] for g in data["gates"]} == {"a", "b"}


def test_receipt_rejects_invalid_session_id(tmp_path):
    import pytest

    with pytest.raises(ValueError):
        gate_runner.write_receipt("L9-s9", [], tmp_path)
