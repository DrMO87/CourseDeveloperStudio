from pathlib import Path

import pytest
import yaml

WAR_ROOM = Path("D:/vault/academy-brain")
ROOT = WAR_ROOM / ".claude/skills/ethos-v2"
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
