"""ASSET-MAPPING.md table parser, shared by generation and the bundle stage gate.

Extracted out of `generate_session.py` so `stage_gate.py` can run the real
parser instead of a second, looser copy of the same rules — two independent
implementations of "what counts as a valid asset row" would only drift apart.
Neither `generate_session.py` nor `stage_gate.py` imports the other; this
module depends on neither, so both can depend on it without a cycle.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from swarm import paths

VAULT = paths.VAULT_ROOT


@dataclass
class Asset:
    aid: str
    slide: str
    path: Path
    klass: str  # REFERENCE | EVIDENCE
    status: str

    @property
    def produced(self) -> bool:
        return self.status.strip().lower() == "produced and mapped"


_COLS = {
    "aid": ("id", "asset"),
    # "lands on" is what ASSET-MAPPING.md actually calls this column.
    "slide": ("slide", "lands", "destination"),
    "path": ("path", "file"),
    "klass": ("class",),
    "status": ("status", "production"),
}


def _header_index(cells: list[str]) -> dict[str, int] | None:
    """Map our field names onto whatever the table actually called its columns."""
    lowered = [c.strip().lower() for c in cells]
    idx: dict[str, int] = {}
    for field_name, needles in _COLS.items():
        for i, cell in enumerate(lowered):
            if any(n in cell for n in needles) and i not in idx.values():
                idx[field_name] = i
                break
    return idx if len(idx) == len(_COLS) else None


def _row_cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def parse_asset_mapping(text: str, *, vault: Path = VAULT) -> list[Asset]:
    """Pull every asset row out of the mapping's markdown tables.

    Column order is not assumed — headers are matched by name, because the file
    is authored by another agent and its exact shape is not ours to dictate.
    """
    assets: list[Asset] = []
    idx: dict[str, int] | None = None
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            idx = None
            continue
        cells = _row_cells(line)
        if set("".join(cells)) <= set("-: "):  # separator row
            continue
        if idx is None:
            idx = _header_index(cells)
            continue
        if len(cells) <= max(idx.values()):
            continue
        raw = cells[idx["path"]].strip("`").strip()
        raw = re.sub(r"^\[|\]\(.*\)$", "", raw)  # unwrap a markdown link
        if not raw or raw in {"-", "—"}:
            continue
        p = Path(raw)
        assets.append(
            Asset(
                aid=cells[idx["aid"]].strip("`"),
                slide=cells[idx["slide"]],
                path=p if p.is_absolute() else vault / p,
                klass=cells[idx["klass"]].strip("*` ").upper(),
                status=cells[idx["status"]],
            )
        )
    return assets
