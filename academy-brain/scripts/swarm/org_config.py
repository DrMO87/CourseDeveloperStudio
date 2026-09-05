"""Per-job institute rule-value config for gates whose thresholds vary by organization.

STEP 12 (CourseDeveloperStudio multi-institute gate parameterization): `brand_palette.py`'s
`APPROVED`/`RETIRED` and `arabic_ratio.py`'s `TARGET_ARABIC`/`TOLERANCE` used to be Techno
Square's literal values hardcoded as module constants — wrong for any other institute (see
Horus University's own retired palette in
`vaults/Inst-Analysis/02_Areas/horus-university-egypt/Brand_Identity_Contract.md`). This
module carries those values as data instead, loaded per job from a config file the C# adapter
writes (see `contracts/org-config/org-config.schema.json`), with Techno Square's own values
remaining the default for any standalone/manual/legacy invocation that supplies no config —
exactly the pattern `paths.py` established for `--root`/`CoursePaths.for_root`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

SCHEMA_VERSION = 1


@dataclass(frozen=True)
class BrandPaletteConfig:
    approved: frozenset[str]
    retired: frozenset[str]


@dataclass(frozen=True)
class LanguagePolicyConfig:
    target_ratio: float
    tolerance: float


@dataclass(frozen=True)
class BoundaryTermsConfig:
    # Additive institute-specific terms only — the trainer-boundary gate's TRAINER_MARKERS/
    # TRAINER_PATTERNS baseline is mandatory and always runs regardless of this list; see
    # boundary_check.py's module docstring.
    forbidden_strings: tuple[str, ...] = ()


@dataclass(frozen=True)
class OrgConfig:
    brand_palette: BrandPaletteConfig
    language_policy: LanguagePolicyConfig
    boundary_terms: BoundaryTermsConfig = field(default_factory=BoundaryTermsConfig)


# Techno Square's literal values — formerly brand_palette.py's own APPROVED/RETIRED and
# arabic_ratio.py's own TARGET_ARABIC/TOLERANCE. This is now the one place they are
# hardcoded; both gate modules resolve here instead of carrying their own copy, and this is
# the value standalone/manual invocations (no --org-config given) still get.
TECHNO_SQUARE_DEFAULT = OrgConfig(
    brand_palette=BrandPaletteConfig(
        approved=frozenset({"#231F20", "#FFED10", "#585858", "#FFFFFF"}),
        retired=frozenset({"#F5B301", "#1A1A1A"}),
    ),
    language_policy=LanguagePolicyConfig(target_ratio=0.70, tolerance=0.10),
)


def parse_org_config(payload: dict) -> OrgConfig:
    """Parse and validate one org-config payload (see the schema file for the contract)."""
    version = payload.get("schemaVersion")
    if version != SCHEMA_VERSION:
        raise ValueError(
            f"unsupported org-config schemaVersion {version!r}; expected {SCHEMA_VERSION}"
        )

    palette = payload.get("brandPalette") or {}
    language = payload.get("languagePolicy") or {}
    boundary = payload.get("boundaryTerms") or {}

    if "approved" not in palette or "retired" not in palette:
        raise ValueError("org-config brandPalette must declare both 'approved' and 'retired'")
    if "targetRatio" not in language or "tolerance" not in language:
        raise ValueError("org-config languagePolicy must declare both 'targetRatio' and 'tolerance'")

    return OrgConfig(
        brand_palette=BrandPaletteConfig(
            approved=frozenset(palette["approved"]),
            retired=frozenset(palette["retired"]),
        ),
        language_policy=LanguagePolicyConfig(
            target_ratio=float(language["targetRatio"]),
            tolerance=float(language["tolerance"]),
        ),
        boundary_terms=BoundaryTermsConfig(
            forbidden_strings=tuple(boundary.get("forbiddenStrings", [])),
        ),
    )


def for_org_config(path: Path | str | None) -> OrgConfig:
    """Load an org-config JSON file, or return Techno Square's default.

    Mirrors `paths.for_root`: a real per-job invocation passes an explicit path (the file the
    C# adapter wrote from the job's immutable organization snapshot); a standalone/manual run
    (direct `generate_session.py`/`gate_runner.py` invocation, or academy-brain's own test
    suite) passes none and gets Techno Square's values, matching today's behavior exactly.
    """
    if path is None:
        return TECHNO_SQUARE_DEFAULT
    return parse_org_config(json.loads(Path(path).read_text(encoding="utf-8")))
