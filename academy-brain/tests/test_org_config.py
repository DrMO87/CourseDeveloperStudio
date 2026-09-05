import json

import pytest

from swarm import org_config
from swarm.gates import arabic_ratio, boundary_check, brand_palette

# Horus University's real values, from
# vaults/Inst-Analysis/02_Areas/horus-university-egypt/Brand_Identity_Contract.md
HORUS_APPROVED = ["#002147", "#FFB81C", "#1929B5", "#0F766E"]
HORUS_RETIRED = ["#FF0000", "#990000"]


def horus_payload(**overrides) -> dict:
    payload = {
        "schemaVersion": 1,
        "brandPalette": {"approved": HORUS_APPROVED, "retired": HORUS_RETIRED},
        "languagePolicy": {"targetRatio": 0.70, "tolerance": 0.10},
        "boundaryTerms": {"forbiddenStrings": []},
    }
    payload.update(overrides)
    return payload


def test_for_org_config_with_no_path_is_techno_square_default():
    assert org_config.for_org_config(None) is org_config.TECHNO_SQUARE_DEFAULT


def test_parse_org_config_rejects_unsupported_schema_version():
    with pytest.raises(ValueError):
        org_config.parse_org_config(horus_payload(schemaVersion=2))


def test_for_org_config_loads_a_real_file(tmp_path):
    path = tmp_path / "org-config.json"
    path.write_text(json.dumps(horus_payload()), encoding="utf-8")
    cfg = org_config.for_org_config(path)
    assert cfg.brand_palette.retired == frozenset(HORUS_RETIRED)
    assert cfg.brand_palette.approved == frozenset(HORUS_APPROVED)


def test_horus_retired_color_fails_under_horus_config():
    """Exit criteria worked example: Horus's own retired colors fail under Horus's config."""
    cfg = org_config.parse_org_config(horus_payload())
    result = brand_palette.check("accent #FF0000", config=cfg)
    assert result.verdict == "FAIL"
    assert "#FF0000" in result.evidence["retired"]


def test_horus_approved_color_passes_under_horus_config():
    cfg = org_config.parse_org_config(horus_payload())
    result = brand_palette.check("accent #002147", config=cfg)
    assert result.verdict == "PASS"


def test_techno_square_palette_does_not_fail_under_horus_config():
    """The gate is retired-only, not an allowlist — Techno Square's colors are simply not
    in Horus's retired set, so they pass under Horus's config too."""
    cfg = org_config.parse_org_config(horus_payload())
    result = brand_palette.check("accent #231F20", config=cfg)
    assert result.verdict == "PASS"


def test_brand_palette_with_no_config_still_uses_techno_square_default():
    """Standalone/legacy invocation with no --org-config keeps today's exact behavior."""
    assert brand_palette.check("accent #F5B301").verdict == "FAIL"
    assert brand_palette.check("accent #F5B301", config=None).verdict == "FAIL"


def test_arabic_ratio_target_and_tolerance_both_come_from_config():
    # Same ~8% Arabic / 92% English text as test_arabic_ratio.py's ENGLISH_HEAVY.
    english_heavy = (
        "The micro:bit is a tiny programmable computer with an LED grid, "
        "two buttons, and a range of built in sensors ميكروبيت"
    )
    default_result = arabic_ratio.check(english_heavy)
    assert default_result.verdict == "FAIL"  # fails Techno Square's 70%/10% default

    cfg = org_config.parse_org_config(
        horus_payload(languagePolicy={"targetRatio": 0.10, "tolerance": 0.05})
    )
    configured_result = arabic_ratio.check(english_heavy, config=cfg)
    assert configured_result.verdict == "PASS"  # passes a 10%-Arabic-target institute


def test_boundary_check_baseline_runs_even_with_empty_org_config_list():
    """An institute cannot silently erase the mandatory TRAINER_MARKERS baseline by
    supplying an empty forbiddenStrings override."""
    cfg = org_config.parse_org_config(horus_payload())
    result = boundary_check.check("Trainer note: 5 minutes for this activity.", config=cfg)
    assert result.verdict == "FAIL"


def test_boundary_check_unions_org_terms_with_the_baseline_not_replaces_it():
    cfg = org_config.parse_org_config(
        horus_payload(boundaryTerms={"forbiddenStrings": ["confidential faculty memo"]})
    )
    # The institute-specific term fires...
    assert boundary_check.check("This is a confidential faculty memo.", config=cfg).verdict == "FAIL"
    # ...and the baseline marker still fires too, proving it wasn't replaced.
    assert boundary_check.check("Trainer note: 5 minutes.", config=cfg).verdict == "FAIL"
