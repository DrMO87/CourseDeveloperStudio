"""Refuse a research artifact that declares coverage but authors no task.

`pedagogy_coverage.py` already checks that a level DECLARES it reaches a
given Bloom's process; it cannot check that a real, gradable task exists for
that declaration. This gate checks the companion content a level's research
document must carry: at least one task and answer key tied to a real
objective, not just a passing pedagogy YAML sitting next to an empty file.
"""

from __future__ import annotations

import re

import yaml

from swarm.gates import FAIL, PASS, GateResult, register

_YAML_FENCE = re.compile(
    r"^```yaml[ \t]*\r?\n(.*?)\r?\n```[ \t]*\r?$", re.DOTALL | re.MULTILINE
)

REQUIRED_TASK_FIELDS = ("id", "prompt", "key")


def parse_research(text: str) -> dict:
    """Extract and structurally validate the ```yaml research block. Raises ValueError."""
    matches = list(_YAML_FENCE.finditer(text))
    if not matches:
        raise ValueError(
            "no ```yaml research block found — a research document must author "
            "at least one task, not only declare coverage"
        )
    errors: list[str] = []
    for match in matches:
        try:
            return _parse_research_block(match.group(1))
        except ValueError as exc:
            errors.append(str(exc))
    raise ValueError(f"no valid research block found; last: {errors[-1]}")


def _parse_research_block(block: str) -> dict:
    try:
        doc = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        raise ValueError(f"research block does not parse: {exc}") from exc
    if not isinstance(doc, dict):
        raise ValueError("research block is not a YAML mapping")
    if not isinstance(doc.get("objective"), str) or not doc["objective"].strip():
        raise ValueError("research block declares no `objective`")

    tasks = doc.get("tasks")
    if not isinstance(tasks, list) or not tasks:
        raise ValueError("research block declares no `tasks`")

    seen_ids: set[str] = set()
    for task in tasks:
        if not isinstance(task, dict):
            raise ValueError(f"task {task!r} is not a mapping")
        missing = [
            f
            for f in REQUIRED_TASK_FIELDS
            if not isinstance(task.get(f), str) or not task[f].strip()
        ]
        cites = task.get("cites")
        if (
            not isinstance(cites, list)
            or not cites
            or any(not isinstance(cite, str) or not cite.strip() for cite in cites)
        ):
            missing.append("cites")
        if missing:
            raise ValueError(
                f"task {task.get('id', '?')!r} missing field(s): {', '.join(missing)}"
            )
        tid = task["id"]
        if tid in seen_ids:
            raise ValueError(f"task id {tid!r} is used more than once")
        seen_ids.add(tid)

    doc["_task_ids"] = sorted(seen_ids)
    return doc


@register("research-tasks")
def research_tasks(text: str) -> GateResult:
    try:
        doc = parse_research(text)
    except ValueError as exc:
        return GateResult("research-tasks", FAIL, str(exc))
    return GateResult(
        "research-tasks",
        PASS,
        f"objective {doc['objective']!r}, {len(doc['_task_ids'])} task(s)",
        {"tasks": doc["_task_ids"]},
    )
