"""NotebookLM session executor — the eleven steps, as one command.

Restores the original EthOS operating shape: the operator supplies a target,
the vault supplies the procedure and the state. Recovered from
`Dr mahmoud AI course/.claude/skills/ethos/SKILL.md:192-232` and recorded in
`30-research/_lanes/ethos-generation-method/`.

Two things this deliberately does NOT do:

* It does not go through the notebooklm MCP wrapper. The MCP exposes no file
  upload, which is what stopped the first L1-s1 run. The library underneath it
  has `sources.add_file`, and image sources work. The MCP was the wrong surface,
  never a missing capability.
* It does not upload EVIDENCE-class assets. NotebookLM redraws image sources,
  and a redrawn screenshot of MakeCode code is plausible, wrong, and hard to
  spot. Evidence is reserved as a blank region and overlaid after export.

Run under the notebooklm venv for a real run:

    C:/Users/ET/mcp-servers/notebooklm-mcp/.venv/Scripts/python.exe
        scripts/swarm/generate_session.py L1-s1 --live

Dry run is the default and needs no venv, no network, and no quota.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import sys
import time
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from swarm import overlay as _overlay  # noqa: E402
from swarm import paths  # noqa: E402
from swarm import stage_gate  # noqa: E402
from swarm.asset_mapping import Asset, parse_asset_mapping  # noqa: E402
from swarm.gates import REGISTRY as GATE_REGISTRY, UNVERIFIED as GATE_UNVERIFIED  # noqa: E402

# Defaults for standalone/manual runs (`python generate_session.py L1-s1`).
# Studio's subprocess adapter (STEP 5) always passes --root explicitly.
# COURSE needs a real course.yaml to resolve (paths.COURSE is lazy — see
# paths.py) and this module must stay importable without one, so COURSE
# starts as None; main() always rebinds every name below via
# paths.for_root(root) — whether root came from --root or the standalone
# default — before build_plan()/write_receipt()/enforce_stage_chain() (the
# only readers of these six names) ever run.
VAULT = paths.VAULT_ROOT
COURSE = None
BRAND = VAULT / "Techno Square identity"

# The academy brand doctrine, owned by this vault. Abdeen no longer edits
# the originals (owner ruling 2026-08-30), so the war-room copy is the source
# and the external GPT_Behavior vault is archive. Resolved from the vault
# root, not an absolute path: renaming the vault must not break it.
BRAIN_OS = VAULT / "Abdeen_Moon_OS_Docs" / "Academy_Brain_OS"
BRANDING_RULE = BRAIN_OS / "Techno_Square_Branding_Rule.md"
TATA_GUIDE = BRAIN_OS / "Tata_Mascot_Usage Guide.md"

READY = 2  # SourceStatus.READY — generating against a processing source degrades silently


class HardStop(RuntimeError):
    """A gate refused. Never retried, never worked around."""


# --------------------------------------------------------------------------
# plan
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Upload:
    path: Path
    title: str

    def resolves(self) -> bool:
        return self.path.is_file()


@dataclass
class Pass:
    key: str  # deck-a | deck-b | summary
    notebook: str  # notebook title
    instructions: str
    uploads: list[Upload] = field(default_factory=list)
    evidence: list[Asset] = field(default_factory=list)


# --------------------------------------------------------------------------
# ASSET-MAPPING.md — the hard-stop gate, owned by codex
# --------------------------------------------------------------------------
# `Asset` and `parse_asset_mapping` live in `swarm.asset_mapping` (imported
# above) so `stage_gate.py` can run the real parser too, instead of a second,
# looser copy of the same rules.


APPROVAL_KINDS: frozenset[str] = frozenset(
    {"specialist_council", "owner_business", "physical_action_required"}
)

_GAP_RE = re.compile(r"^\s*GAP\s*[-‐-―]\s*(\S+)", re.M | re.I)
_LEGACY_GAP = "GAP - owner must decide"
# The legacy marker in every spelling that still means the same thing: any case,
# any dash, any spacing, indented or not. Matching one exact ASCII form let
# "Gap - owner must decide" and an en-dash variant ship as settled content.
_LEGACY_GAP_RE = re.compile(
    r"^\s*GAP\s*[-‐-―]\s*owner\s+must\s+decide", re.M | re.I
)


def _front_matter(path: Path, text: str) -> dict:
    """The YAML block delimited by the leading `---` fences, parsed as a mapping.

    Bounded deliberately. The previous version regex-scanned the whole document,
    so a `kind:` in unrelated prose could satisfy the approval gate.
    """
    import yaml

    if not text.startswith("---"):
        raise HardStop(f"{path} has no YAML front matter — cannot establish approval")
    end = text.find("\n---", 3)
    if end == -1:
        raise HardStop(f"{path} front matter is not closed by a '---' line")
    try:
        data = yaml.safe_load(text[3:end])
    except yaml.YAMLError as exc:
        raise HardStop(f"{path} front matter is not valid YAML: {exc}") from exc
    if not isinstance(data, dict):
        raise HardStop(f"{path} front matter is not a mapping")
    return data


def enforce_stage_chain(sid: str) -> None:
    """Refuse to generate a session that skipped a pipeline stage.

    Every other gate here asks whether this session's artifacts are GOOD. None
    asked whether the stages that produce them ever ran — which is how a whole
    course reached generation having never opened research or critique.
    """
    results = stage_gate.check(VAULT, sid, "generation")
    missing = [r for r in results if r["verdict"] == stage_gate.FAIL]
    if missing:
        raise HardStop(
            f"{sid} has not completed every prerequisite stage — "
            + "; ".join(f"{r['stage']}: {r['detail']}" for r in missing)
            + f". Complete the stage, or record a waiver (see 00-contracts/"
            f"pipeline-lessons.md §8). Doctrine version {stage_gate.DOCTRINE_VERSION}."
        )


def enforce_blueprint_gate(path: Path) -> None:
    """DEC-027, retyped: the content is settled before any quota is spent.

    The original gate demanded *owner* approval for everything, which routed
    agent-resolvable technical decisions to a pharmacist and contradicted the
    standing owner rule in `00-contracts/agent-memory.md`. The gate still refuses
    unsettled content — that part made 'start s1' feel effortless — but it now
    asks *who* was competent to settle it.

    `approval.kind` must be one of APPROVAL_KINDS:
      specialist_council       technical/content decisions (specialist + refuter + reviewer)
      owner_business           genuinely undecidable business judgment
      physical_action_required a literal physical act

    Unresolved gaps must name their routing the same way. The bare legacy marker
    is itself refused: it asserts the owner must decide without establishing that
    the decision is actually his.
    """
    if not path.is_file():
        raise HardStop(f"no blueprint at {path} — nothing has been approved yet")
    text = path.read_text(encoding="utf-8")

    front = _front_matter(path, text)

    # Exact match, not substring: "unapproved" and "not-approved" both CONTAIN
    # "approved", and both used to satisfy this gate.
    state = front.get("status")
    if not isinstance(state, str) or state.strip().strip("\"'").lower() != "approved":
        raise HardStop(f"blueprint status is {state!r} — it has not been approved")

    # Bounded to the approval mapping. A loose ^\s*kind: search matched the first
    # `kind:` anywhere in the document, so unrelated metadata could satisfy a
    # typed-approval gate that exists precisely to establish who approved it.
    approval = front.get("approval")
    if not isinstance(approval, dict):
        raise HardStop(
            "blueprint has no approval mapping — state who was competent to "
            f"approve it, one of {sorted(APPROVAL_KINDS)}"
        )
    kind = approval.get("kind")
    if isinstance(kind, str):
        kind = kind.strip().strip("\"'")
    if kind is None:
        raise HardStop(
            "blueprint has no approval.kind — state who was competent to approve it, "
            f"one of {sorted(APPROVAL_KINDS)}"
        )
    if kind not in APPROVAL_KINDS:
        raise HardStop(
            f"blueprint approval.kind is {kind!r} — expected one of {sorted(APPROVAL_KINDS)}"
        )

    if _LEGACY_GAP_RE.search(text):
        raise HardStop(
            f"blueprint uses the untyped marker {_LEGACY_GAP!r}. Route it: "
            "'GAP - specialist_council' for anything an agent can settle, "
            "'GAP - owner_business' or 'GAP - physical_action_required' only for "
            "the two things that genuinely reach the owner."
        )

    gaps = _GAP_RE.findall(text)
    if gaps:
        mistyped = sorted({g for g in gaps if g not in APPROVAL_KINDS})
        if mistyped:
            raise HardStop(
                f"blueprint has GAP markers with unknown routing: {mistyped} — "
                f"expected one of {sorted(APPROVAL_KINDS)}"
            )
        raise HardStop(
            f"blueprint still has {len(gaps)} unresolved gap(s): "
            + ", ".join(f"GAP - {g}" for g in sorted(gaps))
        )


_SLIDE_HEAD = re.compile(r"^#{1,3}\s*Slide\s+(\S+)", re.M)
_SLIDE_ASSET = re.compile(r"\*\*Asset:\*\*\s*`([^`]+)`")


def reconcile_slides(bundle: Path, assets: list[Asset]) -> None:
    """§5b: reconcile the slide list against assets that resolve ON DISK, before generating.

    Owner ruling, 2026-08-21: "just don't build it in the first place." NotebookLM
    quota is the scarce resource, so a pass that generates and *then* discovers a
    hole has already spent a slot. This check is local and free, and it runs before
    a single token is written.

    A slide may never enter the prompt carrying a reference to something that does
    not exist. When one does, the fix is one of three — redesign, substitute, or
    drop — and it is made here, not after the quota is gone.
    """
    source = bundle / "slides-source.md"
    if not source.is_file():
        raise HardStop(f"no slides-source.md at {source} — nothing to reconcile")
    text = source.read_text(encoding="utf-8")

    # aid as written in ASSET-MAPPING, and the same key with an image extension,
    # because slides cite the filename while the mapping cites the id.
    resolved: set[str] = set()
    for a in assets:
        if a.path.is_file():
            resolved.add(a.aid)
            resolved.add(a.path.name)
            resolved.add(a.path.stem)

    # walk slide by slide so the error names the slide, not just the file
    positions = [(m.start(), m.group(1)) for m in _SLIDE_HEAD.finditer(text)]
    bounds = positions + [(len(text), None)]

    holes: list[str] = []
    for i, (start, slide) in enumerate(positions):
        body = text[start : bounds[i + 1][0]]
        for ref in _SLIDE_ASSET.findall(body):
            key = ref.strip()
            if key in resolved or Path(key).stem in resolved:
                continue
            holes.append(f"slide {slide}: `{key}`")

    if holes:
        raise HardStop(
            "slide/asset reconciliation failed — "
            + "; ".join(holes)
            + ". Fix BEFORE generating, one of: redesign the slide so it does not "
            "need the asset, substitute an existing asset carrying the same meaning, "
            "or drop the slide and renumber. Do not generate and patch afterwards — "
            "that spends a quota slot on a deck with a known hole."
        )


def enforce_asset_gate(assets: list[Asset]) -> None:
    """DEC-030's hard stop: every row produced, every path on disk."""
    if not assets:
        raise HardStop("ASSET-MAPPING.md parsed to zero asset rows — refusing to guess")
    # Duplicate ids belong here, not only in _evidence_map: that check sees one
    # pass's evidence subset, so a duplicate among REFERENCE rows — or between two
    # passes — cleared preflight entirely and was resolved later by whichever row
    # happened to be last.
    seen: dict[str, Asset] = {}
    collisions: list[str] = []
    for a in assets:
        key = a.aid.strip().casefold()
        first = seen.get(key)
        if first is None:
            seen[key] = a
        else:
            collisions.append(
                f"{a.aid!r} on slides {first.slide} ({first.path.name}) and "
                f"{a.slide} ({a.path.name})"
            )

    unproduced = [a for a in assets if not a.produced]
    dangling = [a for a in assets if a.produced and not a.path.is_file()]
    unclassed = [a for a in assets if a.klass not in {"REFERENCE", "EVIDENCE"}]
    problems = []
    if collisions:
        problems.append(
            "duplicate asset id(s) — one id must mean one file: " + "; ".join(collisions)
        )
    if unproduced:
        problems.append(
            "not yet produced: " + ", ".join(f"{a.aid} [{a.status}]" for a in unproduced)
        )
    if dangling:
        problems.append("mapped but missing on disk: " + ", ".join(a.aid for a in dangling))
    if unclassed:
        problems.append(
            "unclassified (must be REFERENCE or EVIDENCE): "
            + ", ".join(f"{a.aid}={a.klass!r}" for a in unclassed)
        )
    if problems:
        raise HardStop("asset gate failed — " + "; ".join(problems))


