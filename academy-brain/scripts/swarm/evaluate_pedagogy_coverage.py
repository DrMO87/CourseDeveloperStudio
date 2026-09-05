"""Re-run the real `pedagogy-coverage` gate for a session's level, on demand.

STEP 11 Phase B, Batch 3: `generate_session.py`'s own `pedagogy_summary` already calls
`gates.REGISTRY["pedagogy-coverage"]` directly against the level's real pedagogy record
(30-research/<level>-pedagogy.yaml) and is exported in every RESULT_JSON line — the "real
invocation/result export" the handoff's mapping table (pedagogy-coverage row) requires
already exists there. This script is a thin side-channel wrapper reusing that exact
function (no reimplementation, no drift) so CourseDeveloper.Infrastructure's cascade
reevaluator can re-check the current pedagogy-coverage verdict without re-running the
whole generate_session.py pipeline — mirrors extract_pdf_text.py's role for the
STEP-3-ported PDF gates.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from swarm import generate_session as gs  # noqa: E402


def evaluate(session_code: str, vault_root: Path) -> dict:
    return gs.pedagogy_summary(session_code, vault_root)


def _demo() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        vault = Path(td)
        # No pedagogy record on disk at all — the honest UNVERIFIED path.
        result = evaluate("L1-s1", vault)
        assert result["verdict"] == "UNVERIFIED", result

        research = vault / "30-research"
        research.mkdir(parents=True)
        (research / "1-pedagogy.yaml").write_text(
            "arc: [Think]\narc_bloom: {Think: [Create/producing]}\n"
            "sessions: {L1-s1: {reaches: [Create/producing], knowledge: [Procedural], "
            "assessment: demo}}\n",
            encoding="utf-8",
        )
        result = evaluate("L1-s1", vault)
        assert result["gate"] == "pedagogy-coverage", result
        assert result["verdict"] in ("PASS", "FAIL"), result
    print("self-check passed")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("session_code", nargs="?", help="e.g. L1-s1")
    ap.add_argument("--root", type=Path, default=None, help="course vault root")
    ap.add_argument("--self-check", action="store_true")
    args = ap.parse_args(argv)

    if args.self_check:
        _demo()
        return 0

    if args.session_code is None or args.root is None:
        ap.error("session_code and --root are required")
    if not args.root.is_dir():
        print(f"ERROR: no such directory: {args.root}", file=sys.stderr)
        return 2

    print(json.dumps(evaluate(args.session_code, args.root)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
