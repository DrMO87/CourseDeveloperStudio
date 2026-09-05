"""Extract full text from a generated pass PDF, for post-generation quality-gate evidence.

STEP 11 Phase B, Batch 2: language_ratio and boundary_check must evaluate the actual
generated deck (VAULT/80-generation/<sid>/<pass>.pdf), not source markdown. No PDF
library exists in the C# worker; academy-brain already depends on PyMuPDF (fitz) for
overlay.py, so this small standalone script is the bridge — CourseDeveloper.Infrastructure
shells out to it (see PythonPdfTextExtractor.cs) rather than duplicating a second PDF
text-extraction implementation in .NET.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def extract_text(pdf_path: Path) -> str:
    import fitz  # PyMuPDF

    with fitz.open(str(pdf_path)) as doc:
        return "\n".join(page.get_text() for page in doc)


def _demo() -> None:
    import tempfile

    import fitz

    with tempfile.TemporaryDirectory() as td:
        pdf_path = Path(td) / "demo.pdf"
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 72), "hello demo")
        doc.save(pdf_path)
        doc.close()

        text = extract_text(pdf_path)
        assert "hello demo" in text, f"expected extracted text to contain the inserted string, got: {text!r}"
    print("self-check passed")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("pdf_path", nargs="?", type=Path)
    ap.add_argument("--self-check", action="store_true")
    args = ap.parse_args(argv)

    if args.self_check:
        _demo()
        return 0

    if args.pdf_path is None:
        ap.error("pdf_path is required")

    if not args.pdf_path.is_file():
        print(f"ERROR: no such file: {args.pdf_path}", file=sys.stderr)
        return 2

    print(json.dumps({"text": extract_text(args.pdf_path)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
