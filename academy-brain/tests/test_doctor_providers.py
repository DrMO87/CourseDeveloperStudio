import doctor_providers
from swarm.paths import PROVIDERS


def test_covers_all_swarm_providers():
    assert set(doctor_providers.PROVIDER_COMMANDS) == set(PROVIDERS)


def test_probe_reports_reachable_when_found():
    result = doctor_providers.probe("hermes", which=lambda cmd: "C:/fake/hermes.exe")
    assert result["reachable"] is True
    assert result["path"] == "C:/fake/hermes.exe"


def test_probe_reports_unreachable_when_missing():
    result = doctor_providers.probe("codex", which=lambda cmd: None)
    assert result["reachable"] is False
    assert result["path"] is None


def test_report_marks_missing_providers():
    results = [
        {"name": "hermes", "command": "hermes", "path": "/x/hermes", "reachable": True},
        {"name": "codex", "command": "codex", "path": None, "reachable": False},
    ]
    text = doctor_providers.report(results)
    assert "hermes" in text
    assert "MISSING" in text
    assert "ON PATH" in text


def test_main_exits_nonzero_when_a_provider_is_missing():
    assert doctor_providers.main([], which=lambda cmd: None) == 1


def test_main_exits_zero_when_all_reachable():
    assert doctor_providers.main([], which=lambda cmd: "/usr/bin/" + cmd) == 0
