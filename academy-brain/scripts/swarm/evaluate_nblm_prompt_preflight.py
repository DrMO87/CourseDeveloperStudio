"""Run the `nblm-prompt-preflight` registry gate against a rendered prompt file.

STEP 11 Phase B, Batch 3: side-channel CLI so CourseDeveloper.Infrastructure can get a real
GateResult for this Python-only gate without running generate_session.py's full pipeline —
mirrors extract_pdf_text.py / extract_pdf_colors.py's role for the STEP-3-ported gates.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from swarm.gates import REGISTRY as GATE_REGISTRY  # noqa: E402


def evaluate(prompt_path: Path, *, expected_duration: str | None, expected_audience: str | None,
             expected_branding: str | None, forbidden: list[str]) -> dict:
    payload = {
        "promptText": prompt_path.read_text(encoding="utf-8"),
        "expectedDurationText": expected_duration,
        "expectedAudienceText": expected_audience,
        "expectedBrandingText": expected_branding,
        "forbiddenStrings": forbidden,
    }
    result = GATE_REGISTRY["nblm-prompt-preflight"](json.dumps(payload))
    return {"gate": result.gate, "verdict": result.verdict, "detail": result.detail, "evidence": result.evidence}


def _demo() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        prompt_path = Path(td) / "prompts.md"
        prompt_path.write_text(
            "## Notebook A — Student Deck (Pass A)\n\n```\n45 minutes, ages 9-12.\n```\n\n"
            "## Notebook B — Student Summary\n\n```\nToday I Learned\nNew Words\n"
            "Review at Home\nParent Talk\nMini Activity\n```\n",
            encoding="utf-8",
        )
        result = evaluate(
            prompt_path, expected_duration="45 minutes", expected_audience="ages 9-12",
            expected_branding=None, forbidden=[],
        )
        assert result["verdict"] == "PASS", result

        result = evaluate(
            prompt_path, expected_duration="60 minutes", expected_audience=None,
            expected_branding=None, forbidden=[],
        )
        assert result["verdict"] == "FAIL", result
    print("self-check passed")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("prompt_path", nargs="?", type=Path)
    ap.add_argument("--expected-duration", type=str, default=None)
    ap.add_argument("--expected-audience", type=str, default=None)
    ap.add_argument("--expected-branding", type=str, default=None)
    ap.add_argument("--forbidden", action="append", default=[])
    ap.add_argument("--self-check", action="store_true")
    args = ap.parse_args(argv)

    if args.self_check:
        _demo()
        return 0

    if args.prompt_path is None:
        ap.error("prompt_path is required")
    if not args.prompt_path.is_file():
        print(f"ERROR: no such file: {args.prompt_path}", file=sys.stderr)
        return 2

    print(json.dumps(evaluate(
        args.prompt_path, expected_duration=args.expected_duration, expected_audience=args.expected_audience,
        expected_branding=args.expected_branding, forbidden=args.forbidden,
    )))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
