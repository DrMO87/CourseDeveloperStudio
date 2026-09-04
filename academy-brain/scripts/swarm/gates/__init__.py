"""Deterministic quality gates.

A gate is a pure function from text to a verdict. Model opinion is never
the final check on something mechanically checkable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

PASS = "PASS"
FAIL = "FAIL"
UNVERIFIED = "UNVERIFIED"

_VALID = frozenset({PASS, FAIL, UNVERIFIED})


@dataclass(frozen=True)
class GateResult:
    gate: str
    verdict: str
    detail: str = ""
    evidence: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.verdict not in _VALID:
            raise ValueError(
                f"invalid verdict {self.verdict!r}; expected one of {sorted(_VALID)}"
            )


REGISTRY: dict[str, Callable[[str], GateResult]] = {}


def register(name: str):
    """Decorator adding a gate function to the registry."""

    def wrap(fn: Callable[[str], GateResult]) -> Callable[[str], GateResult]:
        REGISTRY[name] = fn
        return fn

    return wrap


from swarm.gates import (  # noqa: E402,F401
    arabic_ratio,
    boundary_check,
    brand_palette,
    cite_filter,
    pedagogy_coverage,
)
