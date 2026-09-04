# Micro:bit Swarm Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic infrastructure — path contracts, envelope schema, extraction, and quality gates — that lets a cross-provider agent swarm rebuild the Techno Square Micro:bit course unattended.

**Architecture:** A small Python package (`scripts/swarm/`) provides path derivation, frontmatter envelopes, Office extraction, and six deterministic gates. A gate runner composes gates and writes `PASS`/`FAIL`/`UNVERIFIED` receipts. Provider CLIs are reached through uniform adapter skills. EthOS v2 holds doctrine; ruflo holds scheduling. Nothing in this plan makes a model call — every component here is mechanically testable, which is what makes unattended operation safe.

**Tech Stack:** Python 3.11.15, uv 0.11.32, pytest 9.1.1, python-pptx, python-docx, PyYAML. Provider CLIs: `claude`, `hermes`, `codex`, `gemini` (all installed and on PATH as of 2026-08-20). Antigravity has no headless CLI and is not used.

## Verified Provider Invocations

All four confirmed returning output on 2026-08-20. Use these exact forms; do not improvise flags.

| Provider | Command |
| --- | --- |
| Claude | native (Agent tool / `claude`) |
| Hermes | `"C:/Users/ET/AppData/Local/hermes/hermes-agent/venv/Scripts/hermes" -z "<prompt>" --safe-mode` |
| Codex | `codex exec --skip-git-repo-check "<prompt>" < /dev/null` — run from the vault root |
| Gemini | `gemini --skip-trust -p "<prompt>"` — requires `GEMINI_API_KEY` |

Two traps already hit and resolved; do not rediscover them:

- **Codex and Gemini both refuse to run outside a "trusted directory."** Codex needs `--skip-git-repo-check`, Gemini needs `--skip-trust`. Without these they exit non-zero with a trust error that looks like an auth failure.
- **Gemini's `~/.gemini/settings.json` caches `security.auth.selectedType`.** If it is `oauth-personal`, the CLI ignores `GEMINI_API_KEY` and fails with `IneligibleTierError` — Google discontinued individual Code Assist OAuth for this client. It must be set to `gemini-api-key`.
- **Antigravity has no headless CLI**, only `Antigravity.exe` and an IDE launcher. It cannot be a swarm worker. Gemini holds that lane.

## Global Constraints

Copied verbatim from `docs/superpowers/specs/2026-08-20-microbit-course-swarm-design.md`. Every task's requirements implicitly include this section.

- **Session IDs:** `L{1|2}-s{1..7}` — exactly 14 valid IDs. No spaces. Topic clusters `T01`..`T08`.
- **One writer per file, never one writer per folder.** Fan-out stages write to separate lane files whose paths do not intersect.
- **The vault is the single source of truth.** Ruflo memory and Hermes `memory-graph` are indexes/scratch only.
- **Language ratio:** literal 30% English / 70% Arabic in learner-facing output.
- **Brand palette:** `#231F20` near-black, `#FFED10` yellow, `#585858` grey, white. `#F5B301` gold is retired and is a FAIL condition.
- **Gate verdicts are `PASS` / `FAIL` / `UNVERIFIED`.** A gate that could not run is `UNVERIFIED`, never silently omitted.
- **Read-only source trees, never written to:** `Abdeen_Moon_OS_Docs/`, `Techno Square identity/`, `Micro Bit-20260723T182752Z-1-001/`.
- **Python is invoked as `python`** (3.11.15 on PATH). Dependencies are managed with `uv`.
- **All new code lives under `scripts/`; all tests under `tests/`.** Per vault `CLAUDE.md`: never save working files to the repo root.

## Scope

**In scope:** the deterministic substrate — Tasks 1–11 below. Every one is unit-testable without a model call.

**Explicitly out of scope, with reasons:**

- **`qc_deck.py` (OCR duplication checker).** It inspects *generated decks*, which only exist after stage S6. S6 is blocked on the owner wiring NBLM MCP. Building it now means testing it against nothing. It gets its own plan when S6 is unblocked.
- **Running the pipeline** (S0 contracts, R0 provenance, the pilot). That is execution, not construction. It follows this plan.
- **EthOS v2 doctrine content** beyond its skeleton and machine-readable rule tables. The prose rules are authored during S0 by an agent reading Brain OS, not hand-written here.

## File Structure

| File | Responsibility |
| --- | --- |
| `pyproject.toml` | Dependency and pytest configuration |
| `scripts/swarm/__init__.py` | Package marker |
| `scripts/swarm/paths.py` | Session ID validation, stage path derivation |
| `scripts/swarm/envelope.py` | Frontmatter read/write, `reads_allowed` scope checks |
| `scripts/swarm/digest_office.py` | pptx/docx → markdown + images + manifest |
| `scripts/swarm/gates/__init__.py` | Gate registry and the `GateResult` type |
| `scripts/swarm/gates/arabic_ratio.py` | 30/70 language ratio |
| `scripts/swarm/gates/cite_filter.py` | Drop uncited critique items |
| `scripts/swarm/gates/boundary_check.py` | Trainer-only content leaking into student output |
| `scripts/swarm/gates/brand_palette.py` | Retired-gold detection |
| `scripts/swarm/gate_runner.py` | Compose gates, write receipts |
| `scripts/doctor_providers.py` | Provider CLI reachability report |
| `.claude/skills/hermes-delegate/SKILL.md` | Hermes adapter |
| `.claude/skills/ethos-v2/SKILL.md` | Doctrine skeleton |
| `00-contracts/topology.md` | Machine-readable roles and ownership |
| `tests/` | One test module per source module |

Files that change together live together: every gate is one file in `gates/`, each with a single `run()` entry point, so the registry can load them uniformly and a new gate is one file plus one test.

---

### Task 1: Project scaffold and dependencies

**Files:**
- Create: `pyproject.toml`
- Create: `scripts/swarm/__init__.py`
- Create: `tests/test_scaffold.py`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: an importable `swarm` package; `pytest` runnable from the vault root

- [ ] **Step 1: Write the failing test**

Create `tests/test_scaffold.py`:

```python
def test_swarm_package_importable():
    import swarm
    assert swarm.__version__ == "0.1.0"


def test_office_libraries_available():
    import pptx
    import docx
    assert pptx is not None
    assert docx is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && python -m pytest tests/test_scaffold.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'swarm'`

- [ ] **Step 3: Write minimal implementation**

Create `pyproject.toml`:

```toml
[project]
name = "microbit-swarm"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "python-pptx>=0.6.23",
    "python-docx>=1.1.0",
    "PyYAML>=6.0",
]

[dependency-groups]
dev = ["pytest>=8.0"]

[tool.pytest.ini_options]
pythonpath = ["scripts"]
testpaths = ["tests"]

[tool.setuptools.packages.find]
where = ["scripts"]
```

Create `scripts/swarm/__init__.py`:

```python
"""Deterministic infrastructure for the Micro:bit course rebuild swarm."""

__version__ = "0.1.0"
```

- [ ] **Step 4: Install dependencies**

Run: `cd "D:/vault/Microbit" && uv sync`
Expected: creates `.venv/`, installs python-pptx, python-docx, PyYAML, pytest

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_scaffold.py -v`
Expected: PASS, 2 passed

- [ ] **Step 6: Ignore the virtualenv**

Append to `.gitignore`:

```
.venv/
uv.lock
__pycache__/
.pytest_cache/
```

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml scripts/swarm/__init__.py tests/test_scaffold.py .gitignore
git commit -m "feat: scaffold swarm package with office and yaml deps"
```

---

### Task 2: Session ID validation and path derivation

Every agent computes its own input and output paths from a session ID. Getting this wrong means two agents writing one file, which is the failure mode the ownership rule exists to prevent.

**Files:**
- Create: `scripts/swarm/paths.py`
- Create: `tests/test_paths.py`

**Interfaces:**
- Consumes: `swarm` package from Task 1
- Produces:
  - `SESSION_IDS: tuple[str, ...]` — all 14 valid IDs
  - `validate_session_id(sid: str) -> str` — returns the ID, raises `ValueError`
  - `digest_path(sid: str) -> Path`
  - `assets_dir(sid: str) -> Path`
  - `provenance_path(sid: str) -> Path`
  - `lane_path(stage: str, sid: str, provider: str) -> Path`
  - `merged_path(stage: str, sid: str) -> Path`
  - `receipt_path(sid: str, gate: str) -> Path`
  - `VAULT_ROOT: Path`

- [ ] **Step 1: Write the failing test**

Create `tests/test_paths.py`:

