"""Run gates and write receipts.

A gate that could not run is UNVERIFIED, never silently omitted — the
receipt is the audit trail that replaces human supervision.
"""

from __future__ import annotations

import argparse
import inspect
import sys
from pathlib import Path

import yaml

from swarm import gates, org_config, paths, prepare
from swarm.paths import validate_session_id


def run_gates(
    text: str, gate_names: list[str], config: org_config.OrgConfig | None = None
) -> list[gates.GateResult]:
    """Run each named gate. An unknown or crashing gate yields UNVERIFIED.

    STEP 12: ``config`` is threaded to any registered gate whose signature declares a
    ``config`` parameter (brand-palette, arabic-ratio, trainer-boundary); every other gate's
    single-argument ``fn(text)`` contract is untouched, so this never rewrites a gate that
    has no institute-specific rule values.
    """
    results: list[gates.GateResult] = []
    for name in gate_names:
        fn = gates.REGISTRY.get(name)
        if fn is None:
            results.append(gates.GateResult(name, gates.UNVERIFIED, "gate not registered"))
            continue
        try:
            if config is not None and "config" in inspect.signature(fn).parameters:
                results.append(fn(text, config=config))
            else:
                results.append(fn(text))
        except Exception as exc:  # a crashing gate must not pass silently
            results.append(gates.GateResult(name, gates.UNVERIFIED, f"gate raised: {exc}"))
    return results


def overall_verdict(results: list[gates.GateResult]) -> str:
    """FAIL beats UNVERIFIED beats PASS."""
    verdicts = {r.verdict for r in results}
    if gates.FAIL in verdicts:
        return gates.FAIL
    if gates.UNVERIFIED in verdicts:
        return gates.UNVERIFIED
    return gates.PASS


def write_receipt(sid: str, results: list[gates.GateResult], out_dir: Path) -> Path:
    """Write one YAML receipt covering every gate that was asked for."""
    validate_session_id(sid)
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "id": sid,
        "overall": overall_verdict(results),
        "gates": [
            {
                "gate": r.gate,
                "verdict": r.verdict,
                "detail": r.detail,
                "evidence": r.evidence,
            }
            for r in results
        ],
    }
    path = paths.receipt_path(sid, "gates")
    path = out_dir / path.name
    path.write_text(
        yaml.safe_dump(payload, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run deterministic gates on a file.")
    parser.add_argument("session_id")
    parser.add_argument("target", type=Path)
    parser.add_argument("--gates", nargs="+", required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--org-config",
        type=Path,
        default=None,
        help="Path to a per-job org-config JSON file (see contracts/org-config/org-config.schema.json). "
        "Omit for Techno Square's default values (standalone/manual/legacy invocation only).",
    )
    args = parser.parse_args(argv)

    raw = args.target.read_text(encoding="utf-8")
    text, audience = prepare.learner_text(raw)
    run, skipped = prepare.applicable(args.gates, audience)

    org_cfg = org_config.for_org_config(args.org_config)
    results = run_gates(text, run, org_cfg)
    # A gate that does not apply is recorded, never silently dropped.
    for name in skipped:
        results.append(
            gates.GateResult(
                name,
                gates.UNVERIFIED,
                f"not applicable to {audience}-facing artifact",
            )
        )
    results.sort(key=lambda r: args.gates.index(r.gate))
    path = write_receipt(args.session_id, results, args.out)

    verdict = overall_verdict(results)
    print(f"{verdict} [{audience}] — receipt written to {path}")
    return 0 if verdict == gates.PASS else 1


if __name__ == "__main__":
    sys.exit(main())
