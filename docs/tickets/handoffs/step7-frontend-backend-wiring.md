# STEP 7 handoff — frontend wired to Studio's own .NET backend

## What changed

`frontend/src/lib/supabase.ts` no longer talks to Supabase's Postgres tables directly for
organizations, projects, sessions, or gates, and no longer falls back to localStorage or
hardcoded demo data when a call fails. All four domains now call Studio's own .NET API
(`backend/src/CourseDeveloper.Api`) through a new thin client, `frontend/src/lib/apiClient.ts`,
which throws a plain-language `Error` on any failure (network unreachable, 401/403, or any
non-2xx response) instead of returning a value a caller could mistake for real data.

`supabase` (the Supabase JS client) is kept only for two things: reading the signed-in user's
session token (`apiClient.ts` attaches it as `Authorization: Bearer <token>`), and
`DEFAULT_INSTITUTION_TEMPLATES`, which is a real, visible "start from a template" gallery in
`organizations/page.tsx` — not a read-time fallback.

### Before/after per fallback path Codex originally cited

| Function | Before | After |
|---|---|---|
| `fetchOrganizations`/`fetchOrganizationById` | Supabase read, then localStorage, then `DEFAULT_INSTITUTION_TEMPLATES` | `GET /api/Organizations[/{id}]` — throws on failure |
| `createOrganization`/`updateOrganization`/`deleteOrganization` | Wrote to localStorage first, Supabase write attempted in background and ignored on failure | `POST`/`PUT`/`DELETE /api/Organizations` — throws on failure, no local write |
| `fetchGateDefinitions`/`upsertGateDefinition` | Supabase read/write, then localStorage, then 4 hardcoded default gate rows | `GET`/`POST /api/Organizations/{id}/gate-definitions` |
| `toggleGateDefinition` | **No-op stub** — `return true` and nothing else; the UI's toggle never persisted anywhere, not even localStorage | `PATCH /api/Organizations/{orgId}/gate-definitions/{gateCode}/toggle?isEnabled=` (new signature: needs `organizationId` + `gateCode`, not just the definition's own id — the settings page resolves both from state it already has) |
| `fetchProjects`/`fetchProjectById` | Supabase read, then localStorage, then 2 hardcoded demo courses | `GET /api/Projects[?organizationId=][/{id}]` |
| `createProject`/`updateProject`/`deleteProject` | localStorage write, Supabase attempted and ignored on failure | `POST`/`PUT`/`DELETE /api/Projects` |
| `fetchSessions` | Supabase read, then localStorage, then 11 (or 2) hardcoded demo lecture rows | `GET /api/Projects/{id}/sessions` |
| `createSession`/`updateSession`/`updateSessionStage`/`updateSessionCompletedStages`/`deleteSession` | localStorage write, Supabase attempted and ignored on failure | `POST /api/Projects/{id}/sessions`, `PUT`/`DELETE /api/Sessions/{id}` (new controller, see below) |
| `fetchQualityReceipts` | Supabase read, then localStorage | `GET /api/QualityGates/session/{sessionId}` (new endpoint — the persisted receipts were never exposed before) |
| `upsertQualityReceipt` (the "gate result fabrication ~1167" the ticket named) | Accepted a caller-supplied receipt — usually a hardcoded all-PASS one — and wrote it straight to storage as if a gate had actually run | **Removed.** Replaced by `runQualityGates(...)`, which calls the real `POST /api/QualityGates/evaluate` (STEP 3's registry) against the session's actual markdown content. There is no "manually record a receipt" endpoint on the real API and there shouldn't be one. |

`extractLecturesFromCourseSpecs`/`syncSessionsFromDossier` (the dossier-driven lecture
extraction feature) keep their exact topic-parsing logic unchanged, but now call the real
`createSession` for each extracted lecture instead of only `setLocal` — since `fetchSessions`
no longer reads that cache, extracted sessions would otherwise have vanished on the next
page load.

### New backend surface (added because the frontend genuinely needed it, not scope creep for its own sake)

- **`SessionsController`** (new): `GET/PUT/DELETE /api/Sessions/{id}`. `ISessionRepository`
  already had `GetByIdAsync`/`UpdateAsync`/`DeleteAsync` fully implemented
  (`NpgsqlSessionRepository`) — nothing in `CourseDeveloper.Api` exposed them. Creation stays
  on the existing `POST /api/Projects/{id}/sessions`.
- **`IQualityReceiptRepository`** (new interface) + `NpgsqlQualityReceiptRepository` now
  implements it and is DI-registered. It already had a complete, correct `CreateAsync`/
  `GetBySessionAsync` implementation — it was simply never wired to anything.
  `GateRunnerService.EvaluateAsync` now calls `_receiptRepo.CreateAsync(receipt)` before
  returning, so a gate run's receipt survives past the HTTP response. `QualityGatesController`
  gained `GET /api/QualityGates/session/{sessionId}` to read them back.
- **`course_projects` gained 5 columns**: `course_code`, `credit_hours`, `prerequisites`,
  `academic_term`, `total_sessions` (`database/schema.sql`, `CourseProject.cs`,
  `NpgsqlProjectRepository`). The frontend's Create/Edit Course forms already collected all
  five; the backend model had none of them, so real `createProject`/`updateProject` calls
  would have silently dropped them. `course_projects` is Studio-owned hand-written SQL per
  STEP 2's ownership map, so this is in-scope here, not a STEP 2/8 encroachment.
- **`InstitutionType` enum renamed** from PascalCase (`University`, `TrainingCenter`, ...) to
  lowercase/snake_case (`university`, `training_center`, ...) to match Postgres's own
  `institution_type` enum type (`schema.sql:11`, always lowercase) and the frontend's
  `InstitutionType` union type. This was a **real, pre-existing, latent bug**: writing
  `InstitutionType.Academy.ToString()` ("Academy") into a Postgres enum column that only
  accepts `'academy'` would have failed at the database level — it just never ran against a
  live database before now. `Enum.Parse<InstitutionType>(..., ignoreCase: true)` on the read
  side made this safe to rename without touching any other call site.
- **Global JSON options** (`Program.cs`): `PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower`
  (so the API's JSON matches the frontend's existing snake_case field names — `organizationId`
  would otherwise have gone out as `organizationId`, not `organization_id`) plus a plain
  `JsonStringEnumConverter()` (so `PipelineStage`/`GateVerdict`/`ApprovalKind`/`InstitutionType`
  serialize as their literal member names — `"BRAND_SETUP"`, `"academy"` — instead of raw
  integers). Every affected enum's members were checked to already match, post-rename,
  exactly what the frontend and Postgres expect; no per-enum naming policy was needed. This
  only touches `CourseDeveloper.Api`'s MVC pipeline — `CourseDeveloper.Worker` and the
  `Npgsql*Repository` classes' internal jsonb serialization each have their own independent
  `JsonSerializerOptions` and are unaffected.

### Removed fabrication at call sites (not just inside `supabase.ts`)

- `frontend/src/app/page.tsx`'s `applySessionState`: used to fabricate a hardcoded all-PASS
  `QualityReceipt` whenever a session had 4+ completed stages but no real receipt on file.
  Now: no receipts on file means `setReceipt(null)` — an honest "gates haven't run for this
  session" state.
- `frontend/src/app/page.tsx`'s `handleRunStage`: used to call `upsertQualityReceipt` with a
  hardcoded all-PASS receipt whenever the simulated pipeline reached `BUNDLE`/`ARTIFACTS`.
  Now: calls `runQualityGates(...)` with the session's real markdown fields
  (`blueprint_markdown`, `slides_source_markdown`, `home_summary_markdown`,
  `decisions_markdown`) as `learnerText`, then refetches the real persisted receipt.
- `frontend/src/app/organizations/page.tsx`'s `loadData`: used to silently substitute
  `DEFAULT_INSTITUTION_TEMPLATES` on any fetch failure. Now surfaces an inline error banner
  with a Retry button.

### Error surfacing (Standing Rule 8 / "no settings UI, plain-language errors inline")

`page.tsx`, `organizations/page.tsx`, `projects/page.tsx`, and `graph/page.tsx` each gained a
`loadError` state and an inline rose-colored banner (with a Retry button where the reload
function is idempotent) shown when the initial data load fails — no diagnostics panel, no
connection-mode toggle, just the plain-language message `apiClient.ts` throws. Mutating
actions (create/update/delete session or project, toggle a gate, save language policy) that
previously had no error handling at all now catch and surface the same message via the
existing toast/alert mechanisms already present in each file.

## What's explicitly still using Supabase directly (intentionally out of scope)

- **Authentication** — the Supabase JS client's `auth.getSession()` is exactly the "wherever
  STEP 1's auth design calls for it" carve-out in the ticket's Task description.
- **Dossier files, agent swarm logs** (`fetchDossierFiles`/`createDossierFile`/`updateDossierFile`/
  `deleteDossierFile`/`autoCategorizeDossier`/`fetchAgentLogs`/`insertAgentLog`) — not named in
  the ticket's Task ("organizations, projects, sessions, and gates"); left untouched to avoid
  scope creep, though they have the identical Supabase/localStorage-fallback shape and are a
  natural STEP 7-shaped follow-up if the team wants full coverage.
- **`ObsidianParaBrowser.tsx`** — untouched per the explicit constraint; it already calls the
  .NET `ObsidianSync` endpoint correctly and is the working pattern this step followed. It
  also has its own local-route → backend → mock-files fallback chain, structurally identical
  to what this step removed elsewhere — left alone because the ticket names it as the
  reference implementation, not a target.

## A real gap this step surfaced but cannot fix here: there is no login UI yet

Studio's Next.js frontend has **no authentication flow anywhere** — no login page, no
`supabase.auth.signIn`/`onAuthStateChange` call exists in the codebase today. STEP 1 made
every single backend endpoint require a valid JWT (`RequireAuthenticatedUser()` global
fallback policy, no anonymous routes). `apiClient.ts` attaches a bearer token *if* a Supabase
session already exists, but nothing in Studio's own frontend currently creates one.

This means: **today, every real API call from Studio's frontend will get a 401** unless a
session was established some other way (e.g. manually in the browser console, or once STEP 8
merges MVP's proven Supabase-auth UI into this same frontend). That 401 is honest, visible
behavior — exactly what "no silent fallback" demands — but it also means this step's wiring
isn't end-to-end usable by an actual user until STEP 8 lands. Building a login page here would
have meant starting the MVP merge, which this step's scope lock explicitly forbids
("Do not begin the MVP merge in this step (that's STEP 8)"). Flagging this rather than
silently building around it.

## Gates run

- `dotnet build` (backend) — 0 warnings, 0 errors.
- `dotnet test` (backend) — 25/25 passed (unchanged count from STEP 6; `GateRunnerServiceTests`
  updated for the new constructor parameter, no new tests added for the new controllers —
  see "What's NOT done" below).
- `npx tsc --noEmit` (frontend) — clean, no type errors.
- `npm run build` (frontend, Next.js production build) — succeeded, all 11 routes compiled and
  prerendered. Pre-existing `officeparser`/`pdf-parse` "Critical dependency" webpack warnings
  are unrelated dynamic-require noise from an unrelated route (`/api/extract`), not caused by
  this step.

## What's NOT done / not verified here

- **No new backend tests for `SessionsController`, the `IQualityReceiptRepository` wiring, or
  the `courseBundleStorage`-adjacent JSON options change.** The existing 25 kept passing, but
  nothing new was added to assert the new endpoints' behavior at the HTTP layer (no test host
  was stood up for any controller in this repo yet — STEP 3's handoff notes the same gap for
  its own controller-level mapping).
- **Not tested against a live Supabase/Postgres database.** Same caveat as every prior step —
  no live connection in this sandbox. The `course_projects` column additions and the
  `InstitutionType` enum rename are both schema-shape changes that should be sanity-checked
  against a real database before deploy.
- **No login UI** — see the section above. This is the actual blocker to using any of this
  end-to-end today, not a code defect in this step.
- **The frontend was never run in a browser against a live backend** — `npm run build`
  confirms it compiles and type-checks, not that a real request/response round-trip works.
  Recommend a manual smoke test (create an org, a project, a session, toggle a gate, run a
  stage) against a real deployed backend once STEP 8's auth lands.
- **Dossier files and agent logs still have the old fallback shape** — see "explicitly still
  using Supabase directly" above.
