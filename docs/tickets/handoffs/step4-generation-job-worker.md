---
status: pending
---

# STEP 4 handoff — GenerationJob schema, worker skeleton, and the RLS/auth-context fix

## Scope note: RLS/auth-context fix folded in

STEP 2's handoff logged blocker #3 (the `.NET` API's single shared `NpgsqlDataSource` has
no per-request identity, so RLS ownership policies are either bypassed by a privileged
connection role or can't resolve `auth.uid()`) as "not yet assigned to a step, recommend
STEP 4." The user was asked explicitly whether to fold that fix into this step or leave it
open, and chose to fold it in — it is not in STEP 4's literal task text, so it's called out
here rather than silently bundled.

## 1. GenerationJob / GenerationJobEvent schema (`database/schema.sql`, section 13)

```sql
create type generation_job_status as enum (
    'queued', 'claimed', 'running', 'succeeded', 'failed', 'canceled', 'retryable',
    'merging', 'overlaying', 'reviewing'
);

create table public.generation_job (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.course_projects(id) on delete cascade not null,
    session_id uuid references public.course_sessions(id) on delete cascade not null,
    operation text not null,
    idempotency_key text not null,
    notebooklm_account_key text not null default 'default',
    status generation_job_status not null default 'queued',

    claimed_by text,
    claimed_at timestamptz,
    lease_expires_at timestamptz,
    heartbeat_at timestamptz,
    attempt_count int not null default 0,
    max_attempts int not null default 3,

    external_task_id text,
    academy_brain_version text,
    cancel_requested boolean not null default false,

    payload jsonb not null default '{}',
    result_manifest jsonb,
    error_details jsonb,
    progress jsonb not null default '{}',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.generation_job_event (
    id uuid primary key default uuid_generate_v4(),
    job_id uuid references public.generation_job(id) on delete cascade not null,
    event_type text not null,
    detail jsonb not null default '{}',
    created_at timestamptz not null default now()
);
```

**States:** the 7 required states (queued, claimed, running, succeeded, failed, canceled,
retryable) plus 3 reserved for STEP 5's post-generation pipeline (merging, overlaying,
reviewing), so that step doesn't need another enum migration.

**Idempotency:** `(course, session, operation)` is expressed as `idempotency_key` (caller
composes it, e.g. `{sessionId}:{operation}`), enforced with a **partial unique index** —
```sql
create unique index generation_job_active_idempotency_key
    on public.generation_job (idempotency_key)
    where status in ('queued', 'claimed', 'running', 'retryable', 'merging', 'overlaying', 'reviewing');
```
— not a table-wide unique constraint, so retried/completed jobs keep their own history rows
instead of colliding with the next attempt at the same key. `NpgsqlGenerationJobRepository.EnqueueAsync`
checks for an existing active row with the same key first and returns it instead of
inserting a duplicate — this is the "one worker may own a (course, session, operation) key
at a time" constraint.

**Bounded concurrency:** `ClaimNextAsync` excludes jobs whose project or NotebookLM account
already has an in-flight row. Partial unique indexes on `project_id` and
`notebooklm_account_key` are the database-enforced concurrency boundaries; the query
predicates are availability filters. Both limits are one in-flight job in this step.

**Resumable external task IDs / academy-brain version / progress:** columns exist
(`external_task_id`, `academy_brain_version`, `progress` jsonb) but are not populated by
anything in this step — that's STEP 5's real academy-brain adapter. Reserved now so STEP 5
doesn't need a migration either.

## 2. `CourseDeveloper.Worker` — separate process, not `IHostedService` inside the API

New project `backend/src/CourseDeveloper.Worker` (`Microsoft.NET.Sdk.Worker`, own `.csproj`,
own entry in `CourseDeveloper.sln`), referencing `CourseDeveloper.Core` and
`CourseDeveloper.Infrastructure` only — **not** `CourseDeveloper.Api`. It builds and runs as
its own process/container, matching DEC-004's "separately deployable = its own process
within the one Studio release."

- `Program.cs` — `Host.CreateApplicationBuilder`, registers its own `NpgsqlDataSource` built
  from `GENERATION_WORKER_CONNECTION_STRING` (falls back to `SUPABASE_CONNECTION_STRING`,
  then to a local-dev default), registers `NpgsqlGenerationJobRepository` and the polling
  `BackgroundService`.
