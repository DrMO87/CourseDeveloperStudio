---
type: handoff
step: 11
phase: A
status: pending
owner: system-architect
date: 2026-09-05
---

# STEP 11 Phase A — NBLM prompt-authoring options + pipeline-wide repair-cascade design

> [!important] This is a design document only. Nothing in this file has been built. Phase B never starts on this document's completion alone — it starts only when the user explicitly approves specific items below, batch by batch (see the approval matrix at the end).

## Part 1 — NBLM prompt-authoring: 3 options

### Current state (grounding facts)

- `80-generation/nblm-student-deck-prompts.md` exists today with real, non-empty content: three sections (`Notebook A — Student Deck (Pass A)`, `Notebook A — Student Deck (Pass B)`, `Notebook B — Student Summary`), each a hand-authored fenced prose block.
- `scripts/swarm/new_course.py`'s `SCAFFOLD_FILES` (line 56) copies this file **byte-identical** into every new course via `shutil.copy2` (lines 300–307). The specialist agent and specialist-skill templates are separately instantiated with `COURSE`/`SUBJECT` replacements; `_TEMPLATE-agent-memory.md` is merely copied to its live name and is not placeholder-filled. The prompt file has no `_TEMPLATE-` prefix and no fill step. Every course therefore ships the identical Techno-Square-authored prompt prose, including its "120-minute session" duration reference in Pass A (line 20) and its generic "academy logo"/"course mascot (TATA)" language.
- `scripts/swarm/generate_session.py`'s `parse_prompts` (lines 399–421) parses the file by case-insensitive heading substring match (`"pass b"` → deck-b, `"notebook b"` → summary, `"notebook a"` → deck-a) and takes the first fenced code block under each heading as the literal prompt text — a purely structural parse, blind to content.
- `build_plan` (lines 461–510) requires `deck-a` and `summary` to exist (`HardStop` at line 467–469 if missing); `deck-b` is optional. It appends `evidence_clause` (lines 424–448) programmatically — the reserved-image-region clause is never hand-authored, so it is already correctly parameterized per session.
- `preflight` (lines 512–521) checks only that every upload path resolves and that instruction text is non-empty. It performs no semantic check of the prompt text at all.

Dr Mahmoud's complaint is accurate and specific: academy-brain never customizes, AI-generates, or quality-checks this file's content per course — it is a single static artifact, hand-copied, never revisited.

### Option (a) — Formalize the baseline into a validated, parameterized guided template

**Before:** static file, byte-identical across all courses; duration ("120-minute session"), audience assumptions, and course references are implicit/generic prose that never reflects the actual course.