```python
import pytest

from swarm import paths


def test_exactly_fourteen_session_ids():
    assert len(paths.SESSION_IDS) == 14
    assert paths.SESSION_IDS[0] == "L1-s1"
    assert paths.SESSION_IDS[-1] == "L2-s7"


@pytest.mark.parametrize("sid", ["L1-s1", "L1-s7", "L2-s1", "L2-s7"])
def test_validate_accepts_real_ids(sid):
    assert paths.validate_session_id(sid) == sid


@pytest.mark.parametrize("bad", ["L3-s1", "L1-s8", "L1-s0", "l1-s1", "L1 s1", "L1-s01", ""])
def test_validate_rejects_malformed_ids(bad):
    with pytest.raises(ValueError):
        paths.validate_session_id(bad)


def test_digest_path_is_derived_not_searched():
    p = paths.digest_path("L1-s3")
    assert p.name == "L1-s3.md"
    assert p.parent.name == "10-digest"


def test_assets_dir_is_per_session():
    assert paths.assets_dir("L2-s4").as_posix().endswith("10-digest/_assets/L2-s4")


def test_lane_paths_never_collide_across_providers():
    lanes = {
        paths.lane_path("40-critique", "L1-s3", provider)
        for provider in ("codex", "gemini", "hermes")
    }
    assert len(lanes) == 3


def test_lane_path_rejects_unknown_provider():
    with pytest.raises(ValueError):
        paths.lane_path("40-critique", "L1-s3", "gpt5")


def test_merged_path_has_single_owner_per_session():
    assert paths.merged_path("50-patch", "L1-s3").name == "L1-s3.md"


def test_receipt_path_includes_gate_name():
    p = paths.receipt_path("L1-s3", "arabic-ratio")
    assert p.name == "L1-s3.arabic-ratio.yaml"
    assert p.parent.name == "90-receipts"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_paths.py -v`
Expected: FAIL with `ImportError: cannot import name 'paths' from 'swarm'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/swarm/paths.py`:

```python
"""Path derivation for the swarm vault.

Every path is computed from a session ID. Agents never search for their
inputs, which is what keeps read scope declared rather than discovered.
"""

from __future__ import annotations

import re
from pathlib import Path

VAULT_ROOT = Path(__file__).resolve().parents[2]

SESSION_IDS: tuple[str, ...] = tuple(
    f"L{level}-s{n}" for level in (1, 2) for n in range(1, 8)
)

PROVIDERS: frozenset[str] = frozenset({"claude", "codex", "gemini", "hermes"})

_SESSION_RE = re.compile(r"^L[12]-s[1-7]$")


def validate_session_id(sid: str) -> str:
    """Return sid unchanged, or raise ValueError if it is not one of the 14."""
    if not _SESSION_RE.match(sid):
        raise ValueError(
            f"invalid session id {sid!r}; expected one of {SESSION_IDS}"
        )
    return sid


def digest_path(sid: str) -> Path:
    return VAULT_ROOT / "10-digest" / f"{validate_session_id(sid)}.md"


def assets_dir(sid: str) -> Path:
    return VAULT_ROOT / "10-digest" / "_assets" / validate_session_id(sid)


def provenance_path(sid: str) -> Path:
    return VAULT_ROOT / "20-provenance" / f"{validate_session_id(sid)}.md"


def lane_path(stage: str, sid: str, provider: str) -> Path:
    """Per-provider lane file. Distinct providers never share a path."""
    if provider not in PROVIDERS:
        raise ValueError(f"unknown provider {provider!r}; expected one of {sorted(PROVIDERS)}")
    return VAULT_ROOT / stage / validate_session_id(sid) / f"{provider}.json"


def merged_path(stage: str, sid: str) -> Path:
    """Single-owner output for a stage that merges lanes."""
    return VAULT_ROOT / stage / f"{validate_session_id(sid)}.md"


def receipt_path(sid: str, gate: str) -> Path:
    return VAULT_ROOT / "90-receipts" / f"{validate_session_id(sid)}.{gate}.yaml"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_paths.py -v`
Expected: PASS, 16 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/swarm/paths.py tests/test_paths.py
git commit -m "feat: session id validation and stage path derivation"
```

---

### Task 3: Frontmatter envelope

The envelope is what makes the vault a message bus rather than a folder. It carries ownership, status, declared read scope, and the gate verdict.

**Files:**
- Create: `scripts/swarm/envelope.py`
- Create: `tests/test_envelope.py`

**Interfaces:**
- Consumes: `swarm.paths` from Task 2
- Produces:
  - `Envelope` dataclass with fields `id, stage, owner, status, inputs, reads_allowed, gate, tokens, run`
  - `parse(text: str) -> tuple[Envelope, str]` — envelope plus body
  - `render(env: Envelope, body: str) -> str`
  - `is_read_allowed(env: Envelope, path: str) -> bool`

- [ ] **Step 1: Write the failing test**

Create `tests/test_envelope.py`:

```python
import pytest

from swarm import envelope

SAMPLE = """---
id: L1-s3
stage: critique
owner: codex
status: complete
inputs: [10-digest/L1-s3.md]
reads_allowed: ['00-contracts/**', '10-digest/L1-s3.*']
gate: {name: critique-schema, verdict: PASS}
tokens: 8420
run: wf_abc123
---
body text here
"""


def test_parse_returns_envelope_and_body():
    env, body = envelope.parse(SAMPLE)
    assert env.id == "L1-s3"
    assert env.owner == "codex"
    assert env.tokens == 8420
    assert body.strip() == "body text here"


def test_parse_rejects_missing_frontmatter():
    with pytest.raises(ValueError):
        envelope.parse("no frontmatter here")


def test_parse_rejects_invalid_session_id():
    with pytest.raises(ValueError):
        envelope.parse(SAMPLE.replace("id: L1-s3", "id: L9-s9"))


def test_parse_rejects_unknown_status():
    with pytest.raises(ValueError):
        envelope.parse(SAMPLE.replace("status: complete", "status: probably-fine"))


def test_render_round_trips():
    env, body = envelope.parse(SAMPLE)
    env2, body2 = envelope.parse(envelope.render(env, body))
    assert env2 == env
    assert body2.strip() == body.strip()


def test_read_scope_allows_declared_glob():
    env, _ = envelope.parse(SAMPLE)
    assert envelope.is_read_allowed(env, "00-contracts/rubric.md")
    assert envelope.is_read_allowed(env, "10-digest/L1-s3.md")


def test_read_scope_blocks_other_sessions():
    env, _ = envelope.parse(SAMPLE)
    assert not envelope.is_read_allowed(env, "10-digest/L1-s4.md")
    assert not envelope.is_read_allowed(env, "60-approved/L2-s1.md")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_envelope.py -v`
Expected: FAIL with `ImportError: cannot import name 'envelope' from 'swarm'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/swarm/envelope.py`:

```python
"""Frontmatter envelopes: the swarm's message format."""

from __future__ import annotations

import fnmatch
from dataclasses import dataclass, field

import yaml

from swarm.paths import validate_session_id

VALID_STATUS = frozenset({"pending", "complete", "failed", "gated"})
VALID_VERDICT = frozenset({"PASS", "FAIL", "UNVERIFIED"})


@dataclass(frozen=True)
class Envelope:
    id: str
    stage: str
    owner: str
    status: str
    inputs: tuple[str, ...] = ()
    reads_allowed: tuple[str, ...] = ()
    gate: tuple[tuple[str, str], ...] = ()
    tokens: int = 0
    run: str = ""


def parse(text: str) -> tuple[Envelope, str]:
    """Split a document into its envelope and body. Raises ValueError if invalid."""
    if not text.startswith("---\n"):
        raise ValueError("document has no frontmatter")
    _, _, rest = text.partition("---\n")
    raw, sep, body = rest.partition("\n---\n")
    if not sep:
        raise ValueError("unterminated frontmatter")

    data = yaml.safe_load(raw) or {}
    validate_session_id(data.get("id", ""))

    status = data.get("status", "pending")
    if status not in VALID_STATUS:
        raise ValueError(f"invalid status {status!r}; expected one of {sorted(VALID_STATUS)}")

    gate = data.get("gate") or {}
    if gate and gate.get("verdict") not in VALID_VERDICT:
        raise ValueError(f"invalid verdict {gate.get('verdict')!r}")

    env = Envelope(
        id=data["id"],
        stage=data.get("stage", ""),
        owner=data.get("owner", ""),
        status=status,
        inputs=tuple(data.get("inputs") or ()),
        reads_allowed=tuple(data.get("reads_allowed") or ()),
        gate=tuple(sorted(gate.items())) if gate else (),
        tokens=int(data.get("tokens", 0)),
        run=data.get("run", ""),
    )
    return env, body


def render(env: Envelope, body: str) -> str:
    """Serialize an envelope and body back to a document."""
    data = {
        "id": env.id,
        "stage": env.stage,
        "owner": env.owner,
        "status": env.status,
        "inputs": list(env.inputs),
        "reads_allowed": list(env.reads_allowed),
        "tokens": env.tokens,
        "run": env.run,
    }
    if env.gate:
        data["gate"] = dict(env.gate)
    front = yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    return f"---\n{front}---\n{body}"


def is_read_allowed(env: Envelope, path: str) -> bool:
    """True if path matches any declared read pattern.

    Declared scope is the token-efficiency lever: an agent reads one
    session's files plus frozen contracts, never the vault.
    """
    normalized = path.replace("\\", "/")
    for pattern in env.reads_allowed:
        if fnmatch.fnmatch(normalized, pattern):
            return True
        if pattern.endswith("/**") and normalized.startswith(pattern[:-3] + "/"):
            return True
    return False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_envelope.py -v`
Expected: PASS, 7 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/swarm/envelope.py tests/test_envelope.py
git commit -m "feat: frontmatter envelope with declared read scope"
```

