---
step: 5
owner: backend-dev + coder
status: pending
date: 2026-09-04
---

# STEP 5 — academy-brain job contract and subprocess adapter

## Scope note

Per the ticket's exit criteria, this step requires "one end-to-end Techno
Square course must actually run through this path before the step is called
done." That did **not** happen — see [What's blocked, honestly](#whats-blocked-honestly)
below. Everything else in scope is done and independently verified. Status is
`pending` per Standing Rule 3 (agents never self-mark approved); given the
unmet exit criterion, this is pending both user review and the live run, not
just a commit approval.

## 1. Move manifest — academy-brain engine source into the monorepo

Moved (copied, not `git mv` — see [Old repo disposition](#old-repo-disposition)):

```
D:\vault\SM\CourseDeveloperStudio\academy-brain\
├── pyproject.toml
├── uv.lock
├── course.yaml          # NEW — see below, not part of the ticket's literal list
├── scripts/              # doctor_providers.py, run_digest.py, scaffold_vault.py, swarm/
├── 00-contracts/
├── docs/                 # NOT in the ticket's literal file list — added because STEP 9
│                          # explicitly expects "academy-brain's monorepo copies of
│                          # docs\ENGINE.md" to already exist after this step
└── tests/
```

Deliberately **not** moved (this is course *content*, not the engine — stays
at `D:\vault\academy-brain`, referenced per-job via `--root`):
`10-digest/` … `90-receipts/`, `Techno Square identity/`, `Abdeen_Moon_OS_Docs/`,
the real (non-template) `course.yaml`, and every other vault-content directory.

**Diff verification:** every moved file was byte-diffed against its pre-move
source. Only the two files intentionally patched (`scripts/swarm/paths.py`,
`scripts/swarm/generate_session.py` — see §3 below) differ; every other moved
file is identical to the pre-move source.

**`course.yaml` addition:** the ticket's file list didn't name this, but
`scripts/swarm/paths.py` loads a manifest **at import time**, so the moved
code was not importable at all without one. The old repo's `course.yaml` is
explicitly a "TEMPLATE MANIFEST, NOT A COURSE" (its own header comment) —
generic placeholder config, not Techno Square content — so copying it in is
scaffolding the toolchain needs, not a content leak.

### Old repo disposition

`D:\vault\academy-brain` is marked archived (`ARCHIVED.md`, plus a warning
banner in its `CLAUDE.md`): its `scripts/`, `00-contracts/`, `tests/`,
`docs/`, `pyproject.toml`, `uv.lock` are now stale duplicates, and all future
code changes go in the monorepo copy only (Standing Rule 9). **They were not
deleted from the old location** — that's a judgment call: deleting a live
working tree's source files outright, without confirming the monorepo copy
runs correctly end-to-end first, is a bigger and less reversible action than
this step strictly required. The old directory's *content* (`10-digest`
through `90-receipts`, brand assets, the real `course.yaml`) was never part of
the move and continues to live there as the vault the adapter's `--root`
points at.

## 2. Job contract — `contracts/generation-job/`

- `request.schema.json` — shape of `GenerationJob.Payload` for operation
  `academy-brain.generate-session`: `contractVersion` (const 1),
  `sessionId`, `courseVaultRoot`, `live`, `pythonExecutable` (required only
  when `live: true`).
- `result.schema.json` — shape of `GenerationJobExecutionResult.ResultManifest`
  on success: `contractVersion`, `studioBuild.commitSha` (the Studio commit
  that ran the job — per DEC-004 there is no separate academy-brain release
  to pin), `sessionId`, `exitCode`, `stdoutTail`/`stderrTail`, `receiptPath`,
  and `pedagogy` (real `pedagogy-coverage` gate output — see §4).
- `fixtures/request.dry-run.json`, `fixtures/result.dry-run-success.json` —
  worked examples.

`contractVersion` is the schema's own version, kept explicitly separate from
`studioBuild.commitSha` (STEP 2's blocker #3 resolution / DEC-004's effect on
decision 2) — a queued job can survive a deployment, so a worker needs both
"which contract shape is this" and "which Studio build actually ran this."

## 3. academy-brain de-hardcoding — the concrete change

**`scripts/swarm/paths.py`:** `_DEFAULT = for_root(VAULT_ROOT)` used to run
**at import time**, requiring a `course.yaml` next to the file. That broke
outright once the code and its course content moved to separate directories
(confirmed by running the pre-existing test suite against the moved copy —
9 of 9 test files failed collection). Fixed via a lazy `_get_default()` +
PEP 562 module `__getattr__`: the legacy module-level names (`COURSE`,
`SESSION_IDS`, `validate_session_id()`, …) now resolve on first actual use,
not at import. `for_root(root)` itself is unchanged — this only removes the
eager default.

**`scripts/swarm/generate_session.py`:**
- Added `--root` (optional; defaults to the standalone singleton for manual
  runs). When given, `main()` rebuilds `CoursePaths.for_root(root)` and
  rebinds the six process-global path names (`VAULT`, `COURSE`, `BRAND`,
  `BRAIN_OS`, `BRANDING_RULE`, `TATA_GUIDE`) from it, *before* any of
  `enforce_stage_chain`/`build_plan`/`write_receipt`/etc. run — this is the
  literal "invoke via `CoursePaths.for_root(root)`, not the legacy globals"
  requirement. Session-id validation and artifact-schedule checks now go
  through `course_paths.validate_session_id`/`produces_artifacts` (root-bound),
  not the old singleton-bound free functions.
- Own eager `COURSE = paths.COURSE` at module top was **also** a de-hardoding
  gap I found while testing the paths.py fix (it forced the same import-time
  course.yaml load, just one file downstream) — changed to `COURSE = None`,
  with `main()` now *unconditionally* resolving and rebinding all six names
  (previously this only happened when `--root` was explicitly passed).
- Added `pedagogy_summary(sid, vault)` — calls
  `gates.REGISTRY["pedagogy-coverage"]` directly against the level's real
  `30-research/<level>-pedagogy.yaml` record (UNVERIFIED with a plain reason
  if that record doesn't exist yet). Folded into the receipt payload
  (`payload["pedagogy"]`) for both dry and live runs — this is the DEC-005
  transformation-summary requirement, sourced from the real gate, not guessed.
- Added one `RESULT_JSON:{...}` line as the last line of stdout, both for a
  dry run and a completed live run — the one machine-parseable line the C#
  adapter reads, instead of screen-scraping the human-readable print
  statements above it.

**What was explicitly NOT touched** (scope lock): `brand_palette.py`'s Techno
Square hex constants, `arabic_ratio.py`'s ratio constants, and every other
gate module's institute-specific values stay hardcoded — full gate
neutralization is deferred (decision 3). `Organization.BrandPalette`/
`LanguagePolicy`/`BoundaryTerms` are not threaded into the Python side: no
gate module today reads org-derived brand/language/boundary values (they'd
all still read their own hardcoded constants), so plumbing them through now
would be dead wiring. The `--root` rebind does cover the *asset-path* half of
"brand config" (`BRAND`/`BRANDING_RULE`/`TATA_GUIDE` move with the vault
root); the deeper "read actual approved-color-list/ratio-target/forbidden-terms
from Organization" work is the same future gate-neutralization work decision
3 already deferred.

## 4. `CourseDeveloper.Worker` — `AcademyBrainSubprocessExecutor`

Replaces `StubGenerationJobExecutor` as the registered `IGenerationJobExecutor`
(`Program.cs`). `StubGenerationJobExecutor.cs` itself was left in place, not
deleted — it's now dead code (unregistered, unreferenced), same disposition
STEP 4 gave `NpgsqlAgentLogRepository`/`NpgsqlQualityReceiptRepository`.

Behavior:
- Validates `job.Operation == "academy-brain.generate-session"` and
  `payload.contractVersion == 1`; throws otherwise (existing
  `GenerationJobPollingService` catch-all turns that into `FailAsync(retryable: true)`,
  unchanged from STEP 4).
- Reads `sessionId`, `courseVaultRoot`, `live`, `pythonExecutable` from
  `job.Payload` (payload values arrive as `JsonElement` via
  `NpgsqlGenerationJobRepository`'s `System.Text.Json` deserialization — the
  coercion helpers handle both that and native CLR types).
- Interpreter selection: `live: true` requires `pythonExecutable` in the
  payload (this **is** the NotebookLM credential/environment reference this
  step externalizes — academy-brain's own source never hardcodes the special
  notebooklm venv path from its docstring; the adapter picks the right
  interpreter per job/`notebooklm_account_key` instead). A dry run uses
  `GENERATION_WORKER_PYTHON_EXECUTABLE` (env var, default `python`) — no
  NotebookLM package needed for a dry run.
- Launches `<interpreter> <ACADEMY_BRAIN_SCRIPT_PATH> <sessionId> --root <courseVaultRoot> [--live]`,
  captures stdout/stderr, honors cooperative cancellation (polls
  `isCancelRequested()` every 2s while the process runs; kills the whole
  process tree on a positive check).
- Exit code 0: parses the `RESULT_JSON:` line, builds a `ResultManifest`
  matching `result.schema.json`. Non-zero exit (including academy-brain's own
  `HardStop`, which exits 2): throws with a stderr tail, letting the existing
  fail/retry path handle it — a `HardStop` is a deterministic gate refusal,
  not a transient error, but `IGenerationJobExecutor` has no
  retryable-vs-not signal today; not changing that contract was a deliberate
  scope decision (STEP 4's `FailAsync(..., retryable: true)` call site is
  unchanged).
- `ACADEMY_BRAIN_SCRIPT_PATH` has no computed default — fails closed with a
  clear message if unset, rather than guessing a fragile relative path across
  dev/CI/deploy layouts. STEP 6 (devops-automator) sets it explicitly.

## 5. What's blocked, honestly

The exit criterion "a `GenerationJob` submitted through Studio's worker
produces a real academy-brain course output for a Techno Square course" was
**not achieved**, for two independent reasons, neither of which is a defect
in this step's code:

1. **No session has reached the bundle stage yet.** `find D:\vault\academy-brain\75-bundle -maxdepth 1 -type d` returns nothing — the real Techno Square content pipeline (digest → research → critique → patch → approved → localized → bundle) hasn't produced a bundled session for *any* session id yet. This is a content-readiness gap, unrelated to STEP 5's code.
2. **Live generation needs the special NotebookLM venv.** Per `generate_session.py`'s own docstring, a real run must execute under `C:/Users/ET/mcp-servers/notebooklm-mcp/.venv/Scripts/python.exe` (or whichever interpreter has the `notebooklm` package and a stored NotebookLM session) — not available in this sandbox, and not something this step can provision.

What **was** verified instead, as the closest available substitute:
- `python scripts/swarm/generate_session.py --self-check` — fails with
  `ModuleNotFoundError: No module named 'notebooklm'`, exactly as expected
  (the docstring says this needs the special venv; nothing regressed).
- `python scripts/swarm/generate_session.py L1-s1 --root D:/vault/academy-brain`
  (dry run, against the real content vault) — correctly resolves
  `course.yaml` at that root, validates the session id, runs the real
  stage-chain gate, and then hard-stops with
  `missing D:\vault\academy-brain\75-bundle\L1-s1\ASSET-MAPPING.md` — a
  **real, correct** refusal (no bundle exists for L1-s1), proving the
  `--root` externalization resolves against the real vault correctly.

The end-to-end proof remains an open action for whoever has both a bundled
session and the notebooklm venv available.

## 6. Verification performed

- Review rerun: `python -m pytest tests/ -q
  --ignore=tests/test_new_course.py`: **253 passed, 4 skipped**. Contrary to
  the initial note, `test_doctor_providers.py` passes and was not excluded.
  The complete suite is **8 failed, 269 passed, 4 skipped, 17 errors**; every
  failure/error is in `test_new_course.py` for the missing course-content and
  `.claude` scaffold directories described below.
  - `tests/test_new_course.py` (8 failed + 17 errors) — `new_course.py`'s
    `SCAFFOLD_DIRS` copies vault-content directories (`Techno Square
    identity/`, etc.) that the ticket's move list explicitly did not include.
    `new_course.py` is course-scaffolding tooling, not the job-execution path
    STEP 5 is scoped to.
- `dotnet build` (backend, all 5 projects): 0 warnings, 0 errors.
- `dotnet test`: **18/18 passing** (11 from STEP 4 + 7 new
  `AcademyBrainSubprocessExecutorTests` covering `RESULT_JSON` parsing for
  both live and dry-run shapes, tail truncation, and `JsonElement`/native-CLR
  payload coercion).
- Review added an actual subprocess test for worker-shutdown tree cleanup,
  using the locally available Python interpreter.

## 7. Scope lock check

- Did not build the HTTP-service version — subprocess only. ✅
- Did not de-hardcode every gate module's institute-specific values — only
  the execution-boundary values named in the Task (vault/course root,
  NotebookLM credential/interpreter reference; brand/language/boundary
  stayed at the asset-path level per §3's note). ✅
- Did not touch academy-brain's non-`generate_session.py`/`paths.py` source
  beyond copying it as-is (diff-verified). ✅

## Review-loop fixes

- Bound `paths._default` to the per-job `CoursePaths` in `main()`. Rebinding
  only this module's six globals left downstream legacy wrappers such as
  `stage_gate.py` validating against the template manifest. A regression test
  uses an L3/L5 manifest that the template rejects.
- Dry-run `RESULT_JSON` now includes the real `pedagogy_summary()` output. The
  result schema now requires `pedagogy`, matching the ticket and fixture.
- Worker shutdown kills and awaits the subprocess tree before propagating
  cancellation. A cancel-request race is treated as canceled only when the
  worker actually issues the kill. Exit 0 without `RESULT_JSON`, or without
  its required pedagogy object, now fails loudly instead of recording a false
  success.

## 8. Exit criteria — honest check

- [x] `/academy-brain` exists in the monorepo as the verified authoritative
      copy (diff-clean against pre-move source apart from the two
      intentionally patched files).
- [x] Old `D:\vault\academy-brain` repository marked archived
      (`ARCHIVED.md` + `CLAUDE.md` banner); its content-vault role continues
      unchanged.
- [ ] **Not met:** a `GenerationJob` submitted through Studio's worker
      produces a real academy-brain course output for a Techno Square
      course — blocked on content readiness (no bundled session) and
      NotebookLM venv/credential availability, both outside this
      sandbox's reach. See §5.
- [x] `contractVersion` and `studioBuild.commitSha` both recorded on the job
      result (in `ResultManifest`, per `result.schema.json`).
