---
status: pending
---

# STEP 2 handoff — canonical schema and migration ownership

## Table ownership map

One rule: origin repo keeps owning its own tables' migrations. Two migration authorities total in the merged system, never both on one table.

### Studio-owned (hand-written `database/schema.sql`, run by whoever applies Supabase migrations today)

| Table | Notes |
|---|---|
| `organizations` | |
| `course_projects` | |
| `project_dossier_files` | |
| `course_sessions` | FK target for `WorksheetProject.sessionId` — see FK plan below |
| `agent_swarm_logs` | |
| `quality_receipts` | |
| `session_assets` | |
| `obsidian_sync_records` | |
| `quality_gate_definitions` | |
| `quality_gate_results` | |
| `generation_job` *(new)* | STEP 4 designs the table; this step only reserves its hand-SQL ownership lane |
| `generation_job_event` *(new)* | STEP 4 designs the table; this step only reserves its hand-SQL ownership lane |

### MVP-owned (Prisma migrations, `prisma/schema.prisma` + `prisma migrate`)

| Table (Prisma model) | Notes |
|---|---|
| `TeacherProfile` | |
| `Subscription` | |
| `WorksheetProject` | `sessionId` gets the new FK — see below |
| `SourceDocument` | |
| `PlaceholderSet` | |
| `SourcePackAttempt` | |
| `SourcePackRequirement` | |
| `GuideDocument` | |
| `GuideRule` | |
| `GuideConflict` | |
| `TeacherImage` | |
| `SourcePackApproval` | |
| `SourcePackConfirmation` | |
| `SourcePackChecklistEvaluation` | |
| `SourcePackChecklistItem` | |
| `AuditEvent` | |
| `TraceEvent` | |

All 27 current schema objects (17 MVP models and 10 existing Studio tables) appear exactly once, with no overlap. STEP 4's two planned `GenerationJob*` tables additionally have reserved Studio hand-SQL ownership lanes; their design remains STEP 4's work.

**Why split by origin instead of picking one tool for everything:** MVP's 17 models have working Prisma-generated client code and business logic against them today (STEP 8 moves that code as-is, per DEC-003's "literal code merge, not a rewrite"). Forcing them onto hand-written SQL would mean hand-writing 17 migrations for zero behavioral gain and real risk of drift from the Prisma client the frontend code still calls. Studio's tables have no ORM in front of them — `.NET` queries them with raw SQL via Npgsql — so there's no Prisma client to preserve there either. Splitting by origin is the zero-rewrite option; a single unified tool would require rewriting one side's data layer, which no decision calls for.

## Critical precondition found during this step: checked MVP and Studio configurations target different Supabase projects

Checked the available configuration references directly:
- Studio's checked-in backend/frontend defaults point at Supabase project `gjxhfyfonjdcaimxjipp` (confirmed in `backend/src/CourseDeveloper.Api/Program.cs`, `backend/src/CourseDeveloper.Api/appsettings.json`, and `frontend/src/lib/supabase.ts`). No Studio `.env` file is present in the repository, so STEP 8 must confirm that the deployed environment has not overridden these defaults.
- MVP's `.env` points at a **different** Supabase project: `jbjfafyjqdjmzmdggzha`.

A foreign key is a same-database constraint — Postgres cannot enforce `WorksheetProject.sessionId → course_sessions.id` across two separate Supabase projects. STEP 8's task text says "Implement the FK per STEP 2's plan" as if this were just a schema edit; it is not — **the databases must be consolidated first.**

**Open blocker — canonical project requires user approval:** decision 6 and the ticket's GOAL require one database, but neither source chooses which existing Supabase project survives. Selecting Studio's project, selecting MVP's project, or approving another consolidation destination has materially different migration and operational consequences, so STEP 2 must not guess. Before STEP 8 migrates data or applies the FK, the user must approve the canonical project and the associated cutover/retirement direction.

Consolidation may require a real data migration (existing teachers, worksheets, approvals) with an actual cutover, not merely a config change; the exact work depends on the user-approved destination and the live data present in each project. It belongs in STEP 8's sequencing, which currently doesn't name it. **Logging it to the Blocker Register below rather than silently expanding STEP 8's scope here** — table ownership and the FK plan are this step's job; approving the destination is the user's decision, and executing the resulting consolidation is STEP 8 work.

## FK plan: `WorksheetProject.sessionId` → `course_sessions.id`

- **Type:** `uuid` on both sides already — no type change needed (`WorksheetProject.sessionId` is `String @db.Uuid` in Prisma; `course_sessions.id` is `uuid`).
- **Nullability:** stays **NOT NULL**. It's already required in the current Prisma model (no `?`), and decision 6 requires every `WorksheetProject` to link to a real session going forward — relaxing it to nullable would let new rows re-create the "opaque unconnected UUID" problem this FK exists to close.
- **Constraint:** `ALTER TABLE "WorksheetProject" ADD CONSTRAINT worksheet_project_session_fkey FOREIGN KEY ("sessionId") REFERENCES course_sessions(id) ON DELETE RESTRICT;`
  - `RESTRICT`, not `CASCADE`: a `course_sessions` row must not be deletable out from under a teacher's in-progress or finished lesson-authoring work. Silent cascading deletion of `WorksheetProject` data (and everything hanging off it — source docs, placeholders, guide rules, approvals) on a session delete is a data-loss path the standing "no silent fallback / no silent data loss" rule rules out. If a session genuinely needs deleting, its `WorksheetProject` must be handled (reassigned or explicitly deleted) first — an explicit action, not a side effect.
