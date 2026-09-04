from swarm import gates
from swarm.gates import brand_palette


def test_approved_palette_passes():
    assert brand_palette.check("background #231F20 accent #FFED10").verdict == gates.PASS


def test_retired_gold_fails():
    result = brand_palette.check("accent color #F5B301")
    assert result.verdict == gates.FAIL
    assert "#F5B301" in result.evidence["retired"]


def test_retired_placeholder_black_fails():
    assert brand_palette.check("bg #1A1A1A").verdict == gates.FAIL


def test_detection_is_case_insensitive():
    assert brand_palette.check("#f5b301").verdict == gates.FAIL


def test_text_without_hex_colors_is_unverified():
    assert brand_palette.check("no colors mentioned").verdict == gates.UNVERIFIED


def test_registered_under_expected_name():
    assert "brand-palette" in gates.REGISTRY
