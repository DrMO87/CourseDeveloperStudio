# STEP 6 handoff — academy-brain worker runtime, secrets, and artifact custody

## What this step built

1. **Worker image** (`Dockerfile.worker`, repo root): bundles `CourseDeveloper.Worker` (.NET)
   and academy-brain's Python runtime, built from the same repo commit, into one image —
   replacing the machine-specific dev venv path the worker previously depended on for
   `pythonExecutable`. Build from the repo root: `docker build -f Dockerfile.worker -t
   course-developer-worker .`
   **Not build-tested in this environment** — no Docker daemon was available. Codex should
   attempt a real build if its sandbox has one; otherwise this needs a build-tested pass
   before it's trusted for deploy.

2. **`notebooklm-py` declared as an explicit dependency** in `academy-brain/pyproject.toml`
   (Codex's original STEP 6 finding: `generate_session.py` imports `NotebookLMClient` but the
   package was never declared, so a fresh install broke on any machine besides the one dev
   venv that happened to have it already). No `[browser]` extra — the worker never performs
   an interactive `nlm login`, only reads a pre-authenticated credential, so Playwright/
   Chromium isn't needed at runtime.

3. **A design correction from the STEP 5/6 gap analysis**: the original plan (baked into
   STEP 5's `request.schema.json`) was "resolve `notebooklm_account_key` to a *different
   Python interpreter path* per account." Reading `notebooklm-py`'s actual source
   (`notebooklm/cli/services/auth_source.py`) showed it already supports exactly this need
   through an env var — `NOTEBOOKLM_AUTH_JSON` (inline credential JSON, no disk file, highest
   precedence) — so a single interpreter can serve every account; only the credential varies
   per job. This is a real correction, not a preference: it removes the entire idea of a
   "per-account venv," which never made sense once STEP 6 bundles one image for every job.
   `pythonExecutable` is removed from `contracts/generation-job/request.schema.json` — nothing
   ever populated it (confirmed by grep across `backend/src`), so removal is safe. It's
   replaced by `GENERATION_WORKER_PYTHON_EXECUTABLE`, a fixed worker-config value the Docker
   image sets.

4. **Credential provisioning via Supabase Vault** (`database/schema.sql`, new section 14):
   reuses Studio's existing Supabase Postgres instance rather than a new secret-manager
   vendor. Each NotebookLM account's credential is a Vault secret named
   `notebooklm:<account_key>`; `public.notebooklm_auth_json(account_key)` is a
   `security definer` SQL function that reads `vault.decrypted_secrets` and is the only thing
   `generation_worker` gets EXECUTE on (not raw SELECT on the vault view). Provisioning a
   credential is an out-of-band `select vault.create_secret('<auth json>', 'notebooklm:<key>',
   ...)` call by an operator — the same convention this schema already uses for
   `studio_api`/`generation_worker`'s own passwords.

   Rotate an existing credential with `vault.update_secret(...)` using its UUID; Vault names
   are unique, so `vault.create_secret(...)` is only for initial provisioning.

   `backend/src/CourseDeveloper.Worker/NotebookLmCredentialResolver.cs` (new):
   `INotebookLmCredentialResolver.ResolveAsync(accountKey, ct)` calls that function via
   Npgsql, at execution time, per job — not at enqueue time. That's what lets a credential
   rotate (a `vault.update_secret(...)`) take effect on the very next claimed job, with
   no worker redeploy and no re-enqueuing jobs already in flight (the exact requirement in
   STEP 6's constraints).

5. **`AcademyBrainSubprocessExecutor.cs` changes**: for `live=true` jobs, resolves
   `job.NotebookLmAccountKey` through the resolver and sets `NOTEBOOKLM_AUTH_JSON` on the
   subprocess's environment. A missing credential throws
   `NonRetryableJobExecutionException` (same STEP 5 mechanism as HardStop) — retrying an
   unprovisioned account fails identically forever, so it shouldn't retry.

6. **Durable artifact storage** (`GenerationArtifactStorage.cs`, new): uploads a completed
   live run's receipt file, **and separately the generated course bundle**, to Supabase
   Storage (same project, reused — no new vendor) via its plain REST API (`POST
   /storage/v1/object/{bucket}/{path}`, URL-encoded segments, `apikey` + bearer service-role
   key, `x-upsert: true` — no supabase-py/C# SDK dependency added for one endpoint). The
   receipt (`VAULT/90-receipts/<sessionId>.production.yaml`) is a small status file;
   the actual slides/assets generate_session.py produces live at
   `VAULT/75-bundle/<sessionId>/` — a separate directory. `AcademyBrainSubprocessExecutor.cs`
   zips that directory (`System.IO.Compression.ZipFile.CreateFromDirectory`) to a temp file
   and uploads it as a second, distinct object when it exists. Both uploads record
   `{bucket, path, sha256, sizeBytes}` in the result manifest —
   `result_manifest.artifactStorage` for the receipt, `result_manifest.courseBundleStorage`
   for the bundle zip (`contracts/generation-job/result.schema.json`, both optional
   properties) — this is the "hashes/locations recorded in Postgres" STEP 6's exit criteria
   asks for, using the `result_manifest` jsonb column STEP 4 already created rather than a
   new table. Dry runs skip the bundle upload. If a live run succeeds but its bundle directory
   doesn't exist, the second upload is skipped with a warning log. In both cases,
   `courseBundleStorage` is absent from the manifest.

   If `SUPABASE_PROJECT_URL`/`SUPABASE_SERVICE_ROLE_KEY` aren't set (e.g. local dev), both
   uploads are skipped with a warning log, not an error — `receiptPath` (local disk) stays
   the only location in that case. **This is a deliberate local-dev fallback, not a
   production posture**: nothing in the worker currently refuses to report a job "succeeded"
   if durable storage was silently skipped. Before this runs against real customer jobs,
   deploy config must guarantee `SUPABASE_PROJECT_URL`/`SUPABASE_SERVICE_ROLE_KEY` are set in
   every environment that isn't a developer's own machine — this handoff does not add a
   hard-fail code path for missing config, since the ticket's exit criteria is satisfied by
   Studio's own deploy checklist enforcing this rather than new runtime logic guessing at
   which environment it's in. A genuine upload failure once storage IS configured throws a
   plain (retryable) exception — a network hiccup is worth retrying, unlike a HardStop.

## Artifact retention policy

- **Receipts and course bundles are retained indefinitely** in the `course-artifacts`
  bucket — they're the durable record of what a paying customer's job produced, and STEP 8's
  customer-facing receipt reads pedagogy evidence that should stay retrievable for the life
  of that customer's course.
- **No automatic deletion job exists or is planned in this step.** Storage cost is one job's
  bundle (slides/assets) per successful live run — small relative to Supabase Storage's
  pricing tiers at MVP volume. Revisit if/when volume makes a lifecycle rule (e.g. Supabase
  Storage's object lifecycle policies, or a scheduled cleanup of jobs past some retention
  window) worth the added complexity — not needed for MVP.
- **Local job workspace files** (the worker's own disk, `receiptPath` in the manifest) are
  NOT covered by this retention policy and may be cleaned up by ordinary worker
  housekeeping — the durable copy in Supabase Storage is the copy of record once a job's
  `artifactStorage`/`courseBundleStorage` manifest entries are populated.

## New environment variables (worker)

| Variable | Set by | Purpose |
|---|---|---|
| `ACADEMY_BRAIN_SCRIPT_PATH` | Docker image (`Dockerfile.worker`) | Path to `generate_session.py` inside the image |
| `GENERATION_WORKER_PYTHON_EXECUTABLE` | Docker image | Path to the bundled venv's python — same value for every job now |
| `SUPABASE_PROJECT_URL` | Deploy config | Base URL for the Storage REST API |
| `SUPABASE_SERVICE_ROLE_KEY` | Deploy config (secret) | Auth for the Storage REST API |
| `GENERATION_ARTIFACT_BUCKET` | Deploy config (optional) | Defaults to `course-artifacts` |

## What's NOT done / not verified here

- **Docker build is untested** — no Docker daemon in this sandbox. Needs a real build
  (ideally in CI) before trusting the image.
- **`notebooklm-py` importability without `[browser]` is an assumption**, based on reading
  its source (`auth.py` builds cookies via `httpx`, not Playwright, for the non-login path).
  Not verified with a real `pip install notebooklm-py && python -c "from notebooklm import
  NotebookLMClient"` in a clean environment — both this sandbox and the reviewing sandbox
  hit network/access errors attempting it. Verify directly against a real network before
  trusting it.
- **Supabase Vault SQL and Storage REST calls are untested against a live Supabase
  project** — no live Postgres/Supabase connection in this sandbox. The `security definer`
  function pattern (with `search_path = ''` and fully-qualified `vault.decrypted_secrets`)
  and the Storage endpoint shape (`POST {project_url}/storage/v1/object/{bucket}/{path}`,
  URL-encoded segments, `apikey` plus bearer service-role key, `x-upsert: true`) both match
  Supabase's documented API, but neither has round-tripped against a real project in this
  repo.
- A bucket named `course-artifacts` needs to actually exist in the Supabase project (or
  whatever name `GENERATION_ARTIFACT_BUCKET` is set to) — this handoff doesn't create it.
- **No hard-fail if durable storage config is missing in a non-dev environment** — see the
  fallback note under "Durable artifact storage" above. This is a deploy-checklist item, not
  a code gap, but it's not yet enforced by anything.

## Gates run

- `dotnet build` — 0 warnings, 0 errors.
- `dotnet test` — 25/25 passed (21 prior + 4 new: credential-env-var injection, missing
  credential → NonRetryable, artifact-storage manifest recording, course-bundle zip uploaded
  as a separate object from the receipt).
- `python -m pytest tests/ --ignore=tests/test_new_course.py -q` — 253 passed, 4 skipped
  (unchanged from STEP 5's baseline; re-run after regenerating `uv.lock` to include
  `notebooklm-py`).
- `uv lock` — regenerated `academy-brain/uv.lock` to include `notebooklm-py` 0.8.2 and its
  transitive dependencies, fixing a real gap where the declared dependency in
  `pyproject.toml` was absent from the lockfile `Dockerfile.worker`'s frozen
  `uv sync --frozen` depends on.