---

### Task 4: Office extraction

Zero LLM tokens. Extracts text, speaker notes, and every embedded image. Images are the asset the owner explicitly wants preserved.

**Files:**
- Create: `scripts/swarm/digest_office.py`
- Create: `tests/test_digest_office.py`

**Interfaces:**
- Consumes: `swarm.paths` from Task 2
- Produces:
  - `extract_pptx(src: Path, sid: str, out_dir: Path) -> DigestResult`
  - `extract_docx(src: Path, sid: str) -> str`
  - `DigestResult` dataclass with fields `sid, slides, images, warnings`
  - `Slide` dataclass with fields `index, title, body, notes`

- [ ] **Step 1: Write the failing test**

Create `tests/test_digest_office.py`. The test builds a real `.pptx` with python-pptx so there is no fixture binary to check in:

```python
from pathlib import Path

import pytest
from pptx import Presentation
from pptx.util import Inches

from swarm import digest_office


@pytest.fixture
def sample_pptx(tmp_path: Path) -> Path:
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = "What is a micro:bit?"
    slide.placeholders[1].text = "A tiny computer you can program."
    slide.notes_slide.notes_text_frame.text = "Ask students to predict first."

    second = prs.slides.add_slide(prs.slide_layouts[5])
    second.shapes.title.text = "The LED grid"
    png = tmp_path / "dot.png"
    png.write_bytes(
        bytes.fromhex(
            "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753"
            "de0000000c4944415408d76360000000020001e221bc330000000049454e44ae426082"
        )
    )
    second.shapes.add_picture(str(png), Inches(1), Inches(1))

    out = tmp_path / "session-1.pptx"
    prs.save(str(out))
    return out


def test_extracts_every_slide(sample_pptx, tmp_path):
    result = digest_office.extract_pptx(sample_pptx, "L1-s1", tmp_path / "assets")
    assert len(result.slides) == 2
    assert result.slides[0].title == "What is a micro:bit?"
    assert result.slides[1].title == "The LED grid"


def test_captures_speaker_notes(sample_pptx, tmp_path):
    result = digest_office.extract_pptx(sample_pptx, "L1-s1", tmp_path / "assets")
    assert "predict first" in result.slides[0].notes


def test_extracts_images_to_assets_dir(sample_pptx, tmp_path):
    assets = tmp_path / "assets"
    result = digest_office.extract_pptx(sample_pptx, "L1-s1", assets)
    assert len(result.images) == 1
    written = list(assets.glob("*.png"))
    assert len(written) == 1
    assert written[0].stat().st_size > 0


def test_image_manifest_records_source_slide(sample_pptx, tmp_path):
    result = digest_office.extract_pptx(sample_pptx, "L1-s1", tmp_path / "assets")
    assert result.images[0]["slide"] == 2


def test_warns_on_empty_slide(tmp_path):
    prs = Presentation()
    prs.slides.add_slide(prs.slide_layouts[6])  # blank layout
    src = tmp_path / "empty.pptx"
    prs.save(str(src))

    result = digest_office.extract_pptx(src, "L1-s2", tmp_path / "assets")
    assert any("empty" in w for w in result.warnings)


def test_rejects_invalid_session_id(sample_pptx, tmp_path):
    with pytest.raises(ValueError):
        digest_office.extract_pptx(sample_pptx, "L9-s9", tmp_path / "assets")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_digest_office.py -v`
Expected: FAIL with `ImportError: cannot import name 'digest_office' from 'swarm'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/swarm/digest_office.py`:

```python
"""Extract text, notes, and images from Office source material.

Runs at zero LLM cost. Everything downstream reads this output rather
than the original binaries.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import docx
from pptx import Presentation

from swarm.paths import validate_session_id


@dataclass
class Slide:
    index: int
    title: str
    body: str
    notes: str


@dataclass
class DigestResult:
    sid: str
    slides: list[Slide] = field(default_factory=list)
    images: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def extract_pptx(src: Path, sid: str, out_dir: Path) -> DigestResult:
    """Pull every slide's text, notes, and embedded images."""
    validate_session_id(sid)
    out_dir.mkdir(parents=True, exist_ok=True)
    result = DigestResult(sid=sid)
    prs = Presentation(str(src))

    for i, slide in enumerate(prs.slides, start=1):
        title = ""
        body_parts: list[str] = []

        for shape in slide.shapes:
            if shape.shape_type == 13 or getattr(shape, "image", None) is not None:
                _save_image(shape, i, len(result.images) + 1, out_dir, result)
                continue
            if not shape.has_text_frame:
                continue
            text = shape.text_frame.text.strip()
            if not text:
                continue
            if shape == slide.shapes.title:
                title = text
            else:
                body_parts.append(text)

        notes = ""
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip()

        if not title and not body_parts:
            result.warnings.append(f"slide {i} is empty (no title, no body)")

        result.slides.append(
            Slide(index=i, title=title, body="\n\n".join(body_parts), notes=notes)
        )

    _write_manifest(out_dir, result)
    return result


def _save_image(shape, slide_index: int, seq: int, out_dir: Path, result: DigestResult) -> None:
    try:
        image = shape.image
    except (AttributeError, ValueError):
        return
    name = f"img-{seq:02d}.{image.ext}"
    (out_dir / name).write_bytes(image.blob)
    result.images.append(
        {
            "file": name,
            "slide": slide_index,
            "ext": image.ext,
            "bytes": len(image.blob),
        }
    )


def _write_manifest(out_dir: Path, result: DigestResult) -> None:
    (out_dir / "manifest.json").write_text(
        json.dumps({"id": result.sid, "images": result.images}, indent=2),
        encoding="utf-8",
    )


def extract_docx(src: Path, sid: str) -> str:
    """Return a docx's paragraphs as markdown-ish plain text."""
    validate_session_id(sid)
    document = docx.Document(str(src))
    return "\n\n".join(p.text.strip() for p in document.paragraphs if p.text.strip())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_digest_office.py -v`
Expected: PASS, 6 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/swarm/digest_office.py tests/test_digest_office.py
git commit -m "feat: pptx and docx extraction with image manifest"
```

---

### Task 5: Gate registry and result type

Every gate returns the same shape so the runner can treat them uniformly and a new gate is one file plus one test.

**Files:**
- Create: `scripts/swarm/gates/__init__.py`
- Create: `tests/test_gate_registry.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `GateResult` dataclass with fields `gate, verdict, detail, evidence`
  - `PASS`, `FAIL`, `UNVERIFIED` string constants
  - `register(name)` decorator
  - `REGISTRY: dict[str, Callable[[str], GateResult]]`

- [ ] **Step 1: Write the failing test**

Create `tests/test_gate_registry.py`:

```python
import pytest

from swarm import gates


def test_verdict_constants():
    assert gates.PASS == "PASS"
    assert gates.FAIL == "FAIL"
    assert gates.UNVERIFIED == "UNVERIFIED"


def test_register_adds_to_registry():
    @gates.register("dummy-gate")
    def _dummy(text: str) -> gates.GateResult:
        return gates.GateResult("dummy-gate", gates.PASS, "ok", {})

    assert "dummy-gate" in gates.REGISTRY
    assert gates.REGISTRY["dummy-gate"]("x").verdict == gates.PASS


def test_gate_result_rejects_invalid_verdict():
    with pytest.raises(ValueError):
        gates.GateResult("g", "PROBABLY", "", {})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_gate_registry.py -v`
Expected: FAIL with `ImportError: cannot import name 'gates' from 'swarm'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/swarm/gates/__init__.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_gate_registry.py -v`
Expected: PASS, 3 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/swarm/gates/__init__.py tests/test_gate_registry.py
git commit -m "feat: gate registry and GateResult with verdict validation"
```

---

### Task 6: Arabic ratio gate

Brain OS mandates literal 30% English / 70% Arabic. This gate is the enforcement.

**Files:**
- Create: `scripts/swarm/gates/arabic_ratio.py`
- Create: `tests/test_arabic_ratio.py`

**Interfaces:**
- Consumes: `swarm.gates` from Task 5
- Produces: `check(text: str) -> GateResult`, registered as `"arabic-ratio"`; constants `TARGET_ARABIC = 0.70`, `TOLERANCE = 0.10`

- [ ] **Step 1: Write the failing test**

Create `tests/test_arabic_ratio.py`:

```python
from swarm import gates
from swarm.gates import arabic_ratio

ARABIC_HEAVY = (
    "الميكروبيت كمبيوتر صغير تقدر تبرمجه بنفسك وتعمل بيه حاجات كتير جدا "
    "وتشوف النتيجة على الشاشة الصغيرة بتاعته بسهولة كده Micro:bit"
)
ENGLISH_HEAVY = (
    "The micro:bit is a tiny programmable computer with an LED grid, "
    "two buttons, and a range of built in sensors ميكروبيت"
)


