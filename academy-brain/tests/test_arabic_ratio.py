from swarm import gates
from swarm.gates import arabic_ratio

# mostly Arabic, within tolerance - should pass
ARABIC_HEAVY = (
    "الميكروبيت كمبيوتر صغير تقدر تبرمجه بنفسك وتعمل بيه حاجات كتير جدا "
    "وتشوف النتيجة على الشاشة الصغيرة بتاعته The micro:bit is programmable"
)
# 8% Arabic, 92% English - should fail
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
