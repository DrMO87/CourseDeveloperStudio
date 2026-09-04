---
type: execution-plan
status: approved-pending-execution
last_updated: 2026-09-04
---

> [!warning] Amended after initial approval
> DEC-004 and DEC-005 (STEP 0a) were added after this ticket's first version. DEC-004 **reverses** the original decision 1/2 language about academy-brain staying an externally-pinned, separately-versioned release — read STEP 0a before trusting any older step text that still says "pinned external release" or "no vendored copy." Steps 2, 3, 4, 5, 6, 7, and 8 have all been updated to match; if any wording elsewhere in this file still contradicts DEC-004 or DEC-005, DEC-004/DEC-005 win.

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

---

## STEP 0 — Scope calls

### 0a — Ruled by user *(binding)*

> [!success] Resolved 2026-09-04 — logged as DEC-002, DEC-003.

1. **Ticket scope (DEC-002):** Full integration, all 9 decisions, in one ticket. Dr. Mahmoud delegated the entire integration with no separate team — there is no "his side" to leave out. Every step below is executed by the user (via this session/its agents), including the Studio-side backend fixes that decision 2's ownership language originally described as "Dr. Mahmoud's team's" work.
2. **MVP merge mode (DEC-003):** Literal code merge — MVP's lesson-authoring routes, components, and Prisma layer move into CourseDeveloperStudio's Next.js frontend as a module. Not a separately-deployed app linked by FK alone.
3. **Engine placement (DEC-004) — supersedes decision 1/2's "externally-pinned release" language.** academy-brain's source moves into the CourseDeveloperStudio monorepo as an internally-owned Python component — one repo, one coordinated release, one team, one support boundary. It is **not** rewritten into C#, and it still runs as its own Python subprocess/background worker (generation takes real time and cannot happen inside an HTTP request) — but it is no longer a separately-versioned external product Studio merely calls. The old `D:\vault\academy-brain` repo is archived at cutover, not dual-maintained (Standing Rule 9). User's own words: *"i am not a programer i cant make thie decision. all i want is to build academy brain into the studio app."* Codex verdict: CONCEDE-WITH-CHANGES — concrete monorepo shape and the effect on decisions 2/7/9 are in `docs/tickets/codex-review-evidence/engine-placement-reversal-review.json`.
4. **Customer-facing design principle (DEC-005) — "monkey theory."** Every customer type (academy owner, university professor, school teacher) is designed for as the same technologically-illiterate archetype: press a button, it works, done — whether a "stubborn" resistant professor or a "compliant" academy/school teacher. One linear button chain (4-8 steps, same as MVP's existing `/create` flow), identical for everyone, no settings screen, no guidance-level dial, no onboarding-path choice. This **overrides** an earlier draft of this same decision (round 1) where the assistant and Codex had both proposed an adjustable "guidance level" setting — the user rejected that explicitly: a dial is still a decision the customer has to make, which this customer archetype does not do. Codex round 2 verdict: CONCEDE-WITH-CHANGES — approved the zero-configuration direction, and added two requirements folded into STEP 3/5/7/8 below: (a) a short post-generation "transformation receipt" (what was kept / added / adjusted) since the MVP's existing confirmation step only verifies what was *read*, not what happened after; (b) every blocked "next" button must show one plain-language reason and one concrete fix, not just stay disabled. Evidence: `docs/tickets/codex-review-evidence/adoption-ux-round1-review.json` and `docs/tickets/codex-review-evidence/adoption-ux-round2-review.json`.

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
├── frontend/                         # Next.js app (Studio + merged MVP module, STEP 8)
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

**Task:** Physically move academy-brain's source into this monorepo at `/academy-brain` (per DEC-004's repository shape above) — including `pyproject.toml`, `scripts/swarm/`, `00-contracts/`, and `tests/` — verify the moved copy is the authoritative one (working tree diff against the pre-move `D:\vault\academy-brain` clean), and retire/archive the old `D:\vault\academy-brain` repository per Standing Rule 9. Then define a versioned job-request/result contract between Studio's worker and academy-brain, implement the subprocess adapter in `CourseDeveloper.Worker` that invokes academy-brain's code from the newly-moved `/academy-brain` (no more "pinned external release"), and externalize academy-brain's currently hardcoded execution-boundary values (vault/course root, brand/language/boundary config, NotebookLM credential reference, output location) so the adapter can pass them per-job instead of relying on `generate_session.py`'s process-global `VAULT`/`COURSE`/`BRAND` bindings. Per DEC-005, the job result must also report a **transformation summary** (what was preserved from the source text verbatim, what was added, what was mechanically adjusted) — sourced from academy-brain's real pedagogy-coverage gate output, not a guess — for STEP 8's customer-facing receipt.