# --------------------------------------------------------------------------
# instructions — lifted from the prompt file, never re-derived per run
# --------------------------------------------------------------------------

_SECTION = re.compile(r"^## (?P<head>.+?)\n(?P<body>.*?)(?=^## |\Z)", re.S | re.M)
_FIRST_FENCE = re.compile(r"```\n(?P<body>.*?)\n```", re.S)


def parse_prompts(text: str) -> dict[str, str]:
    """Return {deck-a, deck-b, summary} from 80-generation's prompt file.

    A heading's own body ends at the next '## ' heading, never mid-fence —
    otherwise a fence-less section (like "After generation") lets a naive
    fence search skip past it and steal the next heading's block.
    """
    out: dict[str, str] = {}
    for sec in _SECTION.finditer(text):
        head = sec.group("head").lower()
        fence = _FIRST_FENCE.search(sec.group("body"))
        if not fence:
            continue
        if "pass b" in head:
            key = "deck-b"
        elif "notebook b" in head:
            key = "summary"
        elif "notebook a" in head:
            key = "deck-a"
        else:
            continue
        out.setdefault(key, fence.group("body").strip())
    return out


def evidence_clause(evidence: list[Asset]) -> str:
    """The clause that stops NotebookLM inventing a screenshot.

    Not in the prompt file — it comes from the two-asset-class rule
    (`ethos/SKILL.md:371-415`), which the first run predated.
    """
    if not evidence:
        return ""
    rows = "\n".join(
        f"- slide {a.slide}: write exactly [Reserved Image Area: {a.aid}]"
        for a in evidence
    )
    return (
        "\n\nReserved image regions. These slides carry a real screenshot that is "
        "inserted after export:\n"
        f"{rows}\n"
        "On each of those slides, leave a single clean empty image area and write "
        "the marker line shown above as literal text, character for character, "
        "including the square brackets. Nothing else goes in that area. The "
        "marker is how the post-export step finds where to paste the real "
        "screenshot; without it the build fails. Do NOT draw, recreate, "
        "paraphrase, illustrate or imagine the code or the device. An invented "
        "screenshot is worse than an empty box, because it looks right and "
        "teaches something false."
    )


# --------------------------------------------------------------------------
# building the plan
# --------------------------------------------------------------------------


def _is_brand(p: Path) -> bool:
    name = p.name.lower()
    return "logo" in name or "tata" in name or BRAND in p.parents


def build_plan(sid: str, assets: list[Asset], prompts: dict[str, str]) -> list[Pass]:
    bundle = VAULT / "75-bundle" / sid
    # deck-b is optional: only sessions whose slide count exceeds NotebookLM's
    # single-pass cap need a second pass. A short deck (like a 15-
    # slides) has no "PASS B" section in the prompt file, and that is correct,
    # not a missing block.
    missing = [k for k in ("deck-a", "summary") if k not in prompts]
    if missing:
        raise HardStop(f"prompt file has no block for: {', '.join(missing)}")

    reference = [a for a in assets if a.klass == "REFERENCE"]
    evidence = [a for a in assets if a.klass == "EVIDENCE"]

    deck_title = f"{COURSE.name} {sid} — student deck"
    common = [
        Upload(bundle / "slides-source.md", "slides-source.md"),
        Upload(bundle / "decisions.md", "decisions.md"),
        Upload(BRANDING_RULE, "Techno_Square_Branding_Rule.md"),
        Upload(TATA_GUIDE, "Tata_Mascot_Usage_Guide.md"),
    ] + [Upload(a.path, a.path.name) for a in reference]

    # Bound by what the mapping says lands on a summary slide — not by whether the
    # filename looks like branding. img-05 is a summary reference and is not brand.
    summary_refs = [
        a for a in reference if "summary" in a.slide.lower() or _is_brand(a.path)
    ]
    summary = [
        Upload(bundle / "home-summary.md", "home-summary.md"),
        Upload(BRANDING_RULE, "Techno_Square_Branding_Rule.md"),
        Upload(TATA_GUIDE, "Tata_Mascot_Usage_Guide.md"),
    ] + [Upload(a.path, a.path.name) for a in summary_refs]

    plan = [
        Pass("deck-a", deck_title, prompts["deck-a"] + evidence_clause(evidence), common, evidence),
    ]
    if "deck-b" in prompts:
        plan.append(
            Pass("deck-b", deck_title, prompts["deck-b"] + evidence_clause(evidence), common, evidence)
        )
    plan.append(
        Pass(
            "summary",
            f"{COURSE.name} {sid} — student summary",
            prompts["summary"],
            summary,
            [],
        )
    )
    return plan


def preflight(plan: list[Pass]) -> list[str]:
    """Everything checkable without spending a single quota slot."""
    problems = []
    for ps in plan:
        for up in ps.uploads:
            if not up.resolves():
                problems.append(f"{ps.key}: upload does not resolve — {up.path}")
        if not ps.instructions.strip():
            problems.append(f"{ps.key}: empty instructions")
    return problems


