"""Refuse to advance a session past a stage whose predecessors have no evidence.

Every other gate in this vault judges the TEXT of one artifact. This one judges
the VAULT: it answers "may this session enter stage X at all", which is the
question nothing was asking when an entire course ran 90-receipts -> 75-bundle
and skipped research, critique, patch, refutation, approval and localization
without a single complaint.

A stage is satisfied by evidence or by a valid waiver. Nothing else. A waiver is
a structured document with a named authority and an expiry date, because the one
course that DID carry a written "record why the stage is not applicable" rule in
its contract recorded nothing at all and shipped fifteen sessions anyway. Prose
that asks for a justification is not a gate; this file is the gate.

Scope note: this checks that evidence EXISTS and that waivers are VALID. It does
not check that evidence is fresh relative to its predecessor.

STEP 9 R1-R4 (2026-09-05): receipts, research, digest, and provenance used to
be satisfied by any file matching the glob, regardless of content — a session
could enter bundle on four empty-but-present files. Those four stages now
also run a structural content check (see `_CONTENT_VALIDATORS` below); the
other stages are unchanged pending their own batch.

STEP 9 R5-R8 (2026-09-05): critique, patch, refutation, and approval gained
the same treatment. Critique is checked as a set (`_COLLECTION_VALIDATORS`):
independent lanes together, not any one lane alone. Patch, refutation, and
approval each cross-check against an earlier stage's real content — an
adjudicated issue id must have been raised by a real critique lane, a
challenged patch id must actually be high-severity, and an approval's
declared upstream hashes must match the vault's current evidence, not a
stale or self-asserted one.

STEP 9 R9-R10 (2026-09-05): localization and bundle gained the same
treatment. Localization must cite real provenance claims, preserve every
number and inline-code span from English into Arabic, and bind to the
CURRENT `approved` hash. Bundle is checked as a set (`_COLLECTION_VALIDATORS`):
all six files present, individually substantive, cross-consistent (SOURCES.md
claims resolve against provenance; home-summary.md never leaks a research
task's answer key) — without re-deriving generation time's own blueprint/
asset checks (`generate_session.enforce_blueprint_gate`/`enforce_asset_gate`),
which already run in full immediately before any quota is spent.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import filecmp
import hashlib
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import yaml

from .asset_mapping import parse_asset_mapping
from .gates import PASS as GATE_PASS
from .gates import (
    approval_decision,
    bundle_sources,
    critique_lane,
    digest_synthesis,
    localization_align,
    patch_adjudication,
    provenance_map,
    receipt_claims,
    refutation_challenge,
    research_tasks,
)
from .paths import validate_session_id

# Bumped when the stage chain or the waiver contract changes in a way that would
# alter a verdict. Stamped into every receipt so a later doctrine change can
# never silently reinterpret an artifact that passed under earlier rules.
# 2 -> 3: receipts/research/digest/provenance gained content validation (STEP 9 R1-R4).
# 3 -> 4: critique/patch/refuted/approved gained content validation (STEP 9 R5-R8).
# 4 -> 5: localized/bundle gained content validation (STEP 9 R9-R10).
DOCTRINE_VERSION = 5

PASS = "PASS"
FAIL = "FAIL"

# Reasons a stage may legitimately be skipped. Free text is not one of them:
# "not applicable" with no vocabulary behind it is how a permanent exemption
# gets laundered out of a temporary blockage.
WAIVER_REASONS = frozenset(
    {
        "not-applicable",  # the stage cannot apply to this session, ever
        "blocked",  # the stage is owed and not yet done — MUST carry an expiry
        "superseded",  # another session's artifact covers this one, named in `covered_by`
    }
)
_TERMINAL_REASONS = frozenset({"not-applicable", "superseded"})


@dataclass(frozen=True)
class Stage:
    """One stage of the pipeline and what counts as evidence for it."""

    name: str
    directory: str
    pattern: str  # glob, with {sid} and {level} substituted
    scope: str  # "session" or "level"


# The chain, in order. A stage's prerequisites are every stage before it.
STAGE_CHAIN: tuple[Stage, ...] = (
    Stage("receipts", "90-receipts", "{sid}.*.yaml", "session"),
    Stage("research", "30-research", "L{level}/*.md", "level"),
    Stage("digest", "10-digest", "{sid}.md", "session"),
    Stage("provenance", "20-provenance", "{sid}.md", "session"),
    Stage("critique", "40-critique", "{sid}/*.json", "session"),
    Stage("patch", "50-patch", "{sid}.md", "session"),
    Stage("refuted", "55-refuted", "{sid}.md", "session"),
    Stage("approved", "60-approved", "{sid}.md", "session"),
    Stage("localized", "70-localized", "{sid}.md", "session"),
    Stage("bundle", "75-bundle", "{sid}/*.md", "session"),
    Stage("generation", "80-generation", "{sid}/*", "session"),
)
_BY_NAME = {s.name: s for s in STAGE_CHAIN}


class StageGateError(RuntimeError):
    """The gate could not reach a verdict. Never reported as a pass."""


def _level_of(sid: str) -> str:
    """`L2-s5` -> `2`. Session ids are already validated before this runs."""
    return sid.split("-", 1)[0].lstrip("L")


def is_locked(vault: Path, sid: str) -> bool:
    """Has this session already shipped a locked golden artifact?

    A lock is a byte-identical `.LOCKED-GOLDEN.pdf` (pipeline-lessons.md §7).
    Anything under `_rejected/` is explicitly NOT a lock — that directory holds
    incident evidence, including goldens locked in error and then withdrawn, and
    counting one would let a rejected artifact grant a permanent exemption.
    """
    root = vault / "80-generation" / sid
    if not root.is_dir():
        return False
    for locked in root.rglob("*.LOCKED-GOLDEN.pdf"):
        if "_rejected" in {part.casefold() for part in locked.parts} or not locked.is_file():
            continue
        accepted = locked.with_name(
            locked.name.removesuffix(".LOCKED-GOLDEN.pdf") + ".pdf"
        )
        try:
            with locked.open("rb") as stream:
                is_pdf = locked.stat().st_size > 5 and stream.read(5) == b"%PDF-"
            if is_pdf and accepted.is_file() and filecmp.cmp(locked, accepted, shallow=False):
                return True
        except OSError:
            continue
    return False


def waiver_path(vault: Path, stage: Stage, sid: str) -> Path:
    """Where a waiver for this stage must live.

    A level-scoped stage takes a level-named waiver. Naming it per session
    would require one identical file per session in the level, each declaring
    `scope: level` — eight chances to disagree about a single decision.
    """
    if stage.scope == "level":
        return vault / stage.directory / f"L{_level_of(sid)}.waiver.yaml"
    return vault / stage.directory / f"{sid}.waiver.yaml"


def read_waiver(path: Path, today: _dt.date, expected_scope: str) -> tuple[bool, str]:
    """Return (valid, detail). A malformed waiver is invalid, never ignored."""
    try:
        doc = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        return False, f"waiver {path.name} does not parse ({exc})"
    if not isinstance(doc, dict):
        return False, f"waiver {path.name} is not a YAML mapping"

    missing = [k for k in ("reason", "authority", "scope", "granted") if not doc.get(k)]
    if missing:
        return False, f"waiver {path.name} is missing required field(s): {', '.join(missing)}"

    reason = str(doc["reason"])
    if reason not in WAIVER_REASONS:
        return False, (
            f"waiver {path.name} reason {reason!r} is not one of "
            f"{', '.join(sorted(WAIVER_REASONS))}"
        )
    if doc["scope"] != expected_scope:
        return False, (
            f"waiver {path.name} scope {doc['scope']!r} does not match "
            f"the stage scope {expected_scope!r}"
        )
    if reason == "superseded" and not doc.get("covered_by"):
        return False, f"waiver {path.name} claims 'superseded' but names no covered_by"

    expiry = doc.get("expires")
    if reason not in _TERMINAL_REASONS:
        # A 'blocked' waiver with no expiry is a permanent exemption wearing a
        # temporary label — the exact laundering this vocabulary exists to stop.
        if expiry is None:
            return False, f"waiver {path.name} reason 'blocked' requires an `expires` date"
    if expiry is not None:
        if isinstance(expiry, _dt.datetime):
            expiry = expiry.date()
        if not isinstance(expiry, _dt.date):
            return False, f"waiver {path.name} `expires` must be a YYYY-MM-DD date"
        if expiry < today:
            return False, f"waiver {path.name} expired on {expiry.isoformat()}"
    return True, f"waived: {reason} by {doc['authority']}"


def _find_specialist_receipt(vault: Path, sid: str) -> dict | None:
    """Locate this session's specialist receipt among its 90-receipts/ files.

    `90-receipts/` also holds gate and production receipts written by other
    code; only a file that parses as a specialist receipt counts here.
    """
    stage = _BY_NAME["receipts"]
    pattern = stage.pattern.format(sid=sid, level=_level_of(sid))
    for candidate in sorted((vault / stage.directory).glob(pattern)):
        if not candidate.is_file() or ".waiver." in candidate.name:
            continue
        try:
            return receipt_claims.parse_receipt(candidate.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
    return None


def _validate_provenance(vault: Path, sid: str, text: str) -> tuple[bool, str]:
    """Provenance must parse AND every claim it cites must resolve to a real receipt claim."""
    try:
        doc = provenance_map.parse_provenance(text)
    except ValueError as exc:
        return False, str(exc)
    receipt = _find_specialist_receipt(vault, sid)
    if receipt is None:
        return False, "provenance links exist but no valid specialist receipt was found to trace them to"
    unresolved = [cid for cid in doc["_claim_ids"] if cid not in receipt["_claim_ids"]]
    if unresolved:
        return False, f"provenance cites claim id(s) not in the specialist receipt: {', '.join(unresolved)}"
    return True, f"{len(doc['_claim_ids'])} claim(s) traced and resolved against the specialist receipt"


def _find_provenance(vault: Path, sid: str) -> dict | None:
    """Locate this session's provenance map, parsed. `None` if none parses."""
    stage = _BY_NAME["provenance"]
    pattern = stage.pattern.format(sid=sid, level=_level_of(sid))
    for candidate in sorted((vault / stage.directory).glob(pattern)):
        if not candidate.is_file() or ".waiver." in candidate.name:
            continue
        try:
            return provenance_map.parse_provenance(candidate.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
    return None


def _critique_issue_severities(vault: Path, sid: str) -> dict[str, str]:
    """Issue severities from every critique lane; malformed or conflicting input fails closed."""
    stage = _BY_NAME["critique"]
    pattern = stage.pattern.format(sid=sid, level=_level_of(sid))
    severities: dict[str, str] = {}
    for candidate in sorted((vault / stage.directory).glob(pattern)):
        if not candidate.is_file() or ".waiver." in candidate.name:
            continue
        try:
            doc = critique_lane.parse_lane(candidate.read_text(encoding="utf-8"))
        except (ValueError, OSError, UnicodeError) as exc:
            raise ValueError(f"{candidate.name}: {exc}") from exc
        for issue_id, severity in doc["_issue_severities"].items():
            previous = severities.get(issue_id)
            if previous is not None and previous != severity:
                raise ValueError(
                    f"critique issue {issue_id!r} has conflicting severity {previous!r} and {severity!r}"
                )
            severities[issue_id] = severity
    return severities


def _find_patch(vault: Path, sid: str) -> dict | None:
    """Locate this session's patch adjudication record, parsed. `None` if none parses."""
    stage = _BY_NAME["patch"]
    pattern = stage.pattern.format(sid=sid, level=_level_of(sid))
    for candidate in sorted((vault / stage.directory).glob(pattern)):
        if not candidate.is_file() or ".waiver." in candidate.name:
            continue
        try:
            return patch_adjudication.parse_patch(candidate.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
    return None


def _current_stage_hash(vault: Path, stage_name: str, sid: str) -> str | None:
    """SHA256 over every current artifact for one stage — approval's freshness check.

    Hashes the raw bytes of whatever currently matches the stage's glob,
    regardless of whether it would itself pass content validation, so a stale
    approval is caught the moment ANY upstream artifact changes, not only
    when it becomes invalid.
    """
    stage = _BY_NAME.get(stage_name)
    if stage is None:
        return None
    pattern = stage.pattern.format(sid=sid, level=_level_of(sid))
    hits = sorted(
        p for p in (vault / stage.directory).glob(pattern) if p.is_file() and ".waiver." not in p.name
    )
    if not hits:
        return None
    digest = hashlib.sha256()
    for path in hits:
        try:
            relative_name = path.relative_to(vault / stage.directory).as_posix().encode("utf-8")
            content = path.read_bytes()
        except OSError:
            return None
        digest.update(len(relative_name).to_bytes(8, "big"))
        digest.update(relative_name)
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()


def _gate_validator(fn) -> Callable[[Path, str, str], tuple[bool, str]]:
    """Adapt a `swarm.gates` text->GateResult function to a (vault, sid, text) validator."""

    def run(_vault: Path, _sid: str, text: str) -> tuple[bool, str]:
        result = fn(text)
        return result.verdict == GATE_PASS, result.detail

    return run


# ENGINE's documented three-lane roster (scaffold_vault.py TOPOLOGY["40-critique"]["fanout"];
# comparison doc §3.5: "Preserve the documented codex/opencode/hermes lanes ... An unavailable
# required lane is missing review evidence, not an empty successful response. R6 depends on
# this full review set or explicitly represented waivers." — duplicated locally rather than
# imported, matching this module's existing convention for approval_decision.AUTHORITIES.
REQUIRED_CRITIQUE_LANES = frozenset({"codex", "opencode", "hermes"})


def _validate_critique_lanes(vault: Path, sid: str, hits: list[Path]) -> tuple[bool, str]:
    """All lanes together, not any one lane alone: distinct, independently valid, source-resolved."""
    won_by: dict[str, str] = {}
    parsed: dict[str, dict] = {}
    for candidate in hits:
        try:
            text = candidate.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            return False, f"{candidate.name}: could not read ({exc})"
        try:
            doc = critique_lane.parse_lane(text)
        except ValueError as exc:
            return False, f"{candidate.name}: {exc}"
        if doc["_lane"] in parsed:
            return False, f"{candidate.name}: lane {doc['_lane']!r} duplicates {won_by[doc['_lane']]}"
        won_by[doc["_lane"]] = candidate.name
        parsed[doc["_lane"]] = doc

    missing = sorted(REQUIRED_CRITIQUE_LANES - parsed.keys())
    if missing:
        return False, f"missing required critique lane(s): {', '.join(missing)}"

    input_hashes = {doc["input_hash"] for doc in parsed.values()}
    if len(input_hashes) != 1:
        return False, "critique lanes declare different `input_hash` values for the frozen draft"

    try:
        _critique_issue_severities(vault, sid)
    except ValueError as exc:
        return False, str(exc)

    provenance = _find_provenance(vault, sid)
    known_claims = set(provenance["_claim_ids"]) if provenance else set()
    unresolved = sorted(
        f"{lane}:{cid}"
        for lane, doc in parsed.items()
        for cid in doc["_cited_claims"]
        if cid not in known_claims
    )
    if unresolved:
        return False, f"critique cites claim id(s) not resolved by provenance: {', '.join(unresolved)}"

    total_issues = sum(len(doc["_issue_ids"]) for doc in parsed.values())
    return True, f"{len(parsed)} independent lane(s) ({', '.join(sorted(parsed))}), {total_issues} issue(s)"


def _validate_patch(vault: Path, sid: str, text: str) -> tuple[bool, str]:
    """Patch must parse AND every adjudicated issue id must be a real critique issue."""
    try:
        doc = patch_adjudication.parse_patch(text)
    except ValueError as exc:
        return False, str(exc)
    try:
        known_issues = _critique_issue_severities(vault, sid)
    except ValueError as exc:
        return False, f"critique evidence is invalid: {exc}"
    unresolved = [iid for iid in doc["_issue_ids"] if iid not in known_issues]
    if unresolved:
        return False, f"patch adjudicates issue id(s) not raised by any critique lane: {', '.join(unresolved)}"
    return True, f"revision {doc['revision']!r}, {len(doc['_issue_ids'])} issue(s) adjudicated against real critique issues"


def _validate_refutation(vault: Path, sid: str, text: str) -> tuple[bool, str]:
    """Refutation must parse AND cover every applied, high-severity patch issue."""
    try:
        doc = refutation_challenge.parse_refutation(text)
    except ValueError as exc:
        return False, str(exc)

    patch = _find_patch(vault, sid)
    try:
        severities = _critique_issue_severities(vault, sid)
    except ValueError as exc:
        return False, f"critique evidence is invalid: {exc}"
    if patch is None:
        return False, "no valid current patch adjudication found"

    patch_issue_ids = set(patch["_issue_ids"])
    invented = sorted(patch_issue_ids - severities.keys())
    if invented:
        return False, f"patch adjudicates issue id(s) not raised by any critique lane: {', '.join(invented)}"
    applied_ids = {e["issue_id"] for e in patch["entries"] if e["disposition"] == "applied"}
    high_severity_ids = {iid for iid in applied_ids if severities[iid] == "high"}

    if high_severity_ids and doc["_no_high_severity_patches"]:
        return False, (
            "refutation declares `no_high_severity_patches: true` but the patch "
            f"applies high-severity issue(s): {', '.join(sorted(high_severity_ids))}"
        )
    missing = sorted(high_severity_ids - set(doc["_challenged_issue_ids"]))
    if missing:
        return False, f"refutation does not challenge high-severity patch id(s): {', '.join(missing)}"

    extraneous = sorted(set(doc["_challenged_issue_ids"]) - high_severity_ids)
    if extraneous:
        return False, f"refutation challenges issue id(s) that are not applied high-severity patches: {', '.join(extraneous)}"
    defeated = sorted(
        issue_id
        for issue_id in high_severity_ids
        if doc["_challenge_results"][issue_id] == "defeated"
    )
    if defeated:
        return False, f"high-severity patch id(s) defeated by refutation must return to patch: {', '.join(defeated)}"

    if high_severity_ids:
        return True, f"{len(high_severity_ids)} high-severity patch(es) challenged"
    return True, "no high-severity patches to challenge"


def _validate_approval(vault: Path, sid: str, text: str) -> tuple[bool, str]:
    """Approval must parse, bind the FULL resolved review ledger, and match the vault right now.

    Comparison doc §3.8: the decision must bind to "the source/research/review hashes"
    and must "refuse a self-asserted council record without the corresponding reviews" —
    a subset (e.g. only `receipts`) is a self-asserted record, not a settled one.
    """
    try:
        doc = approval_decision.parse_approval(text)
    except ValueError as exc:
        return False, str(exc)

    approval_index = tuple(_BY_NAME).index("approved")
    valid_upstream = set(tuple(_BY_NAME)[:approval_index])
    for stage_name in doc["_upstream"]:
        if stage_name not in _BY_NAME:
            return False, f"approval upstream names unknown stage {stage_name!r}"
        if stage_name not in valid_upstream:
            return False, f"approval upstream stage {stage_name!r} is not before 'approved'"
    missing_ledger = sorted(valid_upstream - doc["_upstream"].keys())
    if missing_ledger:
        return False, (
            "approval does not bind the full resolved review ledger — missing "
            f"upstream stage(s): {', '.join(missing_ledger)}"
        )

    stale: list[str] = []
    for stage_name, declared_hash in doc["_upstream"].items():
        current_hash = _current_stage_hash(vault, stage_name, sid)
        if current_hash is None:
            stale.append(f"{stage_name}: no current evidence found")
        elif current_hash != declared_hash:
            stale.append(f"{stage_name}: declared hash does not match current evidence")
    if stale:
        return False, f"approval is stale against the live vault: {'; '.join(stale)}"
    return True, f"settled by {doc['actor']!r}, bound to {len(doc['_upstream'])} upstream stage(s), all current"


def _validate_localization(vault: Path, sid: str, text: str) -> tuple[bool, str]:
    """Localization must parse, cite real claims, and bind to the CURRENT approved hash."""
    try:
        doc = localization_align.parse_localization(text)
    except ValueError as exc:
        return False, str(exc)

    provenance = _find_provenance(vault, sid)
    known_claims = set(provenance["_claim_ids"]) if provenance else set()
    unresolved = [cid for cid in doc["_cited_claims"] if cid not in known_claims]
    if unresolved:
        return False, f"localization cites claim id(s) not resolved by provenance: {', '.join(unresolved)}"

    current_hash = _current_stage_hash(vault, doc["_bound_stage"], sid)
    if current_hash is None:
        return False, f"localization is bound to {doc['_bound_stage']!r} but no current evidence was found"
    if current_hash != doc["_bound_hash"]:
        return False, f"localization is stale against the live {doc['_bound_stage']!r} evidence"
    return True, f"{len(doc['_segment_ids'])} segment(s) aligned, bound to current {doc['_bound_stage']!r}"


_REQUIRED_BUNDLE_FILES = (
    "slides-source.md",
    "blueprint.md",
    "decisions.md",
    "SOURCES.md",
    "ASSET-MAPPING.md",
    "home-summary.md",
)
MIN_BUNDLE_FILE_WORDS = 8


def _research_answer_keys(vault: Path, sid: str) -> list[str]:
    """Every task `key` string from this session's level research.

    Feeds the bundle's home-summary leak check (comparison doc §3.10: "Keep
    K1 in the designated research/teacher material unless the reviewed
    teaching sequence explicitly calls for showing an answer").
    """
    stage = _BY_NAME["research"]
    pattern = stage.pattern.format(sid=sid, level=_level_of(sid))
    keys: list[str] = []
    for candidate in sorted((vault / stage.directory).glob(pattern)):
        if not candidate.is_file() or ".waiver." in candidate.name:
            continue
        try:
            doc = research_tasks.parse_research(candidate.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        for task in doc.get("tasks", []):
            key = task.get("key")
            if isinstance(key, str) and key.strip():
                keys.append(key.strip())
    return keys


def _contains_answer_key(text: str, key: str) -> bool:
    """Match a literal key without treating it as part of a larger word."""
    left = r"(?<!\w)" if re.match(r"\w", key[0]) else ""
    right = r"(?!\w)" if re.match(r"\w", key[-1]) else ""
    return re.search(f"{left}{re.escape(key)}{right}", text) is not None


def _validate_bundle_files(vault: Path, sid: str, hits: list[Path]) -> tuple[bool, str]:
    """All six bundle files together: present, individually substantive, cross-consistent.

    Deliberately does not re-derive generation time's own blueprint/asset
    checks (`generate_session.enforce_blueprint_gate`/`enforce_asset_gate`/
    `reconcile_slides`) — those already run in full immediately before any
    quota is spent. ASSET-MAPPING.md is parsed with the same
    `asset_mapping.parse_asset_mapping` those checks use (no second, looser
    copy of the table format to drift from), but this stops at "the table
    parses into real rows with a recognized class" — it does not resolve
    paths or reconcile slides; that stays generation-time's job. This asks
    the narrower stage-gate question: did bundling actually happen, with
    real per-file substance and cross-file consistency, rather than an
    unrelated leftover file satisfying a bare glob match.
    """
    by_name = {p.name: p for p in hits}
    missing = [name for name in _REQUIRED_BUNDLE_FILES if name not in by_name]
    if missing:
        return False, f"missing required bundle file(s): {', '.join(missing)}"

    def _read(name: str) -> str | None:
        try:
            return by_name[name].read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            return None

    for name in ("slides-source.md", "decisions.md", "home-summary.md"):
        text = _read(name)
        if text is None:
            return False, f"{name}: could not read"
        if len(text.split()) < MIN_BUNDLE_FILE_WORDS:
            return False, f"{name}: too short to be real bundle content"

    blueprint_text = _read("blueprint.md")
    if blueprint_text is None:
        return False, "blueprint.md: could not read"
    if not blueprint_text.startswith("---"):
        return False, "blueprint.md has no YAML front matter — cannot establish approval"
    end = blueprint_text.find("\n---", 3)
    if end == -1:
        return False, "blueprint.md front matter is not closed by a '---' line"
    try:
        front = yaml.safe_load(blueprint_text[3:end])
    except yaml.YAMLError as exc:
        return False, f"blueprint.md front matter is not valid YAML: {exc}"
    if not isinstance(front, dict):
        return False, "blueprint.md front matter is not a mapping"
    status = front.get("status")
    if not isinstance(status, str) or status.strip().strip("\"'").lower() != "approved":
        return False, f"blueprint.md status is {status!r} — it has not been approved"
    approval = front.get("approval")
    kind = approval.get("kind") if isinstance(approval, dict) else None
    if isinstance(kind, str):
        kind = kind.strip().strip("\"'")
    if kind not in approval_decision.AUTHORITIES:
        return False, (
            f"blueprint.md approval.kind is {kind!r} — expected one of "
            f"{sorted(approval_decision.AUTHORITIES)}"
        )

    asset_text = _read("ASSET-MAPPING.md")
    if asset_text is None:
        return False, "ASSET-MAPPING.md: could not read"
    assets = parse_asset_mapping(asset_text, vault=vault)
    if not assets:
        return False, "ASSET-MAPPING.md has no parsable asset row"
    bad_klass = sorted({a.klass for a in assets if a.klass not in {"REFERENCE", "EVIDENCE"}})
    if bad_klass:
        return False, f"ASSET-MAPPING.md has asset row(s) with unrecognized class: {', '.join(bad_klass)}"

    sources_text = _read("SOURCES.md")
    if sources_text is None:
        return False, "SOURCES.md: could not read"
    try:
        sources_doc = bundle_sources.parse_sources(sources_text)
    except ValueError as exc:
        return False, f"SOURCES.md: {exc}"
    provenance = _find_provenance(vault, sid)
    known_claims = set(provenance["_claim_ids"]) if provenance else set()
    unresolved = [cid for cid in sources_doc["_claim_ids"] if cid not in known_claims]
    if unresolved:
        return False, f"SOURCES.md cites claim id(s) not resolved by provenance: {', '.join(unresolved)}"

    summary_text = _read("home-summary.md") or ""
    leaked = sorted(
        {
            k
            for k in _research_answer_keys(vault, sid)
            if _contains_answer_key(summary_text, k)
        }
    )
    if leaked:
        return False, f"home-summary.md leaks teacher-only answer key content: {', '.join(leaked)}"

    return True, f"all 6 bundle file(s) present, {len(sources_doc['_claim_ids'])} claim(s) sourced"


# Stages whose presence check is not enough on its own (STEP 9 R1-R4/R5-R8/R9-R10).
# A stage absent from both dicts below keeps today's filename-glob-only behavior.
_CONTENT_VALIDATORS: dict[str, Callable[[Path, str, str], tuple[bool, str]]] = {
    "receipts": _gate_validator(receipt_claims.receipt_claims),
    "research": _gate_validator(research_tasks.research_tasks),
    "digest": _gate_validator(digest_synthesis.digest_synthesis),
    "provenance": _validate_provenance,
    "patch": _validate_patch,
    "refuted": _validate_refutation,
    "approved": _validate_approval,
    "localized": _validate_localization,
}

# Stages that must be judged as a SET of artifacts, not any one artifact alone:
# three independent critique lanes only mean something together (STEP 9 R5),
# and the six bundle files only mean something together (STEP 9 R10).
_COLLECTION_VALIDATORS: dict[str, Callable[[Path, str, list[Path]], tuple[bool, str]]] = {
    "critique": _validate_critique_lanes,
    "bundle": _validate_bundle_files,
}


def check_stage(vault: Path, stage: Stage, sid: str, today: _dt.date) -> tuple[bool, str]:
    """Is this one stage satisfied for this session — by evidence or by waiver?"""
    pattern = stage.pattern.format(sid=sid, level=_level_of(sid))
    directory = vault / stage.directory
    hits = sorted(
        p for p in directory.glob(pattern) if p.is_file() and ".waiver." not in p.name
    )
    if hits:
        collection_validator = _COLLECTION_VALIDATORS.get(stage.name)
        if collection_validator is not None:
            ok, detail = collection_validator(vault, sid, hits)
            if ok:
                return True, detail
            wp = waiver_path(vault, stage, sid)
            if wp.is_file():
                return read_waiver(wp, today, stage.scope)
            return False, f"{len(hits)} artifact(s) at {stage.directory}/{pattern} but {detail}"

        validator = _CONTENT_VALIDATORS.get(stage.name)
        if validator is None:
            return True, f"{len(hits)} artifact(s) at {stage.directory}/{pattern}"
        last_detail = ""
        for candidate in hits:
            try:
                text = candidate.read_text(encoding="utf-8")
            except (OSError, UnicodeError) as exc:
                last_detail = f"{candidate.name}: could not read ({exc})"
                continue
            ok, detail = validator(vault, sid, text)
            if ok:
                return True, f"{candidate.name}: {detail}"
            last_detail = f"{candidate.name}: {detail}"
        failed_detail = (
            f"{len(hits)} artifact(s) at {stage.directory}/{pattern} but none pass "
            f"content validation; last: {last_detail}"
        )
        wp = waiver_path(vault, stage, sid)
        if wp.is_file():
            return read_waiver(wp, today, stage.scope)
        return False, failed_detail

    wp = waiver_path(vault, stage, sid)
    if wp.is_file():
        return read_waiver(wp, today, stage.scope)
    return False, (
        f"no artifact matching {stage.directory}/{pattern} and no waiver at "
        f"{wp.relative_to(vault).as_posix()}"
    )


def check(vault: Path, sid: str, entering: str, today: _dt.date | None = None) -> list[dict]:
    """Check every stage that must be complete before `entering` begins."""
    validate_session_id(sid)
    if entering not in _BY_NAME:
        raise StageGateError(
            f"unknown stage {entering!r} — expected one of "
            f"{', '.join(s.name for s in STAGE_CHAIN)}"
        )
    vault = Path(vault)  # callers hand this in from argv and from other vaults
    today = today or _dt.date.today()
    index = [s.name for s in STAGE_CHAIN].index(entering)

    # Doctrine does not run backwards (pipeline-lessons.md §8.4). A session that
    # already shipped a locked golden passed the rules that existed when it
    # shipped, and this gate did not. Failing it now would not improve it — it
    # would only make a finished artifact look broken and invite a regeneration
    # that nobody wants. New work is gated; history is read, not re-judged.
    if is_locked(vault, sid):
        return [
            {
                "stage": stage.name,
                "verdict": PASS,
                "detail": f"{sid} locked under doctrine < {DOCTRINE_VERSION}; not re-judged",
            }
            for stage in STAGE_CHAIN[:index]
        ]

    results = []
    for stage in STAGE_CHAIN[:index]:
        ok, detail = check_stage(vault, stage, sid, today)
        results.append({"stage": stage.name, "verdict": PASS if ok else FAIL, "detail": detail})
    return results


def receipt(sid: str, entering: str, results: list[dict]) -> dict:
    return {
        "id": sid,
        "entering": entering,
        "doctrine_version": DOCTRINE_VERSION,
        "overall": FAIL if any(r["verdict"] == FAIL for r in results) else PASS,
        "prerequisites": results,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("session_id")
    ap.add_argument("--entering", required=True, choices=[s.name for s in STAGE_CHAIN])
    ap.add_argument("--vault", type=Path, default=Path(__file__).resolve().parents[2])
    ap.add_argument("--out", type=Path, default=None, help="write a YAML receipt here")
    ns = ap.parse_args(argv)

    try:
        results = check(ns.vault, ns.session_id, ns.entering)
    except StageGateError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 2

    doc = receipt(ns.session_id, ns.entering, results)
    if ns.out:
        ns.out.parent.mkdir(parents=True, exist_ok=True)
        ns.out.write_text(yaml.safe_dump(doc, sort_keys=False, allow_unicode=True), "utf-8")
    for r in results:
        print(f"  {r['verdict']:4} {r['stage']:12} {r['detail']}")
    print(f"{doc['overall']} — {ns.session_id} entering {ns.entering}")
    return 0 if doc["overall"] == PASS else 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main(sys.argv[1:]))
