from pathlib import Path

import pytest
import yaml

WAR_ROOM = Path("D:/vault/academy-brain")
SKILL = WAR_ROOM / ".claude/skills/hermes-delegate/SKILL.md"


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