# --------------------------------------------------------------------------
# the live run
# --------------------------------------------------------------------------


def _evidence_map(ps: Pass) -> dict[str, Path]:
    """asset id -> path, with ids canonicalised and collisions refused.

    Building this with a dict comprehension let the last duplicate id win
    silently, so two rows claiming the same id bound the wrong file with no
    warning. Ids are stripped and compared case-insensitively because
    `bug-1` and `Bug-1 ` are the same id to a human writing ASSET-MAPPING.md.
    """
    out: dict[str, Path] = {}
    seen: dict[str, str] = {}
    for a in ps.evidence:
        aid = a.aid.strip()
        key = aid.casefold()
        if key in seen:
            raise HardStop(
                f"{ps.key}: two evidence assets share the id {aid!r} "
                f"(also seen as {seen[key]!r}). One id, one image — resolve it in "
                "ASSET-MAPPING.md rather than letting one silently win."
            )
        seen[key] = aid
        out[aid] = a.path
    return out


def _composite(deck: Path, ps: Pass) -> None:
    """Overlay EVIDENCE onto the exported deck, then prove no region survived.

    Reserving a blank region is half the contract; this is the other half. The
    L1-s1 run shipped empty dashed boxes while the images sat on disk, and an
    empty box reads to the owner as a demand for content he cannot supply.

    Runs on the freshly downloaded deck AND on the skip path, because a deck
    downloaded by an earlier run predates this step and would otherwise be
    delivered unfilled.
    """
    assets = _evidence_map(ps)
    if _overlay.find_regions(deck):
        # Overlay into a scratch copy first, verify it, then atomically swap it
        # in. `overlay()`'s in-place `saveIncr()` on `deck` directly would leave
        # a crash mid-write (or a second, concurrently-resuming caller doing the
        # same) with a corrupted or half-overlaid production file that no rerun
        # can distinguish from "already composited".
        # The real extension stays LAST: overlay() dispatches its handler on the
        # suffix, so a scratch named "deck.pdf.compositing123" is an unsupported
        # format and this whole atomic-swap path raises instead of protecting.
        tmp = deck.with_name(f"{deck.stem}.compositing{os.getpid()}{deck.suffix}")
        import shutil

        try:
            shutil.copy2(deck, tmp)
            filled = _overlay.overlay(tmp, assets)
            _overlay.assert_filled(tmp, assets)
            tmp.replace(deck)
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
        print(f"  overlaid {len(filled)} region(s): {', '.join(filled)}")
    # `assets` is passed so the check verifies images are PRESENT, not merely
    # that markers are absent. A run interrupted between redaction and insertion
    # leaves a deck with neither, which the marker-only check called a pass.
    _overlay.assert_filled(deck, assets)


@dataclass(frozen=True)
class _TaskState:
    notebook_id: str
    task_id: str  # "" means a request is pending/in-flight, result not yet known


_CORRUPT = object()  # sentinel: file exists but is not a valid state record


def _encode_task_state(state: "_TaskState") -> str:
    return f"{state.notebook_id}\n{state.task_id}"


def _decode_task_state(text: str) -> "_TaskState | object":
    """Parse the sidecar's exact two-line format. Anything else is _CORRUPT."""
    lines = text.split("\n")
    if len(lines) != 2:
        return _CORRUPT
    notebook_id, task_id = lines
    if not notebook_id:
        return _CORRUPT
    return _TaskState(notebook_id=notebook_id, task_id=task_id)


def _load_task_state(path: Path) -> "_TaskState | None | object":
    """Read a pass's generation-lock sidecar. None = no lock, _CORRUPT = unreadable."""
    if not path.is_file():
        return None
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return _CORRUPT
    return _decode_task_state(text)


def _claim_task_lock(path: Path, nb_id: str, attempts: int = 5) -> "_TaskState | None | object":
    """Exclusively create the pending-marker sidecar to claim this pass.

    Returns None if this call won the race and the marker is now ours to fill
    in with a real task_id. Returns the pre-existing state (a _TaskState, or
    _CORRUPT) if someone else — a prior run, or a process that started at the
    same instant — already claimed it; O_CREAT|O_EXCL makes "check, then
    write" a single atomic step so two simultaneous callers cannot both see
    "no lock" and both proceed to generate_slide_deck.

    A losing FileExistsError followed by a read that finds nothing (the
    winner already finished and cleaned up its lock between our failed
    create and our read) must never be treated as "we won" — that would let
    a second caller regenerate right after a first caller's success. Retry
    the whole create-or-read transition instead; if the file keeps
    flickering in and out of existence this many times, something is
    actively racing and the caller should see a real, current state rather
    than silently winning a stale-seeming claim.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    for _ in range(attempts):
        try:
            with path.open("x", encoding="utf-8") as f:
                f.write(_encode_task_state(_TaskState(notebook_id=nb_id, task_id="")))
            return None
        except FileExistsError:
            state = _load_task_state(path)
            if state is not None:
                return state
            # the file existed a moment ago and is now gone — retry the claim
    raise HardStop(
        f"{path} kept appearing and disappearing across {attempts} attempts to "
        f"claim it — a concurrent run is actively finishing at the same "
        f"moment. Rerun once it settles."
    )


def _save_task_state(path: Path, state: _TaskState) -> None:
    """Overwrite an already-claimed sidecar atomically (crash mid-write leaves the old file intact)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.tmp{os.getpid()}")
    tmp.write_text(_encode_task_state(state), encoding="utf-8")
    tmp.replace(path)


@contextmanager
def _pass_execution_lock(out_dir: Path, key: str):
    """Exclusive lock spanning the entire decide/resume → download → composite →
    cleanup section for one pass.

    `_claim_task_lock` only makes the "no state yet, start a fresh generation"
    transition atomic. It does nothing to stop two callers who both find an
    EXISTING sidecar (one still holding a real, resumable task_id) from both
    entering the resume branch at once — both would download to the same PDF
    path and both would call `_composite` on it concurrently. This lock
    closes that gap by serializing the whole section for a given
    (out_dir, key), regardless of which state (fresh, resuming, recovering
    from a crashed composite) that section takes.

    A held lock surviving a killed process (no heartbeat/PID liveness check)
    is a real, accepted risk here — this codebase prefers a manual escape
    hatch (operator inspects the notebook, deletes the lock) over automatic
    lock-breaking, same as `.task_id`'s own corrupt/mismatch handling above.
    """
    path = out_dir / f"{key}.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = path.open("x", encoding="utf-8")
    except FileExistsError as exc:
        raise HardStop(
            f"{path} exists — another process is actively working this pass "
            f"right now (or crashed while holding it). Do not run a second "
            f"invocation concurrently; if you've confirmed nothing is running, "
            f"delete {path} manually and rerun."
        ) from exc
    try:
        fd.close()
        yield
    finally:
        path.unlink(missing_ok=True)


def _pass_fingerprint(ps: Pass) -> str:
    """SHA256 over exactly what this pass will send: instructions and upload bytes.

    Comparison doc §3.11: bind each generation attempt to a fingerprint of the
    rendered bundle, upload bytes, assets, and prompt version. `ps.uploads` and
    `ps.instructions` already ARE those inputs — `build_plan()` assembled them
    from the bundle, ASSET-MAPPING, and the prompt file — so no separate
    re-read of the bundle directory is needed here. Length-framed (not raw
    concatenation) so two different upload sets cannot collide onto the same
    digest, the same defect fixed in `stage_gate._current_stage_hash`.
    """
    digest = hashlib.sha256()
    instructions = ps.instructions.encode("utf-8")
    digest.update(len(instructions).to_bytes(8, "big"))
    digest.update(instructions)
    for up in sorted(ps.uploads, key=lambda u: u.title):
        title = up.title.encode("utf-8")
        content = up.path.read_bytes()
        digest.update(len(title).to_bytes(8, "big"))
        digest.update(title)
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()


def _manifest_path(out_dir: Path, key: str) -> Path:
    return out_dir / f"{key}.input-manifest"


