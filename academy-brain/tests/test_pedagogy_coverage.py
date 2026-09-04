import pytest
import yaml

from swarm.gates import FAIL, PASS, UNVERIFIED, pedagogy_coverage as pc

ARC = ["Think", "Create", "Evaluate", "Extend", "Share"]
ARC_BLOOM = {
    "Think": ["Remember/recalling", "Understand/inferring"],
    "Create": ["Apply/executing"],
    "Evaluate": ["Evaluate/checking"],
    "Extend": ["Analyze/differentiating", "Create/generating"],
    "Share": ["Understand/explaining", "Evaluate/critiquing"],
}


def record(sessions, arc=ARC, arc_bloom=ARC_BLOOM):
    return yaml.safe_dump(
        {"level": 1, "arc": arc, "arc_bloom": arc_bloom, "sessions": sessions}
    )


def session(reaches, knowledge=("Factual", "Procedural"), assessment="demo the artefact"):
    return {"reaches": list(reaches), "knowledge": list(knowledge), "assessment": assessment}


def run(text):
    return pc.pedagogy_coverage(text)


# --- the coverage rules ----------------------------------------------------


def test_a_level_meeting_every_rule_passes():
    r = run(record({
        "L1-s1": session(["Remember/recalling", "Apply/executing"]),
        "L1-s2": session(["Apply/implementing", "Analyze/attributing"], ["Conceptual"]),
        "L1-s3": session(["Create/producing"], ["Procedural", "Metacognitive"]),
    }))
    assert r.verdict == PASS
    assert r.evidence["ceiling"] == "Create"


def test_session_that_never_reaches_apply_is_a_demonstration_not_a_lesson():
    r = run(record({
        "L1-s1": session(["Remember/recalling", "Understand/summarizing"]),
        "L1-s2": session(["Analyze/organizing", "Create/planning"]),
    }))
    assert r.verdict == FAIL
    assert "demonstration, not a lesson" in r.detail


def test_level_that_plateaus_at_apply_fails():
    r = run(record({
        "L1-s1": session(["Apply/executing"]),
        "L1-s2": session(["Apply/implementing"]),
    }))
    assert r.verdict == FAIL
    assert "plateaus at Apply" in r.detail


def test_level_never_reaching_create_fails():
    r = run(record({
        "L1-s1": session(["Apply/executing", "Analyze/attributing"]),
    }))
    assert r.verdict == FAIL
    assert "reaches Create" in r.detail


def test_uniformly_factual_knowledge_is_vocabulary_instruction():
    r = run(record({
        "L1-s1": session(["Apply/executing"], ["Factual"]),
        "L1-s2": session(["Analyze/attributing", "Create/generating"], ["Factual"]),
    }))
    assert r.verdict == FAIL
    assert "vocabulary" in r.detail


def test_session_without_assessment_fails():
    r = run(record({
        "L1-s1": session(["Apply/executing", "Analyze/attributing", "Create/generating"],
                         assessment=None),
    }))
    assert r.verdict == FAIL
    assert "no `assessment`" in r.detail


# --- the arc is declared, not assumed --------------------------------------


def test_a_course_may_name_its_own_arc():
    """Nothing in the gate knows Think/Create/Evaluate/Extend/Share."""
    r = run(record(
        {"L2-s1": session(["Apply/executing", "Analyze/attributing", "Create/producing"])},
        arc=["Observe", "Build", "Break", "Rebuild"],
        arc_bloom={
            "Observe": ["Understand/interpreting"],
            "Build": ["Apply/executing"],
            "Break": ["Analyze/attributing"],
            "Rebuild": ["Create/producing"],
        },
    ))
    assert r.verdict == PASS


def test_arc_stage_declaring_no_cells_fails():
    r = run(record(
        {"L1-s1": session(["Apply/executing", "Analyze/attributing", "Create/generating"])},
        arc_bloom={**ARC_BLOOM, "Share": []},
    ))
    assert r.verdict == FAIL
    assert "declares no Bloom's cells" in r.detail


def test_arc_bloom_naming_a_stage_outside_the_arc_fails():
    r = run(record(
        {"L1-s1": session(["Apply/executing", "Analyze/attributing", "Create/generating"])},
        arc_bloom={**ARC_BLOOM, "Ponder": ["Remember/recalling"]},
    ))
    assert r.verdict == FAIL
    assert "not in the declared arc" in r.detail


def test_non_mapping_session_fails_without_crashing():
    r = run(record({"L1-s1": ["Create/producing"]}))

    assert r.verdict == FAIL
    assert "not a mapping" in r.detail


def test_reaches_must_be_a_list_not_a_string():
    r = run(record({"L1-s1": {
        "reaches": "Create/producing",
        "knowledge": ["Procedural"],
        "assessment": "demo",
    }}))

    assert r.verdict == FAIL
    assert "reaches" in r.detail and "list" in r.detail


def test_arc_stage_names_must_be_strings():
    r = run(record(
        {"L1-s1": {
            "reaches": ["Create/producing"],
            "knowledge": ["Procedural"],
            "assessment": "demo",
        }},
        arc=[["not", "hashable"]],
        arc_bloom={},
    ))

    assert r.verdict == FAIL
    assert "arc stage" in r.detail and "string" in r.detail


# --- cell vocabulary -------------------------------------------------------


def test_parse_cell_accepts_a_bare_process():
    assert pc.parse_cell("Analyze") == ("Analyze", None)


def test_unknown_process_is_refused():
    with pytest.raises(ValueError):
        pc.parse_cell("Synthesis/whatever")  # 1956 category, not in the revision


def test_subprocess_belonging_to_another_process_is_refused():
    with pytest.raises(ValueError):
        pc.parse_cell("Apply/critiquing")  # critiquing is Evaluate's


def test_bad_cell_in_a_record_fails_the_gate():
    r = run(record({"L1-s1": session(["Apply/teleporting"])}))
    assert r.verdict == FAIL
    assert "not a subprocess" in r.detail


def test_unknown_knowledge_type_fails():
    r = run(record({
        "L1-s1": session(["Apply/executing", "Analyze/attributing", "Create/generating"],
                         ["Factual", "Vibes"]),
    }))
    assert r.verdict == FAIL
    assert "not a Bloom's knowledge type" in r.detail


# --- malformed records -----------------------------------------------------


def test_unparseable_record_is_unverified_not_pass():
    assert run("[: not yaml").verdict == UNVERIFIED


def test_missing_sections_fail():
    assert run(yaml.safe_dump({"level": 1})).verdict == FAIL


def test_gate_is_registered():
    from swarm import gates

    assert "pedagogy-coverage" in gates.REGISTRY