- **Backfill requirement:** `WorksheetProject.sessionId` is currently an opaque UUID with no declared relationship to `course_sessions`; source inspection alone does not prove that every live value is invalid. Before adding the `NOT NULL` FK, STEP 8 must export every existing worksheet row (`id`, `userId`, current `sessionId`, and identifying lesson metadata) and every candidate Studio session with its owning project/user, then produce an explicit old-value-to-target-session reconciliation manifest. Known matches may be updated from that manifest; ambiguous or unmatched rows must block the constraint and be presented for user approval rather than guessed. If an approved mapping requires a new `course_projects`/`course_sessions` row, STEP 8 must obtain all required Studio fields (`project_id`, `session_code`, `level`, and `session_number`) from approved source data before creating it. After updates, STEP 8 must verify that an orphan-count query returns zero and that every `WorksheetProject.sessionId` resolves to exactly one `course_sessions.id`; only then may the `NOT NULL` FK be added with `ON DELETE RESTRICT` in the same controlled cutover.

## RLS / auth-context: answered, not deferred

**Finding:** the current `.NET` Postgres access (`Program.cs:26-34`, all `Npgsql*Repository` classes) opens a single shared `NpgsqlDataSource` built once at startup from one fixed `SUPABASE_CONNECTION_STRING`. There is no per-request mechanism that sets who the authenticated user is inside the Postgres session. Every query runs as whatever one fixed role that connection string authenticates as, for every request, regardless of which user's JWT STEP 1's auth middleware validated.

The source does not reveal the deployed `SUPABASE_CONNECTION_STRING`, so the runtime database role cannot be identified from these files. The verified consequences are:
1. If the connection authenticates as a privileged owner or another `BYPASSRLS` role (including a database role configured as `service_role`), PostgreSQL bypasses the ownership policies; the database therefore does not enforce per-user isolation for `course_projects`, `course_sessions`, and their dependent rows.
2. If it authenticates as `authenticated` or another non-bypass role without setting JWT claims, `auth.uid()` evaluates to `NULL`, so the `auth.uid()`-dependent ownership policies reject rows. (`organizations` and `quality_gate_definitions` also have role-scoped policies using `true`; not every policy in the file is keyed on `auth.uid()`.)

**Decision — preserve RLS for real, don't disable it:** the connection string must not use `service_role`, `postgres`, or any other RLS-bypassing role, and every request must perform its protected Postgres work inside a transaction that sets the session's identity to match the JWT STEP 1 already validated, mirroring the same mechanism Supabase's own PostgREST uses:

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "<validated-user-id-from-JWT>", "role": "authenticated"}';
```

issued inside every database transaction, before its first protected query, using the validated JWT `sub` claim available from `HttpContext.User`. Because the repositories currently open independent pooled connections, a request-scoped unit of work must make all related commands share that connection and transaction, or each repository operation must start its own transaction and apply both settings; setting them on one connection cannot affect another pooled connection. The claims value must be passed through a parameterized `set_config('request.jwt.claims', ..., true)` (or an equivalently safe API), not interpolated into SQL. The underlying Postgres role becomes a narrowly privileged `authenticator`-style role that is only allowed to `SET ROLE authenticated` — never `service_role` or another `BYPASSRLS` role — so skipping the setup fails closed. With the role and transaction-local claims set on the same connection used by the query, Supabase's existing `auth.uid()` function reads the validated `sub` and the current ownership policies work as intended.

**Scope note:** implementing this (touching `Program.cs`, the `NpgsqlDataSource` registration, and every repository's connection-acquisition path) is code, not plan — out of this step's scope lock. It isn't explicitly assigned to any existing step; STEP 4 is the next step that touches Postgres connection/access code (adding `GenerationJob` polling), so it's the natural place to land this fix, and it's called out below in the Blocker Register so it isn't lost between steps.

## Blocker Register additions

| # | Step | Raised by | Date | The blocker | Resolution |
|---|---|---|---|---|---|
| 2 | STEP 2 | system-architect | 2026-09-04 | Checked configurations target separate Supabase projects (`jbjfafyjqdjmzmdggzha` vs. Studio's checked-in default `gjxhfyfonjdcaimxjipp`); STEP 8 must first confirm the deployed refs. If they differ as configured, the `WorksheetProject.sessionId → course_sessions.id` FK is physically impossible until both schemas live in one database. | Open: the user must approve which project is canonical and the cutover/retirement direction; the binding decisions require one database but do not choose the survivor. STEP 8 must then sequence consolidation/data transfer → approved `sessionId` reconciliation and zero-orphan validation → FK. |
| 3 | STEP 2 | system-architect | 2026-09-04 | `.NET` backend uses one shared data source and opens repository connections without propagating the validated JWT identity; the deployed connection role is not visible in source. RLS ownership policies therefore either can be bypassed by a privileged/`BYPASSRLS` role or cannot resolve `auth.uid()` under a non-bypass role. | Decided here: use a narrowly privileged authenticator role that can reach only `authenticated`, and set the role plus parameterized transaction-local JWT claims from the validated `sub` on the same connection/transaction as every protected query. Implementation is not yet assigned to a step — recommend STEP 4, the next step touching Postgres access. |

## Exit criteria check

- Every table in both current schemas has exactly one named owner. ✅ (27 current tables; two additional STEP 4 ownership lanes reserved above)
- `WorksheetProject → course_sessions` FK specified with type and nullability. ✅ (`uuid`, `NOT NULL`, `ON DELETE RESTRICT`, backfill required first)
- RLS/auth-context question answered, not deferred. ✅ (decision made: preserve via transaction-local role+claims on each query's connection, never an RLS-bypassing role; implementation ownership flagged for STEP 4)