def _check_input_freshness(out_dir: Path, ps: Pass) -> None:
    """Refuse to reuse or resume a pass whose bundle/prompt inputs have moved on.

    Comparison doc §3.11: on a mismatch, stop with a plain reason before
    spending quota — do not silently delete notebook sources, reset the task
    lock, or overwrite existing output.

    A pass with no manifest predates this check (STEP 9 §3.11, 2026-09-05).
    Matching `stage_gate.is_locked()`'s "doctrine does not run backwards", a
    pass that has done no work yet (no output, no in-flight task) is
    grandfathered by adopting its current fingerprint as the baseline — there
    is no prior state for it to have drifted from. A pass that already has
    output or an in-flight task and STILL has no manifest is a different,
    riskier case: silently adopting "whatever the inputs are right now" as
    its baseline would let a bundle edit made *while the task was pending*
    pass as "unchanged" — defeating the exact protection this check exists
    to add, for precisely the sessions most likely to be affected right at
    rollout. That case hard-stops instead and asks for a one-time explicit
    baseline, rather than silently trusting an unverifiable "now".

    Isolating a deliberately new attempt under its own notebook/output
    identity, once one is authorized, is explicitly future work (comparison
    doc §3.11) and is not done here.
    """
    path = _manifest_path(out_dir, ps.key)
    current = _pass_fingerprint(ps)
    if path.is_file():
        recorded = path.read_text(encoding="utf-8").strip()
        if recorded != current:
            raise HardStop(
                f"{ps.key}: bundle/prompt inputs changed since this pass's last attempt "
                f"(input manifest at {path} no longer matches). Stopping before spending "
                "quota. This does not delete notebook sources, reset the task lock, or "
                "touch existing output — inspect the change, then explicitly decide "
                "whether to start a new attempt."
            )
        return

    started = (out_dir / f"{ps.key}.pdf").is_file() or (out_dir / f"{ps.key}.task_id").is_file()
    if started:
        raise HardStop(
            f"{ps.key}: no input manifest exists yet, but this pass already has prior "
            f"work on disk (output and/or an in-flight task). It predates the §3.11 "
            f"freshness check, so its original inputs were never recorded and staleness "
            f"cannot be verified automatically. Stopping before spending quota. Confirm "
            f"the current bundle/prompt inputs are the ones this pass should use, then "
            f"record its baseline once by writing {current} to {path}."
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(current, encoding="utf-8")


@contextmanager
def _prepare_regeneration(out_dir: Path, ps: Pass):
    """Last-resort content-quality regeneration's pre-flight (STEP 11 Phase B, Batch 2):
    quarantine the rejected `<key>.pdf` so `_run_pass` starts a genuinely fresh attempt
    for exactly this one pass, never all three.

    docs/tickets/handoffs/step11-nblm-prompt-authoring.md, "The new integration point":
    this operation must (1) preserve/quarantine the rejected artifact — never delete it,
    (2) prove no NotebookLM task is still in flight for this pass, and (3) let a fresh
    real task get created for only this pass. `_run_pass` already owns every bit of that
    task-lifecycle logic (`.lock` for concurrent-caller exclusion, `.task_id` for
    resumable-vs-fresh, §3.11 freshness manifest) — this function does not reimplement
    any of it. The context retains that same pass lock through the caller's fresh run,
    preventing another ordinary or regeneration invocation from entering after quarantine.
    """
    key = ps.key
    with _pass_execution_lock(out_dir, key):
        task_id_path = out_dir / f"{key}.task_id"
        if task_id_path.is_file():
            raise HardStop(
                f"{key}: {task_id_path} exists — a NotebookLM task may still be in flight or "
                "crash-resumable for this pass. Regeneration must prove nothing is in flight "
                "before firing a new task; a plain rerun (without --regenerate-pass) will "
                "resume or report that task's real status instead of duplicating it."
            )

        done = out_dir / f"{key}.pdf"
        if not done.is_file():
            raise HardStop(
                f"{key}: no existing {done} to regenerate — this is a last-resort operation "
                "for a pass that already produced a rejected artifact, not a way to run the "
                "first attempt. Run without --regenerate-pass for that."
            )

        # Check while the rejected PDF still proves prior work exists. Moving it
        # first would let a legacy pass with no manifest look unstarted and silently
        # adopt today's inputs as its unverifiable historical baseline.
        _check_input_freshness(out_dir, ps)

        quarantine_dir = out_dir / ".quarantine"
        quarantine_dir.mkdir(parents=True, exist_ok=True)
        timestamp = int(time.time())
        quarantined = quarantine_dir / f"{key}-{timestamp}.pdf"
        suffix = 1
        while quarantined.exists():
            quarantined = quarantine_dir / f"{key}-{timestamp}-{suffix}.pdf"
            suffix += 1
        shutil.move(str(done), str(quarantined))
        try:
            yield quarantined
        except BaseException:
            # If no task was ever claimed, the fresh attempt never became remotely
            # observable. Restore the rejected artifact so a readiness/preflight
            # refusal does not strand it in quarantine and make retries impossible.
            if not task_id_path.exists() and not done.exists() and quarantined.exists():
                shutil.move(str(quarantined), str(done))
            raise


async def _run_pass(
    client, ps: Pass, out_dir: Path, notebooks: dict[str, str], *, pass_lock_held: bool = False
) -> dict:
    from notebooklm import SlideDeckFormat

    nb_id = notebooks.get(ps.notebook)
    if nb_id is None:  # step 1-2: reuse before create, never spawn duplicates
        existing = {nb.title: nb.id for nb in await client.notebooks.list()}
        nb_id = existing.get(ps.notebook)
        if nb_id is None:
            nb_id = (await client.notebooks.create(ps.notebook)).id
            print(f"  created notebook {ps.notebook!r} -> {nb_id}")
        else:
            print(f"  reusing notebook {ps.notebook!r} -> {nb_id}")
        notebooks[ps.notebook] = nb_id
        # step 3: sources go up once per notebook, not once per pass
        have = {s.title for s in await client.sources.list(nb_id)}
        for up in ps.uploads:
            if up.title in have:
                continue
            await client.sources.add_file(nb_id, up.path, wait=True, title=up.title)
            print(f"    + {up.title}")

    # step 4: nothing generates until every source is READY
    srcs = await client.sources.list(nb_id)
    not_ready = [s.title for s in srcs if int(getattr(s.status, "value", s.status)) != READY]
    if not_ready:
        raise HardStop(f"sources not READY: {', '.join(not_ready)}")

    lock_scope = nullcontext() if pass_lock_held else _pass_execution_lock(out_dir, ps.key)
    with lock_scope:
        # §3.11 freshness gate: refuse a stale skip/resume/fresh-start before any
        # of the three branches below act on this pass's disk state.
        _check_input_freshness(out_dir, ps)

        # A finished pass is never regenerated. Quota is daily and small; a rerun
        # after one pass of three failed must not spend a slot on work already done.
        done = out_dir / f"{ps.key}.pdf"
        # A prior run's task is resumed here, never re-requested. Without this,
        # any ArtifactNotReadyError/timeout on download made the caller's only
        # recovery path a full rerun, which — because `done` above is still
        # missing — called generate_slide_deck again and fired a second,
        # unwanted deck generation on top of the first one still rendering.
        task_id_file = out_dir / f"{ps.key}.task_id"

        if done.is_file() and not task_id_file.is_file():
            # A PDF on disk with NO surviving sidecar means a prior run finished
            # end-to-end (download + compositing) and cleaned up after itself —
            # genuinely done. A PDF on disk WITH a surviving sidecar instead means
            # a prior attempt crashed mid-compositing (see below): that PDF may be
            # partial or corrupt, so it must NOT be trusted here — fall through to
            # the resume path instead, which re-downloads a known-good copy before
            # compositing again.
            print(f"  {ps.key} already downloaded at {done} — skipping generation")
            _composite(done, ps)
            return {"pass": ps.key, "notebook_id": nb_id, "task_id": None, "output": str(done)}

        # Exclusive create, not load-then-save: two processes racing to start this
        # pass at the same instant must not both observe "no lock" and both call
        # generate_slide_deck. Only the loser of the O_CREAT|O_EXCL race gets a
        # non-None state back here.
        state = _claim_task_lock(task_id_file, nb_id)

        if state is _CORRUPT:
            raise HardStop(
                f"{task_id_file} is empty or unreadable. A prior generation may be "
                f"in flight or may have crashed before recording its task_id — do "
                f"NOT delete this file blindly. Inspect notebook {nb_id!r} in "
                f"NotebookLM for a pending/in-progress {ps.key} artifact first; "
                f"only delete the file to force a fresh generation once you've "
                f"confirmed none is running."
            )
        if state is not None and state.notebook_id != nb_id:
            raise HardStop(
                f"{task_id_file} records notebook_id {state.notebook_id!r} but this "
                f"run resolved notebook {nb_id!r} for {ps.notebook!r} — the notebook "
                f"was likely deleted and recreated under the same title. Resuming "
                f"this task_id against the new notebook cannot succeed. Inspect "
                f"both notebooks manually, then delete {task_id_file} to regenerate."
            )
        if state is not None and not state.task_id:
            raise HardStop(
                f"{task_id_file} exists but has no task_id recorded — generation "
                f"was requested but this process (or a concurrent one) never "
                f"recorded the result, possibly still in flight. Inspect notebook "
                f"{nb_id!r} in NotebookLM manually before deleting {task_id_file} "
                f"to retry; do not let this rerun call generate_slide_deck again "
                f"while that ambiguity is unresolved."
            )

        if state is None and done.is_file():
            # We won the claim, but a concurrent run finished (downloaded the PDF
            # and deleted its own lock) in the gap between our `done.is_file()`
            # check above and this claim succeeding. Release the now-pointless
            # lock we just created and take the already-done path instead of
            # generating a second time.
            task_id_file.unlink(missing_ok=True)
            print(f"  {ps.key} already downloaded at {done} — skipping generation")
            _composite(done, ps)
            return {"pass": ps.key, "notebook_id": nb_id, "task_id": None, "output": str(done)}

        if state is None:
            # _claim_task_lock already wrote the pending marker (no task_id yet)
            # via an exclusive create, so any other invocation racing this one
            # gets a non-None state above and hard-stops instead of also calling
            # generate_slide_deck for the same pass.
            # step 5-6
            status = await client.artifacts.generate_slide_deck(
                nb_id,
                instructions=ps.instructions,
                slide_format=SlideDeckFormat.DETAILED_DECK,
                language="ar",
            )
            task_id = getattr(status, "task_id", None)
            if not task_id:
                # an empty success, not an empty error — the daily-quota signature
                raise HardStop(
                    "generate_slide_deck returned an empty task_id. This is NotebookLM's "
                    "daily quota exhaustion signature, not short-term rate limiting. Stop "
                    "and wait for the reset; retrying only burns time."
                )
            _save_task_state(task_id_file, _TaskState(notebook_id=nb_id, task_id=task_id))
        else:
            task_id = state.task_id
            print(f"  resuming pending {ps.key} task {task_id} — not re-firing generation")

        out = out_dir / f"{ps.key}.pdf"
        gen_status = None
        try:
            gen_status = await client.artifacts.wait_for_completion(nb_id, task_id, initial_interval=15)
        except TimeoutError:
            # A client-side give-up is not a server-side failure; the deck is often
            # already finished. Only a timeout means this — every other exception is
            # a real defect and must not be disguised as a download attempt.
            print("  wait timed out; the deck may already be done — trying download")

        if gen_status is not None and (gen_status.is_failed or gen_status.is_removed or gen_status.is_not_found):
            # ArtifactNotReadyError below is raised for every non-completed selection
            # (pending, in-progress, failed, removed, missing) — it does not by itself
            # distinguish "still rendering" from "permanently dead". Only wait_for_
            # completion's own returned status tells them apart, so that check must
            # happen before treating a download failure as transient.
            raise HardStop(
                f"{ps.key} task {task_id} ended in terminal status "
                f"{gen_status.status!r} ({gen_status.error or 'no error detail'}). "
                f"This will never become ready — rerunning will not help. Inspect "
                f"notebook {nb_id!r} manually, then delete {task_id_file} to "
                f"regenerate intentionally."
            )

        from notebooklm.exceptions import ArtifactNotReadyError

        try:
            await client.artifacts.download_slide_deck(nb_id, out, artifact_id=task_id)
        except ArtifactNotReadyError:
            # Not ready yet is not a failure to recover from by regenerating — the
            # sidecar file above keeps this exact task_id resumable on the next
            # invocation instead of spending another quota slot on a duplicate.
            print(f"  {ps.key} artifact {task_id} not ready yet — rerun to resume, not regenerate")
            raise HardStop(f"{ps.key} artifact {task_id} not ready yet; rerun to resume")
        print(f"  downloaded {out}")
        # The sidecar is the recovery record for "generation was requested but
        # the pass isn't done yet" — it must stay in place until the pass is
        # actually done, including compositing. Deleting it before _composite
        # succeeds would let a crash mid-composite look like "no lock, safe to
        # regenerate" on the next run, even though the download itself worked.
        _composite(out, ps)
        task_id_file.unlink(missing_ok=True)
        return {"pass": ps.key, "notebook_id": nb_id, "task_id": task_id, "output": str(out)}


async def run_live(sid: str, plan: list[Pass], *, prelocked_pass: str | None = None) -> dict:
    from notebooklm import NotebookLMClient

    out_dir = VAULT / "80-generation" / sid
    out_dir.mkdir(parents=True, exist_ok=True)
    # `from_storage()` returns a context manager, not a client. Awaiting it
    # directly yields an object whose every call dies with "Client not
    # initialized" — confirmed live, 2026-08-20.
    async with NotebookLMClient.from_storage() as client:
        lang = await client.settings.get_output_language()
        if lang != "ar":  # step 0
            raise HardStop(f"account output language is {lang!r}, must be 'ar'")
        notebooks: dict[str, str] = {}
        results = []
        for ps in plan:
            print(f"[{ps.key}]")
            results.append(
                await _run_pass(client, ps, out_dir, notebooks, pass_lock_held=ps.key == prelocked_pass)
            )
        return {"session": sid, "passes": results}


# --------------------------------------------------------------------------
# receipt
# --------------------------------------------------------------------------


_SID_LEVEL_RE = re.compile(r"^L(\d+)-s\d+$")


def pedagogy_summary(sid: str, vault: Path) -> dict:
    """Real pedagogy_coverage gate output for sid's level — for the job's

    transformation summary (DEC-005), never a guess. UNVERIFIED with a plain
    reason if the level's pedagogy record doesn't exist yet; the gate is not
    re-implemented here, `gates.REGISTRY["pedagogy-coverage"]` is called
    directly so this can never drift from the real check in pedagogy.md.
    """
    match = _SID_LEVEL_RE.match(sid)
    if not match:
        return {"gate": "pedagogy-coverage", "verdict": GATE_UNVERIFIED, "detail": f"could not parse level from session id {sid!r}"}

    record_path = vault / "30-research" / f"{match.group(1)}-pedagogy.yaml"
    if not record_path.is_file():
        return {
            "gate": "pedagogy-coverage",
            "verdict": GATE_UNVERIFIED,
            "detail": f"no pedagogy record at {record_path}",
        }

    result = GATE_REGISTRY["pedagogy-coverage"](record_path.read_text(encoding="utf-8"))
    return {"gate": result.gate, "verdict": result.verdict, "detail": result.detail, "evidence": result.evidence}


def write_receipt(sid: str, payload: dict) -> Path:
    import yaml

    out = VAULT / "90-receipts" / f"{sid}.production.yaml"
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(payload)
    payload["visual_review"] = "PENDING — OCR-blind, a human must open the PDF"
    payload["overall"] = "UNVERIFIED"
    out.write_text(yaml.safe_dump(payload, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return out


# --------------------------------------------------------------------------
# self-check
# --------------------------------------------------------------------------

_DEMO_MAP = """
| ID | Slide | Path | Class | Production status |
| --- | --- | --- | --- | --- |
| `logo` | all | `Techno Square identity/PNG/white logo.png` | REFERENCE | Produced and mapped |
| `img-20-bug1` | 17 | `75-bundle/L1-s1/assets/_demo-fixture-never-exists.png` | EVIDENCE | Needs owner review |
"""

_DEMO_PROMPTS = """
## Notebook A — Student Slide Deck
```
pass A body
```
## Notebook B — Summary
```
summary body
```
## Notebook A — PASS B
```
pass B body
```
"""


def _demo_prepare_regeneration() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)
        ps = Pass(key="deck-a", notebook="demo", instructions="same historical inputs")

        try:
            with _prepare_regeneration(out_dir, ps):
                raise AssertionError("unreachable")
            raise AssertionError("expected HardStop when there is no existing pdf to regenerate")
        except HardStop:
            pass

        pdf = out_dir / "deck-a.pdf"
        pdf.write_bytes(b"%PDF-1.4 fake")

        lock = out_dir / "deck-a.lock"
        lock.write_text("", encoding="utf-8")
        try:
            with _prepare_regeneration(out_dir, ps):
                raise AssertionError("unreachable")
            raise AssertionError("expected HardStop while another process holds the pass lock")
        except HardStop:
            pass
        assert pdf.is_file(), "a refused regeneration must never touch the existing artifact"
        lock.unlink()

        task_id_file = out_dir / "deck-a.task_id"
        task_id_file.write_text("nb-1\ntask-9", encoding="utf-8")
        try:
            with _prepare_regeneration(out_dir, ps):
                raise AssertionError("unreachable")
            raise AssertionError("expected HardStop while a task_id sidecar survives")
        except HardStop:
            pass
        assert pdf.is_file(), "a refused regeneration must never touch the existing artifact"
        task_id_file.unlink()

        original_bytes = pdf.read_bytes()
        manifest = out_dir / "deck-a.input-manifest"
        manifest.write_text(_pass_fingerprint(ps), encoding="utf-8")
        with _prepare_regeneration(out_dir, ps) as quarantined:
            assert (out_dir / "deck-a.lock").is_file(), (
                "the pass lock must cover quarantine through the fresh generation attempt"
            )
            assert not pdf.is_file(), "the quarantined pass must be cleared so _run_pass fires fresh"
            assert quarantined.parent == out_dir / ".quarantine"
            assert quarantined.read_bytes() == original_bytes, (
                "quarantine must preserve the rejected artifact byte-for-byte, never delete it"
            )
        assert not (out_dir / "deck-a.lock").exists(), "the pass lock must be released afterward"

        pdf.write_bytes(original_bytes)
        try:
            with _prepare_regeneration(out_dir, ps):
                raise HardStop("source readiness changed before a task was claimed")
        except HardStop:
            pass
        assert pdf.read_bytes() == original_bytes, (
            "a failed attempt that never claimed a task must restore the rejected artifact"
        )

        manifest.unlink(missing_ok=True)
        try:
            with _prepare_regeneration(out_dir, ps):
                raise AssertionError("unreachable")
            raise AssertionError("expected HardStop for prior work with no freshness manifest")
        except HardStop:
            pass
        assert pdf.read_bytes() == original_bytes
        assert not manifest.exists(), "regeneration must not silently baseline unverifiable prior work"


def _demo() -> None:
    assets = parse_asset_mapping(_DEMO_MAP)
    assert len(assets) == 2, assets
    assert assets[0].klass == "REFERENCE" and assets[0].produced
    assert assets[1].aid == "img-20-bug1" and not assets[1].produced
    assert assets[0].path.is_absolute()

    # the blueprint gate refuses anything short of a clean, correctly-typed approval
    import tempfile

    _OK = "---\nstatus: approved\napproval:\n  kind: specialist_council\n---\n"

    with tempfile.TemporaryDirectory() as td:
        bp = Path(td) / "blueprint.md"
        for body, why in (
            ("---\nstatus: draft-awaiting-owner-approval\n---\n", "draft"),
            ("---\ntype: blueprint\n---\n", "no status field"),
            ("---\nstatus: approved\n---\n", "approved with no approval.kind"),
            (
                "---\nstatus: approved\napproval:\n  kind: vibes\n---\n",
                "unknown approval kind",
            ),
            (_OK + "GAP - owner must decide\n", "untyped legacy owner gap"),
            (_OK + "GAP - somebody\n", "gap with unknown routing"),
            (_OK + "GAP - specialist_council\n", "open typed gap"),
        ):
            bp.write_text(body, encoding="utf-8")
            try:
                enforce_blueprint_gate(bp)
            except HardStop:
                pass
            else:  # pragma: no cover
                raise AssertionError(f"blueprint gate let {why} through")

        # the legacy marker is refused by name, so the message tells the author where to route it
        bp.write_text(_OK + "GAP - owner must decide\n", encoding="utf-8")
        try:
            enforce_blueprint_gate(bp)
        except HardStop as exc:
            assert "specialist_council" in str(exc), exc

        # all three routings are accepted as approval kinds
        for kind in sorted(APPROVAL_KINDS):
            bp.write_text(
                f"---\nstatus: approved\napproval:\n  kind: {kind}\n---\nall settled\n",
                encoding="utf-8",
            )
            enforce_blueprint_gate(bp)

    # a row that is not yet produced must stop the run, not warn
    try:
        enforce_asset_gate(assets)
    except HardStop as exc:
        assert "not yet produced" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("unproduced asset did not hard-stop")

    assets[1].status = "Produced and mapped"
    try:
        enforce_asset_gate(assets)
    except HardStop as exc:
        assert "missing on disk" in str(exc), exc
    else:  # pragma: no cover
        raise AssertionError("dangling path did not hard-stop")

    # §5b: a slide citing an asset that is not on disk stops the run before any quota
    with tempfile.TemporaryDirectory() as td:
        b = Path(td)
        (b / "assets").mkdir()
        (b / "assets" / "img-01.png").write_bytes(b"x")
        (b / "slides-source.md").write_text(
            "## Slide 3 — fine\n- **Asset:** `img-01.png`\n\n"
            "## Slide 7 — hole\n- **Asset:** `img-99.png`\n",
            encoding="utf-8",
        )
        present = Asset("img-01", "3", b / "assets" / "img-01.png", "REFERENCE", "Produced and mapped")
        try:
            reconcile_slides(b, [present])
        except HardStop as exc:
            assert "slide 7" in str(exc) and "img-99.png" in str(exc), exc
            assert "redesign" in str(exc) and "substitute" in str(exc) and "drop" in str(exc), exc
        else:  # pragma: no cover
            raise AssertionError("reconciliation let a missing slide asset through")

        # drop the offending slide and it reconciles
        (b / "slides-source.md").write_text(
            "## Slide 3 — fine\n- **Asset:** `img-01.png`\n", encoding="utf-8"
        )
        reconcile_slides(b, [present])

    p = parse_prompts(_DEMO_PROMPTS)
    assert p == {"deck-a": "pass A body", "summary": "summary body", "deck-b": "pass B body"}, p

    clause = evidence_clause([assets[1]])
    assert "slide 17" in clause and "Do NOT draw" in clause
    assert evidence_clause([]) == ""

    # generation-lock sidecar: no file, exclusive claim, resumable, corrupt, mismatch
    with tempfile.TemporaryDirectory() as td:
        f = Path(td) / "deck-a.task_id"
        assert _load_task_state(f) is None

        # first claim wins and leaves a pending marker
        assert _claim_task_lock(f, "nb-1") is None
        state = _load_task_state(f)
        assert state == _TaskState(notebook_id="nb-1", task_id="")

        # a second, simultaneous claim attempt loses the O_CREAT|O_EXCL race
        # and gets the winner's state back instead of also proceeding
        lost = _claim_task_lock(f, "nb-1")
        assert lost == _TaskState(notebook_id="nb-1", task_id="")

        # the winner fills in the real task_id once generation is accepted
        _save_task_state(f, _TaskState(notebook_id="nb-1", task_id="task-9"))
        state = _load_task_state(f)
        assert state == _TaskState(notebook_id="nb-1", task_id="task-9")
        assert state.notebook_id == "nb-1"  # mismatch check compares against a different nb_id by the caller

        f.write_text("", encoding="utf-8")
        assert _load_task_state(f) is _CORRUPT

        f.write_text("garbage-no-newline", encoding="utf-8")
        assert _load_task_state(f) is _CORRUPT

        # a third line (embedded newline in task_id, or trailing junk) must not
        # silently parse into a usable, resumable task_id
        f.write_text("nb-1\ntask-9\nJUNK", encoding="utf-8")
        assert _load_task_state(f) is _CORRUPT

        f.write_text("nb-1\n\nJUNK", encoding="utf-8")
        assert _load_task_state(f) is _CORRUPT

        f.unlink()

    asyncio.run(_demo_run_pass())
    _demo_prepare_regeneration()
    print("self-check OK")


class _FakeSourceStatus:
    value = READY


class _FakeSource:
    def __init__(self, title: str) -> None:
        self.title = title
        self.status = _FakeSourceStatus()


class _FakeSources:
    async def list(self, nb_id: str) -> list[_FakeSource]:
        return [_FakeSource("slides-source.md")]

    async def add_file(self, nb_id: str, path, wait: bool = True, title: str = "") -> None:  # pragma: no cover
        raise AssertionError("uploads must not run when a notebook_id is already known")


class _FakeArtifacts:
    """Records calls so a test can assert generate_slide_deck fired at most once."""

    def __init__(self, gen_status=None, download_error: Exception | None = None) -> None:
        self.generate_calls = 0
        self.download_calls = 0
        self.gen_status = gen_status
        self.download_error = download_error

    async def generate_slide_deck(self, nb_id, instructions, slide_format, language):  # noqa: D401
        self.generate_calls += 1

        class _Status:
            task_id = "fresh-task-id"

        return _Status()

    async def wait_for_completion(self, nb_id, task_id, initial_interval=15):
        if self.gen_status is not None:
            return self.gen_status
        raise TimeoutError("client gave up")

    async def download_slide_deck(self, nb_id, out, artifact_id):
        self.download_calls += 1
        if self.download_error is not None:
            raise self.download_error
        import fitz  # _composite() opens the downloaded file as a real PDF

        doc = fitz.open()
        doc.new_page()
        doc.save(out)
        doc.close()


class _FakeClient:
    def __init__(self, artifacts: _FakeArtifacts) -> None:
        self.sources = _FakeSources()
        self.artifacts = artifacts


async def _demo_run_pass() -> None:
    import tempfile

    from notebooklm.exceptions import ArtifactNotReadyError

    ps = Pass(key="deck-a", notebook="nb-title", instructions="do it")

    def _seed_manifest(out_dir: Path) -> None:
        """Scenarios below pre-seed a task_id/pdf to model a pass already mid-flight
        UNDER §3.11 doctrine, not a legacy pre-doctrine pass — so they need a matching
        baseline manifest, same as a real in-doctrine pass would already have. The
        legacy no-manifest case has its own dedicated scenario (8b)."""
        _manifest_path(out_dir, ps.key).write_text(_pass_fingerprint(ps), encoding="utf-8")

    # 1. an existing sidecar with a real task_id resumes instead of regenerating
    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)
        _seed_manifest(out_dir)
        _save_task_state(out_dir / "deck-a.task_id", _TaskState(notebook_id="nb-1", task_id="old-task"))
        art = _FakeArtifacts(download_error=ArtifactNotReadyError("slide_deck", artifact_id="old-task"))
        client = _FakeClient(art)
        try:
            await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
        except HardStop as exc:
            assert "old-task" in str(exc) and "rerun to resume" in str(exc), exc
        else:  # pragma: no cover
            raise AssertionError("not-ready download did not hard-stop")
        assert art.generate_calls == 0, "resumed task must not call generate_slide_deck again"
        assert (out_dir / "deck-a.task_id").is_file(), "sidecar must survive a not-ready hard-stop"

    # 2. sidecar recorded a different notebook_id than the one this run resolved
    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)
        _seed_manifest(out_dir)
        _save_task_state(out_dir / "deck-a.task_id", _TaskState(notebook_id="nb-OLD", task_id="stale-task"))
        art = _FakeArtifacts()
        client = _FakeClient(art)
        try:
            await _run_pass(client, ps, out_dir, {"nb-title": "nb-NEW"})
        except HardStop as exc:
            assert "nb-OLD" in str(exc) and "nb-NEW" in str(exc), exc
        else:  # pragma: no cover
            raise AssertionError("notebook mismatch did not hard-stop")
        assert art.generate_calls == 0

    # 3. a corrupt sidecar must not be silently treated as resumable or regenerated over
    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)
        _seed_manifest(out_dir)
        (out_dir / "deck-a.task_id").write_text("", encoding="utf-8")
        art = _FakeArtifacts()
        client = _FakeClient(art)
        try:
            await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
        except HardStop as exc:
            assert "unreadable" in str(exc) or "empty" in str(exc), exc
        else:  # pragma: no cover
            raise AssertionError("corrupt sidecar did not hard-stop")
        assert art.generate_calls == 0

    # 4. a terminal-failed generation must hard-stop distinctly, not loop as "not ready yet"
    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)

        class _FailedStatus:
            status = "failed"
            error = "quota"
            is_failed = True
            is_removed = False
            is_not_found = False

        art = _FakeArtifacts(gen_status=_FailedStatus())
        client = _FakeClient(art)
        try:
            await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
        except HardStop as exc:
            assert "terminal status" in str(exc) and "'failed'" in str(exc), exc
        else:  # pragma: no cover
            raise AssertionError("terminal failure did not hard-stop")
        assert art.generate_calls == 1
        assert art.download_calls == 0, "a known-dead task must not even attempt download"

    # 4b. a held execution lock rejects a second caller outright — this is what
    # actually closes the "two callers both resume the same real-task sidecar"
    # gap: _claim_task_lock only guards the fresh-generation transition, not
    # a second concurrent resume of an already-existing sidecar
    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)
        _seed_manifest(out_dir)
        _save_task_state(out_dir / "deck-a.task_id", _TaskState(notebook_id="nb-1", task_id="in-flight"))
        (out_dir / "deck-a.lock").touch()
        art = _FakeArtifacts()
        client = _FakeClient(art)
        try:
            await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
        except HardStop as exc:
            assert "deck-a.lock" in str(exc) and "another process" in str(exc), exc
        else:  # pragma: no cover
            raise AssertionError("a held execution lock did not hard-stop a second caller")
        assert art.generate_calls == 0
        assert art.download_calls == 0
        assert (out_dir / "deck-a.lock").is_file(), "rejecting a second caller must not release the first caller's lock"

    # 5. a fresh pass with no sidecar generates exactly once, downloads, and cleans up the sidecar
    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)

        class _CompleteStatus:
            status = "completed"
            error = None
            is_failed = False
            is_removed = False
            is_not_found = False

        art = _FakeArtifacts(gen_status=_CompleteStatus())
        client = _FakeClient(art)
        result = await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
        assert art.generate_calls == 1
        assert art.download_calls == 1
        assert result["task_id"] == "fresh-task-id"
        assert not (out_dir / "deck-a.task_id").exists(), "sidecar must be cleaned up on success"
        assert not (out_dir / "deck-a.lock").exists(), "execution lock must be released on success"
        assert (out_dir / "deck-a.pdf").is_file()

    # 6. a PDF already on disk (e.g. a concurrent run finished first) must
    # never trigger generation, regardless of which of the two done.is_file()
    # checks catches it — this only exercises the entry check; the recheck
    # immediately after a won claim (same guard, exercised for the same
    # invariant) has no independent test because reproducing that exact
    # interleaving needs real concurrency, not just a fake client
    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)
        _seed_manifest(out_dir)
        import fitz as _fitz

        _doc = _fitz.open()
        _doc.new_page()
        _doc.save(out_dir / "deck-a.pdf")
        _doc.close()
        art = _FakeArtifacts()
        client = _FakeClient(art)
        result = await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
        assert art.generate_calls == 0, "a PDF that appeared between check and claim must not trigger generation"
        assert result["task_id"] is None
        assert not (out_dir / "deck-a.task_id").exists(), "the pointless claim must be released"

    # 7. the sidecar must survive a post-download compositing failure — deleting
    # it before compositing succeeds would make a crashed-mid-composite pass
    # look like "no lock, safe to regenerate" on the next run
    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)

        class _CompleteStatus2:
            status = "completed"
            error = None
            is_failed = False
            is_removed = False
            is_not_found = False

        art = _FakeArtifacts(gen_status=_CompleteStatus2())
        client = _FakeClient(art)
        module = sys.modules[__name__]
        real_composite = module._composite

        def _boom(deck, ps_):
            raise RuntimeError("compositing exploded")

        module._composite = _boom
        try:
            try:
                await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
            except RuntimeError as exc:
                assert "compositing exploded" in str(exc)
            else:  # pragma: no cover
                raise AssertionError("compositing failure was swallowed")
        finally:
            module._composite = real_composite
        assert (out_dir / "deck-a.task_id").is_file(), "sidecar must survive a compositing failure"
        assert (out_dir / "deck-a.pdf").is_file(), "the pre-composite download is still on disk"

        # rerunning must NOT trust that stale PDF via the entry shortcut — the
        # surviving sidecar means the download may be partial/corrupt, so it
        # must resume (re-download a known-good copy, recomposite, then clean
        # up) rather than short-circuiting on mere PDF presence
        result = await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
        assert art.generate_calls == 1, "resuming a surviving sidecar must not regenerate"
        assert art.download_calls == 2, "recovery must re-download rather than trust the stale local PDF"
        assert result["task_id"] == "fresh-task-id"
        assert not (out_dir / "deck-a.task_id").exists(), "sidecar is cleaned up once recovery composites successfully"

    # 8. §3.11 — a pass with no manifest and no prior work is grandfathered
    # (baseline written, no hard-stop), and an unchanged rerun proceeds; changed
    # instructions since the recorded baseline hard-stop BEFORE any quota is
    # spent; a pass with no manifest but PRIOR work already on disk (the
    # legacy-pending case) hard-stops too, instead of silently adopting
    # today's inputs as if they were the ones the pending task started with
    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)

        class _CompleteStatus3:
            status = "completed"
            error = None
            is_failed = False
            is_removed = False
            is_not_found = False

        art = _FakeArtifacts(gen_status=_CompleteStatus3())
        client = _FakeClient(art)
        result = await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
        assert art.generate_calls == 1, "first-ever attempt is grandfathered, not blocked"
        manifest = out_dir / "deck-a.input-manifest"
        assert manifest.is_file(), "a baseline manifest must be recorded on first use"
        recorded = manifest.read_text(encoding="utf-8")

        # an unchanged rerun (new pdf/sidecar cycle, same inputs) matches the baseline
        (out_dir / "deck-a.pdf").unlink()
        result = await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
        assert art.generate_calls == 2
        assert manifest.read_text(encoding="utf-8") == recorded, "matching inputs must not rewrite the manifest"

        # changed instructions since the recorded baseline must hard-stop before
        # any of the three branches act, and must not touch existing state
        (out_dir / "deck-a.pdf").unlink()
        changed = Pass(key="deck-a", notebook="nb-title", instructions="do it DIFFERENTLY")
        try:
            await _run_pass(client, changed, out_dir, {"nb-title": "nb-1"})
        except HardStop as exc:
            assert "input manifest" in str(exc) and "no longer matches" in str(exc), exc
        else:  # pragma: no cover
            raise AssertionError("a changed pass did not hard-stop on a stale manifest")
        assert art.generate_calls == 2, "a manifest mismatch must not spend quota"
        assert manifest.read_text(encoding="utf-8") == recorded, "a mismatch must not overwrite the recorded baseline"
        assert not (out_dir / "deck-a.task_id").exists(), "a manifest mismatch must not create a task lock sidecar"

    # 8b. §3.11 legacy case — no manifest, but prior work (an in-flight task
    # sidecar or output) already exists on disk. Each must hard-stop rather than
    # silently adopting today's inputs as the prior work's baseline.
    for prior_work_name in ("deck-a.task_id", "deck-a.pdf"):
        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td)
            prior_work = out_dir / prior_work_name
            prior_work.write_text("pre-existing prior work", encoding="utf-8")

            art = _FakeArtifacts(gen_status=_CompleteStatus3())
            client = _FakeClient(art)
            try:
                await _run_pass(client, ps, out_dir, {"nb-title": "nb-1"})
            except HardStop as exc:
                message = str(exc)
                expected_fingerprint = _pass_fingerprint(ps)
                assert "no input manifest exists yet" in message and "prior work" in message, exc
                assert f"writing {expected_fingerprint} to" in message, exc
            else:  # pragma: no cover
                raise AssertionError(f"legacy prior work {prior_work_name} without a manifest did not hard-stop")
            assert art.generate_calls == 0, "legacy prior work must not spend quota"
            assert not (out_dir / "deck-a.input-manifest").exists(), (
                "a hard-stop must not silently write a baseline manifest"
            )
            assert prior_work.read_text(encoding="utf-8") == "pre-existing prior work", (
                "a hard-stop must not touch existing prior work"
            )


