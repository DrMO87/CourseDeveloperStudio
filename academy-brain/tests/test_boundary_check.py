from swarm import gates, prepare
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
    assert "trainer note" in result.evidence["matches"][0].lower()


def test_detects_expected_answer():
    assert boundary_check.check(LEAKED_ANSWER).verdict == gates.FAIL


def test_detects_arabic_trainer_marker():
    assert boundary_check.check(LEAKED_ARABIC).verdict == gates.FAIL


def test_detection_is_case_insensitive():
    assert boundary_check.check("EXPECTED ANSWER: yes").verdict == gates.FAIL


def test_detects_clock_time_timeline():
    result = boundary_check.check("شوف بيحصل إيه.\n\n00:00-00:10 Warm-up and recap.")
    assert result.verdict == gates.FAIL
    assert "clock-time timeline" in result.evidence["matches"]


def test_detects_single_digit_hour_timeline():
    assert boundary_check.check("0:10 — 1:30 build the conveyor").verdict == gates.FAIL


def test_clock_time_rejects_impossible_time_components():
    assert boundary_check.check("Sensor readings 12:34-56:78").verdict == gates.PASS


def test_clock_time_does_not_fire_on_a_bare_duration():
    assert boundary_check.check("استنى 10 ثواني بعد ما تشغل الموتور.").verdict == gates.PASS


def test_detects_session_flow():
    assert boundary_check.check("Session flow: warm-up, build, test.").verdict == gates.FAIL


def test_detects_trainer_timing():
    assert boundary_check.check("Trainer timing: allow 10 minutes.").verdict == gates.FAIL


def test_detects_debugging_note():
    assert boundary_check.check("Debugging note: check port C first.").verdict == gates.FAIL


def test_detects_reflection_question():
    assert boundary_check.check("Reflection question: what changed?").verdict == gates.FAIL


def test_detects_exit_ticket():
    assert boundary_check.check("Exit ticket: name one Subsystem.").verdict == gates.FAIL


def test_empty_text_is_unverified():
    assert boundary_check.check("").verdict == gates.UNVERIFIED


def test_slide_budget_note_naming_absent_trainer_content_does_not_fire():
    """A slide-source's trailing budget note lists trainer sections to say they
    are ABSENT. Prepared text must drop it, or every real deck fails the gate."""
    raw = (
        "---\ntype: student-slides-source\naudience: STUDENT-FACING\n---\n\n"
        "## Slide 1\n\nالميكروبيت كمبيوتر صغير.\n\n"
        "## Slide budget note\n\n"
        "No trainer-only content (Time/Trainer Flow, Exit Ticket) appears in this file.\n"
    )
    text, audience = prepare.learner_text(raw)
    assert audience == prepare.STUDENT
    assert boundary_check.check(text).verdict == gates.PASS


def test_trainer_guide_with_only_lock_frontmatter_is_not_student():
    """Shipped Trainer Guides carry lock metadata and no audience/type/role.
    Read as student, they get the trainer gates — and §1d's mandated clock-time
    flow then fails the very artifact required to contain it."""
    raw = (
        "---\nstatus: locked\ngenerated: true\n---\n\n"
        "# EV3 Robotics — Level 2 — Trainer Guide\n\n*INTERNAL USE ONLY*\n\n"
        "00:00-00:10 Warm-up.\n"
    )
    text, audience = prepare.learner_text(raw)
    assert audience == prepare.TRAINER
    run, skip = prepare.applicable(["trainer-boundary"], audience)
    assert run == [] and skip == ["trainer-boundary"]


def test_registered_under_expected_name():
    assert "trainer-boundary" in gates.REGISTRY
