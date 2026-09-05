---
title: STEP 12 — multi-institute gate parameterization (brand/language config)
date: 2026-09-06
status: complete
---

# STEP 12 — multi-institute gate parameterization

## What this step found

STEP 5 externalized *where* a course's files live (`--root`/`CoursePaths.for_root`). Three
academy-brain gate modules still hardcoded Techno Square's own *rule values* as Python module
constants:

- `academy-brain/scripts/swarm/gates/brand_palette.py:9-10` — `APPROVED`/`RETIRED` hex sets.
- `academy-brain/scripts/swarm/gates/arabic_ratio.py:7-8` — `TARGET_ARABIC`/`TOLERANCE`.
- `academy-brain/scripts/swarm/gates/boundary_check.py` — `TRAINER_MARKERS`/`TRAINER_PATTERNS`
  academy-wide baseline, correctly *not* institute-specific (see below), but the C# port of
  this same check (`BoundaryCheckGate.cs`) never carried that baseline at all.

Separately, Studio's own C# `IQualityGate` implementations (`BrandPaletteGate.cs`,
`LanguageRatioGate.cs`, `BoundaryCheckGate.cs`) were **already** parameterized per
organization — they read `Organization.BrandPalette`/`LanguagePolicy`/`BoundaryTerms` live via
`Batch2ContentQualityGateReevaluator`. That reevaluator's live `Organization` read for these
four fields (brand/language/boundary/asset-citation) is unchanged by this step — it was not
named in this step's Constraints and rewriting it would have been unrequested scope. The one
real reproducibility gap Constraints did name — the NBLM-prompt fields
(`NblmPromptPreflightRepair.cs`) — is fixed below.

## The config-passing mechanism

### Python side: `swarm/org_config.py`

Mirrors `paths.py`'s `for_root`/`CoursePaths` pattern exactly:

- `OrgConfig` (frozen dataclass): `brand_palette` (`approved`/`retired` frozensets),
  `language_policy` (`target_ratio`/`tolerance`), `boundary_terms` (`forbidden_strings` tuple,
  additive — see below).
- `TECHNO_SQUARE_DEFAULT` — the one place Techno Square's values are still hardcoded; every
  gate module now imports this instead of carrying its own copy.
- `for_org_config(path)` — `None` (standalone/manual/legacy invocation, or academy-brain's own
  test suite) returns `TECHNO_SQUARE_DEFAULT`; a real path loads the JSON file and validates
  the schema version plus the fields consumed by the Python gates. The complete serialized
  snapshot contract is defined by `contracts/org-config/org-config.schema.json`.

`gate_runner.py` gained `--org-config <path>`, mirroring `--root`. `run_gates()` threads the
resolved `OrgConfig` to any registered gate whose signature declares a `config` keyword
parameter (checked via `inspect.signature`) — every gate that has no institute-specific rule
values keeps its untouched `fn(text)` single-argument contract.

### C# side: `OrganizationConfigSnapshot`

`GenerationJob -> CourseProject.OrganizationId -> Organization` resolves, once, to an
immutable `OrganizationConfigSnapshot` (`CourseDeveloper.Core.Models`):
`BrandPalette`/`LanguagePolicy`/`BoundaryTerms` (reusing `Organization`'s own config types) plus
the NBLM-prompt fields folded in from STEP 11 Batch 3's review: `DurationMinutes`,
`TargetAgeBand`, `OrganizationName`, `MascotCharacterName`.

`IOrganizationConfigSnapshotResolver` / `OrganizationConfigSnapshotResolver` is the named
resolver Constraints asked for (`CourseDeveloper.Infrastructure/ContentQuality/`). It fails
closed (throws `InvalidOperationException`) if the project, its `OrganizationId`, the
organization, or the session cannot be resolved, or if the session belongs to a different
project — never falls back to Techno Square or any other institute's config (Standing Rule
10a(ii)). Mutable organization collections are copied while resolving so later live-model
changes cannot alter the resolved snapshot.

`OrganizationConfigSnapshotPayload.ToPayloadValue`/`FromJobPayload` convert the snapshot
to/from `GenerationJob.Payload["orgConfigSnapshot"]`, matching
`contracts/org-config/org-config.schema.json`'s shape exactly (`schemaVersion`,
`organizationId`, `brandPalette`, `languagePolicy`, `boundaryTerms`, `nblmPromptFields`).

**No real enqueue call site exists yet** — `IGenerationJobRepository.EnqueueAsync` has no
production caller in this codebase today (confirmed by repo-wide search; the frontend button
sequence that will call it is future work, tracked separately). This step builds the resolver
and snapshot machinery the same way STEP 11 Batch 1 built the cascade primitives ahead of their
real caller: `OrganizationConfigSnapshotResolverTests.cs` exercises `ResolveAsync` end to end
against a real `Organization`/`CourseProject`/`CourseSession` chain (using Horus University's
actual published brand values) and proves the resulting snapshot round-trips through both
the direct dictionary and real-jsonb-shaped `JsonElement` payload forms field-for-field
unchanged — the concrete "C# adapter test" the exit criteria ask for.
Whichever future endpoint calls `EnqueueAsync` must call this resolver first and write its
result into the job's payload before the job becomes immutable.

## Before/after, gate by gate