def test_arabic_heavy_text_passes():
    result = arabic_ratio.check(ARABIC_HEAVY)
    assert result.verdict == gates.PASS


def test_english_heavy_text_fails():
    result = arabic_ratio.check(ENGLISH_HEAVY)
    assert result.verdict == gates.FAIL
    assert "arabic_ratio" in result.evidence


def test_empty_text_is_unverified_not_pass():
    result = arabic_ratio.check("   ")
    assert result.verdict == gates.UNVERIFIED


def test_digits_and_punctuation_do_not_count():
    result = arabic_ratio.check("12345 !!! ---")
    assert result.verdict == gates.UNVERIFIED


def test_registered_under_expected_name():
    assert "arabic-ratio" in gates.REGISTRY
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_arabic_ratio.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'swarm.gates.arabic_ratio'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/swarm/gates/arabic_ratio.py`:

```python
"""Enforce the Brain OS 30/70 English/Arabic ratio."""

from __future__ import annotations

from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register

TARGET_ARABIC = 0.70
TOLERANCE = 0.10

_ARABIC_RANGES = ((0x0600, 0x06FF), (0x0750, 0x077F), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF))


def _is_arabic(ch: str) -> bool:
    code = ord(ch)
    return any(lo <= code <= hi for lo, hi in _ARABIC_RANGES)


def _is_latin(ch: str) -> bool:
    return ("a" <= ch <= "z") or ("A" <= ch <= "Z")


