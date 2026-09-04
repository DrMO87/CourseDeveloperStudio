"""Refuse a level whose pedagogy never claims to leave the shallow end.

Checks a level's pedagogy record (`30-research/<level>-pedagogy.yaml`, schema in
00-contracts/pedagogy.md §5) against the required coverage in §2.

What this gate can and cannot do, stated plainly so nobody mistakes a PASS for
more than it is: it checks what a level DECLARES. It cannot read slides and
confirm the declared thinking actually happens — that is the course
specialist's responsibility. A gate that cannot catch a lie can still catch the
far more common failure, which is a level that never even claims to reach
Analyze because nobody ever asked it to.
"""

from __future__ import annotations

import yaml

from swarm.gates import FAIL, PASS, UNVERIFIED, GateResult, register

# Bloom's revised taxonomy (Anderson & Krathwohl 2001), ordered simple -> complex.
PROCESSES: tuple[str, ...] = (
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
)
SUBPROCESSES: dict[str, frozenset[str]] = {
    "Remember": frozenset({"recognizing", "recalling"}),
    "Understand": frozenset(
        {
            "interpreting", "exemplifying", "classifying", "summarizing",
            "inferring", "comparing", "explaining",
        }
    ),
    "Apply": frozenset({"executing", "implementing"}),
    "Analyze": frozenset({"differentiating", "organizing", "attributing"}),
    "Evaluate": frozenset({"checking", "critiquing"}),
    "Create": frozenset({"generating", "planning", "producing"}),
}
KNOWLEDGE: frozenset[str] = frozenset(
    {"Factual", "Conceptual", "Procedural", "Metacognitive"}
)

_RANK = {name: i for i, name in enumerate(PROCESSES)}
_APPLY = _RANK["Apply"]
_ANALYZE = _RANK["Analyze"]
_CREATE = _RANK["Create"]


def parse_cell(cell: str) -> tuple[str, str | None]:
    """`Apply/executing` -> ('Apply', 'executing'). Raises on an unknown cell."""
    process, _, sub = str(cell).partition("/")
    process = process.strip()
    sub = sub.strip() or None
    if process not in _RANK:
        raise ValueError(f"{cell!r}: {process!r} is not a Bloom's process")
    if sub is not None and sub not in SUBPROCESSES[process]:
        raise ValueError(
            f"{cell!r}: {sub!r} is not a subprocess of {process} "
            f"({', '.join(sorted(SUBPROCESSES[process]))})"
        )
    return process, sub


@register("pedagogy-coverage")
def pedagogy_coverage(text: str) -> GateResult:
    try:
        doc = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        return GateResult("pedagogy-coverage", UNVERIFIED, f"record does not parse: {exc}")
    if not isinstance(doc, dict):
        return GateResult("pedagogy-coverage", UNVERIFIED, "record is not a YAML mapping")

    arc = doc.get("arc")
    arc_bloom = doc.get("arc_bloom")
    sessions = doc.get("sessions")
    if not isinstance(arc, list) or not arc:
        return GateResult("pedagogy-coverage", FAIL, "no `arc` declared — see pedagogy.md §5")
    if not isinstance(arc_bloom, dict):
        return GateResult("pedagogy-coverage", FAIL, "no `arc_bloom` mapping declared")
    if not isinstance(sessions, dict) or not sessions:
        return GateResult("pedagogy-coverage", FAIL, "no `sessions` declared")

    problems: list[str] = []

    # Every arc stage declares cells, and every declared stage is in the arc.
    bad_arc_stages = [stage for stage in arc if not isinstance(stage, str) or not stage.strip()]
    for stage in bad_arc_stages:
        problems.append(f"arc stage {stage!r} must be a non-empty string")
    valid_arc = [stage for stage in arc if isinstance(stage, str) and stage.strip()]
    for stage in valid_arc:
        if not arc_bloom.get(stage):
            problems.append(f"arc stage {stage!r} declares no Bloom's cells")
    for stage in arc_bloom:
        if stage not in valid_arc:
            problems.append(f"arc_bloom names {stage!r}, which is not in the declared arc")

    # Coverage is measured over SESSIONS only. `arc_bloom` is what the course
    # intends; sessions are what it claims to have done. Counting the intent
    # toward the ceiling lets a level declare Create in its arc and pass while
    # no session ever gets there — which is the exact gap being closed.
    level_processes: set[str] = set()
    level_knowledge: set[str] = set()

    for group, entries in (("arc_bloom", arc_bloom), ("sessions", sessions)):
        for key, value in entries.items():
            if group == "sessions" and not isinstance(value, dict):
                problems.append(f"session {key!r} is not a mapping")
                continue
            cells = value if group == "arc_bloom" else value.get("reaches")
            if not cells:
                if group == "sessions":
                    problems.append(f"session {key!r} declares no `reaches` cells")
                continue
            if not isinstance(cells, list):
                field = "Bloom's cells" if group == "arc_bloom" else "`reaches`"
                problems.append(f"{group}.{key} {field} must be a list")
                continue
            reached: set[str] = set()
            for cell in cells:
                try:
                    process, _ = parse_cell(cell)
                except ValueError as exc:
                    problems.append(f"{group}.{key}: {exc}")
                    continue
                reached.add(process)
                if group == "sessions":
                    level_processes.add(process)
            if group == "sessions":
                # §2.1 — every session must reach at least Apply.
                if reached and max(_RANK[p] for p in reached) < _APPLY:
                    problems.append(
                        f"session {key!r} never leaves "
                        f"{'/'.join(sorted(reached, key=_RANK.get))} — a session that does "
                        "not reach Apply is a demonstration, not a lesson (pedagogy.md §2.1)"
                    )
                for kind in value.get("knowledge") or []:
                    if kind not in KNOWLEDGE:
                        problems.append(
                            f"session {key!r}: {kind!r} is not a Bloom's knowledge type "
                            f"({', '.join(sorted(KNOWLEDGE))})"
                        )
                    else:
                        level_knowledge.add(kind)
                if not value.get("assessment"):
                    problems.append(
                        f"session {key!r} declares no `assessment` — formative assessment "
                        "is embedded, not optional (pedagogy.md §3)"
                    )

    ceiling = max((_RANK[p] for p in level_processes), default=-1)
    if ceiling < _ANALYZE:
        problems.append(
            "no session in this level reaches Analyze or higher — a level that "
            "plateaus at Apply teaches procedure without judgement (pedagogy.md §2.2)"
        )
    if _RANK["Create"] not in {_RANK[p] for p in level_processes}:
        problems.append(
            "no session in this level reaches Create (pedagogy.md §2.2)"
        )
    if level_knowledge and level_knowledge == {"Factual"}:
        problems.append(
            "every session's knowledge type is Factual — that is vocabulary "
            "instruction, not a curriculum (pedagogy.md §2.3)"
        )

    evidence = {
        "processes": sorted(level_processes, key=lambda p: _RANK[p]),
        "knowledge": sorted(level_knowledge),
        "ceiling": PROCESSES[ceiling] if ceiling >= 0 else None,
    }
    if problems:
        return GateResult("pedagogy-coverage", FAIL, "; ".join(problems), evidence)
    return GateResult(
        "pedagogy-coverage",
        PASS,
        f"level reaches {PROCESSES[ceiling]}; knowledge {', '.join(sorted(level_knowledge))}",
        evidence,
    )