**After:** convert the fenced prompt bodies into a guided template with named runtime fields (session duration, audience descriptor, whether Pass B applies for this session's slide count, course/org display name where the prose currently says "this session"). The future enqueue/config-snapshot builder resolves these fields through the authoritative `CourseSession → CourseProject → Organization` relationship (`DurationMinutes` on the session, `TargetAgeBand` on the project, organization name/branding policy on the organization), stores the resolved values in the immutable job payload, and records the template version plus a SHA-256 of the rendered prompt. `AcademyBrainSubprocessExecutor` then passes that snapshot to Python through STEP 5's versioned per-job contract (the same boundary that already carries `--root`); it is not currently a payload builder. `parse_prompts`'s heading-substring contract is unchanged — only the body text inside each fence becomes template output instead of static prose.

**Risk:** Low. Every field is a fact the backend already knows (duration, audience, org name) — no invention, no new external dependency, fully deterministic and reproducible from the job's own config snapshot.

**Cost:** Low–moderate. A versioned payload-schema extension, one deterministic rendering pass, and provenance fields in the result/receipt. No new gate or registry entry belongs to option (a) itself.

**Recommendation:** Adopt. This is the correct baseline regardless of whether (b) or (c) also ship — it removes the actual defect (one-size-fits-all prose) and is a structural prerequisite for (b): a preflight check that verifies "does the prompt match this session's duration" is meaningless while duration is hardcoded prose with nothing to check it against.

### Option (b) — Deterministic structural/pedagogical pre-flight checks

**What `pedagogy_coverage.py`'s Bloom's-taxonomy gate can and cannot validly assess** (this mapping was explicitly required by the ticket):

| Can assess | Cannot assess |
|---|---|
| Whether a level's *declared pedagogy record* (`30-research/<level>-pedagogy.yaml`, a separate YAML artifact, not the NBLM prompt file) claims each session reaches at least Apply | Anything about the NBLM prompt file's own text — it never reads it |
| Whether the level's sessions collectively reach Analyze and Create | Whether the prompt's audience language matches the session's actual configured audience |
| Whether knowledge types span beyond pure Factual | Whether prompt duration language matches `CourseSession.DurationMinutes` |
| — | Whether the academy-logo/TATA-mascot placement clause is present and correctly scoped |
| — | Whether the prompt text contains any of the org's `BoundaryTerms.ForbiddenStrings` (a check on the *instruction* text, distinct from `boundary_check.py`'s downstream check on *generated slide content*) |
| — | Whether a summary-deck prompt names all five mandatory sections (Today I Learned / New Words / Review at Home / Parent Talk / Mini Activity — from the file's own §"Notebook B" text, lines 66–67) |

`pedagogy_coverage.py` evaluates an artifact authored upstream of prompt authoring and reads a wholly different artifact. `ENGINE.md` places research before bundle/generation, but the current `generate_session.py` stage-chain check verifies stage evidence/waivers and does **not** invoke `pedagogy_coverage.py`; the Python gate is registered but has no runtime caller in `scripts/swarm/` today. Batch 3's “exposure” must therefore add a real invocation/result export rather than describe an existing generation hard-stop. It is not a substitute for a prompt-preflight check, and a prompt-preflight check is not a substitute for it.

**Before:** no structural or content check on the resolved prompt text exists at all; `preflight()` only checks upload-path resolution and non-empty instructions.

**After:** add one new, separate deterministic academy-brain registry gate — proposed code `nblm-prompt-preflight` — that runs against the fully-resolved (post-option-(a)-templating) prompt text and checks, all without any LLM call. Its Python `GateResult` is exported in the subprocess result contract and adapted into the shared content-quality envelope described in Part 2; it is not silently treated as though it came from Studio's C# `IQualityGateRunner`.
1. Parser structure — exactly one required deck-a section and one required summary section resolve; deck-b is optional but may appear at most once. Duplicate recognized headings must fail instead of inheriting `parse_prompts`'s current first-one-wins `setdefault` behavior.
2. Audience marker — the templated audience string is present verbatim.
3. Branding markers — the rendered logo/mascot clause matches the immutable organization snapshot (including an explicit no-mascot policy); it must not hardcode Techno Square/TATA as a universal rule.
4. Duration — the templated duration matches `CourseSession.DurationMinutes`.
5. Forbidden content — the *prompt instruction text itself* contains none of `Organization.BoundaryTerms.ForbiddenStrings`.
6. Required sections — for the summary deck specifically, all five mandatory bullets are present.

**Risk:** Low–moderate. New gate module, new test suite; the real risk is scope creep into re-deriving pedagogy-coverage's job — hence the explicit boundary table above, which this gate must not cross.

**Cost:** Moderate. One new gate + `@register` entry + a pre-generation invocation in `generate_session.py`, plus result-contract/C# adapter wiring so the worker can distinguish this content-quality result from an ordinary subprocess `HardStop`.

**Recommendation:** Adopt, sequenced after (a) — its checks are only meaningful once (a) makes duration/audience real runtime fields rather than static prose.

### Option (c) — AI drafts/critiques the prompt text itself

**Before:** no AI ever touches the prompt-authoring layer.

**After:** an LLM (provider/model TBD) either drafts session-specific prompt clauses or critiques the option-(a)-rendered result before upload, producing a versioned prompt artifact.

**Required before this can ship** (all four, non-negotiable per the ticket's constraints):
1. A one-time **platform-owner** enablement decision — never a per-job approval shown to the button-presser (Standing Rule 10/10a: "owner" = platform owner, one-time, out-of-band).
2. An explicit model/provider choice — never silently defaulted.
3. Versioning/provenance — every `GenerationJob` must record which prompt-artifact version and rendered-prompt SHA-256 produced the prompt actually uploaded (and, if AI-authored, model/provider/timestamp), so a defect traces to a specific version. This extends the baseline provenance required for option (a); it is not exclusive to option (c).
4. An audit record, separate from the per-job event stream, for platform-owner review only.

**Risk:** Highest in this set — a bad AI-authored clause corrupts every deck generated under it until caught; needs its own critique/audit loop (structurally analogous to academy-brain's own critique/patch/refutation stages for content, applied to prompts instead). It is also the first candidate in this whole ticket where "retry the real authoring operation" (Standing Rule 10a(2)) is genuinely meaningful for prompt text — re-invoking the LLM is a real, bounded, retryable operation, unlike (a)'s deterministic template fill.

**Cost:** Highest — new model/provider dependency, a review workflow, storage for versioned prompt artifacts and provenance.

**Recommendation:** Defer. (a)+(b) fix the static-personalization and missing-validation defects deterministically; they deliberately do **not** satisfy the separate “AI authors/improves the prompt” possibility. Revisit (c) only if the user wants that additional capability or if (a)+(b) prove insufficient for sessions with pedagogical needs no parameterization schema anticipated. If ever approved, (c)'s prompt-generation step becomes a natural Standing-Rule-10a real-operation retry target (Row 7 of the mapping table below), not something this ticket schedules now.

**Combined recommendation:** Batch 3 (below) ships (a) + (b) together. Option (c) is not part of any batch in this plan and requires a separate, later, explicitly-named platform-owner decision.

### `ENGINE.md` doc-drift finding

`docs/ENGINE.md` §8 (line 196) currently reads:

> `nblm-student-deck-prompts.md` — hard-required by `generate_session.py:1339`, exists nowhere. **Blocks generation in any new course.** | OPEN — needs a decision

This is stale. The file exists today (read in full for this handoff) with real content, and is copied into every new course by `new_course.py`'s `SCAFFOLD_FILES` (line 56). This is a doc-drift finding independent of which option above is chosen — `ENGINE.md`'s own header states "Last true as of: 2026-08-31," and gap #1's entry needs updating to reflect that the file exists but (pending this ticket's approval) is not yet parameterized or pre-flight-checked, rather than "exists nowhere." No file is modified by this handoff; flagging only, per Phase A's scope lock.

---

## Part 2 — Pipeline-wide repair-cascade mechanics (Standing Rule 10a)

### What exists today (traced, not assumed)

- `GateRunnerService.EvaluateAsync` (`backend/src/CourseDeveloper.Infrastructure/QualityGates/GateRunnerService.cs:32`) runs enabled gates, attaches severity metadata (`advisory`/`approvalRequired`/`blocking`), computes `QualityReceipt.OverallVerdict`, persists the receipt, and **returns it**. It does not itself block anything.
- The **only production** caller of `IQualityGateRunner.EvaluateAsync` is `QualityGatesController.EvaluateGates` (`backend/src/CourseDeveloper.Api/Controllers/QualityGatesController.cs:42`) — a synchronous HTTP endpoint invoked ad hoc by the frontend for interactive/manual gate checks. Backend-wide grep also finds direct calls in `GateRunnerServiceTests`; those are tests, not a pipeline consumer. Other production references are the interface/implementation, gate-level `EvaluateAsync` methods, and API DI registration.
- `GenerationJobPollingService` (`backend/src/CourseDeveloper.Worker/GenerationJobPollingService.cs`) — the actual durable job pipeline STEP 4/5 built — never calls the gate runner at all today. It calls `IGenerationJobExecutor.ExecuteAsync`, then `CompleteAsync`/`FailAsync`/`CancelAsync` based on the executor's own result, with no quality-gate step in between.
- **Conclusion:** there is no pre-existing hard-stop to preserve or reuse. STEP 3's gates run in one isolated, frontend-triggered path that never touches `GenerationJob` at all. Standing Rule 10a's own note ("STEP 3... predating this clarification") is accurate for exactly this reason. The integration point below is new, not a wiring change to an existing short-circuit.
- `GenerationJob` (`backend/src/CourseDeveloper.Core/Models/GenerationJob.cs`) already carries `AttemptCount`/`MaxAttempts` (default 3) and a `Progress` JSONB dictionary. `NpgsqlGenerationJobRepository.FailAsync` (line 236) already transitions a job to the existing `retryable` status when `retryable=true` and `AttemptCount < MaxAttempts` — no new `GenerationJobStatus` value is needed.
- **Real gap found:** `ClaimNextAsync`'s WHERE clause (line 137) claims *any* row in `('queued', 'retryable')` with no delay check — a job that goes `retryable` is eligible for immediate re-claim on the very next poll (2-second default interval). There is no backoff mechanism today at all. Standing Rule 10a(3) explicitly requires "rescheduled automatically with backoff," so Batch 1 must add one column (below) — this is a schema extension of the existing table, not new infrastructure, and does not violate Standing Rule 7.

### The new integration point

`AcademyBrainSubprocessExecutor` is STEP 5's production `IGenerationJobExecutor` implementation and the only execution abstraction `GenerationJobPollingService` calls mid-job. It is therefore the proposed orchestration boundary, but it is **not ready for gate evaluation today**: the worker does not register `IQualityGateRunner` or its repositories/gates, and the executor receives only the job payload and later a narrow `RESULT_JSON` (`receiptPath` + pedagogy summary). It does not currently receive the organization id/snapshot, `learnerText`, mapped `SessionAsset` rows, or extracted text/style tokens from the generated PDFs.

Batch 1 must first define a versioned `GateEvaluationInput`/result-envelope contract. The subprocess side exports the exact artifact path/kind, **pass identity** (`deck-a`, `deck-b`, or `summary` where applicable), artifact lineage/version, and gate-checkable representation (for example, source markdown for pre-generation gates and an explicitly extracted representation for post-generation PDF/style checks); the immutable job snapshot supplies organization identity/config and mapped-asset facts. Gate evidence must identify the smallest unit it can prove is defective (JSON issue/location, source-markdown citation, PDF page/text match, or at minimum the pass). The worker then registers the dependencies needed to call `IQualityGateRunner.EvaluateAsync` for C# gates and adapts explicitly named Python `GateResult` values into the same orchestration envelope. No gate may be claimed as protecting a generated deck until its input is actually derived from that deck rather than from upstream source markdown.

The real pipeline does **not** expose an editable generated-content intermediate. `build_plan` uploads `slides-source.md`/`home-summary.md` plus instructions, NotebookLM returns one PDF per pass, and `_run_pass` writes that PDF directly. The generated learner prose is never retained as markdown, JSON, PPTX, or a per-slide model. `overlay.py` can locate a reserved marker in a PDF and replace that exact region with an already-produced evidence image; that purpose-built compositor is not a general text-authoring or style-preserving PDF editor. Therefore source markdown/YAML/critique JSON and rendered prompt text are addressable structured artifacts, while NotebookLM-authored PDF prose is opaque for safe content correction. Extracting PDF text for a gate creates an inspection representation, not an authoritative editable source.

The executor may coordinate **last-resort** regeneration only through an explicit operation adapter. `generate_session.py` currently treats a completed `80-generation/<session>/<pass>.pdf` as final and resumes a surviving `.task_id`; simply invoking it again does **not** regenerate a quality-failing deck. Its three `Pass` objects are independently executed and independently persisted as `deck-a.pdf`, optional `deck-b.pdf`, and `summary.pdf`, so the smallest honest NotebookLM retry is one failing pass, not the whole session. Batch 1 must add a safe, auditable "regenerate this pass as last resort because the scoped repair tiers were unavailable or failed" operation that preserves/quarantines the rejected artifact, proves no NotebookLM task is still in flight, and creates a fresh real task for only that pass. Blind deletion of PDFs or task sidecars is forbidden. If evidence cannot attribute a failure to a pass, the gate must be improved to do so before it is allowed to spend regeneration quota; it must not default to regenerating all passes.

### Corrected cascade order: smallest proven repair first

For one artifact lineage/pass, orchestration evaluates the complete applicable gate set and then proceeds in this order:

1. **Deterministic fact correction.** Apply at most one correction for a finding when current immutable job facts prove the exact value (for example, re-render a duration field). Re-evaluate every applicable gate on the changed artifact.
2. **Targeted patch of the evidenced unit.** Use only a gate-specific patch adapter that names both the addressable unit and an authoritative mechanical transformation. Examples that qualify are dropping one uncited critique issue or relinking one exact asset citation to the unique registered asset it already denotes. Merely finding text in a PDF does not qualify: deletion can change meaning and replacement prose would be fabrication. Re-evaluate every applicable gate on the changed artifact.
3. **Full authoring/generation retry â€” last resort.** Invoke only after tiers 1 and 2 are unavailable or have failed, and only when the mapping below names a real operation capable of producing the defective artifact. For NotebookLM output, regenerate only the evidenced failing pass. This is a distinct, heavy event, never described or counted as an ordinary correction.
4. **Honest durable retry.** When the shared last-resort budget is exhausted, or no real operation exists, reschedule with backoff and alert the platform owner. The user sees "still working"; no empty, generic, stale, or placeholder artifact is promoted.

Every adapter returns a new artifact version plus provenance for the exact source fact/mapping and unit changed. A patch that would need to compose, translate, summarize, infer, or otherwise invent learner/curriculum prose is ineligible by construction. Addressability changes repair scope; it does not relax Standing Rules 8 or 10a.

- A content-quality envelope whose effective receipt verdict is `PASS` (including receipts whose only failures are advisory under today's aggregation) → executor proceeds to let `GenerationJobPollingService` call `CompleteAsync` as today.
- An allowlisted content-quality `blocking` `FAIL` from either supported origin enters the in-process cascade described next instead of being flattened into an ordinary exception. `UNVERIFIED` handling must remain the configured gate policy; this proposal does not silently convert it to PASS or assume it is a content defect worth regenerating.
- `QualityGatesController`'s existing HTTP endpoint and all STEP 3 detection algorithms/contracts are untouched. Batch 1 does add worker-side DI/use of the existing abstractions and may require shared registration helpers; that is orchestration wiring, not a gate-algorithm rewrite.

### Origin/kind discriminator (explicit allowlist, never severity or CLR type alone)

Today STEP 8b's missing-required-field validation does not produce a `QualityGateResult`, and STEP 12 is not implemented yet. CLR type alone is therefore not a durable boundary: Python pedagogy/prompt results are not C# `QualityGateResult` objects, while a future refactor could represent a safety check with that type.

Batch 1 must introduce a closed `ContentQualityViolation` envelope containing `origin` (`studio-quality-receipt` or `academy-brain-registry-gate`), a known `gateCode`, artifact identity/version, and verdict/evidence. Cascade eligibility requires **both** an allowed origin and an allowlisted content gate code from the seven rows below. `UserInputValidationFailure`, `OrgConfigSafetyFailure`, unknown gate codes, configuration exceptions, and ordinary subprocess `HardStop` values are non-eligible by construction. Contract tests must prove that changing only a severity string or wrapping an exception in a `QualityGateResult` cannot make an excluded flow eligible.

### Concrete cascade numbers

| Parameter | Value | Reasoning |
|---|---|---|
| Auto-correction bound | At most **1 deterministic fact-correction pass per distinct finding**, followed by all-applicable-gates re-evaluation | Prevents oscillating corrections. Only a mapping-backed authoritative transformation qualifies; it does not spend regeneration quota. |
| Targeted-patch bound | At most **1 gate-specific targeted patch per distinct finding and artifact version**, followed by all-applicable-gates re-evaluation | A patch must name an evidenced unit and an authoritative mechanical transformation. The same finding cannot be repeatedly patched into oscillation, and a new artifact version does not erase the repair-cycle ledger. |
| Last-resort full-operation bound per claimed execution | At most **2 fresh authoring/generation invocations total for one artifact-lineage/pass repair cycle, shared across every gate code encountered in that cycle** | Regeneration is not routine tier 2. It is used only after smaller eligible tiers fail or do not exist. Fixing gate A but producing gate B consumes one of these same two calls; the counter never resets because the failing gate name changed or a new PDF version was created. Review this initial policy from telemetry after 30 production jobs. |
| Per-invocation time limit | **45 minutes wall-clock** for each fresh generation invocation; cancellation terminates the subprocess/task wait through the existing cancellation path | Concrete upper bound for one claimed execution. Phase B must verify the NotebookLM client can cancel or safely persist/resume the task; timeout must never delete an in-flight `.task_id` or fire a duplicate request. |
| Content-quality reschedule policy | On exhaustion, keep status **`retryable`** and schedule **5 min → 15 min → 60 min, then 6-hour intervals** until a real result succeeds or the platform owner resolves/cancels it | Standing Rule 10a requires content-quality exhaustion to remain honestly "still working"; the existing `FailAsync` cap would instead set attempt 3 to `failed`. Daily-quota exhaustion is a distinct external-service condition and should schedule at the known reset boundary (or 24 hours if unknown), not use the 5-minute quality schedule. |
| Existing `AttemptCount` / `MaxAttempts` | Keep `MaxAttempts = 3` for ordinary execution/infra failures; **do not use `FailAsync`'s max-attempt terminal branch for content-quality exhaustion** | Requires a dedicated repository reschedule operation or an explicit extension of `FailAsync`; otherwise the proposed behavior contradicts the current SQL and Rule 10a. Record content-quality cycle count separately in `Progress`. |
| Async event logging | Append a distinct event for every fact correction, targeted patch, **last-resort full regeneration**, and reschedule, including all before/after gate codes, artifact lineage/version/pass, unit, cycle, operation counter, and reason | The platform owner can distinguish a token relink from a costly stochastic regeneration and can see cross-gate regressions. |
| Operational alert threshold (i) | Alert the platform owner when a job first exhausts its in-process retries, and repeat/escalate after **3 content-quality cycles or 24 hours**, whichever comes first | Gives an actionable early signal while the end user still sees "still working." These are explicit initial policy values, not evidence-derived constants; approval accepts them subject to telemetry review. |
| Operational alert threshold (ii) | Alert when the same gate code fails for **3 distinct jobs** in one organization within rolling 24 hours | Distinct jobs are required; repeated cycles of one bad artifact must not masquerade as an organization-wide defect. |

“Alert” in this Phase B scope means an append-only `generation_job_event` with event type `content_quality_alert` plus a structured worker warning/error containing the same identifiers. That uses the existing database event stream and logging stack; it does not imply a new broker or customer-facing notification. If the platform owner needs email/paging, that delivery channel requires a separately named operations decision, while these records remain the authoritative alert source.

### Schema/state-machine hook (extends, does not replace, STEP 4's design)

- **New column** on `generation_job`: `next_attempt_at timestamptz null` (default `null` = immediately eligible). `ClaimNextAsync`'s WHERE clause gains `AND (candidate.next_attempt_at IS NULL OR candidate.next_attempt_at <= now())`. A dedicated content-quality reschedule repository operation must atomically set `status='retryable'`, clear the lease, persist `next_attempt_at`/error/progress, and remain retryable even when ordinary `AttemptCount == MaxAttempts`; merely calling today's `FailAsync(..., retryable: true)` cannot satisfy that contract.
- **No new column** for cascade counters — reuse the existing `Progress` JSONB: `progress.contentQualityCascade = { artifactLineageId, currentArtifactVersion, pass, cycle, fullOperationAttemptsUsed, findings: [{ gateCode, evidenceUnit, factCorrectionUsed, targetedPatchUsed, verdict }], gateSetBefore, gateSetAfter }`. The key is the stable artifact lineage/pass, **not** the current gate code or regenerated version. Retain the successful audit summary rather than clearing it; it is observability/provenance and is not consulted by the claim query.
- **No new `GenerationJobStatus` value.** `retryable` (already exists) is the job-level fallback state; `queued`/`claimed`/`running`/`succeeded`/`failed`/`canceled` are all used exactly as STEP 4 defined them.
- No current frontend code reads or renders `GenerationJob` status; repository-wide search finds no frontend `retryable`/generation-job consumer. The eventual existing generate-deck flow must render `queued`/`claimed`/`running`/content-quality-`retryable` collectively as an honest "still working" state. This is wiring inside the existing linear flow, not authorization for a new screen, setting, or approval step.

### Per-gate-kind mapping table (all 6 STEP 3 kinds + the NBLM option)

| Gate kind | Deterministic fact correction | Targeted patch before regeneration | Full authoring/generation retry — **last resort** | Validation / evidence requirement |
|---|---|---|---|---|
| **Arabic ratio** (`language_ratio` / `arabic_ratio.py`) | None — a ratio is a metric, not a known replacement fact | **No safe lever today.** The generated PDF has no editable prose source, and changing enough wording to alter the ratio is translation/authorship. Aggregate counts in today's evidence do not identify a unit. | Regenerate only the failing `deck-a`, `deck-b`, or `summary` pass against the real inputs. Never regenerate all three merely because one pass failed. | Evaluate each pass separately and add page-level/count evidence so the envelope proves which pass failed. A wrong org target/tolerance is STEP 12 config safety, outside this cascade. |
| **Boundary** (`boundary_check` / `boundary_check.py` baseline + org `ForbiddenStrings`) | None with today's config | **No safe lever today.** Current evidence lists matched markers but not their page/text-run locations; blindly deleting a marker can change meaning, and the PDF is not a style-preserving text IR. A future exact forbidden→approved replacement map plus a proven unit-preserving editor could qualify, but neither exists today. | Regenerate only the evidenced failing pass with the real prompt/sources. | PDF extraction must report pass + page + exact matched text before last-resort regeneration. Baseline/org forbidden-term configuration remains STEP 12's concern. |
| **Brand palette** (`brand_palette` / `brand_palette.py`) | None with today's `BrandPalette`; `Approved` is a set, not a retired→approved semantic mapping | **No safe lever today for generated PDFs.** Existing gates scan hex strings in supplied text and do not inspect rendered PDF color objects. Choosing an arbitrary approved color or recoloring raster/semantic content is forbidden. A future exact replacement map and object-level style evidence could enable a patch. | Regenerate only the failing pass with immutable brand inputs, after a real rendered-output palette gate exists. | Batch 2 must derive per-pass PDF style/color evidence before claiming this gate protects generated decks; source-markdown hex scanning alone is insufficient. |
| **Citation-filtering** (`cite-filter` exists in academy-brain; Studio implementation remains Batch 4 conditional) | None — a missing citation cannot be invented | **Structured filter exists, but no targeted fix for its blocking FAIL.** `filter_issues` can mechanically drop exact uncited issues while preserving cited ones; however, today's gate fails only when *every* issue is uncited. Dropping them all would yield an empty critique, not repair the violation, so that output must not be promoted as success. | If all issues are uncited, retry the real critique-authoring operation only if Batch 4 defines/wires one; the shared operation budget applies. Otherwise reschedule/alert without pretending the critique passed. | STEP 3 deliberately did not port this gate. Batch 4 still requires explicit approval and must add stable issue IDs/locations, may use filtering as pre-gate hygiene, and must enforce non-empty-output semantics. |
| **Pedagogy-coverage** (`pedagogy-coverage` / `pedagogy_coverage.py`) | None — missing Bloom's coverage/assessment is curriculum content, not a known fact | **No safe content patch.** The YAML is structurally addressable down to a session, but filling `reaches`, `knowledge`, or `assessment` would invent pedagogy. Addressability alone does not authorize a patch. | None today: no automated authoring operation regenerates `30-research/<level>-pedagogy.yaml`, and deck generation does not touch it. Reschedule/alert rather than re-polling unchanged YAML or spending NotebookLM quota. | Effectively pre-release/escalation-only until a separately approved real pedagogy-authoring operation exists. Evidence should retain the precise session/field problems already present in `detail`. |
| **Asset reconciliation** (`asset_reconciliation`) | Yes, only when an existing registered asset and its intended reference are uniquely established by authoritative mapping/storage facts | **Yes, on structured source artifacts:** replace/relink the exact citation in `slides-source.md`/`home-summary.md` or the mapping row identified by gate evidence; then rerun reconciliation/bundling. Never patch generated prose and never create a placeholder asset. | Ordinarily none: the gate should run before NotebookLM quota. If a corrected source mapping invalidates an already-generated pass, regenerate only that affected pass as a last resort; a genuinely missing asset has no useful generation retry and goes to reschedule/alert. | Add source file + citation span/slide + unique asset ID/path evidence. A dangling name alone is insufficient to choose among assets. |
| **NBLM-prompt option (recommended: (a)+(b), `nblm-prompt-preflight`)** | Yes — re-render duration/audience/branding fields from the job's immutable snapshot and restore only an exact approved template/version when provenance proves drift | Only the same exact field/template restoration qualifies; do not write missing prose. Duplicate headings or missing required-section prose after a clean re-render are template defects, not invitations to synthesize a local patch. | None under recommended (a)+(b): prompt rendering is deterministic, and NotebookLM deck generation cannot repair a bad instruction before upload. A real prompt-authoring retry exists only if option (c) is separately approved; even then it is last resort under the shared budget. | Validate the base template in CI/scaffolding and the fully rendered prompt per job before quota is spent; evidence names pass, field/heading, template version, and rendered hash. |

**Current targeted-fix verdict:** a genuine scoped mechanical resolution of a blocking finding exists for asset reconciliation and for the deterministic fields in the recommended NBLM option. It does **not** exist today for generated-PDF Arabic ratio, boundary, or brand-palette failures, for pedagogy-content gaps, or for citation-filtering's all-uncited FAIL. Citation filtering does have an addressable JSON unit and a safe drop operation for mixed payloads, but that is pre-gate hygiene rather than a fix for the gate's actual blocking condition. These limitations are stated instead of disguising full regeneration, empty output, or invented prose as a patch.

### Cross-gate whack-a-mole containment

After **every** full authoring/generation invocation, orchestration discards no history and evaluates the complete applicable gate set on the new artifact version before deciding success. The stable repair-cycle key is `(job, artifactLineageId, pass, cycle)`. `fullOperationAttemptsUsed` increments before the call and never resets when:

- gate A passes but gate B now fails;
- the regenerated artifact receives a new version/id;
- more than one gate fails at once; or
- a rescheduled worker claim resumes the same content-quality cycle.

The new result may use an unused deterministic or targeted adapter for its newly evidenced finding, but another full call still spends the same shared counter. Success requires **all applicable blocking gates** to pass (with `UNVERIFIED` handled by configured policy); otherwise the cascade continues within the remaining shared budget. At two full calls, any blocking finding converges to the same content-quality `retryable`/backoff/owner-alert path. Only the scheduler may open a new numbered cycle after the prescribed backoff; a gate-code change, artifact-version change, worker restart, or ordinary re-claim cannot do so. There is no nested per-gate retry loop and no fresh two-call allowance for the newest failure.

### Explicit confirmation: both Standing Rule 10a exceptions stay excluded, gate by gate

None of the seven rows above is, or overlaps with, either excepted flow:

- **STEP 8b's defined missing-required-field blocking** belongs in MVP/Studio frontend validation of user-typed input (e.g. an empty lesson title). STEP 8b is deferred, but this existing MVP pattern is not a `QualityGateResult`, does not run against generated content, and is not one of STEP 3's 6 gate kinds or the NBLM-prompt check. It remains an immediate plain-language block the user fixes by typing.
- **STEP 12's not-yet-implemented fail-closed multi-tenant org-config check** is specified to run at enqueue/pre-execution — resolving `GenerationJob → CourseProject.OrganizationId → Organization` into an immutable per-job config snapshot — strictly *before* any of the 7 content gates above run. Its contract must use the distinct `OrgConfigSafetyFailure` path named above, never a content-quality origin. A missing/ambiguous relationship or missing/inconsistent execution snapshot fails closed and never reaches gate evaluation or the cascade.
- The closed origin + allowlisted-kind envelope above makes this structural rather than accidentally true today. Tests must include a fake future `QualityGateResult` carrying an org-config-safety origin/unknown code and prove it cannot enter the cascade.

---

## Phase B batch plan (dependency-ordered) and approval matrix

Default shape, per the ticket's own proposed sequencing — restated here with this document's concrete numbers folded in. Approval is per batch; approving Phase A's design, the recommended NBLM option, or any one batch never implies approval of another, and never implies approval of Batch 4 specifically (that requires a distinct approval naming citation-filtering by name).

| Batch | Owner | Builds | Depends on | Requires separate approval naming | Risk if skipped/wrong |
|---|---|---|---|---|---|
| **1 — shared cascade primitives + exception boundary** | backend-dev | The versioned gate-input/result envelope with artifact lineage/pass/evidence-unit identity; immutable job-snapshot inputs; worker DI/evaluation boundary; gate-specific fact/targeted-patch adapter contracts; the shared repair-cycle ledger; all-applicable-gates recheck after every mutation; one cross-gate full-operation counter that never resets on gate/version changes; pass-scoped **last-resort** regeneration adapter; safe rejected-artifact/task handling; bounded retry/time limit; dedicated content-quality reschedule operation; `next_attempt_at` + `ClaimNextAsync` check; distinct correction/patch/full-regeneration events and alerts; origin+kind allowlist; focused exception and whack-a-mole tests | Nothing (first batch) | This batch's design as a whole, including its initial numeric policy | Every later batch lacks safe scoping and convergence semantics; a naïve per-gate retry loop can burn quota indefinitely while moving the failure between gates |
| **2 — wire STEP 3's 4 already-ported gates** (Arabic ratio, boundary, brand palette, asset reconciliation) | backend-dev/coder | Defines each real gate input/evidence: per-pass PDF text/page evidence for ratio/boundary, rendered PDF style evidence before brand claims coverage, and source-file/citation/unique-asset evidence for reconciliation. Implements only the genuine targeted reconciliation patch, reruns all applicable gates after it, and enables pass-scoped last-resort regeneration for the three opaque-PDF gates; no arbitrary prose/color substitution | Batch 1 | This batch's gate-by-gate input, patch, and last-resort wiring design | These gates either remain isolated or trigger unsafe whole-artifact regeneration without adequate evidence |
| **3 — pedagogy-coverage exposure + recommended NBLM option ((a)+(b))** | coder (Python side) / backend-dev (job wiring) | Extends the versioned payload/result contracts; records template version/rendered hash; templates the NBLM prompt per option (a); adds and invokes `nblm-prompt-preflight` per option (b); implements exact snapshot/template re-render only; exports/adapts Python results; wires pedagogy coverage as no-patch/no-operation reschedule+alert rather than invoking NotebookLM; includes gate-specific evidence | Batch 1 (no hidden dependency on Batch 2) | This batch's NBLM option + preflight gate design | The static prompt remains unfixed, or pedagogy failures are falsely treated as deck-regeneration candidates |
| **4 — citation-filtering gate logic (conditional)** | coder/backend-dev | Ports/wires the existing critique-JSON citation filter with stable issue evidence, safe drop-uncited-issues pre-gate hygiene for mixed payloads, non-empty-output semantics, all-gates recheck, and a real critique-authoring retry adapter if one is separately defined. An all-uncited FAIL has no targeted repair and never receives a fabricated citation | Batch 1 | **A distinct approval naming "citation-filtering" specifically** — no blanket cascade approval satisfies this | If built without this approval: exactly the forbidden "invented gate logic nobody asked for" outcome; if skipped, the Studio gate correctly keeps failing loudly on enable (STEP 3's existing contract), not silently |
| **5 — full regression + exception-boundary confirmation** | backend-dev | Re-runs Batch 1's exception tests plus end-to-end regression: STEP 8b's blocking and STEP 12's fail-closed check still behave exactly as before and never route through the cascade | Every approved/implemented batch above | This batch's regression scope | No independent confirmation that the two excepted flows survived all the wiring above unchanged |

**Recommendation for the user's approval decision:** approve Batch 1 first and alone if a staged rollout is preferred (it has no user-visible effect until a gate family is wired, but it is materially larger than a retry loop and approval includes the input/envelope, safe-regeneration, persistence, and alerting contracts named above). Batches 2 and 3 can then be approved together or separately since they have no dependency on each other. Batch 4 should not be approved until the user is ready to name citation-filtering specifically. Batch 5 is confirmation work that follows whatever combination of 1–4 was actually built and should be included in the approval of each selected implementation set, not treated as an optional standalone feature.

An actionable approval should name all of the following rather than say “approve Phase A” generically:

1. **NBLM choice:** approve (a)+(b), defer (c), or specify a different option.
2. **Initial cascade policy:** approve or replace the 1 fact correction / 1 targeted patch per finding+version / 2 **shared cross-gate last-resort full invocations per artifact-lineage/pass cycle** / 45-minute limit / 5→15→60-minute then 6-hour schedule / alert thresholds above.
3. **Implementation batches:** name Batch 1 and any of Batches 2–3 to authorize; include Batch 5 regression for the selected set.
4. **Citation filtering:** say “approve Batch 4 citation-filtering” explicitly if desired; silence or a blanket cascade approval means **not approved**.