# --------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("session", nargs="?", help="session id, e.g. L1-s1")
    ap.add_argument("--live", action="store_true", help="actually call NotebookLM and spend quota")
    ap.add_argument("--self-check", action="store_true")
    ap.add_argument(
        "--root",
        type=Path,
        default=None,
        help="course vault root (per-job, e.g. from CourseDeveloper.Worker); "
        "defaults to this file's own vault for standalone/manual runs",
    )
    ap.add_argument(
        "--regenerate-pass",
        default=None,
        metavar="PASS",
        help="STEP 11 Phase B, Batch 2 last resort: quarantine the existing deck-a|deck-b|"
        "summary PDF and fire exactly one fresh NotebookLM attempt for that pass alone. "
        "Requires --live. Declines (exit 3) rather than duplicate a task already in flight.",
    )
    ap.add_argument(
        "--prompt-file",
        type=Path,
        default=None,
        help="STEP 11 Phase B, Batch 3, option (a)+(b): use this resolved prompt file instead "
        "of the course's default 80-generation/nblm-student-deck-prompts.md. "
        "CourseDeveloper.Worker passes this when it has already rendered and preflighted a "
        "per-session copy (see NblmPromptPreflightFactCorrector.cs); omitted for a manual/"
        "standalone run, which falls back to the course's own file exactly as before.",
    )
    args = ap.parse_args(argv)

    if args.self_check:
        _demo()
        return 0
    if not args.session:
        ap.error("session id required")
    if args.regenerate_pass and not args.live:
        ap.error("--regenerate-pass requires --live — regeneration always spends quota")

    # STEP 5: the concrete de-hardcoding this ticket requires — bind every
    # execution-boundary path off CoursePaths.for_root(args.root) instead of
    # generate_session.py's own process-global VAULT/COURSE/BRAND defaults,
    # so one worker process can run jobs against different course roots.
    course_paths = paths.for_root(args.root) if args.root is not None else paths._get_default()
    # Legacy helpers imported by downstream modules (notably stage_gate's
    # validate_session_id wrapper) resolve through paths._get_default(). Bind
    # that default to this job too, or they validate against the engine's
    # template manifest instead of the per-job course manifest.
    paths._default = course_paths
    global VAULT, COURSE, BRAND, BRAIN_OS, BRANDING_RULE, TATA_GUIDE
    VAULT = course_paths.VAULT_ROOT
    COURSE = course_paths.COURSE
    BRAND = VAULT / "Techno Square identity"
    BRAIN_OS = VAULT / "Abdeen_Moon_OS_Docs" / "Academy_Brain_OS"
    BRANDING_RULE = BRAIN_OS / "Techno_Square_Branding_Rule.md"
    TATA_GUIDE = BRAIN_OS / "Tata_Mascot_Usage Guide.md"

    sid = course_paths.validate_session_id(args.session)
    if not course_paths.produces_artifacts(sid):
        print(
            f"HARD STOP: {sid} produces no artifacts under this course's manifest "
            "(course.yaml: artifact_schedule) — nothing to generate",
            file=sys.stderr,
        )
        return 2
    bundle = VAULT / "75-bundle" / sid

    mapping = bundle / "ASSET-MAPPING.md"
    prompt_file = args.prompt_file or (VAULT / "80-generation" / "nblm-student-deck-prompts.md")
    for f in (mapping, prompt_file):
        if not f.is_file():
            print(f"HARD STOP: missing {f}", file=sys.stderr)
            return 2

    # STEP 11 Phase B, Batch 3 follow-up (Codex review): record which exact prompt file
    # this run actually used — the per-session rendered copy or the course's shared
    # default — so the receipt/RESULT_JSON can prove provenance even when the file
    # already passed preflight and no correction/re-render ran.
    # Read once so the digest proves the exact bytes parsed below, even if another
    # process replaces the prompt file while this run is starting.
    prompt_bytes = prompt_file.read_bytes()
    prompt_provenance = {
        "path": str(prompt_file),
        "sha256": hashlib.sha256(prompt_bytes).hexdigest(),
    }

    try:
        enforce_stage_chain(sid)
        assets = parse_asset_mapping(mapping.read_text(encoding="utf-8"), vault=VAULT)
        enforce_blueprint_gate(bundle / "blueprint.md")
        enforce_asset_gate(assets)
        reconcile_slides(bundle, assets)
        plan = build_plan(sid, assets, parse_prompts(prompt_bytes.decode("utf-8")))
        problems = preflight(plan)
        if problems:
            raise HardStop("preflight failed — " + "; ".join(problems))
    except HardStop as exc:
        print(f"HARD STOP: {exc}", file=sys.stderr)
        return 2

    evidence_n = sum(1 for a in assets if a.klass == "EVIDENCE")
    print(f"{sid}: {len(assets)} assets, {evidence_n} reserved as evidence")
    for ps in plan:
        print(f"  {ps.key:8} -> {len(ps.uploads)} sources, notebook {ps.notebook!r}")

    if not args.live:
        print("\ndry run — nothing uploaded, no quota spent. Add --live to fire.")
        # STEP 5: one machine-parseable line so CourseDeveloper.Worker's subprocess
        # adapter has a single result-parsing path for both dry and live runs,
        # rather than screen-scraping the human-readable lines above.
        print("RESULT_JSON:" + json.dumps({
            "sessionId": sid,
            "receiptPath": None,
            "pedagogy": pedagogy_summary(sid, VAULT),
            "promptProvenance": prompt_provenance,
        }))
        return 0

    regen_extra: dict = {}
    if args.regenerate_pass:
        available = {ps.key for ps in plan}
        if args.regenerate_pass not in available:
            print(
                f"REGENERATION DECLINED: --regenerate-pass {args.regenerate_pass!r} is not a pass in "
                f"this session's plan ({sorted(available)})",
                file=sys.stderr,
            )
            return 3

        plan = [ps for ps in plan if ps.key == args.regenerate_pass]
        out_dir = VAULT / "80-generation" / sid
        try:
            with _prepare_regeneration(out_dir, plan[0]) as quarantined:
                print(
                    f"  regenerating only {args.regenerate_pass!r} — "
                    f"quarantined prior artifact to {quarantined}"
                )
                payload = asyncio.run(run_live(sid, plan, prelocked_pass=args.regenerate_pass))
        except HardStop as exc:
            print(f"REGENERATION DECLINED: {exc}", file=sys.stderr)
            return 3

        regen_extra = {
            "pass": args.regenerate_pass,
            "newArtifactVersion": int(time.time()),
            "quarantinedFrom": str(quarantined),
        }
    else:
        payload = asyncio.run(run_live(sid, plan))
    payload["pedagogy"] = pedagogy_summary(sid, VAULT)
    payload["promptProvenance"] = prompt_provenance
    receipt_path = write_receipt(sid, payload)
    print(f"\nreceipt: {receipt_path}")
    print("Deck is NOT done. Merge the two passes, overlay evidence, then review by eye.")
    print("RESULT_JSON:" + json.dumps({
        "sessionId": sid,
        "receiptPath": str(receipt_path),
        "pedagogy": payload["pedagogy"],
        "promptProvenance": prompt_provenance,
        **regen_extra,
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