- `GenerationJobPollingService : BackgroundService` — the polling loop.
- `IGenerationJobExecutor` / `StubGenerationJobExecutor` — the "run academy-brain" step is
  explicitly out of scope here (STEP 5); the stub just runs a cancellable, heartbeat-visible
  delay (`GENERATION_WORKER_STUB_DURATION_SECONDS`, default 20s) so the exit criteria can be
  demonstrated end to end without academy-brain existing yet.

### Claim / lease / heartbeat / recovery mechanics (`NpgsqlGenerationJobRepository`)

- **`ClaimNextAsync`** — one `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1)`
  statement: atomic claim, safe under concurrent worker instances, enforces the per-project
  concurrency bound in the same query.
- **`MarkRunningAsync`** — `claimed` → `running` once the executor actually starts.
- **`HeartbeatAsync`** — extends `lease_expires_at` from a worker-owned timer
  (`GENERATION_WORKER_LEASE_SECONDS`, default 30s; heartbeat fires at lease/3, floor 5s),
  runs concurrently with the job via a linked `CancellationTokenSource` in
  `GenerationJobPollingService.RunClaimedJobAsync`.
- **`RecoverExpiredLeasesAsync`** — run once per poll cycle before claiming, using one
  `UPDATE ... RETURNING` so a concurrent heartbeat cannot be overwritten after a stale read: any
  `claimed`/`running` row whose lease expired goes back to `retryable` (or `failed` if
  `attempt_count >= max_attempts`), clearing `claimed_by`/`claimed_at`/`lease_expires_at` so
  it's re-claimable. This is what makes "worker killed mid-job" recover: a hard kill leaves
  no code running, so the row just sits until the next worker's recovery pass finds the
  expired lease.
- **`RequestCancelAsync` / cancellation** — queued/retryable jobs become canceled immediately;
  running jobs set `cancel_requested`. The executor is handed a
  `Func<Task<bool>> isCancelRequested` it polls between simulated work chunks, and returns a
  `Canceled` result the polling service turns into `CancelAsync`.
- **`CompleteAsync` / `FailAsync`** — terminal transitions; `FailAsync` decides
  `retryable` vs `failed` from `attempt_count` vs `max_attempts`.
- Every transition also writes a `generation_job_event` row (`claimed`, `running`,
  `succeeded`, `failed`, `canceled`, `lease_expired`) for observability.

### Running the worker locally

```
cd backend
$env:SUPABASE_CONNECTION_STRING = "<same connection string CourseDeveloper.Api uses, or GENERATION_WORKER_CONNECTION_STRING to point at the generation_worker role explicitly>"
dotnet run --project src/CourseDeveloper.Worker
```

Manual demo of the exit criteria (needs a live Postgres with the schema applied):
```sql
insert into generation_job (id, project_id, session_id, operation, idempotency_key, payload)
values (gen_random_uuid(), '<existing project id>', '<existing session id>', 'demo', 'demo-key-1', '{}');
```
Watch `generation_job.heartbeat_at` advance every ~10s while the worker runs; `kill -9` (or
Task Manager end the dotnet process on Windows) the worker mid-job and confirm the row's
`status` flips to `retryable` and `claimed_by` clears once `lease_expires_at` passes and a
second worker instance's `RecoverExpiredLeasesAsync` runs.

## 3. RLS/auth-context fix

**New:** `IRequestIdentity` (`Core/Interfaces`) exposes the validated JWT `sub` claim from
the current request; `HttpContextRequestIdentity` (`Api/Auth`) implements it off
`IHttpContextAccessor`. `AuthenticatedConnection` / `AuthenticatedConnectionFactory`
(`Infrastructure/Supabase`) open a Postgres connection + transaction and run
```sql
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', $1, true);  -- parameterized, not string-interpolated
```
before handing back a connection repositories can issue commands on. If no authenticated
identity is available (e.g. called outside an HTTP request), it throws rather than silently
running with an unscoped role — fails closed, per STEP 2's requirement.

