"""Digest the real Office source material into the vault.

Level 2's five decks are topic-named rather than numbered; the mapping to
session IDs below is provisional and is confirmed or corrected by stage R0
provenance analysis.
"""

from __future__ import annotations

import sys
from pathlib import Path

from swarm import envelope
from swarm.digest_office import DigestResult, extract_pptx
from swarm.paths import VAULT_ROOT, assets_dir, digest_path

_COURSE = VAULT_ROOT / "Micro Bit-20260723T182752Z-1-001" / "Micro Bit" / "course"
_L1 = _COURSE / "Level 1"
_L2 = _COURSE / "level 2"

SOURCE_MAP: dict[str, Path] = {
    "L1-s1": _L1 / "session-1.pptx",
    "L1-s2": _L1 / "session-2.pptx",
    "L1-s3": _L1 / "session-3.pptx",
    "L1-s4": _L1 / "session-4.pptx",
    "L1-s5": _L1 / "session-5.pptx",
    "L1-s6": _L1 / "session-6.pptx",
    "L2-s1": _L2 / "musical-algorithms-slides.pptx",
    "L2-s2": _L2 / "musical-gestures-slides.pptx",
    "L2-s3": _L2 / "controlling-music-with-inputs-slides.pptx",
    "L2-s4": _L2 / "programming-debugging-music-slides.pptx",
    "L2-s5": _L2 / "evaluating-micro-bit-music-slides.pptx",
}


def _relative_source(sid: str) -> str:
    """Source path relative to VAULT_ROOT, portable across machines."""
    src = SOURCE_MAP.get(sid)
    if src is None:
        return ""
    return src.relative_to(VAULT_ROOT).as_posix()


def render_digest(result: DigestResult, sid: str) -> str:
    """Build the digest document: envelope plus markdown body."""
    env = envelope.Envelope(
        id=sid,
        stage="digest",
        owner="script",
        status="gated" if result.warnings else "complete",
        inputs=(_relative_source(sid),),
        reads_allowed=("00-contracts/**", f"10-digest/{sid}.*", f"10-digest/_assets/{sid}/**"),
    )

    lines: list[str] = [f"# {sid}", ""]
    for slide in result.slides:
        lines.append(f"## Slide {slide.index}: {slide.title or '(untitled)'}")
        lines.append("")
        if slide.body:
            lines += [slide.body, ""]
        if slide.notes:
            lines += ["**Speaker notes:**", "", slide.notes, ""]

    if result.images:
        lines += ["## Images", ""]
        for img in result.images:
            lines.append(f"- `{img['file']}` — from slide {img['slide']} ({img['bytes']} bytes)")
        lines.append("")

    if result.warnings:
        lines += ["## Extraction warnings", ""]
        lines += [f"- {w}" for w in result.warnings]
        lines.append("")

    return envelope.render(env, "\n".join(lines))


def main(argv: list[str] | None = None) -> int:
    total_slides = 0
    total_images = 0
    gated: list[str] = []

    for sid, src in SOURCE_MAP.items():
        if not src.is_file():
            print(f"MISSING source for {sid}: {src}")
            return 1
        result = extract_pptx(src, sid, assets_dir(sid))
        digest_path(sid).parent.mkdir(parents=True, exist_ok=True)
        digest_path(sid).write_text(render_digest(result, sid), encoding="utf-8")

        total_slides += len(result.slides)
        total_images += len(result.images)
        if result.warnings:
            gated.append(sid)
        print(f"{sid}: {len(result.slides)} slides, {len(result.images)} images")

    print(f"\ntotal: {total_slides} slides, {total_images} images across {len(SOURCE_MAP)} decks")
    if gated:
        print(f"gated for review (extraction warnings): {', '.join(gated)}")
    print("L1-s7, L2-s6, L2-s7 have no source — authored at stage S3.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
