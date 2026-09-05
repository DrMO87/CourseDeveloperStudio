---
type: execution-plan
status: approved-pending-execution
last_updated: 2026-09-05
---

> [!warning] Amended after initial approval
> DEC-004 and DEC-005 (STEP 0a) were added after this ticket's first version. DEC-004 **reverses** the original decision 1/2 language about academy-brain staying an externally-pinned, separately-versioned release — read STEP 0a before trusting any older step text that still says "pinned external release" or "no vendored copy." Steps 2, 3, 4, 5, 6, 7, and 8 have all been updated to match; if any wording elsewhere in this file still contradicts DEC-004 or DEC-005, DEC-004/DEC-005 win.
>
> **2026-09-05 (DEC-008):** the former STEP 8 ("Merge MVP lesson-authoring into Studio") is **descoped from immediate execution**. Its full scope is preserved, unscheduled, as **STEP 8b** below. The step number **STEP 8** is reassigned to a small, deferred task: building Studio's own login page. STEP 9 changed from a plan-only step to a plan-then-implementation step (the approval gate stays — implementation only covers capabilities the user explicitly approves). See STEP 0a, DEC-008.
>
> **2026-09-05 (DEC-009):** an independent, read-only Codex diagnosis of academy-brain's actual pipeline (`docs/tickets/handoffs/step9-digestion-diagnosis.md`) confirmed Dr. Mahmoud's complaint and found it's broader than one file: most of academy-brain's 11 documented pipeline stages are file-presence gates, not real content work. STEP 9 Phase A's mandate widens from "compare against MVP only" to "diagnose and propose fixes for academy-brain's own gate-only stages, using MVP as one candidate source of transferable capability, not the only one." See STEP 0a, DEC-009.

# academy-brain + Dr Mahmoud MVP → CourseDeveloperStudio Integration

> [!important] What this document is
> This is the **ticket**. Steps are dependency-driven, not strictly sequential — each step's own "Starts when" line states its real prerequisite, and STEP 3 is explicitly allowed to run parallel with STEP 2 (both depend only on STEP 1). No step starts before its stated prerequisite step's exit criteria are met and its handoff artifact exists. Each agent picks this file up when its step comes due, reads its own step plus the Standing Rules, and executes.
>
> **Binding constraint on every step:** [[2026-09-04-academy-brain-mvp-integration-vision]] (DEC-001). Read it before touching anything.

## Why this plan exists