**Retrofitted** (swapped `NpgsqlDataSource.OpenConnectionAsync()` for
`IAuthenticatedConnectionFactory.OpenAsync()`, one transaction per repository method — the
explicit fallback STEP 2's handoff sanctioned when a shared request-scoped unit of work
isn't in place): `NpgsqlOrganizationRepository`, `NpgsqlProjectRepository`,
`NpgsqlSessionRepository`, `NpgsqlGateDefinitionRepository`, `NpgsqlDossierRepository` — all
five repositories actually registered in `Program.cs`'s DI and reachable from a controller.

**Not retrofitted, flagged not silently skipped:** `NpgsqlAgentLogRepository` and
`NpgsqlQualityReceiptRepository` exist in the codebase but are registered in no DI container
and referenced by no controller — dead code today. Retrofitting unreachable code doesn't
close any real RLS gap, so it was left alone; whoever wires them up (there's no assigned
step for that yet) must apply the same connection-factory pattern before they go live, or
they'll silently run through the API's `NpgsqlDataSource` directly if it's ever
reintroduced.

**Deployment action required, not just code:** the fix only takes effect once
`SUPABASE_CONNECTION_STRING` (API) and `GENERATION_WORKER_CONNECTION_STRING` (worker) are
actually pointed at the new `studio_api` / `generation_worker` Postgres roles this step adds
to `schema.sql` — both are deliberately created without a password. A real secret must be
set out of band in the Supabase dashboard (or with `ALTER ROLE ... WITH PASSWORD`) before
use. Until that connection-string change ships, the
code change is inert — the deployed API keeps authenticating as whatever role its current
`SUPABASE_CONNECTION_STRING` already uses. This handoff does not claim that cutover has
happened.

## What's simplified (ponytail-marked in code, not silently dropped)

- Per-course concurrency is hardcoded to "at most 1 in-flight job per project" via the claim
  query plus a partial unique index, not a configurable N. NotebookLM-account concurrency is
  likewise one, with `default` as the account key until STEP 5 supplies explicit account keys.
- The RLS retrofit is per-repository-method transactions, not a request-scoped shared unit of
  work — STEP 2 explicitly sanctioned this as a fallback; it means two repository calls
  within one HTTP request aren't atomic with each other (they weren't before this change
  either — each repo call already opened its own connection).
- `StubGenerationJobExecutor` is a timed delay, not a state machine — it exists only to
  exercise claim/heartbeat/lease-recovery/cancel, per this step's explicit scope lock against
  implementing academy-brain invocation.

## Scope lock check

- Did not implement the academy-brain subprocess invocation — `StubGenerationJobExecutor` is
  a placeholder; STEP 5 replaces it.
- Did not touch `IAgentOrchestrator` or `AgentOrchestrator` — untouched, still handles
  short-running stage coordination separately from `GenerationJob`.

## Exit criteria check

- `CourseDeveloper.Worker` runs as its own process, independent of `CourseDeveloper.Api` —
  separate `.csproj`, separate `Program.cs`/`Host`, no reference to `CourseDeveloper.Api`. ✅
  (confirmed by project structure and `dotnet build`; not run against a live Supabase
  instance from this environment — no Postgres reachable here.)
- Manually-inserted `GenerationJob` row gets claimed, lease visibly renewed on heartbeat,
  released/re-claimable if the worker is killed mid-job — mechanics implemented and unit-
  reasoned above (`ClaimNextAsync`/`HeartbeatAsync`/`RecoverExpiredLeasesAsync`); **not yet
  exercised against a live database** — this environment has no reachable Postgres/Supabase
  instance to run the manual demo against. Whoever has DB access should run the demo in
  "Running the worker locally" above before treating this exit criterion as fully verified.

## Verification performed

- Initial implementation run: `dotnet build` (backend, all 5 projects incl. new `CourseDeveloper.Worker`): succeeded, 0
  errors, 0 warnings.
- Initial implementation run: `dotnet test`: `Passed! - Failed: 0, Passed: 11, Skipped: 0, Total: 11` — all pre-existing
  tests (STEP 3's gate registry tests, which use fake repositories unaffected by the
  connection-factory retrofit) still pass unchanged.
- Post-review rerun: both commands were blocked during restore with `NU1301` because this
  sandbox denied access to `https://api.nuget.org/v3/index.json`; no post-fix compile or
  test result is claimed.
- No new unit tests added for `NpgsqlGenerationJobRepository` or the polling service — both
  need a live Postgres to test meaningfully (raw SQL, `FOR UPDATE SKIP LOCKED`, real elapsed
  time for lease expiry) and this repo has no test-database infrastructure today.