| Gate | Before | After |
|---|---|---|
| `brand_palette.py` (`brand-palette`) | Module-level `APPROVED`/`RETIRED` frozensets, Techno Square's literal hex codes | `check(text, *, config=None)`; `config.brand_palette.retired` (or `TECHNO_SQUARE_DEFAULT` if `config` is `None`). Retired-only rejection semantics unchanged — `approved` is still never enforced as an allowlist. |
| `arabic_ratio.py` (`arabic-ratio`) | Module-level `TARGET_ARABIC = 0.70`/`TOLERANCE = 0.10` | `check(text, *, config=None)`; both values read from `config.language_policy`. Arabic/Latin Unicode classifiers stay fixed (out of scope — see the ticket's own note; a third script is a separate, explicitly-authorized change). |
| `boundary_check.py` (`trainer-boundary`) | `TRAINER_MARKERS`/`TRAINER_PATTERNS` baseline only, no institute-specific term support | Baseline unchanged and still mandatory; `config.boundary_terms.forbidden_strings` unioned on top, additive only. |
| `BoundaryCheckGate.cs` (C#, `boundary_check`) | Checked **only** `Organization.BoundaryTerms.ForbiddenStrings`; an empty/unset list made it report `UNVERIFIED` instead of running any check at all | Ports `TRAINER_MARKERS`/`TRAINER_PATTERNS` (including the clock-time-timeline regex) as a mandatory baseline that always runs; `ForbiddenStrings` unioned on top, additive. An empty override list now correctly still runs the baseline instead of reporting `UNVERIFIED`. |
| `NblmPromptPreflightFactCorrector` / the nblm-prompt-preflight reevaluator branch | Read `CourseSession.DurationMinutes`/`CourseProject.TargetAgeBand`/`Organization.Name`/`Organization.MascotConfig.CharacterName` live via `ISessionRepository`/`IProjectRepository`/`IOrganizationRepository` at correction/re-evaluation time | Read the same four fields from the job's immutable `OrganizationConfigSnapshot` instead — a queued/retried job renders identical instructions regardless of any mid-flight config change. `NblmPromptPreflightFactCorrector` no longer depends on any of the three repositories. |

## The `boundary_check` additive-union design, and why

`TRAINER_MARKERS`/`TRAINER_PATTERNS` detect academy-wide student-facing-content hygiene
(trainer notes, timing, clock-time timelines) — not an institute's brand identity. An institute
opting into `boundary_check` must never be able to silently *replace* that baseline by
supplying its own (possibly empty, possibly partial) `ForbiddenStrings` list; the fix is a
plain set union: baseline markers always run, org-specific terms are strictly additive on top.
This applies identically to both the Python gate and its C# port.

## Worked example: Horus University's real values

From `vaults/Inst-Analysis/02_Areas/horus-university-egypt/Brand_Identity_Contract.md`:
approved `["#002147", "#FFB81C", "#1929B5", "#0F766E"]`, retired `["#FF0000", "#990000"]`.

`academy-brain/tests/test_org_config.py` proves, against these exact values:

- `brand_palette.check("accent #FF0000", config=horus_cfg)` → **FAIL** (Horus's own retired
  color).
- `brand_palette.check("accent #002147", config=horus_cfg)` → **PASS** (Horus's own approved
  color).
- `brand_palette.check("accent #231F20", config=horus_cfg)` → **PASS** — Techno Square's own
  color is not in Horus's retired set, and the gate is retired-only, not an allowlist, so it
  correctly does not fail under Horus's config either (matching the exit criteria's explicit
  "should not" requirement).

`OrganizationConfigSnapshotResolverTests.cs` proves the same Horus values (plus `TargetRatio`,
`Tolerance`, an additive boundary term, and the mascot name "Academic Avatar") resolve from a
real `Organization`/`CourseProject`/`CourseSession` chain and round-trip through
`GenerationJob.Payload` field-for-field unchanged. It also covers the `JsonElement` shape
produced by a jsonb round-trip, including a null mascot.

## Verification

- `dotnet build CourseDeveloper.sln`: succeeded with 0 errors; 8 `NU1900` warnings because
  the restricted environment could not reach NuGet's vulnerability-data service.
- `dotnet test CourseDeveloper.sln --no-build`: 138 passed, 0 failed, 0 skipped (was 124 before
  this step; +14 new STEP 12 tests, 0 regressions — one pre-existing test asserting the
  `boundary_check` `UNVERIFIED`-on-empty-list bug was updated to assert the fixed, correct
  behavior instead).
- academy-brain `pytest -q`: 440 passed, 4 skipped, 8 failed, 17 errors (was 430/4/8/17 before
  this step; +10 new `test_org_config.py` tests, 0 regressions — the 8 failed/17 errors are the
  pre-existing `test_new_course.py` scaffold-missing-input cases, unrelated to this work).

## Scope confirmed unchanged

- No gate's detection algorithm changed — only constant/config sourcing (`brand_palette.py`
  stays retired-only; `arabic_ratio.py`'s Arabic/Latin classifiers are unchanged).
- `Organization.cs`'s shape is unchanged and used as-is.
- No STEP 11 (NBLM prompt authoring) or STEP 10 (vault-sync) work performed here beyond the
  one explicitly-named NBLM-prompt-fields snapshot extension.
- `Batch2ContentQualityGateReevaluator`'s live `Organization` read for brand/language/boundary/
  asset-citation is untouched — not named in this step's Constraints, and rewriting an
  already-working, already-tested reevaluator was not requested.
