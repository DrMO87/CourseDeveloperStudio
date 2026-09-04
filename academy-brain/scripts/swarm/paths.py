"""Config-bound path derivation for the swarm vault."""

from __future__ import annotations

import re
from pathlib import Path

from .config import CourseConfig, load_course


class CoursePaths:
    """Path API bound to one vault root and its course manifest."""

    def __init__(self, root: Path, course: CourseConfig) -> None:
        self.VAULT_ROOT = Path(root)
        self.COURSE = course
        self.LEVELS = course.levels
        self.SESSION_NUMBERS = tuple(range(1, course.sessions_per_level + 1))
        self.SESSION_IDS = tuple(
            f"L{level}-s{session}"
            for level in self.LEVELS
            for session in self.SESSION_NUMBERS
        )
        self.PROVIDERS = course.providers
        self._session_re = re.compile(
            rf"^(?:{'|'.join(re.escape(sid) for sid in self.SESSION_IDS)})$"
        )

    def validate_session_id(self, sid: str) -> str:
        """Return sid unchanged, or raise ValueError if it is not configured."""
        if not isinstance(sid, str) or not self._session_re.fullmatch(sid):
            raise ValueError(f"invalid session id {sid!r}; expected one of {self.SESSION_IDS}")
        return sid

    def produces_artifacts(self, sid: str) -> bool:
        return self.COURSE.produces_artifacts(self.validate_session_id(sid))

    def _artifact_session_id(self, sid: str) -> str:
        sid = self.validate_session_id(sid)
        if not self.COURSE.produces_artifacts(sid):
            raise ValueError(f"session {sid!r} does not produce artifacts")
        return sid

    def digest_path(self, sid: str) -> Path:
        return self.VAULT_ROOT / self.COURSE.stages.digest / f"{self._artifact_session_id(sid)}.md"

    def assets_dir(self, sid: str) -> Path:
        return (
            self.VAULT_ROOT
            / self.COURSE.stages.digest
            / self.COURSE.stages.digest_assets
            / self._artifact_session_id(sid)
        )

    def provenance_path(self, sid: str) -> Path:
        return self.VAULT_ROOT / self.COURSE.stages.provenance / f"{self._artifact_session_id(sid)}.md"

    def lane_path(self, stage: str, sid: str, provider: str) -> Path:
        """Per-provider lane file; stage names are deliberately pipeline-owned."""
        if provider not in self.PROVIDERS:
            raise ValueError(f"unknown provider {provider!r}; expected one of {sorted(self.PROVIDERS)}")
        return self.VAULT_ROOT / stage / self._artifact_session_id(sid) / f"{provider}.json"

    def merged_path(self, stage: str, sid: str) -> Path:
        """Single-owner output; stage names are deliberately pipeline-owned."""
        return self.VAULT_ROOT / stage / f"{self._artifact_session_id(sid)}.md"

    def receipt_path(self, sid: str, gate: str) -> Path:
        return self.VAULT_ROOT / self.COURSE.stages.receipts / f"{self.validate_session_id(sid)}.{gate}.yaml"


def for_root(root: Path) -> CoursePaths:
    """Load ``root/course.yaml`` and return a path API bound to that root."""
    root = Path(root)
    return CoursePaths(root, load_course(root))


VAULT_ROOT = Path(__file__).resolve().parents[2]

# STEP 5 (CourseDeveloperStudio monorepo integration): this used to eagerly
# call for_root(VAULT_ROOT) here, at import time. That required a course.yaml
# to sit right next to this file — true only while this engine's code and its
# course vault content lived in the same directory tree. Now that the code
# moved into the monorepo while course vaults stay wherever they're deployed
# (passed in per job via CoursePaths.for_root(root)), importing this module
# must never require a local course.yaml. The legacy module-level names below
# (COURSE, SESSION_IDS, validate_session_id(), ...) are for standalone/manual
# runs only; they resolve lazily, on first actual use, against VAULT_ROOT.
_default: "CoursePaths | None" = None


def _get_default() -> CoursePaths:
    global _default
    if _default is None:
        _default = for_root(VAULT_ROOT)
    return _default


_LAZY_DEFAULT_ATTRS = {
    "COURSE": "COURSE",
    "LEVELS": "LEVELS",
    "SESSION_NUMBERS": "SESSION_NUMBERS",
    "SESSION_IDS": "SESSION_IDS",
    "PROVIDERS": "PROVIDERS",
    "_SESSION_RE": "_session_re",
}


def __getattr__(name: str):
    """PEP 562 lazy module attributes for the legacy standalone-default names."""
    if name in _LAZY_DEFAULT_ATTRS:
        return getattr(_get_default(), _LAZY_DEFAULT_ATTRS[name])
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def validate_session_id(sid: str) -> str:
    return _get_default().validate_session_id(sid)


def produces_artifacts(sid: str) -> bool:
    return _get_default().produces_artifacts(sid)


def digest_path(sid: str) -> Path:
    return _get_default().digest_path(sid)


def assets_dir(sid: str) -> Path:
    return _get_default().assets_dir(sid)


def provenance_path(sid: str) -> Path:
    return _get_default().provenance_path(sid)


def lane_path(stage: str, sid: str, provider: str) -> Path:
    return _get_default().lane_path(stage, sid, provider)


def merged_path(stage: str, sid: str) -> Path:
    return _get_default().merged_path(stage, sid)


def receipt_path(sid: str, gate: str) -> Path:
    return _get_default().receipt_path(sid, gate)
