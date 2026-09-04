import pytest

from swarm import gates


def test_verdict_constants():
    assert gates.PASS == "PASS"
    assert gates.FAIL == "FAIL"
    assert gates.UNVERIFIED == "UNVERIFIED"


def test_register_adds_to_registry():
    try:
        @gates.register("dummy-gate")
        def _dummy(text: str) -> gates.GateResult:
            return gates.GateResult("dummy-gate", gates.PASS, "ok", {})

        assert "dummy-gate" in gates.REGISTRY
        assert gates.REGISTRY["dummy-gate"]("x").verdict == gates.PASS
    finally:
        gates.REGISTRY.pop("dummy-gate", None)


def test_gate_result_rejects_invalid_verdict():
    with pytest.raises(ValueError):
        gates.GateResult("g", "PROBABLY", "", {})
