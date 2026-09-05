"""Extract rendered vector-drawing colors from a generated pass PDF, for brand_palette evidence.

STEP 11 Phase B, Batch 2 slice 3: the handoff (step11-nblm-prompt-authoring.md, Part 2's
per-gate-kind mapping table, brand_palette row) explicitly rejects scanning generated-PDF
text for literal hex-code mentions as insufficient evidence — "existing gates scan hex
strings in supplied text and do not inspect rendered PDF color objects." This script reads
the actual fill/stroke colors PyMuPDF (fitz) recorded when the PDF's vector drawings were
authored (Page.get_drawings()), not text. This is deliberately vector-object evidence only:
it does not inspect text paint, raster-image pixels, shadings/patterns, or annotations. A PDF
with none of the supported vector colors returns an empty list so the C# reevaluator fails
closed as UNVERIFIED; this must not be described as full rendered-page palette coverage.
Sibling of extract_pdf_text.py; see PythonPdfColorExtractor.cs for how
CourseDeveloper.Infrastructure shells out to this.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _normalize_rgb(value: tuple[float, ...] | None) -> tuple[float, float, float] | None:
    if value is None:
        return None
    if len(value) == 1:
        g = value[0]
        return (g, g, g)
    if len(value) == 3:
        return (value[0], value[1], value[2])
    if len(value) == 4:
        c, m, y, k = value
        return ((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k))
    return None


def _to_hex(rgb: tuple[float, float, float]) -> str:
    r, g, b = (round(max(0.0, min(1.0, channel)) * 255) for channel in rgb)
    return f"#{r:02X}{g:02X}{b:02X}"


def extract_colors(pdf_path: Path) -> list[str]:
    import fitz  # PyMuPDF

    colors: set[str] = set()
    with fitz.open(str(pdf_path)) as doc:
        for page in doc:
            for drawing in page.get_drawings():
                for key in ("fill", "color"):
                    normalized = _normalize_rgb(drawing.get(key))
                    if normalized is not None:
                        colors.add(_to_hex(normalized))
    return sorted(colors)


def _demo() -> None:
    import tempfile

    import fitz

    with tempfile.TemporaryDirectory() as td:
        pdf_path = Path(td) / "demo.pdf"
        doc = fitz.open()
        page = doc.new_page()
        page.draw_rect(fitz.Rect(10, 10, 100, 100), color=(1, 0, 0), fill=(0, 1, 0))
        doc.save(pdf_path)
        doc.close()

        colors = extract_colors(pdf_path)
        assert "#00FF00" in colors, f"expected fill color #00FF00 in extracted colors, got: {colors!r}"
        assert "#FF0000" in colors, f"expected stroke color #FF0000 in extracted colors, got: {colors!r}"
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

    print(json.dumps({"colors": extract_colors(args.pdf_path)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