@register("arabic-ratio")
def check(text: str) -> GateResult:
    """Compare Arabic letter share against the 70% target."""
    arabic = sum(1 for ch in text if _is_arabic(ch))
    latin = sum(1 for ch in text if _is_latin(ch))
    total = arabic + latin

    if total == 0:
        return GateResult(
            "arabic-ratio",
            UNVERIFIED,
            "no alphabetic content to measure",
            {"arabic": 0, "latin": 0},
        )

    ratio = arabic / total
    evidence = {"arabic_ratio": round(ratio, 3), "arabic": arabic, "latin": latin}

    if abs(ratio - TARGET_ARABIC) <= TOLERANCE:
        return GateResult("arabic-ratio", PASS, f"ratio {ratio:.0%} within tolerance", evidence)

    direction = "too little Arabic" if ratio < TARGET_ARABIC else "too little English"
    return GateResult(
        "arabic-ratio",
        FAIL,
        f"ratio {ratio:.0%} vs target {TARGET_ARABIC:.0%} — {direction}",
        evidence,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_arabic_ratio.py -v`
Expected: PASS, 5 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/swarm/gates/arabic_ratio.py tests/test_arabic_ratio.py
git commit -m "feat: arabic ratio gate enforcing 30/70 language rule"
```

---

### Task 7: Citation filter

The mechanism that stops the swarm inventing curriculum. Uncited change proposals never reach the judge.

**Files:**
- Create: `scripts/swarm/gates/cite_filter.py`
- Create: `tests/test_cite_filter.py`

**Interfaces:**
- Consumes: `swarm.gates` from Task 5
- Produces:
  - `filter_issues(payload: dict) -> tuple[list[dict], list[dict]]` — returns `(kept, dropped)`
  - `check(text: str) -> GateResult`, registered as `"cite-filter"`

- [ ] **Step 1: Write the failing test**

Create `tests/test_cite_filter.py`:

```python
import json

from swarm import gates
from swarm.gates import cite_filter

PAYLOAD = {
    "issues": [
        {
            "loc": "slide-7",
            "severity": "high",
            "type": "pedagogy",
            "problem": "flashing introduced before predict step",
            "fix": "insert predict-then-run beat",
            "cites": ["microbit.org/teach/units/music#lesson-2"],
        },
        {
            "loc": "slide-9",
            "severity": "medium",
            "type": "pedagogy",
            "problem": "needs more energy",
            "fix": "add a game",
            "cites": [],
        },
        {
            "loc": "slide-11",
            "severity": "low",
            "type": "content",
            "problem": "vague wording",
            "fix": "tighten",
        },
    ]
}


def test_keeps_cited_issues():
    kept, _ = cite_filter.filter_issues(PAYLOAD)
    assert len(kept) == 1
    assert kept[0]["loc"] == "slide-7"


def test_drops_empty_cites():
    _, dropped = cite_filter.filter_issues(PAYLOAD)
    assert {d["loc"] for d in dropped} == {"slide-9", "slide-11"}


def test_blank_string_cite_does_not_count():
    kept, _ = cite_filter.filter_issues({"issues": [{"loc": "s1", "cites": ["  "]}]})
    assert kept == []


def test_check_fails_when_everything_uncited():
    payload = json.dumps({"issues": [{"loc": "s1", "cites": []}]})
    assert cite_filter.check(payload).verdict == gates.FAIL


def test_check_passes_when_all_cited():
    payload = json.dumps({"issues": [{"loc": "s1", "cites": ["microbit.org/x"]}]})
    assert cite_filter.check(payload).verdict == gates.PASS


def test_malformed_json_is_unverified_not_pass():
    assert cite_filter.check("{not json").verdict == gates.UNVERIFIED


def test_registered_under_expected_name():
    assert "cite-filter" in gates.REGISTRY
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_cite_filter.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'swarm.gates.cite_filter'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/swarm/gates/cite_filter.py`:

```python
"""Reject change proposals that cite no source.

Agents may reorganize freely; they may not invent curriculum. This is the
property that makes an unsupervised pipeline safe.
"""

from __future__ import annotations

import json

from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register


def _has_citation(issue: dict) -> bool:
    cites = issue.get("cites") or []
    return any(isinstance(c, str) and c.strip() for c in cites)


def filter_issues(payload: dict) -> tuple[list[dict], list[dict]]:
    """Split issues into (kept, dropped) on whether they cite a source."""
    issues = payload.get("issues") or []
    kept = [i for i in issues if _has_citation(i)]
    dropped = [i for i in issues if not _has_citation(i)]
    return kept, dropped


@register("cite-filter")
def check(text: str) -> GateResult:
    """Verdict on a raw critique payload."""
    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return GateResult("cite-filter", UNVERIFIED, "payload is not valid JSON", {})

    kept, dropped = filter_issues(payload)
    evidence = {"kept": len(kept), "dropped": len(dropped)}

    if not kept and dropped:
        return GateResult(
            "cite-filter", FAIL, "every proposed change is uncited", evidence
        )
    return GateResult(
        "cite-filter", PASS, f"{len(kept)} cited, {len(dropped)} dropped", evidence
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_cite_filter.py -v`
Expected: PASS, 7 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/swarm/gates/cite_filter.py tests/test_cite_filter.py
git commit -m "feat: citation filter rejecting uncited change proposals"
```

---

### Task 8: Trainer/student boundary gate

Brain OS: "Trainer Guide is always internal use only." Student-facing output must not contain trainer scripts, timings, expected answers, or classroom management notes.

**Files:**
- Create: `scripts/swarm/gates/boundary_check.py`
- Create: `tests/test_boundary_check.py`

**Interfaces:**
- Consumes: `swarm.gates` from Task 5
- Produces: `check(text: str) -> GateResult`, registered as `"trainer-boundary"`; `TRAINER_MARKERS: tuple[str, ...]`

- [ ] **Step 1: Write the failing test**

Create `tests/test_boundary_check.py`:

```python
from swarm import gates
from swarm.gates import boundary_check

CLEAN_STUDENT_TEXT = "الميكروبيت كمبيوتر صغير. جرب تضغط زرار A وشوف بيحصل إيه."
LEAKED_TIMING = "الميكروبيت كمبيوتر صغير.\n\nTrainer note: 5 minutes for this activity."
LEAKED_ANSWER = "شوف بيحصل إيه.\n\nExpected answer: the LED grid lights up."
LEAKED_ARABIC = "شوف بيحصل إيه.\n\nملاحظة للمدرب: اسأل الطلاب الأول."


def test_clean_student_text_passes():
    assert boundary_check.check(CLEAN_STUDENT_TEXT).verdict == gates.PASS


def test_detects_trainer_note():
    result = boundary_check.check(LEAKED_TIMING)
    assert result.verdict == gates.FAIL
    assert "Trainer note" in result.evidence["matches"][0]


def test_detects_expected_answer():
    assert boundary_check.check(LEAKED_ANSWER).verdict == gates.FAIL


def test_detects_arabic_trainer_marker():
    assert boundary_check.check(LEAKED_ARABIC).verdict == gates.FAIL


def test_detection_is_case_insensitive():
    assert boundary_check.check("EXPECTED ANSWER: yes").verdict == gates.FAIL


def test_empty_text_is_unverified():
    assert boundary_check.check("").verdict == gates.UNVERIFIED


def test_registered_under_expected_name():
    assert "trainer-boundary" in gates.REGISTRY
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_boundary_check.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'swarm.gates.boundary_check'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/swarm/gates/boundary_check.py`:

```python
"""Detect trainer-only content leaking into student-facing output.

Brain OS, Academy_Language_and_Output_Rules.md: student-facing outputs must
NOT include trainer scripts, trainer timing, internal notes, assessment
checklists, or classroom management notes.
"""

from __future__ import annotations

from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register

TRAINER_MARKERS: tuple[str, ...] = (
    "trainer note",
    "trainer script",
    "trainer question",
    "expected answer",
    "common mistakes",
    "classroom management",
    "assessment checklist",
    "minutes for this",
    "ملاحظة للمدرب",
    "إجابة متوقعة",
    "دليل المدرب",
)


@register("trainer-boundary")
def check(text: str) -> GateResult:
    """Fail if any trainer-only marker appears in student-facing text."""
    if not text.strip():
        return GateResult("trainer-boundary", UNVERIFIED, "no content to scan", {})

    lowered = text.lower()
    matches = [m for m in TRAINER_MARKERS if m.lower() in lowered]

    if matches:
        return GateResult(
            "trainer-boundary",
            FAIL,
            f"{len(matches)} trainer-only marker(s) in student output",
            {"matches": matches},
        )
    return GateResult("trainer-boundary", PASS, "no trainer content detected", {})
```

Note the test asserts `"Trainer note" in result.evidence["matches"][0]` — markers are stored lowercase, so make the test's assertion case-insensitive by comparing lowercase. Adjust the test line to:

```python
    assert "trainer note" in result.evidence["matches"][0].lower()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_boundary_check.py -v`
Expected: PASS, 7 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/swarm/gates/boundary_check.py tests/test_boundary_check.py
git commit -m "feat: trainer/student boundary gate"
```

---

### Task 9: Brand palette gate

The retired gold `#F5B301` is a documented FAIL condition — anything generated with it is off-brand.

**Files:**
- Create: `scripts/swarm/gates/brand_palette.py`
- Create: `tests/test_brand_palette.py`

**Interfaces:**
- Consumes: `swarm.gates` from Task 5
- Produces: `check(text: str) -> GateResult`, registered as `"brand-palette"`; `APPROVED: frozenset[str]`, `RETIRED: frozenset[str]`

- [ ] **Step 1: Write the failing test**

Create `tests/test_brand_palette.py`:

```python
from swarm import gates
from swarm.gates import brand_palette


def test_approved_palette_passes():
    assert brand_palette.check("background #231F20 accent #FFED10").verdict == gates.PASS


def test_retired_gold_fails():
    result = brand_palette.check("accent color #F5B301")
    assert result.verdict == gates.FAIL
    assert "#F5B301" in result.evidence["retired"]


def test_retired_placeholder_black_fails():
    assert brand_palette.check("bg #1A1A1A").verdict == gates.FAIL


def test_detection_is_case_insensitive():
    assert brand_palette.check("#f5b301").verdict == gates.FAIL


def test_text_without_hex_colors_is_unverified():
    assert brand_palette.check("no colors mentioned").verdict == gates.UNVERIFIED


def test_registered_under_expected_name():
    assert "brand-palette" in gates.REGISTRY
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_brand_palette.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'swarm.gates.brand_palette'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/swarm/gates/brand_palette.py`:

```python
"""Enforce the real Techno Square palette and reject retired placeholders."""

from __future__ import annotations

import re

from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register

APPROVED = frozenset({"#231F20", "#FFED10", "#585858", "#FFFFFF"})
RETIRED = frozenset({"#F5B301", "#1A1A1A"})

_HEX = re.compile(r"#[0-9A-Fa-f]{6}")


@register("brand-palette")
def check(text: str) -> GateResult:
    """Fail if any retired brand color appears."""
    found = {m.upper() for m in _HEX.findall(text)}
    if not found:
        return GateResult("brand-palette", UNVERIFIED, "no hex colors found", {})

    retired = sorted(found & RETIRED)
    if retired:
        return GateResult(
            "brand-palette",
            FAIL,
            f"retired brand color(s) present: {', '.join(retired)}",
            {"retired": retired, "found": sorted(found)},
        )
    return GateResult(
        "brand-palette", PASS, "no retired colors", {"found": sorted(found)}
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_brand_palette.py -v`
Expected: PASS, 6 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/swarm/gates/brand_palette.py tests/test_brand_palette.py
git commit -m "feat: brand palette gate rejecting retired colors"
```

---

### Task 10: Gate runner and receipts

Composes gates and writes the audit trail that makes review retrospective instead of blocking. This is what the owner reads instead of supervising.

**Files:**
- Create: `scripts/swarm/gate_runner.py`
- Create: `tests/test_gate_runner.py`

**Interfaces:**
- Consumes: `swarm.gates` (Task 5), all gate modules (Tasks 6–9), `swarm.paths` (Task 2)
- Produces:
  - `run_gates(text: str, gate_names: list[str]) -> list[GateResult]`
  - `overall_verdict(results: list[GateResult]) -> str`
  - `write_receipt(sid: str, results: list[GateResult], out_dir: Path) -> Path`
  - `main(argv: list[str]) -> int` — CLI entry point

- [ ] **Step 1: Write the failing test**

Create `tests/test_gate_runner.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_gate_runner.py -v`
Expected: FAIL with `ImportError: cannot import name 'gate_runner' from 'swarm'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/swarm/gate_runner.py`:

```python
"""Run gates and write receipts.

A gate that could not run is UNVERIFIED, never silently omitted — the
receipt is the audit trail that replaces human supervision.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

from swarm import gates
from swarm.gates import arabic_ratio, boundary_check, brand_palette, cite_filter  # noqa: F401
from swarm.paths import validate_session_id


def run_gates(text: str, gate_names: list[str]) -> list[gates.GateResult]:
    """Run each named gate. An unknown or crashing gate yields UNVERIFIED."""
    results: list[gates.GateResult] = []
    for name in gate_names:
        fn = gates.REGISTRY.get(name)
        if fn is None:
            results.append(gates.GateResult(name, gates.UNVERIFIED, "gate not registered"))
            continue
        try:
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
    path = out_dir / f"{sid}.gates.yaml"
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
    args = parser.parse_args(argv)

    text = args.target.read_text(encoding="utf-8")
    results = run_gates(text, args.gates)
    path = write_receipt(args.session_id, results, args.out)

    verdict = overall_verdict(results)
    print(f"{verdict} — receipt written to {path}")
    return 0 if verdict == gates.PASS else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_gate_runner.py -v`
Expected: PASS, 7 passed

- [ ] **Step 5: Run the whole suite**

Run: `cd "D:/vault/Microbit" && uv run pytest -q`
Expected: PASS, 58 passed

- [ ] **Step 6: Commit**

```bash
git add scripts/swarm/gate_runner.py tests/test_gate_runner.py
git commit -m "feat: gate runner with FAIL-beats-UNVERIFIED-beats-PASS receipts"
```

---

### Task 11: Provider reachability doctor

The swarm cannot shell out to a CLI it cannot resolve. At planning time only `claude` and `hermes` were on PATH; `codex` and `gemini` were installed during planning. This task makes reachability a measured fact with a written report rather than an assumption, and catches regressions (an uninstall, a PATH change) before a stage fails mid-run.

**Files:**
- Create: `scripts/doctor_providers.py`
- Create: `tests/test_doctor_providers.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `PROVIDER_COMMANDS: dict[str, str]` — logical name → executable name
  - `probe(name: str, which=shutil.which) -> dict` — `{name, command, path, reachable}`
  - `report(results: list[dict]) -> str`
  - `main(argv) -> int` — exit 0 if all reachable, 1 otherwise

- [ ] **Step 1: Write the failing test**

Create `tests/test_doctor_providers.py`:

```python
import doctor_providers


def test_covers_all_swarm_providers():
    assert set(doctor_providers.PROVIDER_COMMANDS) == {"claude", "codex", "gemini", "hermes"}


def test_probe_reports_reachable_when_found():
    result = doctor_providers.probe("hermes", which=lambda cmd: "C:/fake/hermes.exe")
    assert result["reachable"] is True
    assert result["path"] == "C:/fake/hermes.exe"


def test_probe_reports_unreachable_when_missing():
    result = doctor_providers.probe("codex", which=lambda cmd: None)
    assert result["reachable"] is False
    assert result["path"] is None


def test_report_marks_missing_providers():
    results = [
        {"name": "hermes", "command": "hermes", "path": "/x/hermes", "reachable": True},
        {"name": "codex", "command": "codex", "path": None, "reachable": False},
    ]
    text = doctor_providers.report(results)
    assert "hermes" in text
    assert "MISSING" in text


def test_main_exits_nonzero_when_a_provider_is_missing():
    assert doctor_providers.main([], which=lambda cmd: None) == 1


def test_main_exits_zero_when_all_reachable():
    assert doctor_providers.main([], which=lambda cmd: "/usr/bin/" + cmd) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_doctor_providers.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'doctor_providers'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/doctor_providers.py`:

```python
"""Report which provider CLIs the swarm can actually reach.

Injecting `which` keeps this testable without depending on what happens to
be installed on the machine running the tests.
"""

from __future__ import annotations

import shutil
import sys

PROVIDER_COMMANDS: dict[str, str] = {
    "claude": "claude",
    "codex": "codex",
    "gemini": "gemini",
    "hermes": "hermes",
}


def probe(name: str, which=shutil.which) -> dict:
    """Resolve one provider's executable."""
    command = PROVIDER_COMMANDS[name]
    path = which(command)
    return {"name": name, "command": command, "path": path, "reachable": path is not None}


def report(results: list[dict]) -> str:
    """Human-readable reachability table."""
    lines = ["provider   status    path"]
    for r in results:
        status = "OK" if r["reachable"] else "MISSING"
        lines.append(f"{r['name']:<10} {status:<9} {r['path'] or '-'}")
    return "\n".join(lines)


def main(argv: list[str] | None = None, which=shutil.which) -> int:
    results = [probe(name, which=which) for name in PROVIDER_COMMANDS]
    print(report(results))
    missing = [r["name"] for r in results if not r["reachable"]]
    if missing:
        print(f"\n{len(missing)} provider(s) unreachable: {', '.join(missing)}")
        print("The swarm cannot delegate to a CLI it cannot resolve.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_doctor_providers.py -v`
Expected: PASS, 6 passed

- [ ] **Step 5: Run it for real and record the result**

Run: `cd "D:/vault/Microbit" && uv run python scripts/doctor_providers.py`
Expected: exit 0, with `claude`, `codex`, `gemini`, and `hermes` all reported OK.

If any provider reports MISSING, stop: either reinstall it or reassign its swarm roles before continuing. Note that reachability is not the same as usability — `gemini` resolves on PATH but fails at call time until auth is configured (Google login or `GEMINI_API_KEY`).

- [ ] **Step 6: Commit**

```bash
git add scripts/doctor_providers.py tests/test_doctor_providers.py
git commit -m "feat: provider CLI reachability doctor"
```

---

### Task 12: Vault stage scaffold and topology contract

Creates the ten stage folders and the machine-readable ownership map agents read to know what they may write.

**Files:**
- Create: `scripts/scaffold_vault.py`
- Create: `tests/test_scaffold_vault.py`
- Create: `00-contracts/topology.md` (generated by the script)

**Interfaces:**
- Consumes: `swarm.paths` (Task 2)
- Produces:
  - `STAGE_DIRS: tuple[str, ...]`
  - `scaffold(root: Path) -> list[Path]`
  - `TOPOLOGY: dict[str, dict]` — stage → `{owner, fanout, writes}`
  - `render_topology() -> str`

- [ ] **Step 1: Write the failing test**

Create `tests/test_scaffold_vault.py`:

```python
import scaffold_vault


def test_creates_all_ten_stage_dirs(tmp_path):
    created = scaffold_vault.scaffold(tmp_path)
    assert len(created) == len(scaffold_vault.STAGE_DIRS)
    for name in scaffold_vault.STAGE_DIRS:
        assert (tmp_path / name).is_dir()


def test_scaffold_is_idempotent(tmp_path):
    scaffold_vault.scaffold(tmp_path)
    scaffold_vault.scaffold(tmp_path)
    assert (tmp_path / "10-digest").is_dir()


def test_never_touches_read_only_source_trees():
    protected = {"Abdeen_Moon_OS_Docs", "Techno Square identity"}
    assert protected.isdisjoint(scaffold_vault.STAGE_DIRS)


def test_fanout_stages_declare_three_providers():
    assert len(scaffold_vault.TOPOLOGY["40-critique"]["fanout"]) == 3
    assert len(scaffold_vault.TOPOLOGY["30-research"]["fanout"]) == 3


def test_claude_never_competes_in_a_stage_it_judges():
    assert "claude" not in scaffold_vault.TOPOLOGY["30-research"]["fanout"]
    assert "claude" not in scaffold_vault.TOPOLOGY["40-critique"]["fanout"]
    assert scaffold_vault.TOPOLOGY["30-research"]["owner"] == "claude"


def test_localize_is_claude_only():
    assert scaffold_vault.TOPOLOGY["70-localized"]["fanout"] == ()
    assert scaffold_vault.TOPOLOGY["70-localized"]["owner"] == "claude"


def test_render_topology_lists_every_stage():
    text = scaffold_vault.render_topology()
    for name in scaffold_vault.STAGE_DIRS:
        assert name in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_scaffold_vault.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scaffold_vault'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/scaffold_vault.py`:

```python
"""Create the stage folders and write the machine-readable topology contract."""

from __future__ import annotations

import sys
from pathlib import Path

from swarm.paths import VAULT_ROOT

STAGE_DIRS: tuple[str, ...] = (
    "00-contracts",
    "10-digest",
    "20-provenance",
    "30-research",
    "40-critique",
    "50-patch",
    "55-refuted",
    "60-approved",
    "70-localized",
    "80-generation",
    "90-receipts",
)

TOPOLOGY: dict[str, dict] = {
    "00-contracts": {"owner": "claude", "fanout": (), "writes": "one file per contract"},
    "10-digest": {"owner": "script", "fanout": (), "writes": "one file per session"},
    "20-provenance": {"owner": "hermes", "fanout": (), "writes": "one file per session"},
    "30-research": {
        "owner": "claude",
        "fanout": ("hermes", "codex", "gemini"),
        "writes": "_lanes/<cluster>/<provider>.json, merged to <cluster>.md",
    },
    "40-critique": {
        "owner": "claude",
        "fanout": ("codex", "gemini", "hermes"),
        "writes": "<session>/<provider>.json",
    },
    "50-patch": {"owner": "claude", "fanout": (), "writes": "one file per session"},
    "55-refuted": {"owner": "claude", "fanout": (), "writes": "one file per session"},
    "60-approved": {"owner": "claude", "fanout": (), "writes": "one file per session"},
    "70-localized": {"owner": "claude", "fanout": (), "writes": "one file per session"},
    "80-generation": {"owner": "claude", "fanout": (), "writes": "prompts and rendered output"},
    "90-receipts": {"owner": "script", "fanout": (), "writes": "<session>.<gate>.yaml"},
}


def scaffold(root: Path) -> list[Path]:
    """Create every stage directory. Idempotent."""
    created = []
    for name in STAGE_DIRS:
        path = root / name
        path.mkdir(parents=True, exist_ok=True)
        created.append(path)
    return created


def render_topology() -> str:
    """Machine-readable ownership map for 00-contracts/topology.md."""
    lines = [
        "# Swarm Topology",
        "",
        "Generated by `scripts/scaffold_vault.py`. Do not hand-edit.",
        "",
        "One writer per file, never one writer per folder.",
        "",
        "| stage | owner | fan-out | writes |",
        "| --- | --- | --- | --- |",
    ]
    for name in STAGE_DIRS:
        t = TOPOLOGY[name]
        fanout = ", ".join(t["fanout"]) if t["fanout"] else "—"
        lines.append(f"| `{name}` | {t['owner']} | {fanout} | {t['writes']} |")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    root = VAULT_ROOT
    scaffold(root)
    (root / "00-contracts" / "topology.md").write_text(render_topology(), encoding="utf-8")
    print(f"scaffolded {len(STAGE_DIRS)} stage dirs under {root}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_scaffold_vault.py -v`
Expected: PASS, 7 passed

- [ ] **Step 5: Scaffold the real vault**

Run: `cd "D:/vault/Microbit" && uv run python scripts/scaffold_vault.py`
Expected: `scaffolded 11 stage dirs under D:\vault\Microbit`, and `00-contracts/topology.md` exists

- [ ] **Step 6: Commit**

```bash
git add scripts/scaffold_vault.py tests/test_scaffold_vault.py "00-contracts/topology.md"
git commit -m "feat: vault stage scaffold and topology ownership contract"
```

---

### Task 13: hermes-delegate skill

The one missing provider adapter. Mirrors the installed `gemini-delegate` shape: non-interactive, single-lane-file output, token receipt.

**Files:**
- Create: `.claude/skills/hermes-delegate/SKILL.md`
- Create: `tests/test_hermes_delegate_skill.py`

**Interfaces:**
- Consumes: `swarm.paths` (Task 2) for the lane-path convention documented in the skill
- Produces: a skill invocable as `hermes-delegate`, documenting the adapter contract every provider obeys

- [ ] **Step 1: Write the failing test**

The skill is a document, so the test asserts the contract it must state. Create `tests/test_hermes_delegate_skill.py`:

```python
from pathlib import Path

import pytest
import yaml

SKILL = Path("D:/vault/Microbit/.claude/skills/hermes-delegate/SKILL.md")


@pytest.fixture
def skill_text() -> str:
    return SKILL.read_text(encoding="utf-8")


def test_skill_file_exists():
    assert SKILL.is_file()


def test_has_valid_frontmatter(skill_text):
    assert skill_text.startswith("---\n")
    front = skill_text.split("---\n")[1]
    data = yaml.safe_load(front)
    assert data["name"] == "hermes-delegate"
    assert "description" in data


def test_documents_noninteractive_invocation(skill_text):
    assert "hermes -z" in skill_text


def test_documents_absolute_executable_path(skill_text):
    assert "AppData/Local/hermes" in skill_text.replace("\\", "/")


def test_forbids_moa_and_memory_graph_as_truth(skill_text):
    lowered = skill_text.lower()
    assert "moa" in lowered
    assert "memory-graph" in lowered


def test_states_single_lane_file_rule(skill_text):
    assert "one lane file" in skill_text.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_hermes_delegate_skill.py -v`
Expected: FAIL — `SKILL.md` does not exist

- [ ] **Step 3: Write minimal implementation**

Create `.claude/skills/hermes-delegate/SKILL.md`:

```markdown
---
name: hermes-delegate
description: Delegate a scoped, read-only research or analysis task to the locally installed Hermes agent CLI as a swarm worker, then collect its output from a single lane file. Use when the swarm assigns Hermes a provenance or research lane, or when the user asks to run something through Hermes. Do not use for tasks small enough to do inline, or for anything that writes learner-facing Arabic.
---

# hermes-delegate

Runs Hermes as one worker inside the Micro:bit course swarm.

## Executable

Hermes is not on PATH. Always invoke by absolute path:

```
C:/Users/ET/AppData/Local/hermes/hermes-agent/venv/Scripts/hermes
```

## Invocation

Non-interactive only. Never open the TUI.

```bash
"C:/Users/ET/AppData/Local/hermes/hermes-agent/venv/Scripts/hermes" \
  -z "<prompt>" \
  --skills master-instructional-design \
  -t web \
  --safe-mode
```

- `-z` — one-shot prompt, no interactive session
- `--skills` — load the shared pedagogy skill so Hermes judges by the same rules as every other lane
- `-t` — toolsets; Hermes owns the web-research lanes
- `--safe-mode` — Hermes is a research worker, not an editor

## Adapter contract

Every provider adapter in this swarm obeys the same three rules. Hermes is no exception.

1. **Read only what is declared.** The task's `reads_allowed` frontmatter is the complete read scope. Do not explore the vault.
2. **Write exactly one lane file.** Path is derived, never chosen:
   - research lane → `30-research/_lanes/<cluster>/hermes.json`
   - provenance → `20-provenance/<session-id>.md`
   One writer per file is what lets three providers run concurrently without locking.
3. **Emit a token receipt.** Report tokens consumed so `90-receipts/` stays accurate.

## Hard rules

- **Do not use `hermes moa`.** Mixture-of-Agents hides divergence inside a single call. Cross-provider divergence is the signal this project exists to produce; collapsing it into one opaque answer defeats the design.
- **Do not treat `hermes memory-graph` as truth.** The vault is the single source of truth. The memory graph is scratch within a run, never authoritative, and is never read by another provider.
- **Do not write Arabic.** All swarm stages operate in structured English. Localisation to 30/70 bilingual is a Claude-only stage (S5b).
- **Cite every claim.** Output feeding REFINE must carry a source URL or Brain OS rule reference. Uncited items are dropped by `cite_filter.py` before a judge ever sees them.

## Failure handling

If Hermes exits non-zero or produces no lane file, report the failure and stop. Do not retry more than twice. One dead lane out of three is tolerated by the swarm; do not silently substitute another provider.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_hermes_delegate_skill.py -v`
Expected: PASS, 6 passed

- [ ] **Step 5: Smoke-test the real CLI**

Run:

```bash
"C:/Users/ET/AppData/Local/hermes/hermes-agent/venv/Scripts/hermes" -z "Reply with exactly: SWARM_OK" --safe-mode
```

Expected: output contains `SWARM_OK`. If it prompts for auth or a model, resolve that before relying on Hermes in a lane.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/hermes-delegate/SKILL.md tests/test_hermes_delegate_skill.py
git commit -m "feat: hermes-delegate adapter skill"
```

---

### Task 14: EthOS v2 doctrine skeleton

Doctrine only. It answers "what is correct?" and never "what runs next?" — that split is what stops the full-pipeline successor becoming a second conductor competing with ruflo.

**Files:**
- Create: `.claude/skills/ethos-v2/SKILL.md`
- Create: `.claude/skills/ethos-v2/references/kids-track-rules.md`
- Create: `tests/test_ethos_v2_skill.py`

**Interfaces:**
- Consumes: gate names registered in Tasks 6–9
- Produces: a skill invocable as `ethos-v2` stating the verdict loop, the kids-track reversals, and the doctrine/mechanism split

- [ ] **Step 1: Write the failing test**

Create `tests/test_ethos_v2_skill.py`:

```python
from pathlib import Path

import pytest
import yaml

ROOT = Path("D:/vault/Microbit/.claude/skills/ethos-v2")
SKILL = ROOT / "SKILL.md"
KIDS = ROOT / "references/kids-track-rules.md"


@pytest.fixture
def skill_text() -> str:
    return SKILL.read_text(encoding="utf-8")


def test_skill_and_reference_exist():
    assert SKILL.is_file()
    assert KIDS.is_file()


def test_has_valid_frontmatter(skill_text):
    data = yaml.safe_load(skill_text.split("---\n")[1])
    assert data["name"] == "ethos-v2"


def test_states_doctrine_not_scheduling(skill_text):
    lowered = skill_text.lower()
    assert "never decides scheduling" in lowered


def test_declares_all_three_verdicts(skill_text):
    for verdict in ("PASS", "FAIL", "UNVERIFIED"):
        assert verdict in skill_text


def test_requires_acting_on_failure_same_turn(skill_text):
    assert "same turn" in skill_text.lower()


def test_names_every_registered_gate(skill_text):
    for gate in ("arabic-ratio", "cite-filter", "trainer-boundary", "brand-palette"):
        assert gate in skill_text


def test_kids_rules_reverse_adult_decisions():
    text = KIDS.read_text(encoding="utf-8")
    assert "one idea per slide" in text.lower()
    assert "#F5B301" in text


def test_documents_ocr_blind_spots(skill_text):
    lowered = skill_text.lower()
    assert "ocr" in lowered
    assert "arrow" in lowered
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_ethos_v2_skill.py -v`
Expected: FAIL — skill files do not exist

- [ ] **Step 3: Write minimal implementation**

Create `.claude/skills/ethos-v2/SKILL.md`:

```markdown
---
name: ethos-v2
description: EthOS v2 — the Micro:bit course vault's content-generation doctrine, successor to the AI course's EthOS. Governs what correct output is at every pipeline stage: quality gates, the QA verdict loop, brand and language law, and the kids-track rules. Invoke when producing, checking, or generating any course artifact in this vault. Does not schedule work — ruflo does that.
---

# EthOS v2

Successor to EthOS, rebuilt for the Techno Square Micro:bit course. Keeps what EthOS learned through real production failures; reverses the adult-audience decisions that are wrong for a kids track.

## Doctrine, not scheduling

EthOS v2 answers **"what is correct?"** — gates, rules, verdicts, brand and language law.
Ruflo answers **"what runs next?"** — spawning, parallelism, memory, handoffs.

**EthOS v2 never decides scheduling.** Ruflo never decides quality. Without this split, a full-pipeline doctrine becomes a second conductor and the two fight.

## Do not generate on invocation alone

Loading this skill does not mean "start generating." Produce output only when given an explicit target — a session ID, a file, or a named artifact. If invoked with no target, ask.

## Diagnose before produce

State what you are about to generate — which session, which source files, which output type — before calling any generator. This is EthOS's single most reusable habit, confirmed against live production evidence.

## The QA verdict loop

Detection is not the deliverable. A QA phase that reports without closing the loop is note-taking.

After running gates you must:

1. **State an explicit verdict per gate** — `PASS` / `FAIL` / `UNVERIFIED`. No prose hedging. A gate you could not run is `UNVERIFIED`, never silently omitted.
2. **Classify every FAIL by cause**, because the cause determines the fix:
   - *prompt/parameter* → regenerate now with the named change (max 3 retries)
   - *source-content* → the artifact cannot be better than its source; fix the upstream stage, then regenerate (max 2)
   - *external limit* → apply the known workaround (e.g. the ~21-slide NotebookLM cap → split and merge)
   - *needs judgment* → escalate
3. **Act in the same turn.** Do not batch defects for a later cleanup pass.

## Deterministic gates

Model opinion is never the final check on something mechanically checkable. Run via `scripts/swarm/gate_runner.py`:

| gate | catches |
| --- | --- |
| `arabic-ratio` | deviation from the literal 30% English / 70% Arabic rule |
| `cite-filter` | change proposals that cite no source |
| `trainer-boundary` | trainer-only content leaking into student-facing output |
| `brand-palette` | retired brand colors, notably `#F5B301` |

## Documented blind spots

Inherited honestly from EthOS. These are real limits, not caveats to wave at:

- **OCR cannot see a missing connector arrow.** N steps require exactly N-1 arrows, all pointing the same direction, right-to-left in Arabic decks. This slipped through a full QA pass once already.
- **OCR cannot see an unlabelled blank placeholder.** A blank box has no text to read.
- **OCR cannot see duplicated diagram nodes.** Visual duplication is outside what a text checker can reach.

Visual review remains mandatory. It is the only control covering this class of defect.

## Kids-track rules

See `references/kids-track-rules.md` for the full adult→kids reversal table.
```

Create `.claude/skills/ethos-v2/references/kids-track-rules.md`:

```markdown
# Kids-Track Rules

EthOS was adapted for an adult audience on the AI course. Techno Square's Micro:bit course is a kids STEM track, which reverses several of those decisions. Where this file and the adult EthOS disagree, this file wins.

## Reversals

| Dimension | EthOS (adult) | EthOS v2 (kids) |
| --- | --- | --- |
| Slide density | one concept plus 2–4 supporting points | **one idea per slide**, strict |
| Tata mascot | beat-markers only | **full 4-state usage**: Excited, Idea, Thinks, Approved — still never on every slide |
| Examples | calibrated to profession and tool familiarity | calibrated to age; concrete and physical |
| Visuals | real interface screenshots | colourful, child-friendly; icons, arrows, simple shapes |
| Arabic register | adult explanatory | simple, short, beginner-friendly, RTL-correct |
| Trainer guide | per session | **per level**, one PDF, produced by Gemini |
| Take-home | Parent Talk dropped | **Home Summary with Parent Talk restored** |

## Unchanged from EthOS

- **Language ratio:** literal 30% English / 70% Arabic. Put the ratio in every generation prompt, not just "include some Arabic."
- **Brand palette:** `#231F20` near-black, `#FFED10` yellow, `#585858` grey, white.
- **Retired and wrong:** `#F5B301` gold and `#1A1A1A` placeholder black. Anything generated with these is off-brand and fails `brand-palette`.
- **Tata is used to support learning, not as decoration**, and never on every slide.

## Home Summary format

Specified in Brain OS `Techno_Square_QA_Checklist.md`. Do not reinvent it. Required sections:

- Today I Learned
- New Words
- Review at Home
- Parent Talk
- Mini Activity

Three slides per session; session 7 is two slides. Twenty slides per level.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_ethos_v2_skill.py -v`
Expected: PASS, 8 passed

- [ ] **Step 5: Run the whole suite**

Run: `cd "D:/vault/Microbit" && uv run pytest -q`
Expected: PASS, 85 passed

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/ethos-v2 tests/test_ethos_v2_skill.py
git commit -m "feat: EthOS v2 doctrine skeleton with kids-track rules"
```

---

### Task 15: Digest the real source material

First end-to-end use of the infrastructure. Zero LLM tokens, and it de-risks every later stage by proving the source material extracts cleanly.

**Files:**
- Create: `scripts/run_digest.py`
- Create: `tests/test_run_digest.py`
- Writes: `10-digest/*.md`, `10-digest/_assets/*/`

**Interfaces:**
- Consumes: `swarm.digest_office` (Task 4), `swarm.paths` (Task 2), `swarm.envelope` (Task 3)
- Produces:
  - `SOURCE_MAP: dict[str, Path]` — session ID → source pptx
  - `render_digest(result, sid) -> str` — envelope plus markdown body
  - `main(argv) -> int`

- [ ] **Step 1: Write the failing test**

Create `tests/test_run_digest.py`:

```python
from swarm import envelope
from swarm.digest_office import DigestResult, Slide

import run_digest


def test_source_map_covers_the_eleven_existing_decks():
    assert len(run_digest.SOURCE_MAP) == 11


def test_source_map_keys_are_valid_session_ids():
    from swarm.paths import SESSION_IDS

    assert set(run_digest.SOURCE_MAP).issubset(set(SESSION_IDS))


def test_render_digest_produces_parseable_envelope():
    result = DigestResult(
        sid="L1-s1",
        slides=[Slide(1, "What is a micro:bit?", "A tiny computer.", "Ask first.")],
        images=[{"file": "img-01.png", "slide": 1, "ext": "png", "bytes": 70}],
    )
    text = render = run_digest.render_digest(result, "L1-s1")
    env, body = envelope.parse(text)

    assert env.id == "L1-s1"
    assert env.stage == "digest"
    assert env.owner == "script"
    assert "What is a micro:bit?" in body


def test_render_digest_includes_speaker_notes():
    result = DigestResult(
        sid="L1-s1", slides=[Slide(1, "T", "B", "Ask students to predict.")]
    )
    assert "Ask students to predict." in run_digest.render_digest(result, "L1-s1")


def test_render_digest_lists_images():
    result = DigestResult(
        sid="L1-s1",
        slides=[Slide(1, "T", "B", "")],
        images=[{"file": "img-01.png", "slide": 1, "ext": "png", "bytes": 70}],
    )
    assert "img-01.png" in run_digest.render_digest(result, "L1-s1")


def test_warnings_mark_status_gated():
    result = DigestResult(
        sid="L1-s1", slides=[Slide(1, "", "", "")], warnings=["slide 1 is empty"]
    )
    env, _ = envelope.parse(run_digest.render_digest(result, "L1-s1"))
    assert env.status == "gated"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_run_digest.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'run_digest'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/run_digest.py`:

```python
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


def render_digest(result: DigestResult, sid: str) -> str:
    """Build the digest document: envelope plus markdown body."""
    env = envelope.Envelope(
        id=sid,
        stage="digest",
        owner="script",
        status="gated" if result.warnings else "complete",
        inputs=(str(SOURCE_MAP.get(sid, "")),),
        reads_allowed=("00-contracts/**", f"10-digest/{sid}.*"),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/vault/Microbit" && uv run pytest tests/test_run_digest.py -v`
Expected: PASS, 6 passed

- [ ] **Step 5: Digest the real material**

Run: `cd "D:/vault/Microbit" && uv run python scripts/run_digest.py`
Expected: 11 lines reporting slide and image counts, then a total. Every count must be greater than zero — a deck reporting 0 slides means extraction failed, not that the deck is empty.

- [ ] **Step 6: Verify images actually landed**

Run: `cd "D:/vault/Microbit" && find 10-digest/_assets -type f -name "*.png" -o -name "*.jpeg" -o -name "*.jpg" | wc -l`
Expected: a count matching the total reported in Step 5. These are the images the owner explicitly wants reused — if this is 0, stop and diagnose before proceeding.

- [ ] **Step 7: Commit**

```bash
git add scripts/run_digest.py tests/test_run_digest.py 10-digest/
git commit -m "feat: digest 11 source decks with extracted images"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Covered by |
| --- | --- |
| §5 provider adapters | Task 11 (reachability), Task 13 (hermes-delegate) |
| §6.1 provenance-bound claims | Task 7 (cite_filter) |
| §6.3 deterministic gates | Tasks 5–10 |
| §6.4 documented blind spots | Task 14 (EthOS v2 states them) |
| §7.4 audit trail | Task 10 (receipts) |
| §8 vault contract | Task 12 (scaffold + topology) |
| §8.1 ownership rule | Task 2 (lane paths cannot collide), Task 12 (topology) |
| §8.2 handoff schema | Task 3 (envelope) |
| §9 S1 digest | Tasks 4, 15 |
| §11 EthOS v2 | Task 14 |
| §12 scripts table | Tasks 4, 6, 7, 8, 10 — `qc_deck.py` deferred with reason (see Scope) |

**Gaps deliberately left, each with a stated reason in Scope:** `qc_deck.py`, pipeline execution, EthOS v2 prose doctrine.

**Type consistency:** `GateResult(gate, verdict, detail, evidence)` is constructed identically in Tasks 5–10. `validate_session_id` is imported by `paths`, `envelope`, `digest_office`, and `gate_runner` with one signature. `DigestResult(sid, slides, images, warnings)` and `Slide(index, title, body, notes)` are used consistently in Tasks 4 and 15.

**Known correction folded into Task 8:** the initial test asserted `"Trainer note"` against a lowercase-stored marker; Step 3 of that task states the fix explicitly rather than leaving the implementer to discover the mismatch.

---

## Sequencing note

Tasks 1–3 are foundational and must run in order. Tasks 6–9 (the four gates) are mutually independent once Task 5 lands and can be executed in parallel by separate workers. Task 10 requires all four. Tasks 11–14 are independent of the gates and of each other. Task 15 requires Tasks 2, 3, and 4.

## Blocking dependency

**Resolved 2026-08-20.** `@openai/codex` and `@google/gemini-cli` were installed globally; `codex`, `gemini`, `claude`, and `hermes` all resolve. Antigravity ships only a GUI IDE (`Antigravity.exe`, `antigravity-ide.cmd`) with no headless agent CLI, so **Gemini takes its lane** — an independently developed provider, which preserves real cross-provider divergence.

Two verification facts for implementers:

- **Codex** requires a trusted git directory: `codex exec --skip-git-repo-check "<prompt>" < /dev/null`, run from the vault root. Verified returning output.
- **Gemini** requires auth before use: either `GEMINI_API_KEY` in the environment, or a Google login via the interactive TUI. **Not yet configured at time of writing** — Task 11 will report it reachable but it will fail at call time until the owner sets this up. Confirm before any stage delegates to Gemini.