**Mandatory reading:**
- `D:\vault\academy-brain\scripts\swarm\generate_session.py` lines ~18, 39–51, 592–874 (pre-move source, at its current path — read before moving) — the CLI entrypoint, the hardcoded globals, and the NotebookLM stored-session client usage (confirmed by Codex to be a stored-credential API client, not live browser automation — correct this in any docs that still say "browser automation")
- `D:\vault\academy-brain\scripts\swarm\paths.py` — `CoursePaths`/`for_root(root)` already exists; `generate_session.py` doesn't use it yet, which is exactly the gap this step closes
- `D:\vault\academy-brain\00-contracts\pedagogy.md` and `scripts\swarm\gates\pedagogy_coverage.py` — the real pedagogy check (Bloom's taxonomy) this step must expose in the job result, replacing the MVP's current Groq-only, regex-based objective/skill detection (`D:\vault\Dr mahmoud MVP\src\server\first-route\governed-input-service.ts` ~line 229, 381)
- `backend/src/CourseDeveloper.Core/Models/Organization.cs` — the source of the brand/language/boundary config this step must thread through
- `docs/tickets/codex-review-evidence/academybrain-review.json` (decisions 1 and 3) and `docs/tickets/codex-review-evidence/engine-placement-reversal-review.json` (DEC-004's effect on this step, including the migration rule) — full evidence

**Constraints:**
- academy-brain stays Python; do not port any of it to C# (not reopenable without a new user ruling).
- Per DEC-004: academy-brain's source lives in this same repo (`/academy-brain`), builds and deploys from the same commit as the rest of Studio — no separate release/version to pin, no copy-and-diverge risk. The job payload keeps `contractVersion` (the job-contract schema version) separate from `studioBuild`/`commitSha` (the Studio build/commit that executed the job) — see STEP 2. Neither field is an academy-brain release number.
- The adapter must invoke academy-brain via `CoursePaths.for_root(root)`, not the legacy module-level globals — this is the concrete de-hardcoding step, not a full institute-agnostic rewrite of every gate module.
- One end-to-end Techno Square course must actually run through this path before the step is called done (decision 3's "thin vertical slice") — but only after the config values above are externalized, not before.
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

**Task:** Package academy-brain's runtime as a reproducible worker image — per DEC-004, this image bundles `CourseDeveloper.Worker` **and** the Python runtime + academy-brain code from the same repo commit, replacing the current machine-specific venv path — provision NotebookLM credentials through a secret store instead of local stored-session files, and define durable artifact storage for generated course outputs off the local filesystem.

**Mandatory reading:**
- `D:\vault\academy-brain\pyproject.toml` (pre-move source — by STEP 6's start, the authoritative copy is at this monorepo's `/academy-brain/pyproject.toml` per STEP 5) — current dependency list (missing `notebooklm`, per Codex finding)
- `D:\vault\academy-brain\scripts\swarm\generate_session.py` lines ~18, 873 (pre-move path; post-move at `/academy-brain/scripts/swarm/generate_session.py`) — the machine-specific interpreter path and stored-session credential load this step replaces
- `docs/tickets/codex-review-evidence/mvp-review.json` and `docs/tickets/codex-review-evidence/academybrain-review.json`, decision 9 — full requirements list (credential rotation, per-org credential policy, encrypted storage, retention)

**Constraints:**
- `notebooklm` must be declared as an explicit dependency, not an implicit import.
- Credential provisioning must support rotation without redeploying the worker image.
- Artifacts must land somewhere Studio-visible (not just the local job workspace) with hashes/locations recorded in Postgres per STEP 4's job schema.

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

## STEP 8 — frontend-developer + backend-dev: Merge MVP lesson-authoring into Studio

**Owner:** frontend-developer (Next.js/Prisma code move), backend-dev (FK + auth unification)
**Starts when:** STEP 2, STEP 6, and STEP 7 handoffs all exist

**Task:** Move MVP's lesson-authoring routes, components, and Prisma layer into CourseDeveloperStudio's Next.js frontend as a module (per DEC-003 — literal code merge, not a separate deployment). Make MVP's Supabase auth pattern (already proven working) the shared identity boundary application-wide. Implement the `WorksheetProject.sessionId` → `course_sessions.id` FK per STEP 2's plan. Per DEC-005, add two small, non-branching additions to MVP's existing linear `/create` flow: (1) a short "transformation receipt" shown with the finished lesson — kept / added / adjusted, sourced from STEP 5's job result, not invented here; (2) when a required-field button won't advance, show one plain-language reason and one concrete fix inline (e.g. "Add the school logo to continue.") instead of leaving it silently disabled.

**Mandatory reading:**
- `D:\vault\Dr mahmoud MVP\src\lib\auth\AuthContext.tsx` and `src\server\auth\session.ts` — the auth pattern becoming platform-wide
- `D:\vault\Dr mahmoud MVP\prisma\schema.prisma` — all 17 models being moved (not 15, per Codex's correction of the original research)
- STEP 2's handoff — the exact FK type/nullability decided there
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

**Output:** `docs/tickets/handoffs/step8-mvp-merge.md` — file move manifest, auth unification summary, FK migration, transformation-receipt implementation, before/after for one lesson-authoring flow exercised end-to-end inside the merged app

**Exit criteria:** MVP's lesson-authoring flow runs inside CourseDeveloperStudio's frontend under one auth session, unchanged in step order; a `WorksheetProject` created in that flow carries a valid FK to a real `course_sessions` row; the finished lesson shows a transformation receipt; a blocked required-field button shows a plain-language reason and fix; no separate MVP deployment is required for this flow to work.

---

## GOAL

CourseDeveloperStudio's frontend talks only to its own authenticated .NET backend (no silent demo fallback); its gate runner is a generic, DI-registered plugin system covering all 6 gate kinds; academy-brain lives inside the Studio monorepo as an internally-owned Python engine (DEC-004) behind a durable job queue and its own worker process, with credentials and artifacts under proper custody; Dr Mahmoud MVP's lesson-authoring flow lives inside Studio's frontend under one shared auth boundary, linked to Studio's core entities by real foreign keys, with one canonical, ownership-mapped database schema underneath all of it — and the entire customer-facing product is one linear, zero-configuration button sequence for every institute type, with a transformation receipt and plain-language blocking messages as the only additions to that sequence (DEC-005).

---

## Blocker Register

| # | Step | Raised by | Date | The blocker | Resolution |
|---|---|---|---|---|---|
| 1 | STEP 1 | assistant | 2026-09-04 | A full solution `dotnet build` can't go green until STEP 3 lands — `GateRunnerService.cs` writes `QualityReceipt` properties that don't exist on the model (the exact defect STEP 3 is scoped to fix), and it lives in the same `CourseDeveloper.Infrastructure` project STEP 1's own code builds against. STEP 1's own changes introduce zero new errors; confirmed by isolating this exact error set against STEP 3's own citation. | Not blocking — informational. STEP 1 is otherwise complete; STEP 3 (already fully scoped, independent, allowed to run parallel per STEP 3's own "Starts when") resolves this when it lands. See `docs/tickets/handoffs/step1-backend-auth-di.md` for the full build trace. |

## Step Ledger

| Step | Owner | Status | Handoff artifact | Date |
|---|---|---|---|---|
| 1 | backend-dev | Complete, pending user approval to commit | `docs/tickets/handoffs/step1-backend-auth-di.md` | 2026-09-04 |
| 2 | system-architect | Not started | | — |
| 3 | backend-dev | Not started | | — |
| 4 | backend-dev | Not started | | — |
| 5 | backend-dev + coder | Not started | | — |
| 6 | devops-automator | Not started | | — |
| 7 | frontend-developer | Not started | | — |
| 8 | frontend-developer + backend-dev | Not started | | — |

## Related

- [[2026-09-04-academy-brain-mvp-integration-vision]] — the binding rule
- Codex review outputs (evidence source for every decision cited above), copied into `docs/tickets/codex-review-evidence/`:
  - `studio-review.json` — Studio-repo-scoped review (original 9 decisions)
  - `academybrain-review.json` — academy-brain-repo-scoped review (original 9 decisions)
  - `mvp-review.json` — MVP-repo-scoped review (original 9 decisions)
  - `adoption-ux-round1-review.json` — DEC-005 round 1 (proposed and then rejected the guidance-level dial)
  - `adoption-ux-round2-review.json` — DEC-005 round 2, final (zero-configuration design, transformation receipt, blocking-message requirement)
  - `engine-placement-reversal-review.json` — DEC-004 (academy-brain moves into the Studio monorepo, supersedes original decision 1/2 external-pin language)
