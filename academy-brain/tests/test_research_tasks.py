import yaml

from swarm import gates
from swarm.gates import research_tasks

BLOCK = {
    "objective": "O1",
    "tasks": [
        {"id": "A1", "prompt": "trace the loop", "key": "K1", "cites": ["C1"]},
    ],
}


def _doc(block: dict) -> str:
    return "# Research\n\n```yaml\n" + yaml.safe_dump(block) + "```\n"


def test_valid_research_passes():
    result = research_tasks.research_tasks(_doc(BLOCK))
    assert result.verdict == gates.PASS
    assert result.evidence["tasks"] == ["A1"]


def test_skips_unrelated_yaml_fence_and_accepts_crlf_research_block():
    text = (
        "# Research\r\n\r\n```yaml\r\nmetadata: only\r\n```\r\n\r\n"
        + _doc(BLOCK).replace("\n", "\r\n")
    )
    assert research_tasks.research_tasks(text).verdict == gates.PASS


def test_declaration_with_no_yaml_block_fails():
    assert research_tasks.research_tasks("# Research\n\nreaches: Apply\n").verdict == gates.FAIL


def test_missing_objective_fails():
    doc = {**BLOCK, "objective": ""}
    assert research_tasks.research_tasks(_doc(doc)).verdict == gates.FAIL


def test_no_tasks_fails():
    doc = {**BLOCK, "tasks": []}
    assert research_tasks.research_tasks(_doc(doc)).verdict == gates.FAIL


def test_task_without_citation_fails():
    doc = {"objective": "O1", "tasks": [{"id": "A1", "prompt": "p", "key": "K1", "cites": []}]}
    assert research_tasks.research_tasks(_doc(doc)).verdict == gates.FAIL


def test_duplicate_task_id_fails():
    task = BLOCK["tasks"][0]
    doc = {"objective": "O1", "tasks": [task, task]}
    assert research_tasks.research_tasks(_doc(doc)).verdict == gates.FAIL


def test_non_string_task_id_fails_without_crashing():
    doc = {**BLOCK, "tasks": [{**BLOCK["tasks"][0], "id": []}]}
    assert research_tasks.research_tasks(_doc(doc)).verdict == gates.FAIL


def test_registered_under_expected_name():
    assert "research-tasks" in gates.REGISTRY