CourseDeveloperStudio is Dr. Mahmoud's institute-agnostic curriculum platform — but its orchestrator is a stub, its gate runner is 4 hardcoded methods, and its frontend talks directly to Supabase with a localStorage demo fallback instead of its own backend. Meanwhile academy-brain (the user's Python content-generation pipeline, hardcoded to Techno Square) and Dr Mahmoud MVP (the user's Next.js/Prisma teacher lesson-authoring app, further along than its own stale README claims) are the two real engines Dr. Mahmoud wants inside Studio. Three independent Codex CLI reviews (one per repo) converged on 9 decisions for how to wire all three together without rewriting academy-brain, without losing MVP's working auth/data layer, and without shipping "another demo." This ticket turns those 9 decisions into sequenced, executable steps.

---

## Standing Rules (apply to every step, every agent)

1. **Vision is binding.** [[2026-09-04-academy-brain-mvp-integration-vision]]. Suggestions allowed, deviation not.
2. **No guessing.** Genuine blockers escalate and get logged in the Blocker Register below. Small judgement calls are made by the agent, not escalated.
3. **Never self-mark as approved/confirmed.** Only the user approves. Agents write `pending`.
4. **Cite the source.** Every claim in a produced file traces to a real file, a Codex `result.json` finding, or a decision ID.
5. **Update only what needs updating.** Do not mass-rewrite adjacent work — Studio, academy-brain, and MVP each have working parts; touch only what a step names.
6. **Log the handoff.** Each step ends by writing its handoff artifact and appending one line to the Step Ledger.
7. **No new message queue infrastructure.** Postgres is the job queue for generation jobs. Do not introduce Redis, RabbitMQ, or any broker — this was explicitly decided against by all 3 Codex reviews (decision 7). Not reopenable without a new user ruling.
8. **No silent fallback in production paths.** Any code path that swallows a backend/API error and substitutes localStorage or hardcoded demo data must be removed or explicitly gated behind a named demo mode — never left as an unlabeled default (decision 5). This is the exact pattern the integration exists to eliminate; "it still works" is not sufficient justification to leave one in.
9. **One academy-brain, one home (DEC-004).** Once academy-brain's source moves into the CourseDeveloperStudio monorepo, the old `D:\vault\academy-brain` repository is retired/archived. Never dual-maintain it, never sync changes back to it, never leave a submodule or package reference pointing at it. Two "official" copies drifting apart is the exact failure this decision exists to prevent.
10. **No configuration surface for guidance/mode (DEC-005 — "monkey theory").** The customer-facing product treats every customer (academy owner, university professor, school teacher) as the same non-technical archetype: one linear button chain, same order, same screens, for everyone. Never add a settings screen, a guidance-level dial, an onboarding-path choice, or any other mode/branch a customer must configure. All adaptive judgment (how much to preserve vs. fill in, how directive to be) happens silently in the backend. Not reopenable without a new user ruling — the user has already overridden this once (a "guidance level" dial) after both the assistant and Codex proposed it in round 1.
    - **10a. Repair cascade, pipeline-wide (2026-09-05, revised same day — no fallback content, ever).** "Monkey clicks button, button works" has two halves — no dial is only half of it; the button must also finish with a **real** result, never a fabricated stand-in for one. This applies to **every content/pipeline quality gate in this integration**, not just STEP 11's NBLM prompts: STEP 3's 6 gate kinds (Arabic ratio, boundary, brand palette, citation-filtering, pedagogy-coverage, asset reconciliation), STEP 5's pedagogy-coverage exposure, and any future gate logic. A gate violation must resolve through: **(1)** deterministic auto-correction of real, backend-known facts only (org name, branding assets, duration bounds, other fields the system already knows are true) — **never** insertion of generic/placeholder/templated content standing in for real teaching content, and never reuse of stale course/org values merely because they are available; **(2)** if the violation can't be resolved from current, authoritative known facts, an automatic, bounded execution attempt that retries the actual generation/authoring step against the real inputs; **(3)** if that attempt's retry bound is exhausted, the durable job returns to its existing retryable state and is rescheduled automatically with backoff for another bounded attempt — the end user sees an honest "still working" state, never a finished-looking deliverable that isn't real. STEP 11 Phase A must define the per-attempt retry count/time limit, backoff, and operational alert threshold before Phase B implements the shared orchestration; those values are deliberately not global constants in this Standing Rule. Any gate algorithm implemented later must adopt STEP 11's approved cascade contract rather than inventing separate retry behavior. **(2026-09-05 update: that implementing step is now STEP 11 Phase A/B — pipeline-wide, batched, not NBLM-prompt-only.)** **(4)** Only a true infra failure (an external API/service down — not a content-quality finding) may surface as a stopped, plain-language, retryable message, and nothing is substituted in its place. **This directly enforces Standing Rule 8, which already bans exactly this failure mode** — the user has already been burned once by a fallback path in the MVP that silently shipped generic content as if it were the real output, and that direction is rejected outright here, not just discouraged. Whatever needed a retry is logged asynchronously for the platform owner; the end user only ever sees a real result or an honest "still working"/"retry" state, never a fake one.
    - **10a exceptions — do not sweep these into the cascade:** (i) **STEP 8b's blocked-button messaging** for a genuinely missing *user-supplied* required field (e.g. an empty title in MVP's authoring flow) is not a content-quality gate — the monkey caused it and can trivially fix it by typing; a plain-language "fix" message there is the proven, correct MVP pattern and stays as-is. (ii) **STEP 12's fail-closed multi-tenant org-config check** is a data-isolation safety guard, not a quality gate — silently "auto-fixing" missing organization config by guessing an organization or falling back to another institute's (e.g. Techno Square's) brand/language rules would silently misgrade one institute against another's policy, which this ticket already explicitly forbids (STEP 12 Constraints). At enqueue/pre-execution validation, before the immutable job snapshot is established, the system may populate a missing snapshot only from the job's single, unambiguous, authoritative `GenerationJob → CourseProject.OrganizationId → Organization` relationship; that is recovery of current tenant identity, not substitution. Once execution has begun, it must not rebuild a missing snapshot from live organization data because that would break reproducibility. If the relationship or immutable snapshot is missing, ambiguous, or inconsistent at the applicable boundary, the check must fail closed with a job error and never enter the content-quality retry cascade.
    - **10a follow-up on already-shipped work:** STEP 3 (committed `84b6ac7`) built a `blocking` severity used generically for "prevents publish/advance" across all gate kinds, predating this clarification. STEP 3's registry/dispatch mechanism, result contract, and 4 ported gates are unaffected and not reopened. The orchestration that eventually consumes **any** content-quality result — including results from those 4 existing gates — must exhaust 10a's repair cascade before allowing the result to prevent publish/advance; whoever eventually implements the deferred citation-filtering/pedagogy-coverage gate *logic* (explicitly out of scope for STEP 3 itself) inherits the same constraint. No STEP 3 code change is required by this note. A content-quality gate may still emit the existing `blocking` severity, but severity alone must never select cascade eligibility: STEP 11 must distinguish content-quality results from STEP 8b user-input validation and STEP 12 safety guards by an explicit origin/kind classification. Only those two excepted classes may treat `blocking` as an immediate terminal block/fail-closed result.

---

## STEP 0 — Scope calls

### 0a — Ruled by user *(binding)*

> [!success] Resolved 2026-09-04 — logged as DEC-002, DEC-003, DEC-004, DEC-005, DEC-006, DEC-007.

1. **Ticket scope (DEC-002):** Full integration, all 9 decisions, in one ticket. Dr. Mahmoud delegated the entire integration with no separate team — there is no "his side" to leave out. Every step below is executed by the user (via this session/its agents), including the Studio-side backend fixes that decision 2's ownership language originally described as "Dr. Mahmoud's team's" work.
2. **MVP merge mode (DEC-003):** Literal code merge — MVP's lesson-authoring routes, components, and Prisma layer move into CourseDeveloperStudio's Next.js frontend as a module. Not a separately-deployed app linked by FK alone.
3. **Engine placement (DEC-004) — supersedes decision 1/2's "externally-pinned release" language.** academy-brain's source moves into the CourseDeveloperStudio monorepo as an internally-owned Python component — one repo, one coordinated release, one team, one support boundary. It is **not** rewritten into C#, and it still runs as its own Python subprocess/background worker (generation takes real time and cannot happen inside an HTTP request) — but it is no longer a separately-versioned external product Studio merely calls. The old `D:\vault\academy-brain` repo is archived at cutover, not dual-maintained (Standing Rule 9). User's own words: *"i am not a programer i cant make thie decision. all i want is to build academy brain into the studio app."* Codex verdict: CONCEDE-WITH-CHANGES — concrete monorepo shape and the effect on decisions 2/7/9 are in `docs/tickets/codex-review-evidence/engine-placement-reversal-review.json`.
4. **Customer-facing design principle (DEC-005) — "monkey theory."** Every customer type (academy owner, university professor, school teacher) is designed for as the same technologically-illiterate archetype: press a button, it works, done — whether a "stubborn" resistant professor or a "compliant" academy/school teacher. One linear button chain (4-8 steps, same as MVP's existing `/create` flow), identical for everyone, no settings screen, no guidance-level dial, no onboarding-path choice. This **overrides** an earlier draft of this same decision (round 1) where the assistant and Codex had both proposed an adjustable "guidance level" setting — the user rejected that explicitly: a dial is still a decision the customer has to make, which this customer archetype does not do. Codex round 2 verdict: CONCEDE-WITH-CHANGES — approved the zero-configuration direction, and added two requirements folded into STEP 3/5/7/8 below: (a) a short post-generation "transformation receipt" (what was kept / added / adjusted) since the MVP's existing confirmation step only verifies what was *read*, not what happened after; (b) every blocked "next" button must show one plain-language reason and one concrete fix, not just stay disabled. Evidence: `docs/tickets/codex-review-evidence/adoption-ux-round1-review.json` and `docs/tickets/codex-review-evidence/adoption-ux-round2-review.json`.
5. **Canonical database (DEC-006) — resolves Blocker Register #2.** STEP 2 found MVP and Studio currently run on two separate Supabase projects, which blocks the `WorksheetProject.sessionId → course_sessions.id` FK until one database survives. Ruled 2026-09-04: **Studio's Supabase project (`gjxhfyfonjdcaimxjipp`) is canonical.** MVP's tables get created there via Prisma migration, MVP's existing production data is copied across in a one-time migration, and MVP's old project (`jbjfafyjqdjmzmdggzha`) is retired once cutover is verified — same "one home, not dual-maintained" pattern as DEC-004, applied to the database. STEP 8 sequences and executes this (consolidate → `sessionId` reconciliation → FK), per STEP 2's plan in `docs/tickets/handoffs/step2-schema-ownership.md`.
6. **Digestion-pipeline scope (DEC-007) — new STEP 9, not folded into STEP 8.** The user's stated priority: MVP's most important retained value is its content-intake/digestion pipeline, and academy-brain's pipeline (DIGEST and its neighboring receipt/provenance/review stages, not just `digest_office.py` in isolation) may hold transferable improvements for it — without narrowing academy-brain's own pipeline to just that stage. Codex's independent review confirmed a real conflict with STEP 8's existing scope lock ("move MVP's workflow as-is... other workflow changes are a separate, future request") and recommended against folding an unscoped "improve digestion" mandate into STEP 8, since it has no named capability, acceptance test, or affected inputs/outputs yet. MVP operates at one-teacher/one-lesson scale with pasted-text or PDF intake, while academy-brain operates at multi-session-course scale; academy-brain's legacy automated Office digest runner is additionally hardcoded today to 11 Micro:bit PPTX decks. Techniques are therefore not guaranteed to transfer as-is. Ruled 2026-09-04: recorded as STEP 9 below — a comparison-and-scoping step, not an implementation mandate. No digestion workflow change to MVP is authorized until STEP 9 names specific capabilities and the user approves them.
7. **STEP 8 descoped; MVP merge deferred as STEP 8b; STEP 9 becomes plan-then-implementation (DEC-008).** Ruled 2026-09-05, after STEP 7 shipped and the user tried the running product and asked what STEP 8 actually does. Two changes:
   - **STEP 8 descope.** The user's own words: *"step 8 is obselete as is. it will be another step bulding the login page and we do that once we make sure that our product is running."* The full MVP lesson-authoring merge (Prisma tables, `WorksheetProject`↔`course_sessions` FK, canonical-database migration per DEC-006, transformation receipt, blocked-button messaging) is **not canceled** — it is deferred, unscheduled, and preserved verbatim as **STEP 8b** below, pending a future, separate user go-ahead. The step number **STEP 8** is reassigned to a much smaller task: give Studio its own login page (modeled on MVP's already-proven Supabase auth pattern, referenced not moved) so the product STEP 1–7 already built is actually usable end-to-end without a hand-run Supabase session. New STEP 8 is explicitly gated on the user first confirming the STEP 1–7 product runs end-to-end — it is not sequenced to start automatically the moment STEP 7's handoff exists.
   - **DEC-006's canonical-database consolidation moves with the deferred scope.** DEC-006 (Studio's Supabase project is canonical; MVP's data migrates in) exists to unblock the `WorksheetProject` FK, which is STEP 8b work now, not STEP 8. DEC-006 itself is **not reopened or reversed** — its resolution stands — only the step that executes it moves to STEP 8b. Blocker Register #2 is repointed accordingly.
   - **STEP 9 becomes plan-then-implementation.** The user's own words: *"step 9 should be a plan then implemintation."* STEP 9 keeps its existing Phase A (comparison, capability table, adopt/adapt/skip recommendations) unchanged, and gains a Phase B: once the user approves specific capabilities from Phase A's table, the **same step** implements exactly those approved capabilities — no new step needs to be authored to act on an approval. The approval gate itself is unchanged and non-negotiable: Phase B never starts on Phase A's completion alone, and never implements a capability the user didn't approve.

8. **STEP 9 Phase A's mandate widens to include academy-brain's own gate-only stages, not just MVP comparison (DEC-009).** Ruled 2026-09-05. Before running Phase A, the user asked for an independent diagnosis of how academy-brain's pipeline actually digests content, dispatched via Codex (read-only, `codex-cli 0.153.3`, session `01a06ee1-279e-78b2-ac59-2df2e1ba2d76`). Findings, in full, at `docs/tickets/handoffs/step9-digestion-diagnosis.md`: the DIGEST stage (`digest_office.py`/`run_digest.py`) is pure extraction with no synthesis, confirming the complaint — but so are most of the other 10 documented stages (receipts, research, provenance, critique, patch, refutation, approval, localization, bundling), each implemented as a file-presence/metadata gate rather than real content review. Only the final generation stage does real AI work (calling NotebookLM), and it never receives digested understanding from earlier stages because none is produced. The user's own words: *"we need to improve whats wrong with studio."* This means STEP 9 Phase A must diagnose and propose fixes for academy-brain's own broken stages directly — MVP's pipeline remains one candidate source of transferable capability (per DEC-007) but is no longer the only lens; a stage academy-brain gets wrong that MVP also doesn't solve is still in scope for a proposed fix. Phase B's approval gate is unchanged: nothing gets built until the user approves specific items from Phase A's table.

### 0b — Assumed by the agent *(not binding — overturn cheaply)*

1. **Step ordering puts backend auth + the DI lifetime defect first (STEP 1)** — every later step that talks to the API or runs a background service inherits this bug if it's not fixed first. *What changes if wrong:* reorder STEP 1 after whichever step the user considers more urgent; no other step depends on ordering beyond "auth exists before frontend wiring, schema ownership exists before schema changes."
2. **academy-brain's build/versioning process (decision 2, as amended by DEC-004) is folded into STEP 5's constraints rather than given its own step** — it's a process decision (track the Studio commit/build that executed a job, since there is no separate academy-brain release to pin), not a code artifact on its own. *What changes if wrong:* split into a standalone STEP 5b if the user wants an explicit build-tracking mechanism designed and reviewed separately.
3. **"Dedicated worker" (decisions 1, 7) means a separate `CourseDeveloper.Worker` .NET project/executable, not an `IHostedService` inside `CourseDeveloper.Api`** — this is what "separately deployable, not coupled to the web API process lifecycle" concretely requires per all 3 Codex reviews. *What changes if wrong:* STEP 4 and STEP 5 collapse into one in-process hosted service, contradicting the reviewed decision — would need explicit user override.

### 0c — Open, blocking

None. All forks resolved in 0a; everything else is cosmetic (naming, file layout, exact DTO shapes) and left to each step's agent.

---

## Repository shape (per DEC-004)

Target monorepo layout, per Codex's engine-placement review — steps below build toward this, not a literal one-shot restructure:

```text
CourseDeveloperStudio/
├── frontend/                         # Next.js app (Studio; own login page in STEP 8; merged MVP module deferred to STEP 8b)
├── backend/
│   ├── src/
│   │   ├── CourseDeveloper.Core/
│   │   ├── CourseDeveloper.Infrastructure/
│   │   ├── CourseDeveloper.Api/
│   │   └── CourseDeveloper.Worker/   # durable job consumer (STEP 4)
│   └── tests/
├── academy-brain/                    # authoritative Python engine source (moved in, STEP 5/6)
│   ├── pyproject.toml
│   ├── scripts/swarm/
│   ├── 00-contracts/
│   └── tests/
├── contracts/generation-job/         # request/result/event schemas shared by Worker <-> academy-brain (STEP 5)
├── database/migrations/              # STEP 2's schema-ownership plan lands here
└── docs/tickets/                     # this ticket and its evidence
```

The worker's deployed image contains both `CourseDeveloper.Worker` and the Python runtime + academy-brain code from the **same repo commit** — one release, not two things upgraded independently.

---

## STEP 1 — backend-dev: Fix Studio backend auth, CORS, and DI lifetime defect

**Owner:** backend-dev
**Starts when:** ticket approved (no prior step)

**Task:** Register real authentication (Supabase JWT bearer validation, matching what MVP's `session.ts` already does against the same Supabase project) in `CourseDeveloper.Api`, replace `AllowAnyOrigin` CORS with an explicit allow-list, and fix the DI lifetime defect where `AgentOrchestrator` and `GateRunnerService` are registered as singletons while depending on scoped repositories.

**Mandatory reading:**
- `backend/src/CourseDeveloper.Api/Program.cs` — current CORS/auth/DI registration
- `D:\vault\Dr mahmoud MVP\src\server\auth\session.ts` — the Supabase token verification pattern already proven to work against this project's Supabase instance
- `docs/tickets/codex-review-evidence/studio-review.json`, decision 5 and decision 4's defect note — exact line citations for both bugs

**Constraints:**
- Auth must validate the same Supabase project MVP already authenticates against (one identity boundary, per decision 6) — do not stand up a second auth system.
- `AgentOrchestrator` and `GateRunnerService` become scoped (or their scoped dependencies get wrapped via `IServiceScopeFactory` if a singleton lifetime is kept deliberately) — pick whichever, but state which and why in the handoff.

**Scope lock — do NOT:**
- Do not touch the gate registry itself here (that's STEP 3) — fix only the DI lifetime, not the gate dispatch logic.
- Do not wire the frontend to the new auth yet (that's STEP 7).

**Output:** `docs/tickets/handoffs/step1-backend-auth-di.md` — what changed, files touched, how it was verified (e.g. `dotnet build` clean, a manual authenticated-vs-unauthenticated request test)

**Exit criteria:** `dotnet build` succeeds; an unauthenticated request to a protected endpoint returns 401; CORS only allows the known frontend origin(s); `AgentOrchestrator`/`GateRunnerService` no longer mix singleton lifetime with scoped dependencies.

---

## STEP 2 — architect: Canonical schema and migration ownership

**Owner:** system-architect
**Starts when:** STEP 1 handoff exists

**Task:** Decide and document, table-by-table, which migration tool owns which table across Studio's hand-run `database/schema.sql` and MVP's Prisma migration history — per decision 8. Produce the mapping and the FK plan that STEP 4 (GenerationJob) and STEP 8 (MVP merge, WorksheetProject↔course_sessions FK) will implement against.

**Mandatory reading:**
- `database/schema.sql` — Studio's current tables and RLS policies (note: RLS assumes `auth.uid()`, which STEP 1's auth work must actually populate)
- `D:\vault\Dr mahmoud MVP\prisma\schema.prisma` — MVP's 17-model schema
- `docs/tickets/codex-review-evidence/mvp-review.json` and `docs/tickets/codex-review-evidence/academybrain-review.json`, decision 8 sections — both independently flagged this as a missing decision

**Constraints:**
- One migration authority per table, no table owned by both Prisma and hand-written SQL.
- Must define the concrete FK from `WorksheetProject.sessionId` to `course_sessions.id` (currently an unconnected opaque UUID) — this is what STEP 8 will implement.
- Must confirm the .NET backend's Postgres connection preserves the authenticated user context RLS expects, rather than bypassing it via a service-role connection string.
- Per DEC-004: `GenerationJob` records two separate fields, not one — `studioBuild`/`commitSha` (the Studio build/commit that executed the job; academy-brain no longer has its own release line to pin) and `contractVersion` (the job-contract schema version, per STEP 5, kept because queued jobs can survive a deployment and a worker may pick up a job whose payload shape predates the running build). Do not conflate these two into a single field.

**Scope lock — do NOT:**
- Do not write or run any migration in this step — this step produces the plan only.
- Do not touch `GenerationJob` table design here beyond noting it needs a slot in the plan — full design is STEP 4.

**Output:** `docs/tickets/handoffs/step2-schema-ownership.md` — table ownership map, FK plan, RLS/auth-context confirmation

**Exit criteria:** Every table in both schemas has exactly one named owner; the `WorksheetProject`→`course_sessions` FK is specified with type and nullability; the RLS/auth-context question is answered, not deferred.

---

## STEP 3 — backend-dev: Generic quality gate registry

**Owner:** backend-dev
**Starts when:** STEP 1 handoff exists (independent of STEP 2 — can run in parallel)

**Task:** Replace `IQualityGateRunner`'s 4 hardcoded methods and `GateRunnerService`'s switch statement with a DI-registered `IQualityGate` contract (`Code` + `EvaluateAsync(GateContext, GateConfig)`), and fix the `QualityReceipt` property mismatch where `GateRunnerService` writes properties (e.g. `ArabicRatioVerdict`) that don't exist on the model, causing `QualityGatesController` to return an empty `GateResults` list even when gates ran.

**Mandatory reading:**
- `backend/src/CourseDeveloper.Core/Interfaces/IQualityGateRunner.cs`
- `backend/src/CourseDeveloper.Infrastructure/QualityGates/GateRunnerService.cs`
- `backend/src/CourseDeveloper.Core/Models/QualityReceipt.cs` and `QualityGateDefinition.cs`
- `D:\vault\academy-brain\scripts\swarm\gates\__init__.py` — the `@register()` pattern as conceptual blueprint only, not a literal port (Codex was explicit: academy-brain's `Callable[[str], GateResult]` signature is too narrow for Studio's asset/contextual gates)
- `docs/tickets/codex-review-evidence/studio-review.json`, decision 4 section — full evidence and the exact defect line citations

**Constraints:**
- Must fail loudly (not silently skip) on an enabled gate with an unknown code.
- Must support all 5 gate kinds academy-brain has (Arabic ratio, boundary, brand palette, citation-filtering, pedagogy-coverage) plus Studio's asset reconciliation — 6 total, not 4.
- `GateConfig` (currently loaded but never passed to handlers) must actually reach `EvaluateAsync`.
- Per DEC-005: each gate result carries an internal severity — `advisory` (informational only), `approvalRequired` (reserved for genuinely consequential exceptions — expected to be rare in this design), or `blocking` (prevents publish/advance). This severity is never exposed as a customer-facing setting or menu — it's config-time policy, read by STEP 8's UI (rendering studio-frontend gate results per STEP 7's wiring) to decide whether to show a dismissible note or a plain-language blocking message with one concrete fix. A `blocking` result must carry a human-readable reason and remedy string, not just a pass/fail code.
- Per Standing Rule 10a (added 2026-09-05, after this step shipped): this step's registry/dispatch mechanism, result contract, and 4 ported gates are unaffected; no STEP 3 code change is required. The later orchestration that consumes any content-quality result (including a result from an existing ported gate) must exhaust the auto-correct/bounded-retry cascade before allowing it to prevent publish/advance, and the same rule binds whoever later implements the deferred citation-filtering/pedagogy-coverage gate logic. **STEP 11 Phase A/B (2026-09-05) is now that orchestration step** — see STEP 11 for the batch plan that routes content-quality `blocking` results produced by this service through the cascade using an explicit origin/kind classification, without changing the immediate blocking/fail-closed semantics of STEP 8b user-input validation or STEP 12 safety guards.

**Scope lock — do NOT:**
- Do not implement the citation-filtering or pedagogy-coverage gate logic itself in this step — only the registry/dispatch mechanism and the existing 4 gates ported to the new interface. New gate *logic* is out of scope unless the user asks for it explicitly.
- Do not change `QualityGateDefinition`'s database shape — it's already generic enough (per Codex finding); only fix the receipt-writing bug.

**Output:** `docs/tickets/handoffs/step3-gate-registry.md` — new interface, migration of the 4 existing gates, defect fix, before/after `GateResults` output sample

**Exit criteria:** `dotnet test` passes on the gate test suite; hitting the quality-gates endpoint with all 4 existing gates enabled returns a populated (non-empty) `GateResults` list; an unknown gate code enabled in config produces a visible error, not a silent skip.

---

## STEP 4 — backend-dev: GenerationJob schema and dedicated worker service

**Owner:** backend-dev
**Starts when:** STEP 2 handoff exists (needs the schema ownership plan) and STEP 1 handoff exists (needs working auth/DI)

**Task:** Add a `GenerationJob` (and `GenerationJobEvent`) table to the Supabase Postgres database per STEP 2's plan, and stand up a separately-running `CourseDeveloper.Worker` project (not an `IHostedService` inside `CourseDeveloper.Api`) that polls it with atomic claim/lease, heartbeat, attempt count, and lease-expiry recovery. Per DEC-004, "separately deployable" means its own process/container within the one Studio release — not an independently-versioned product with its own release cadence.

**Mandatory reading:**
- `docs/tickets/codex-review-evidence/studio-review.json` and `docs/tickets/codex-review-evidence/academybrain-review.json`, decision 7 sections — full list of required mechanics (idempotency key, cancellation, resumable external task IDs, per-course concurrency)
- STEP 2's handoff — table ownership plan this must slot into

**Constraints:**
- Postgres only — no Redis/RabbitMQ (Standing Rule 7).
- One worker may own a `(course, session, operation)` idempotency key at a time.
- Job states must include queued, claimed, running, succeeded, failed, canceled, retryable at minimum — plus room for post-generation states (merge/overlay/review) that STEP 5 will use, since a NotebookLM-returned PDF is not itself "done" per academy-brain's own generator output.

**Scope lock — do NOT:**
- Do not implement the academy-brain subprocess invocation itself here — this step builds the job table and worker skeleton/polling loop only. The actual "run academy-brain" logic is STEP 5.
- Do not touch `IAgentOrchestrator` — it can keep handling short-running stage coordination; `GenerationJob` is a new, separate path for durable long-running generation.

**Output:** `docs/tickets/handoffs/step4-generation-job-worker.md` — schema, worker project structure, claim/lease/heartbeat implementation, how to run the worker locally

**Exit criteria:** `CourseDeveloper.Worker` runs as its own process, independent of `CourseDeveloper.Api`; a manually-inserted `GenerationJob` row gets claimed, its lease visibly renewed on heartbeat, and released/re-claimable if the worker is killed mid-job.

---

## STEP 5 — backend-dev + coder: academy-brain job contract and subprocess adapter

**Owner:** backend-dev (contract + adapter), coder (academy-brain-side config externalization)
**Starts when:** STEP 4 handoff exists

**Task:** Physically move academy-brain's source into this monorepo at `/academy-brain` (per DEC-004's repository shape above) — including `pyproject.toml`, `scripts/swarm/`, `00-contracts/`, and `tests/` — verify the moved copy is the authoritative one (working tree diff against the pre-move `D:\vault\academy-brain` clean), and retire/archive the old `D:\vault\academy-brain` repository per Standing Rule 9. Then define a versioned job-request/result contract between Studio's worker and academy-brain, implement the subprocess adapter in `CourseDeveloper.Worker` that invokes academy-brain's code from the newly-moved `/academy-brain` (no more "pinned external release"), and externalize academy-brain's currently hardcoded execution-boundary *path* values (vault/course root, NotebookLM credential reference, output location) so the adapter can pass them per-job instead of relying on `generate_session.py`'s process-global `VAULT`/`COURSE`/`BRAND` path bindings. Gate *rule-values* (brand palette colors, language ratio targets, boundary terms) are explicitly out of scope here — see Scope Lock and STEP 12, which does that half. Per DEC-005, the job result must also report a **transformation summary** (what was preserved from the source text verbatim, what was added, what was mechanically adjusted) — sourced from academy-brain's real pedagogy-coverage gate output, not a guess — for STEP 8's customer-facing receipt.

**Mandatory reading:**
- `D:\vault\academy-brain\scripts\swarm\generate_session.py` lines ~18, 39–51, 592–874 (pre-move source, at its current path — read before moving) — the CLI entrypoint, the hardcoded globals, and the NotebookLM stored-session client usage (confirmed by Codex to be a stored-credential API client, not live browser automation — correct this in any docs that still say "browser automation")
- `D:\vault\academy-brain\scripts\swarm\paths.py` — `CoursePaths`/`for_root(root)` already exists; `generate_session.py` doesn't use it yet, which is exactly the gap this step closes
- `D:\vault\academy-brain\00-contracts\pedagogy.md` and `scripts\swarm\gates\pedagogy_coverage.py` — the real pedagogy check (Bloom's taxonomy) this step must expose in the job result, replacing the MVP's current Groq-only, regex-based objective/skill detection (`D:\vault\Dr mahmoud MVP\src\server\first-route\governed-input-service.ts` ~line 229, 381)
- `backend/src/CourseDeveloper.Core/Models/Organization.cs` — the source of the brand/language/boundary config; NOT this step's job (see Scope Lock) — read only to confirm the fields this step's job-contract shape will need to accommodate later, in STEP 12
- `docs/tickets/codex-review-evidence/academybrain-review.json` (decisions 1 and 3) and `docs/tickets/codex-review-evidence/engine-placement-reversal-review.json` (DEC-004's effect on this step, including the migration rule) — full evidence

**Constraints:**
- academy-brain stays Python; do not port any of it to C# (not reopenable without a new user ruling).
- Per DEC-004: academy-brain's source lives in this same repo (`/academy-brain`), builds and deploys from the same commit as the rest of Studio — no separate release/version to pin, no copy-and-diverge risk. The job payload keeps `contractVersion` (the job-contract schema version) separate from `studioBuild`/`commitSha` (the Studio build/commit that executed the job) — see STEP 2. Neither field is an academy-brain release number.
- The adapter must invoke academy-brain via `CoursePaths.for_root(root)`, not the legacy module-level globals — this is the concrete de-hardcoding step, not a full institute-agnostic rewrite of every gate module.
- One end-to-end Techno Square course must actually run through this path before the step is called done (decision 3's "thin vertical slice") — but only after the path values above are externalized, not before.
- Extraction stays dumb text-pulling (structuring pasted/uploaded content into fields); the pedagogy pass is a distinct step in the job pipeline that runs academy-brain's real gate, not the extraction model itself guessing objectives.
- The old `D:\vault\academy-brain` repository must be marked archived/read-only once the move is verified — no dual-maintenance window beyond this step (Standing Rule 9).

**Scope lock — do NOT:**
- Do not build the HTTP-service version of the adapter — subprocess only, per decision 1. HTTP is an explicit "later, only if needed" per all 3 Codex reviews.
- Do not de-hardcode every academy-brain gate module's institute-specific values in this step (e.g. `brand_palette.py`'s Techno Square hex constants) — only the execution-boundary values listed in Task. Full gate neutralization is future work, explicitly deferred by decision 3.

**Output:** `docs/tickets/handoffs/step5-academy-brain-adapter.md` — move manifest (files moved, diff-verified against pre-move source, old-repo archive confirmation), job contract schema, adapter code, list of externalized config values, proof of one real end-to-end run

**Exit criteria:** `/academy-brain` exists in this monorepo as the verified authoritative copy and the old `D:\vault\academy-brain` repository is archived; a `GenerationJob` submitted through Studio's worker produces a real academy-brain course output for a Techno Square course, using per-job config rather than `generate_session.py`'s hardcoded globals, with `contractVersion` and `studioBuild`/`commitSha` both recorded on the job record.

---

## STEP 6 — devops-automator: academy-brain worker runtime, secrets, and artifact custody

**Owner:** devops-automator
**Starts when:** STEP 5 handoff exists

**Task:** Package academy-brain's runtime as a reproducible worker image — per DEC-004, this image bundles `CourseDeveloper.Worker` **and** the Python runtime + academy-brain code from the same repo commit, replacing the current machine-specific venv path — provision NotebookLM credentials through a secret store instead of local stored-session files, and define durable artifact storage for generated course outputs off the local filesystem. **This step also closes a concrete gap STEP 5 left open**: `GenerationJob.NotebookLmAccountKey` (`backend/src/CourseDeveloper.Core/Models/GenerationJob.cs:14`) is stored on every job and already used to keep two jobs on the same account from running concurrently (`NpgsqlGenerationJobRepository.cs:143`), but nothing resolves that key to the `pythonExecutable` interpreter path STEP 5's job-request contract requires for a live run (`contracts/generation-job/request.schema.json`'s `pythonExecutable` field). Define that resolver here — e.g. a per-account-key table/env mapping to an interpreter path with that account's stored NotebookLM session — as part of the secret-store provisioning work.

**Mandatory reading:**
- `D:\vault\academy-brain\pyproject.toml` (pre-move source — by STEP 6's start, the authoritative copy is at this monorepo's `/academy-brain/pyproject.toml` per STEP 5) — current dependency list (missing `notebooklm`, per Codex finding)
- `D:\vault\academy-brain\scripts\swarm\generate_session.py` lines ~18, 873 (pre-move path; post-move at `/academy-brain/scripts/swarm/generate_session.py`) — the machine-specific interpreter path and stored-session credential load this step replaces
- `docs/tickets/codex-review-evidence/mvp-review.json` and `docs/tickets/codex-review-evidence/academybrain-review.json`, decision 9 — full requirements list (credential rotation, per-org credential policy, encrypted storage, retention)

**Constraints:**
- `notebooklm` must be declared as an explicit dependency, not an implicit import.
- Credential provisioning must support rotation without redeploying the worker image.
- Artifacts must land somewhere Studio-visible (not just the local job workspace) with hashes/locations recorded in Postgres per STEP 4's job schema.
- The `NotebookLmAccountKey` → `pythonExecutable` resolver must be a lookup the worker performs at execution time (e.g. from the secret store, keyed by the job's account key), not a value baked into the enqueue-time job payload — rotating a credential must not require re-enqueuing in-flight jobs.

**Scope lock — do NOT:**
- Do not change the job/worker logic from STEP 4/5 — this step is packaging, secrets, and storage only.
- Do not pick a specific secret manager or cloud provider without checking what Studio/MVP's existing Vercel/Supabase deployment already uses — reuse existing infrastructure choices rather than introducing a new vendor.

**Output:** `docs/tickets/handoffs/step6-worker-runtime.md` — worker image definition, credential provisioning mechanism, artifact storage location and retention policy

**Exit criteria:** The worker runs from the packaged image (not a developer's local venv); a NotebookLM credential can be rotated without a code change; a generated artifact from STEP 5's test run is retrievable from the durable storage location, not just the local job workspace.

---

## STEP 7 — frontend-developer: Wire Studio frontend to its own backend

**Owner:** frontend-developer
**Starts when:** STEP 1 and STEP 3 handoffs exist (needs working auth and the gate registry's real, non-empty responses)

**Task:** Replace `frontend/src/lib/supabase.ts`'s direct-Supabase CRUD and silent localStorage/demo fallback with calls to Studio's authenticated .NET API for organizations, projects, sessions, and gates. Keep the Supabase JS client only for authentication (or wherever STEP 1's auth design calls for it).

**Mandatory reading:**
- `frontend/src/lib/supabase.ts` — every fallback path Codex cited (organizations ~line 112, project writes ~314, session seeding ~554, gate result fabrication ~1167 per the Studio-scope Codex review)
- `frontend/src/components/ObsidianParaBrowser.tsx` — the one component that already calls the .NET backend correctly; use as the working pattern
- STEP 1's handoff — the actual auth mechanism now available to call from the frontend

**Constraints:**
- No silent fallback in production paths (Standing Rule 8) — any remaining demo behavior must be behind an explicit, named demo mode flag, never a bare `catch` that swallows the error.
- Preserve `ObsidianParaBrowser`'s existing working backend call — do not "fix" something that already isn't broken.
- Per DEC-005/Standing Rule 10: do not add any settings/config UI here even incidentally (e.g. no "API connection mode" toggle) — errors surface as plain-language messages inline, not as a diagnostics panel.

**Scope lock — do NOT:**
- Do not begin the MVP merge in this step (that's STEP 8) — this step only fixes Studio's existing frontend's own data flow.
- Do not remove Supabase entirely — auth may still legitimately use it per STEP 1's design.

**Output:** `docs/tickets/handoffs/step7-frontend-backend-wiring.md` — before/after for each fallback path removed, confirmation demo mode (if kept) is explicit and named

**Exit criteria:** Killing the .NET API produces visible errors in the frontend for organizations/projects/sessions/gates, not silently-served demo data; `ObsidianParaBrowser`'s existing backend call still works unchanged.

---

## STEP 8 — frontend-developer: Give Studio its own login page

> [!info] Reassigned 2026-09-05 (DEC-008). This step used to be the full MVP merge — that scope still exists, unscheduled, as **STEP 8b** immediately below. This STEP 8 is new and much smaller.

**Owner:** frontend-developer
**Starts when:** the user has personally confirmed the STEP 1–7 product runs end-to-end (i.e. has used the app and is satisfied it works) — **this is a manual go-ahead from the user, not a file-existence gate.** Do not start this step just because STEP 7's handoff file exists.

**Task:** Build a real login/sign-up page for Studio's own frontend and wire session state through it, so the API calls STEP 7 already wired stop needing a hand-run Supabase session. Model it directly on MVP's already-working, already-proven pattern — `D:\vault\Dr mahmoud MVP\src\app\login\page.tsx` (the actual screen: email, password, one submit button, a sign-up toggle, nothing else) plus `AuthContext.tsx`/`session.ts` (the session logic) — as a **reference to follow, not code to move**. Add an app-wide guard that redirects an unauthenticated visitor to `/login`, and make sure a signed-in session persists across a page reload and actually attaches to every request STEP 7's `apiClient.ts` sends.

**Mandatory reading:**
- `D:\vault\Dr mahmoud MVP\src\app\login\page.tsx` — the actual screen to model (already read in full this session: email field, password field, one submit button, a plain-text mode toggle, an inline error banner — no third-party sign-in buttons, no "forgot password" flow, no extra screens)
- `D:\vault\Dr mahmoud MVP\src\lib\auth\AuthContext.tsx` and `src\server\auth\session.ts` — the session/token logic behind that screen
- STEP 1's handoff (`docs/tickets/handoffs/step1-backend-auth-di.md`) — the exact backend auth mechanism this login must produce a token for
- STEP 7's handoff (`docs/tickets/handoffs/step7-frontend-backend-wiring.md`) — its "no login flow" gap note, and `frontend/src/lib/apiClient.ts` — where the real access token needs to attach to outgoing requests

**Constraints:**
- One Supabase auth boundary: authenticate against Studio's own, already-canonical Supabase project (DEC-006: `gjxhfyfonjdcaimxjipp`) — do not point this login at MVP's separate project (`jbjfafyjqdjmzmdggzha`); that project's data migration is STEP 8b's concern, not this step's.
- Per Standing Rule 10 (DEC-005): one screen, one flow, identical for every institute type — no "which organization are you" chooser, no config, no mode toggle. If a signed-in user belongs to more than one organization, that selection happens post-login, inside the app's existing organization switcher (`ObsidianGraphView`/dashboard already has one) — not as a login-time decision.
- Session must survive a page reload without forcing re-entry of credentials, matching what MVP's pattern already does.

**Scope lock — do NOT:**
- Do not move any of MVP's Prisma lesson-authoring tables, routes, or components — that is STEP 8b, deferred.
- Do not implement the `WorksheetProject`↔`course_sessions` FK or any canonical-database data migration (DEC-006's execution) — STEP 8b.
- Do not implement the transformation-receipt or blocked-button plain-language messaging — those are STEP 8b's UX additions on MVP's `/create` flow, not this step's.
- Do not add password reset, social sign-in, multi-factor auth, or any screen beyond what MVP's existing login page already has — match the proven pattern, don't expand it.

**Output:** `docs/tickets/handoffs/step8-studio-login.md` — the login page, the session-wiring approach, before/after for an unauthenticated request against a STEP 7 endpoint

**Exit criteria:** an unauthenticated visit to Studio redirects to `/login`; a successful sign-in persists a session and every STEP 7 API call (organizations/projects/sessions/gates) succeeds without a hand-run token; a reload keeps the session; signing out clears it and re-locks the app; the login screen has exactly one flow with zero settings/mode configuration.

---

## STEP 8b — frontend-developer + backend-dev: Merge MVP lesson-authoring into Studio *(deferred — not currently scheduled)*

> [!warning] Deferred 2026-09-05 (DEC-008). This is the full scope that used to be STEP 8, preserved verbatim below so it isn't lost. **Do not start this step from this ticket alone** — it requires a fresh, explicit user go-ahead in addition to its own prerequisites, because the user descoped it precisely to avoid this scale of work happening automatically once STEP 7 shipped.

**Owner:** frontend-developer (Next.js/Prisma code move), backend-dev (FK + auth unification)
**Starts when:** STEP 2, STEP 6, and STEP 8 handoffs all exist, **and** the user has explicitly authorized this step by name (a handoff existing is necessary but not sufficient — see the deferral note above).

**Task:** Move MVP's lesson-authoring routes, components, and Prisma layer into CourseDeveloperStudio's Next.js frontend as a module (per DEC-003 — literal code merge, not a separate deployment). Extend STEP 8's login (already built by this point) so MVP's Supabase auth pattern is the shared identity boundary application-wide, including MVP's own users/data. Implement the `WorksheetProject.sessionId` → `course_sessions.id` FK per STEP 2's plan, executing DEC-006's canonical-database consolidation (Studio's Supabase project is canonical; MVP's production data migrates in; MVP's old project is retired once verified). Per DEC-005, add two small, non-branching additions to MVP's existing linear `/create` flow: (1) a short "transformation receipt" shown with the finished lesson — kept / added / adjusted, sourced from STEP 5's job result, not invented here; (2) when a required-field button won't advance, show one plain-language reason and one concrete fix inline (e.g. "Add the school logo to continue.") instead of leaving it silently disabled.

**Mandatory reading:**
- `D:\vault\Dr mahmoud MVP\src\lib\auth\AuthContext.tsx` and `src\server\auth\session.ts` — the auth pattern becoming platform-wide (STEP 8 already used this as a reference for Studio's own login; this step is where MVP's own users/data actually move onto that boundary)
- `D:\vault\Dr mahmoud MVP\prisma\schema.prisma` — all 17 models being moved (not 15, per Codex's correction of the original research)
- STEP 2's handoff — the exact FK type/nullability decided there
- STEP 8's handoff — the login page and session wiring this step builds on rather than duplicates
- `docs/tickets/codex-review-evidence/studio-review.json`, decision 6 section — evidence for why "auth/data layer" language needed qualifying (MVP's data model isn't Studio's general data layer, it's the lesson-authoring bounded context specifically)
- `docs/tickets/codex-review-evidence/adoption-ux-round1-review.json` and `docs/tickets/codex-review-evidence/adoption-ux-round2-review.json` — DEC-005's full reasoning, the transformation-receipt gap, and why it can't just reuse MVP's existing intake-confirmation step

**Constraints:**
- Studio's .NET API stays authoritative for organizations, curricula, projects, sessions, and gates — MVP's Prisma layer stays authoritative only for its own lesson-authoring tables (extraction → placeholder → source-pack → guide-rules → teacher-approval → checklist → handoff).
- `userId` on `WorksheetProject` (currently nullable) must become non-nullable once the unified auth requires ownership — confirm this doesn't break any existing MVP data before enforcing it.
- One Supabase auth boundary for the whole merged app — no second, parallel auth system left over from Studio's side.
- Per Standing Rule 10 (DEC-005): the receipt and blocking-message additions must not introduce any settings, mode choice, or extra button the customer has to configure — they attach to the existing linear sequence, they don't fork it.

**Scope lock — do NOT:**
- Do not redesign MVP's 17-model workflow (extraction/placeholder/guide-rules/etc.) beyond the two additions named in Task — move the rest as-is; other workflow changes are a separate, future request.
- Do not merge MVP's and Studio's "project" concepts into one table — decision 6 is explicit that these stay two linked aggregates (via the FK), not one collapsed entity.
- Do not build a before/after diff UI or a separate approval screen for the transformation receipt — it's a compact, read-only summary attached to the result, per Codex round 2's "not a full comparison interface" ruling.

**Output:** `docs/tickets/handoffs/step8b-mvp-merge.md` — file move manifest, auth unification summary, FK migration, transformation-receipt implementation, before/after for one lesson-authoring flow exercised end-to-end inside the merged app

**Exit criteria:** MVP's lesson-authoring flow runs inside CourseDeveloperStudio's frontend under one auth session, unchanged in step order; a `WorksheetProject` created in that flow carries a valid FK to a real `course_sessions` row; the finished lesson shows a transformation receipt; a blocked required-field button shows a plain-language reason and fix; no separate MVP deployment is required for this flow to work.

---

## STEP 9 — system-architect (Phase A) + backend-dev/coder (Phase B): Digestion-pipeline diagnosis, capability comparison, and implementation (academy-brain, with MVP as a candidate source)

> [!info] Changed 2026-09-05 (DEC-008, DEC-009). This step used to stop at a proposal document comparing MVP vs. academy-brain. It now has two phases: Phase A (diagnose academy-brain's own gate-only stages + compare/propose against MVP where relevant) is widened per DEC-009; Phase B (implement) only ever covers capabilities the user has explicitly approved out of Phase A's table — it never starts on Phase A's completion alone.

**Owner:** system-architect (Phase A — diagnosis + comparison), backend-dev + coder (Phase B — implementing only the capabilities the user approves; coder for academy-brain/Python-side changes, backend-dev for anything touching Studio's .NET API or MVP's TypeScript side)
**Starts when:** STEP 5 handoff exists (academy-brain is then in the monorepo and STEP 5's already-implemented pedagogy-gate change is known; the comparison can inspect MVP's existing source before STEP 8b moves it and does not depend on the merge). Phase B additionally starts only when the user has explicitly approved one or more specific capabilities from Phase A's output — never automatically.

### Phase A — Diagnose, compare, and propose

**Task:** Start from the pre-work diagnosis already done (`docs/tickets/handoffs/step9-digestion-diagnosis.md`, DEC-009): academy-brain's DIGEST stage is pure extraction, and 9 of its other 10 documented stages (receipts, research, provenance, critique, patch, refutation, approval, localization, bundling) are file-presence/metadata gates standing in for real content review. For each broken stage, propose a concrete fix — what the stage should actually do, grounded in what its own docs (`ENGINE.md`, `pdf-intake-sop.md`) already claim it does. Where MVP's content-intake/digestion pipeline (source intake → `PlaceholderSet` inference → `GuideDocument`/`GuideRule` ingestion → `SourcePackAttempt` generation) has a directly transferable capability for a given stage, name it per DEC-007's original comparison mandate — but MVP is not required to have an answer for every stage; academy-brain's critique/patch/refutation gates, for instance, may need a fix with no MVP equivalent at all. For each candidate fix (MVP-sourced or academy-brain-native): what the stage does today (cite the diagnosis or fresh code reading), what it should do instead, why, what it would take to build, and what it would NOT change (inputs/outputs/stored semantics MVP's teachers or academy-brain's existing gate chain already depend on, unless the fix is explicitly about changing those). Phase A produces a proposal for the user to approve — it does not implement anything.

**Mandatory reading:**
- `docs/tickets/handoffs/step9-digestion-diagnosis.md` — the completed pre-work diagnosis (DEC-009); ground every proposed fix in this, don't re-derive it from scratch
- `D:\vault\Dr mahmoud MVP\prisma\schema.prisma` — `SourceDocument`, `PlaceholderSet`, `GuideDocument`/`GuideRule`, and `SourcePackAttempt`, to ground MVP's stored entities in the actual schema
- `D:\vault\Dr mahmoud MVP\src\server\source-intake\service.ts`, `src\server\placeholders\service.ts`, `src\server\first-route\governed-input-service.ts`, and `src\server\first-route\source-pack-service.ts` — the implementation paths that ground what MVP actually does with those entities
- academy-brain's monorepo copies of `docs\ENGINE.md`, `00-contracts\pdf-intake-sop.md`, `scripts\swarm\digest_office.py`, `scripts\run_digest.py`, `scripts\swarm\stage_gate.py`, and `scripts\swarm\generate_session.py` (paths per the diagnosis handoff) — read the relocated authoritative copies, not the retired source repository
- `docs\ENGINE.md` — the documented 11-stage pipeline (receipts, research, digest, provenance, critique, patch, refutation, approval, localization, bundling, generation), not just the `DIGEST` stage name
- `00-contracts\pdf-intake-sop.md` — the sourced-receipt, digest, then independent-review pattern for PDF sources
- STEP 5's handoff — academy-brain's pedagogy gate already replaces MVP's regex-based objective/skill detection; any STEP 9 proposal must be distinct from that already-shipped change, not a duplicate of it

**Constraints:**
- Every proposed fix must name: the specific academy-brain stage/mechanism it targets (cite the diagnosis handoff or fresh code), a concrete before/after (not "richer digestion" — an actual example of what changes), and, where one exists, the MVP touchpoint it draws from.
- Must explicitly flag scale/format mismatches per capability drawn from MVP (MVP: one teacher, one lesson, pasted text or PDF; academy-brain: one multi-session course with a broader PDF-oriented intake SOP, while its legacy automated Office digest runner is PPTX-centric and hardcoded to a Micro:bit session map), so nothing is proposed that only works for Techno Square's specific course structure.
- Must not propose collapsing MVP's and academy-brain's pipelines into one shared implementation — per decision 6 and STEP 8b's scope lock, these remain two linked systems, not one merged data/processing layer.

**Phase A scope lock — do NOT:**
- Do not implement any of the proposed fixes in Phase A — Phase A produces a reviewed proposal only.
- Do not modify MVP's or academy-brain's code, schema, or pipeline in Phase A.
- Do not treat Phase A's completion as authorization to build — Phase B only covers capabilities the user has explicitly approved from Phase A's output; an unapproved capability, however well-argued, does not get built.

**Phase A output:** `docs/tickets/handoffs/step9-digestion-comparison.md` — stage-by-stage fix proposal covering academy-brain's own gate-only stages plus any MVP-sourced capability, each with a recommendation (adopt / adapt / skip) and reasoning, ready for user approval

**Phase A exit criteria:** every proposed fix names a concrete academy-brain stage/mechanism, a concrete before/after, and (where applicable) a concrete MVP touchpoint; no proposal requires collapsing the two pipelines into one; the user has an actionable list to approve or reject, not a restated version of "improve digestion."

### Phase B — Implement the approved capabilities

**Task:** For each fix the user explicitly approved from Phase A's table (adopt or adapt — never a skipped one, whether it targets an academy-brain gate-only stage directly or draws from MVP), implement exactly that fix against the before/after Phase A already described for it. If implementation reveals the real change is bigger than Phase A's before/after implied, stop and confirm with the user before proceeding on that capability rather than quietly expanding it.

**Constraints:**
- Implement only approved capabilities — an adjacent improvement noticed mid-implementation gets named in the handoff, not built without separate approval (Standing Rule 2).
- Preserve every "what it would NOT change" commitment Phase A made for each capability — MVP's teachers must not see stored semantics shift underneath a capability they didn't ask to change.
- Still bound by decision 6 / STEP 8b's scope lock: implementing a capability must not collapse MVP's and academy-brain's pipelines into one shared implementation, even if that would be technically simpler.

**Phase B scope lock — do NOT:**
- Do not implement any capability Phase A marked "skip," or any capability the user did not explicitly approve.
- Do not fold in STEP 8b's merge work (Prisma move, FK, transformation receipt) — Phase B only touches the digestion capability itself, wherever its code currently lives (MVP's repo, academy-brain's repo, or both).
- Do not batch unrelated fixes into this step because "it's already touching that file" (Standing Rule 5).

**Phase B output:** `docs/tickets/handoffs/step9-digestion-implementation.md` — which capabilities were approved, what was actually built for each against Phase A's before/after, what tests/verification ran, and confirmation nothing outside the approved list was touched

**Phase B exit criteria:** every user-approved capability is implemented, tested, and matches Phase A's stated before/after; nothing marked "skip" or left unapproved was built; MVP's and academy-brain's pipelines remain two linked systems, not one merged implementation.

---

## STEP 10 — backend-dev: canonical Obsidian vault sync

**Owner:** backend-dev
**Starts when:** STEP 5 handoff exists; if this step's asset handling reads through STEP 6's durable artifact-location contract, the final integration and exit test additionally require STEP 6. Coordinate with STEP 7 — do not treat STEP 10 as independent of it (see Constraints).

**Task:** Dr Mahmoud (non-programmer, project owner) flagged that Studio's Obsidian vault structure is poor. Investigation found two separate defects, not one:

1. **Two independent, uncoordinated vault writers exist.** `ObsidianVaultService.SyncSessionToVaultAsync` (the .NET method behind `ObsidianSyncController`) writes up to 4 flat Markdown files per session under `01_Projects/<project>/<session>/`, with no YAML frontmatter, no asset subfolder, no index/linking note. Separately, a Next.js route (`frontend/src/app/api/obsidian/sync/route.ts`) writes its own content into `02_Areas` and `03_Resources` under its own derived `VAULT_ROOT` — a second, independent serializer that may target a different vault root entirely. `ObsidianParaBrowser.tsx` tries the local Next.js filesystem route first and only falls back to the .NET backend, so the two paths compete rather than cooperate. `04_Archive` stays empty in the inspected paths.
2. **`AgentOrchestrator` never actually calls the real sync.** It logs that synchronization occurred (`ARTIFACTS_GENERATED_AND_SYNCED`) without invoking `SyncSessionToVaultAsync` — a correctness bug independent of the structural weakness above.
3. A separate, unused method on the same class (`WriteGeneratedCourseBundleAsync`) already serializes frontmatter correctly via `FrontmatterEnvelopeParser` — nothing calls it.

This step must: pick exactly one canonical vault-writing implementation (decide .NET vs. Next.js, or split responsibility along an explicit, documented contract) and retire or delegate the other, rather than maintaining two independent serializers against potentially two vault roots; fix `AgentOrchestrator` to call the real sync instead of logging a false success; add real frontmatter (reuse the already-correct `FrontmatterEnvelopeParser`), a per-session asset subfolder, and an index/linking note; populate `02_Areas`/`03_Resources` with real content per a defined artifact-type → PARA-folder mapping (not filler content solely to make them non-empty); add path-containment validation and safe filename normalization for project/session/category names used in file paths; make re-sync idempotent and atomic with a defined collision/stale-file policy.

**Mandatory reading:**
- `backend/src/CourseDeveloper.Infrastructure/Obsidian/ObsidianVaultService.cs`, `FrontmatterEnvelopeParser.cs`, `IObsidianVaultService.cs`
- `backend/src/CourseDeveloper.Api/Controllers/ObsidianSyncController.cs`
- `backend/src/CourseDeveloper.Infrastructure/Agents/AgentOrchestrator.cs` — confirm the logged-vs-actual sync gap before changing it
- `frontend/src/components/ObsidianParaBrowser.tsx`, `frontend/src/app/api/obsidian/sync/route.ts`, `frontend/src/lib/obsidianSync.ts` — the second, independent vault writer and its read-preference order
- STEP 5's result contract and STEP 6's artifact-custody handoff (for asset sourcing)
- STEP 7's handoff (frontend read path this step must not silently break)

**Constraints:**
- Exactly one component owns physical vault writes after this step; the other path is retired or delegates through the canonical one — do not leave two serializers live.
- Frontmatter must carry stable organization/project/session/artifact identity, artifact type, source/provenance, content hash, and sync timestamp.
- If consolidating the two writers requires changing `ObsidianSyncController`'s existing API/URL shape that STEP 7 already confirmed the frontend calls correctly, flag it as a small, explicitly named STEP-7-adjacent frontend follow-up rather than silently changing it.

**Scope lock — do NOT:**
- Do not touch academy-brain's own, separate vault.
- Do not invent placeholder Area/Resource content solely to satisfy "non-empty" — populate only with real, sourced content per the defined mapping.
- Do not implement STEP 11's prompt-authoring proposal in this step — unrelated scope.

**Output:** `docs/tickets/handoffs/step10-vault-sync.md`

**Exit criteria:** one canonical vault writer confirmed, the other retired or delegated; `AgentOrchestrator`'s sync claim matches a real sync call; a real synced session shows frontmatter-correct notes, populated (not filler) Areas/Resources, path-safe filenames; re-sync is idempotent; the browser still renders correctly (or the smallest possible flagged frontend change); acceptance tests cover first sync, repeat sync, updated content, assets, and unsafe paths.

---

## STEP 11 — system-architect (Phase A) + backend-dev/coder (Phase B, batched): NBLM prompt-authoring AND pipeline-wide repair-cascade implementation (Standing Rule 10a)

> [!info] Changed 2026-09-05. This step used to stop at a 3-option proposal document for NBLM prompts only. It now has two phases, mirroring STEP 9's approval-gated shape: Phase A keeps the original NBLM-prompt comparison and additionally designs the concrete Standing Rule 10a repair-cascade mechanism (retry bound, backoff, alert threshold, per-gate-kind mapping) that 10a itself deferred to "whichever step eventually implements gate logic" — that step is now this one. Phase B implements the approved design **pipeline-wide, in dependency-ordered batches** — not just for NBLM prompts, for every implemented content-quality gate this ticket touches (STEP 3's 4 existing gate implementations, STEP 5's pedagogy exposure, and STEP 11's approved prompt checks), while defining the same cascade contract for deferred gate kinds without inventing their algorithms. Phase B never starts on Phase A's completion alone.

**Owner:** system-architect (Phase A — design), backend-dev + coder (Phase B — coder for academy-brain/Python gate wiring, backend-dev for anything touching Studio's .NET `GateRunnerService`/`GenerationJob` worker)
**Starts when:** STEP 5 handoff exists. Phase B additionally starts only when the user has explicitly approved Phase A's NBLM-prompt option, cascade design, and named Phase B batches — never automatically. No individual batch starts merely because Phase A finished or because another batch was approved.

### Phase A — Design: NBLM prompt options + pipeline-wide cascade mechanics

**Task, part 1 (unchanged from the original NBLM-prompt proposal):** Dr Mahmoud flagged that academy-brain never AI-generates, improves, or semantically quality-checks the prompts used to generate student decks via NotebookLM — `new_course.py` copies a static hand-authored template (`80-generation/nblm-student-deck-prompts.md`) into every course; `generate_session.py` parses and uploads it as-is. (`ENGINE.md`'s note that this file "exists nowhere" is stale — flag as a doc-drift finding regardless of which option below is chosen.) Propose 3 options at rising ambition/risk, each with a concrete before/after, risk, cost, and recommendation:
- **(a)** Formalize the existing baseline into a validated, parameterized guided template — hardcoded assumptions (duration, branding, course references) become runtime fields the backend fills in automatically from the course/org record.
- **(b)** Add deterministic structural/pedagogical pre-flight checks (map exactly which properties `pedagogy_coverage.py`'s Bloom's-taxonomy gate can validly assess vs. what needs separate checks — parser structure, audience, branding, duration, forbidden content, required sections).
- **(c)** AI drafts/critiques the prompt text itself — needs a one-time platform-owner enablement decision (never a per-job approval shown to the end user), model/provider choice, versioning/provenance, and an audit record.

**Task, part 2 (new):** design the shared repair-cascade mechanism Standing Rule 10a requires, concretely enough for Phase B to build it without further judgment calls:
- The per-attempt retry bound, backoff schedule, and operational alert threshold (10a explicitly left these undefined at the Standing-Rule level, for this step to set).
- How a bounded attempt and its reschedule-on-exhaustion hook into `GenerationJob`'s existing job-state machine (queued/claimed/running/succeeded/failed/canceled/retryable — STEP 4) — no new queue infra (Standing Rule 7).
- The exact orchestration/consumer boundary that will act on a returned `QualityReceipt`. `GateRunnerService` currently adds severity metadata, computes `OverallVerdict`, persists the receipt, and returns it; it does **not** itself short-circuit publication or own a durable `GenerationJob`. Phase A must therefore trace any current publish/advance consumer and, if none exists, design the smallest explicit worker/orchestrator integration point rather than assuming a pre-existing short-circuit.
- A per-gate-kind mapping table covering STEP 3's 6 gate kinds (Arabic ratio, boundary, brand palette, citation-filtering, pedagogy-coverage, asset reconciliation) plus whichever NBLM-prompt option gets recommended: for each, name what counts as a real auto-correctable fact, what counts as a real authoring/generation operation worth retrying, and what — if anything — is pre-release-validation-only per option (b)'s reasoning (a static defect with no authoring operation to retry must be caught before release, not given a meaningless runtime retry).
- Explicit confirmation, gate by gate, that the mapping does not sweep in Standing Rule 10a's two exceptions: STEP 8b's user-input blocking and STEP 12's fail-closed multi-tenant org-config check both stay outside the cascade, unchanged.
- A dependency-ordered **batch plan** for Phase B (see Phase B below for the default shape) and a batch-by-batch approval matrix. Phase A may reorder or merge batches if it finds a better sequencing, but must state the sequencing explicitly; no blanket approval of the cascade design may be inferred as approval to build a previously deferred gate algorithm.

**Design lock — monkey-theory UX applies here too:** the end user (academy owner, professor, teacher) is designed for as technologically illiterate — one linear button sequence, no settings, no dials, no "review and approve" screens; the backend absorbs all judgment invisibly. None of this may add a step, screen, toggle, or judgment call to the end user's existing generate-deck button flow. "Owner" means the platform/product owner making a one-time, out-of-band build/enablement decision — never the button-presser approving individual jobs.

The rule is "monkey clicks button, button **works**" — with a **real** result, not a stand-in. A quality check that hard-blocks generation on failure breaks the button as badly as a settings dial would. But silently substituting generic/template content for the real output is worse, not better — the user has already been burned by exactly that pattern once, in the MVP, and rejects that direction outright: the cascade design must auto-correct only current, authoritative backend-known facts, retry the real authoring/generation operation in bounded attempts against real inputs, and fall back only to an honest "still working" state — never to a canned substitute. Only a true infra failure (an external API/service down, not a content-quality finding) may surface as a stopped, plain-language, retryable message.

**Mandatory reading:**
- `D:\vault\academy-brain\80-generation\nblm-student-deck-prompts.md`, `scripts\swarm\new_course.py`, `scripts\swarm\generate_session.py`, `docs\ENGINE.md` — as before, for the NBLM-prompt comparison
- `backend/src/CourseDeveloper.Infrastructure/QualityGates/GateRunnerService.cs`, `backend/src/CourseDeveloper.Core/Interfaces/IQualityGateRunner.cs`, `backend/src/CourseDeveloper.Core/Models/QualityReceipt.cs`, and `backend/src/CourseDeveloper.Api/Controllers/QualityGatesController.cs` (STEP 3's shipped registry/result path) — verify where severity is metadata/aggregation today and trace whether any backend consumer currently enforces it
- `backend/src/CourseDeveloper.Worker/GenerationJobPollingService.cs`, `backend/src/CourseDeveloper.Infrastructure/Supabase/NpgsqlGenerationJobRepository.cs`, `backend/src/CourseDeveloper.Core/Models/GenerationJob.cs`, and `backend/src/CourseDeveloper.Core/Enums/CoreEnums.cs` (STEP 4's worker/state path) — the existing job-state machine and retry semantics to build on, not duplicate
- Standing Rule 10a and its two exceptions (Standing Rules section) — the contract this design must satisfy exactly

**Constraints:**
- Must not propose folding this into STEP 5's already-locked migration/adapter scope.
- Must include versioning/provenance for whichever prompt controls a given generation job.
- Must not add any new step, screen, toggle, or decision point to the end user's button flow.
- The cascade design must never substitute generic/template/stale content for a real result — auto-correct real facts, retry the real operation, or fall back to an honest "still working" state; "reject and report" and "silently substitute" are both unacceptable terminal states.
- Must reuse `GenerationJob`'s existing state machine and Postgres-backed queue (Standing Rule 7) — no new retry infrastructure, no new broker.

**Phase A scope lock — do NOT:**
- Do not implement any option or any cascade code in Phase A — design and propose only.
- Do not modify the prompt file, `new_course.py`, `generate_session.py`, `GateRunnerService.cs`, or any gate's detection algorithm in Phase A.
- Do not treat Phase A's completion as authorization to build — Phase B only implements what the user explicitly approves.
- Do not fold STEP 8b's or STEP 12's excepted flows into the cascade design.

**Phase A output:** `docs/tickets/handoffs/step11-nblm-prompt-authoring.md` — the 3-option NBLM comparison with recommendation, the `ENGINE.md` doc-drift note, the concrete cascade mechanics (retry bound/backoff/alert threshold), the per-gate-kind mapping table, and the proposed Phase B batch plan.

**Phase A exit criteria:** each NBLM option has a concrete before/after, risk, cost, and an approval boundary that keeps the end-user's button flow unchanged; the cascade design names concrete numbers (not "some retries"); the per-gate mapping table covers all 6 STEP 3 gate kinds plus the NBLM option; both 10a exceptions are explicitly confirmed excluded; the user has an actionable recommendation, dependency map, and batch-by-batch approval matrix to approve, not a restated "make it more resilient."

### Phase B — Implement the approved design, pipeline-wide, in batches

**Task:** For the NBLM-prompt option, cascade design, and individual batches the user explicitly approved from Phase A, implement exactly that, with each delivered batch committed independently. Batch 1 is the hard prerequisite for Batches 2–4; Batches 2 and 3 then wire separate gate families and have no hidden dependency on each other; conditional Batch 4 requires Batch 1 plus its own distinct scope approval; Batch 5 follows every approved/implemented batch. The default delivery order is 1 → 2 → 3 → 4 (if approved) → 5 so review and rollback stay predictable, not because every adjacent pair has a technical dependency. This uses STEP 9 Phase B's same non-negotiable approve-then-implement discipline; the explicit batch decomposition is STEP 11's own execution detail. Default batch shape, adjustable per Phase A's actual proposed sequencing and batch-by-batch approval matrix:
- **Batch 1 — shared cascade primitives and exception boundary (backend-dev).** Build the reusable auto-correct/bounded-retry/reschedule-with-backoff mechanism against `GenerationJob`'s existing state machine and add the explicit worker/orchestrator consumer boundary Phase A identified for returned `QualityReceipt` results. Add an explicit content-quality origin/kind discriminator and route only eligible content-quality `blocking` results through the cascade; never route by severity alone, and do not misdescribe `GateRunnerService` itself as an existing hard-stop owner. Before this batch can be committed, focused tests must prove a representative content-quality `blocking` result enters the cascade while representative STEP 8b user-input validation and STEP 12 org-config safety failures retain their immediate block/fail-closed behavior. No gate-specific detection logic yet.
- **Batch 2 — wire STEP 3's 4 already-ported gates (Arabic ratio, boundary, brand palette, asset reconciliation) through the cascade (backend-dev/coder),** per Phase A's mapping table.
- **Batch 3 — STEP 5's pedagogy-coverage exposure + the approved NBLM-prompt option (coder for Python-side, backend-dev for job wiring),** through the same shared cascade. **Known limitation, deferred to STEP 12 (per user decision 2026-09-05):** the NBLM prompt renderer (`NblmPromptPreflightRepair.cs`) resolves duration/audience/organization-name/branding by reading `CourseSession`/`CourseProject`/`Organization` live at correction time, not from an immutable per-job snapshot — Codex's Batch 3 follow-up review flagged that a queued/retried job can therefore render different instructions after a mid-flight config change. The correct fix is the same enqueue-time snapshot mechanism STEP 12 already owns (see STEP 12 Constraints below); building it early, just for this one gate, would mean constructing STEP 12's core infrastructure ahead of schedule. STEP 12 must extend its snapshot to cover these NBLM-prompt fields, not just brand/language/boundary values.
- **Batch 4 — citation-filtering gate logic (conditional, separately approved).** Build and wire this algorithm only if Phase A proposed it and the user gave a distinct approval specifically naming citation-filtering gate logic, which STEP 3 deliberately deferred. Otherwise skip the entire batch: do not add a detector, no-op/advisory result, fallback, or placeholder implementation. The shared cascade contract may reserve the existing citation-filtering gate kind for future use, but an enabled gate with no registered implementation must continue to fail loudly under STEP 3's contract.
  **Skipped (per user decision 2026-09-05):** the user named Batch 4 specifically, so investigation proceeded before writing any code. Finding: `academy-brain/scripts/swarm/gates/cite_filter.py`'s `check`/`filter_issues` have no live caller anywhere in the real deck-generation pipeline — `generate_session.py` never produces or reads an "issues"/"cites" JSON payload, and `stage_gate.py`'s own "critique" stage validates the separate `critique_lane.py` schema instead (whose `cites` field is already required non-negotiably, so re-running `cite_filter` against lane files would be a no-op). `cite_filter.py`'s only caller in this repo is its own unit test; it was written for an older, unrelated microbit-swarm critique/judge design (see `academy-brain/docs/superpowers/plans/2026-08-20-microbit-swarm-infrastructure.md`), not for this pipeline. "Wiring" it into the Studio cascade would therefore mean designing new gate logic from scratch (what artifact to check, how to produce it) — the exact "invented gate logic nobody asked for" outcome this batch's own constraint forbids — not porting an existing check. User chose to leave this batch unbuilt; the citation-filtering gate kind stays reserved-but-unimplemented and continues to fail loudly if ever enabled, per this bullet's own fallback contract. No code was changed for this batch.
- **Batch 5 — full regression and exception-boundary confirmation.** Re-run the focused Batch 1 exception tests plus end-to-end regression coverage confirming STEP 8b's user-input blocking and STEP 12's fail-closed org-config check still block/fail closed exactly as before and neither routes through the cascade.
  **Executable scope complete (2026-09-05), covering Batches 1–3 (Batch 4 skipped, see above); end-to-end exception acceptance deferred:** `ContentQualityCascadeTests`'s 21 focused Batch 1 cascade tests re-run clean, including 14 eligibility/allowlist cases (the origin+gate-code allowlist rejects `"org-config-safety"` and `"user-input-validation-failure"` under either defined origin, non-FAIL verdicts, non-blocking findings, and an undefined origin — all structurally excluded from the cascade). Full backend regression: `dotnet build` 0/0, `dotnet test` 124/124. Full academy-brain regression: 430 passed/4 skipped/8 failed/17 errors — identical to every prior checkpoint this step, all pre-existing `test_new_course.py` scaffold-missing failures unrelated to this work. **Caveat, stated plainly:** neither STEP 8b's user-input-validation code nor STEP 12's org-config-safety check exist in the codebase yet (both are separate, not-yet-built steps) — there is no real end-to-end code path to run them against today. The above allowlist tests are the closest available proxy: they prove the cascade's own gate-code/origin allowlist structurally rejects exactly the string codes those future steps are specified to use under both currently defined origins. True end-to-end confirmation remains an unsatisfied Batch 5 acceptance check that STEP 8b/STEP 12 must fulfill once their real paths exist; it cannot be manufactured against code that does not exist.

**Constraints:**
- Implement only what Phase A proposed and the user approved (Standing Rule 2) — an adjacent improvement noticed mid-implementation gets named in the handoff, not built without separate approval.
- Approval is recorded per batch. Approval of Phase A's general cascade design, an NBLM option, or another batch never implies approval of conditional Batch 4's citation-filtering algorithm.
- Preserve every existing gate's `@register(...)` name and `GateResult`/`IQualityGate` contract — the cascade orchestrates around gates, it does not change their individual detection algorithms (mirrors STEP 12's same constraint).
- No new message-queue infrastructure (Standing Rule 7) — retry/backoff state lives in the existing Postgres-backed `GenerationJob` table.
- If a batch's real implementation turns out bigger than Phase A's design implied, stop and confirm with the user before proceeding on that batch rather than quietly expanding it.

**Phase B scope lock — do NOT:**
- Do not implement any batch, or any part of a batch, the user did not approve.
- Do not fold STEP 8b's or STEP 12's excepted flows into the cascade, even incidentally while wiring adjacent code.
- Do not batch unrelated fixes into this step because "it's already touching that file" (Standing Rule 5).

**Phase B output:** `docs/tickets/handoffs/step11-pipeline-cascade-implementation.md` — which batches were approved and built, what was implemented per batch against Phase A's design, gate-by-gate before/after `GateResults` samples showing the cascade firing (not just passing/failing), regression confirmation for the two excepted flows, and test/verification results per batch.

**Phase B exit criteria:** every approved batch is implemented and tested; `dotnet build`/`dotnet test` green; a simulated content-quality gate violation (e.g. a retired brand-palette color) demonstrably routes through the cascade (auto-correct or bounded retry) instead of an immediate hard block; a simulated STEP 8b-style missing required field still blocks with a plain-language fix, unchanged; a simulated STEP 12 missing/ambiguous org-config still fails closed, unchanged; nothing unapproved was built.

---

## STEP 12 — backend-dev + coder: multi-institute gate parameterization (brand/language config)

**Owner:** backend-dev (payload/config plumbing), coder (Python gate changes)
**Starts when:** STEP 5's config/subprocess contract exists (`--root`/`CoursePaths.for_root`, the job-contract schema, `AcademyBrainSubprocessExecutor`) — not gated on STEP 5's own full exit criteria (real Techno Square end-to-end run), which remains separately open per its handoff.

**Task:** STEP 5 de-hardcoded *where* a course's files live (`--root`); this step de-hardcodes the *institute-specific rule values* still baked into individual gate modules as Python constants. This is not hypothetical — real evidence of multiple institutes already in the pipeline:
- `vaults/Inst-Analysis/02_Areas/horus-university-egypt/Brand_Identity_Contract.md` — a real second organization (Horus University — Egypt, Faculty of Pharmacy) already has its own approved/retired brand palette recorded via Studio's own vault sync, distinct from Techno Square's.
- Sibling course vaults already running outside Techno Square: `D:\vault\ev3-academy`, `D:\vault\microbit-academy`, `D:\vault\lipincott pharma` (a pharmacy course — not even the same subject area), `D:\vault\code-square`, `D:\vault\LV1 reg FOPPU`. These prove multiple real institutional/course contexts exist — they are NOT confirmed to be academy-brain-compatible course roots, and this step must not assume it can run academy-brain against any of them.
- `Organization.cs` (`backend/src/CourseDeveloper.Core/Models/Organization.cs`) already has the fields this data belongs in — `BrandPalette.Approved/Retired`, `LanguagePolicy.PrimaryScript/TargetRatio/Tolerance/SecondaryScript`, `BoundaryTerms.ForbiddenStrings`. These fields are already read/written by `NpgsqlOrganizationRepository` and consumed by Studio's own C# gates — they are unused only by *academy-brain*, not unused generally.

Concretely, replace these two module-level constants with values read from per-job config (the same `--root`-adjacent mechanism, e.g. a small JSON config file the C# adapter writes per job and a gate-loader reads, or a `--org-config <path>` CLI arg mirroring `--root`):
- `academy-brain/scripts/swarm/gates/brand_palette.py:9-10` — `APPROVED = frozenset({"#231F20", "#FFED10", "#585858", "#FFFFFF"})` / `RETIRED = frozenset({"#F5B301", "#1A1A1A"})` — Techno Square's literal hex codes, hardcoded. **Note the gate's actual algorithm only rejects colors intersecting `RETIRED` (`brand_palette.py:18,22`) — `APPROVED` is never enforced as an allowlist.** Preserve that retired-only semantics per Constraints below; do not silently turn it into an allowlist check.
- `academy-brain/scripts/swarm/gates/arabic_ratio.py:7-8` — `TARGET_ARABIC = 0.70` / `TOLERANCE = 0.10` — not every institute wants an Arabic/English mix at all (e.g. an English-only pharmacy course). Externalize both `TargetRatio` AND `Tolerance` (both are currently hardcoded; don't parameterize only one). Note `arabic_ratio.py:13,18` also hardcodes which Unicode ranges count as "Arabic" vs "Latin" — passing `PrimaryScript`/`SecondaryScript` selects between two fixed classifiers, it does not generalize to arbitrary scripts. If a future institute needs a third script, that's a separate, explicitly-authorized algorithm change, not silently in scope here.

**Assess, don't blindly move:** `boundary_check.py`'s `TRAINER_MARKERS`/`TRAINER_PATTERNS` (trainer-vs-student content leakage detection, grounded in the student-facing-content rule at `boundary_check.py:1`) is academy-wide output hygiene, not an institute-specific brand rule. Resolution: **keep `TRAINER_MARKERS`/`TRAINER_PATTERNS` as a mandatory baseline that always runs; treat `Organization.BoundaryTerms.ForbiddenStrings` as additive institute-specific terms unioned on top of that baseline — never as a replacement.** An institute must not be able to silently erase the baseline leakage check by supplying an empty or partial override list. (This also fixes an existing bug: today an empty org `ForbiddenStrings` list makes `BoundaryCheckGate.cs` report UNVERIFIED instead of running the baseline check — `backend/src/CourseDeveloper.Infrastructure/QualityGates/BoundaryCheckGate.cs:20`.)

**Mandatory reading:**
- `academy-brain/scripts/swarm/gates/brand_palette.py`, `arabic_ratio.py`, `boundary_check.py` — the three candidate gates
- `backend/src/CourseDeveloper.Core/Models/Organization.cs` — the config shape already defined; already consumed by Studio's own C# gates, but not by academy-brain
- `backend/src/CourseDeveloper.Infrastructure/QualityGates/BoundaryCheckGate.cs` — the existing empty-list-means-UNVERIFIED behavior this step must not carry into the additive-union design
- `vaults/Inst-Analysis/02_Areas/horus-university-egypt/Brand_Identity_Contract.md` and `.../institution-core/Brand_Identity_Contract.md` — real second/generic-institute config already produced by Studio's own vault sync, as a concrete non-Techno-Square example to design against
- STEP 5's handoff (`docs/tickets/handoffs/step5-academy-brain-adapter.md`) — the `--root` externalization pattern this step extends
- `academy-brain/scripts/swarm/generate_session.py`'s `BRAND`/`BRANDING_RULE`/`TATA_GUIDE` section — the asset-*path* half of branding STEP 5 already made root-relative; this step is the *rule-value* half STEP 5 explicitly deferred
- `backend/src/CourseDeveloper.Core/Models/GenerationJob.cs` — confirm it currently carries no `Organization`/`OrganizationId` reference; this step must name the resolver that turns a job's project into an organization config snapshot (see Constraints)

**Constraints:**
- Keep every gate's `@register(...)` name and `GateResult` contract unchanged — only the hardcoded constants become parameters, not the check logic or algorithm. Specifically: `brand_palette.py` stays retired-only rejection (no allowlist enforcement) unless a separate, explicitly-authorized step adds an enforcement-policy field to `Organization.BrandPalette`.
- Techno Square's current values are the default/fallback **only for a standalone/manual/legacy invocation path with no job-supplied org config** (e.g. running `generate_session.py` directly, or `academy-brain`'s own test suite). For a real Studio production `GenerationJob`, enqueue/pre-execution validation may populate a missing serialized config snapshot only by following the job's single, unambiguous, authoritative `GenerationJob → CourseProject.OrganizationId → Organization` relationship and recording that recovery before execution begins. Once execution has begun, a missing snapshot must not be reconstructed from a live, possibly changed `Organization` row. If tenant identity/config is missing, ambiguous, or inconsistent at the applicable boundary, the job must **fail closed** and must not silently fall back to Techno Square — a multi-tenant job must never be silently graded against another institute's brand/language rules. **This is the Standing Rule 10a(ii) exception, by design:** it is a data-isolation safety guard, not a content-quality gate; safe pre-execution population happens before the guard, while an unresolved identity/config failure produces a hard, plain-language, retryable fail-closed error and never enters 10a's content-quality retry cascade.
- Config values must reach the gate through the same per-job mechanism STEP 5 established (subprocess argument/file), not a new network call or shared mutable global. Name the upstream resolver: `GenerationJob` → `CourseProject.OrganizationId` → `Organization` → serialized org-config snapshot written into the job payload at enqueue time (immutable per job — re-reading a live, possibly-since-edited `Organization` row on retry would break reproducibility).
- Define the org-config file/payload's own schema and version (mirroring `contracts/generation-job/*.schema.json`), independent of the job-request contract version.
- **Folded in from STEP 11 Batch 3's follow-up review (2026-09-05, per user decision):** the same enqueue-time immutable snapshot must also cover the NBLM-prompt-preflight fields `NblmPromptFields` resolves (`CourseSession.DurationMinutes`, `CourseProject.TargetAgeBand`, `Organization.Name`, `Organization.MascotConfig.CharacterName`) — today `NblmPromptPreflightRepair.cs` reads these live from their repositories at correction time instead of from a job snapshot, so a queued/retried job can render different prompt instructions after a mid-flight config change. Extend the snapshot schema to include them and update `NblmPromptPreflightRepair.TryCorrectAsync` (and the reevaluator that checks for the expected rendered text) to read from the snapshot instead of `ISessionRepository`/`IProjectRepository`/`IOrganizationRepository`.

**Scope lock — do NOT:**
- Do not rewrite any gate's detection algorithm — only its constant sourcing. This explicitly includes: do not turn `brand_palette.py`'s retired-only check into an approved-colors allowlist.
- Do not touch vault-root or session-id handling — STEP 5 already solved that; this step is rule-values only.
- Do not redesign `Organization.cs`'s shape — its `BrandPalette`/`LanguagePolicy`/`BoundaryTerms` fields already fit for the retired-only/additive-union design above; use them as-is. (If a later requirement needs allowlist enforcement or a third script, that's a separately-authorized model change, not this step.)
- Do not implement NBLM prompt-authoring (STEP 11) or vault-sync consolidation (STEP 10) in this step — unrelated scope.

**Output:** `docs/tickets/handoffs/step12-multi-institute-gates.md` — the config-passing mechanism, the job→organization resolver, before/after for each gate touched, the `boundary_check.py` additive-union design and its reasoning, and a worked example using Horus University's real palette values.

**Exit criteria:** `brand_palette.py` and `arabic_ratio.py` (both `TargetRatio` and `Tolerance`) read their values from per-job config, not module constants; Techno Square's existing values still pass unchanged when no override is given (standalone/legacy path only — production path fails closed on missing config); a dry run using Horus University's real retired colors (`#FF0000`, `#990000` per its Brand_Identity_Contract.md) correctly fails, and a dry run using Horus's approved colors correctly passes — proving the parameterization is real and not just plumbed-but-ignored, without requiring Techno Square's palette to fail under Horus's config (it should not, since the gate is retired-only, not an allowlist); a C# adapter test proves the exact organization snapshot reaches the per-job config file/payload unchanged.

---

## GOAL

**Near-term (STEPs 1–9, as scoped now):** CourseDeveloperStudio's frontend talks only to its own authenticated .NET backend (no silent demo fallback), behind its own real login page; its gate runner is a generic, DI-registered plugin system covering all 6 gate kinds; academy-brain lives inside the Studio monorepo as an internally-owned Python engine (DEC-004) behind a durable job queue and its own worker process, with credentials and artifacts under proper custody; the digestion-pipeline gap Dr. Mahmoud raised (text extraction without real content understanding) has a reviewed comparison against academy-brain's pipeline and the user-approved capabilities from it are implemented — and the entire customer-facing product is one linear, zero-configuration button sequence for every institute type (DEC-005).

**Deferred (STEP 8b, unscheduled):** Dr Mahmoud MVP's lesson-authoring flow lives inside Studio's frontend under one shared auth boundary, linked to Studio's core entities by real foreign keys, with one canonical, ownership-mapped database schema underneath all of it, plus a transformation receipt and plain-language blocking messages on that flow (DEC-005). This remains the long-term goal — DEC-003's literal-merge decision is not reversed — it is just not being executed until the user explicitly authorizes STEP 8b.

---

## Blocker Register

| # | Step | Raised by | Date | The blocker | Resolution |
|---|---|---|---|---|---|
| 1 | STEP 1 | assistant | 2026-09-04 | A full solution `dotnet build` can't go green until STEP 3 lands — `GateRunnerService.cs` writes `QualityReceipt` properties that don't exist on the model (the exact defect STEP 3 is scoped to fix), and it lives in the same `CourseDeveloper.Infrastructure` project STEP 1's own code builds against. STEP 1's own changes introduce zero new errors; confirmed by isolating this exact error set against STEP 3's own citation. | **Resolved.** STEP 3 committed (`84b6ac7`); the model gained the missing `QualityReceipt` properties and the solution builds green. |
| 2 | STEP 2 | system-architect | 2026-09-04 | Checked configurations target separate Supabase projects (`jbjfafyjqdjmzmdggzha` vs. Studio's checked-in default `gjxhfyfonjdcaimxjipp`); STEP 8b must first confirm the deployed refs. If they differ as configured, the `WorksheetProject.sessionId → course_sessions.id` FK is physically impossible until both schemas live in one database. | **Resolved 2026-09-04 (DEC-006), execution repointed 2026-09-05 (DEC-008):** user approved Studio's project (`gjxhfyfonjdcaimxjipp`) as canonical. This now executes under **STEP 8b** (deferred, unscheduled — still open, see Step Ledger), not the STEP 8 that now means "Studio login page." STEP 8b must confirm the deployed refs match these checked-in defaults, then sequence consolidation/data transfer → approved `sessionId` reconciliation and zero-orphan validation → FK. |
| 3 | STEP 2 | system-architect | 2026-09-04 | `.NET` backend uses one shared data source and opens repository connections without propagating the validated JWT identity; the deployed connection role is not visible in source. RLS ownership policies therefore either can be bypassed by a privileged/`BYPASSRLS` role or cannot resolve `auth.uid()` under a non-bypass role. | **Resolved.** Folded into STEP 4's commit (`ac56469`: "GenerationJob durable queue + CourseDeveloper.Worker, fold in STEP 2 RLS/auth-context fix") per the design in `docs/tickets/handoffs/step2-schema-ownership.md`. |

## Step Ledger

*Reconciled against `git log` on 2026-09-05 — the previous table had drifted from what was actually committed.*

| Step | Owner | Status | Handoff artifact | Date |
|---|---|---|---|---|
| 1 | backend-dev | Committed (`339dbc6`) | `docs/tickets/handoffs/step1-backend-auth-di.md` | 2026-09-04 |
| 2 | system-architect | Committed (`6423d5a`) | `docs/tickets/handoffs/step2-schema-ownership.md` | 2026-09-04 |
| 3 | backend-dev | Committed (`84b6ac7`) | `docs/tickets/handoffs/step3-gate-registry.md` | 2026-09-04 |
| 4 | backend-dev | Committed (`ac56469`) | `docs/tickets/handoffs/step4-generation-job-worker.md` | 2026-09-04 |
| 5 | backend-dev + coder | Code committed (`62f5041`); live end-to-end run still blocked (content + NotebookLM venv unavailable) — unverified, not something a later commit has resolved | `docs/tickets/handoffs/step5-academy-brain-adapter.md` | 2026-09-04 |
| 6 | devops-automator | Committed (`c63385f`) | `docs/tickets/handoffs/step6-worker-runtime.md` | 2026-09-04 |
| 7 | frontend-developer | Committed (`74bf2d0`) | `docs/tickets/handoffs/step7-frontend-backend-wiring.md` | 2026-09-05 |
| 8 | frontend-developer | Not started — reassigned 2026-09-05 (DEC-008) to Studio's own login page; gated on user confirming the STEP 1–7 product runs end-to-end | | — |
| 8b | frontend-developer + backend-dev | Deferred, not scheduled (DEC-008) — former STEP 8 (full MVP merge), preserved verbatim, requires a fresh explicit user go-ahead | | — |
| 9 | system-architect (Phase A) / backend-dev + coder (Phase B) | Phase A (diagnose+propose) done — `step9-digestion-diagnosis.md` — and user-approved. Phase B implemented and committed in three dependency-ordered batches: batch 1 R1-R4 (`a1e6721`), batch 2 R5-R8 (`f67f4ae`), batch 3 R9-R10 + §3.11 (`6c0c420`). Complete. | `docs/tickets/handoffs/step9-digestion-diagnosis.md` | 2026-09-05 |
| 10 | backend-dev | Committed (`7457390`) — canonical vault writer, path-safety fixes, dossier sync, auth-forwarding proxy, org-logo sync, NLM-download import; Codex round 4 review: ready, no bugs found | `docs/tickets/handoffs/step10-vault-sync.md` | 2026-09-05 |
| 11 | system-architect (Phase A) / backend-dev + coder (Phase B) | Committed (`325af60`) — Batches 1-3 implemented (cascade primitives, STEP 3 gate wiring, pedagogy-coverage + NBLM-prompt-preflight); Batch 4 (citation-filtering) investigated and skipped, no live caller for the existing gate exists; Batch 5 regression clean, STEP 8b/12 end-to-end confirmation deferred (neither has real code yet) | `docs/tickets/handoffs/step11-nblm-prompt-authoring.md` | 2026-09-05 |
| 12 | backend-dev + coder | Committed (`abda4ea`) — org_config.py de-hardcodes brand_palette.py/arabic_ratio.py; boundary_check.py additive baseline; OrganizationConfigSnapshot + fail-closed resolver (extended for STEP 11 Batch 3's NBLM-prompt fields); BoundaryCheckGate.cs UNVERIFIED-on-empty-list bug fixed. Codex review: found and fixed a resolver session/project ownership gap, snapshot/payload collection aliasing, and payload parsing that silently accepted missing required fields. | `docs/tickets/handoffs/step12-multi-institute-gates.md` | 2026-09-06 |

## Related

- [[2026-09-04-academy-brain-mvp-integration-vision]] — the binding rule
- Codex review outputs (evidence source for every decision cited above), copied into `docs/tickets/codex-review-evidence/`:
  - `studio-review.json` — Studio-repo-scoped review (original 9 decisions)
  - `academybrain-review.json` — academy-brain-repo-scoped review (original 9 decisions)
  - `mvp-review.json` — MVP-repo-scoped review (original 9 decisions)
  - `adoption-ux-round1-review.json` — DEC-005 round 1 (proposed and then rejected the guidance-level dial)
  - `adoption-ux-round2-review.json` — DEC-005 round 2, final (zero-configuration design, transformation receipt, blocking-message requirement)
  - `engine-placement-reversal-review.json` — DEC-004 (academy-brain moves into the Studio monorepo, supersedes original decision 1/2 external-pin language)
