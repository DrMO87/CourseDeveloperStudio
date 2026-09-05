# STEP 10 — canonical Obsidian vault sync

**Owner:** backend-dev
**Status:** implemented, pending Codex review + user commit approval

## What was wrong

1. Two independent, uncoordinated vault writers: the .NET `ObsidianVaultService.SyncSessionToVaultAsync`
   (flat files, no frontmatter, no assets folder, no index note) and a Next.js route
   (`frontend/src/app/api/obsidian/sync/route.ts`) that wrote its own PARA structure directly to disk,
   using fabricated fallback curriculum content whenever real session markdown wasn't present.
2. `AgentOrchestrator.RunArtifactsGenerationSwarmAsync` logged `ARTIFACTS_GENERATED_AND_SYNCED` without
   ever calling the real sync.
3. `WriteGeneratedCourseBundleAsync` already serialized frontmatter correctly but nothing called it.
4. `frontend/src/app/api/obsidian/read/route.ts` accepted an absolute `path` query param and read it
   unconditionally — an arbitrary-file-read vulnerability. `files/route.ts` interpolated `category` and
   `projectSlug` into filesystem paths with no containment check.

## Decision: canonical writer = the .NET backend

`ObsidianVaultService` (behind `ObsidianSyncController`) is now the only component that writes to the
vault. Reasoning: it is the pipeline's authoritative data source (`CourseSession.BlueprintMarkdown` etc.,
populated by the real generation pipeline), whereas the Next.js route was a frontend-side writer using
client-fetched Supabase data and hardcoded fallback pharma-curriculum text when real content was absent
— exactly the "filler content" the ticket's scope lock forbids. Frontend filesystem writes are also the
wrong place for path-safety-sensitive vault mutations to live.

The Next.js `/api/obsidian/sync` route is retired as a writer and now only forwards to the backend
(`syncCourseToObsidian()`'s call signature is unchanged — no caller in `CourseDossierHub.tsx` or
`NotebookLMPanel.tsx` needed to change). This satisfies "smallest possible frontend change": the external
contract (`POST /api/obsidian/sync` with `{organization, project, sessions, activeSession, dossierFiles}`)
is untouched; only its internals changed from "write to disk" to "proxy to backend, one call per session
and per dossier file."

Every backend endpoint requires an authenticated caller (STEP 1's `FallbackPolicy`), so `obsidianSync.ts`
now attaches the caller's Supabase JWT and the proxy route forwards it as the `Authorization` header to
the backend. This is the one behavior change visible to a caller: an unauthenticated sync attempt now
returns `{success: false, message: 'You need to sign in to sync to the vault.'}` instead of silently
writing to disk — this is correct (every other backend write already required auth) and does not change
what a signed-in user experiences.

## What changed

**Backend:**
- `ObsidianVaultService.cs` — rewritten. Per-project layout `vaults/<projectSlug>/{01_Projects,02_Areas,03_Resources}/...`
  (matches what the Next.js reader routes already expect, so no frontend read-path change was needed).
  Frontmatter (organization/project/session identity, artifact type, source, content hash, sync timestamp)
  via the existing `FrontmatterEnvelopeParser`/`WriteGeneratedCourseBundleAsync` — one serialization path
  for every note this service writes. Atomic writes (`temp file + File.Move(overwrite: true)`). A
  `SafeSegment()` helper sanitizes every path segment built from external input (project slug, session
  code, org slug, asset id, dossier category). `ReadNoteAsync`/`ListParaCategoryFilesAsync`/
  `QueryVaultAreaAsync` now verify the resolved path stays inside the vault root, throwing
  `UnauthorizedAccessException` otherwise. Session assets (`SessionAsset.FilePath`) are copied into a
  per-session `assets/` subfolder; a missing source file is recorded in the index note, not thrown. A new
  `_index.md` per session links every artifact and asset. `02_Areas/<org-slug>/Brand_Identity_Contract.md`
  and `03_Resources/<project-slug>/Course_Overview.md` are populated from real `Organization`/
  `CourseProject` fields only.
- `IObsidianVaultService.SyncSessionToVaultAsync` now takes `(CourseSession, CourseProject, Organization)`
  instead of `(CourseSession, string projectName)` — the org is needed for the area note and frontmatter.
- New `SyncDossierFileAsync(ProjectDossierFile, CourseProject, Organization)` + controller endpoint
  `POST /api/ObsidianSync/sync-dossier-file` — the dossier-upload auto-sync feature in `CourseDossierHub.tsx`
  used the Next.js writer for real uploaded files (not fabricated content), so retiring that writer
  without replacing this path would have silently broken working upload behavior.
- `AgentOrchestrator.RunArtifactsGenerationSwarmAsync` now takes the already-loaded `CourseSession` and
  actually calls `_obsidianService.SyncSessionToVaultAsync(...)`; a sync failure now throws instead of
  being swallowed behind a logged success message.
- `ObsidianSyncController` gained `IOrganizationRepository` (to resolve the org for both endpoints) and
  wraps `GetParaFiles` to turn a path-containment rejection into a 400 instead of an unhandled exception.
- `ObsidianVaultService` now reads `VAULT_ROOT` (same env var name the Next.js routes read) ahead of
  `Obsidian:VaultPath`, so one env var configures both processes to the same on-disk vault.

**Frontend:**
- `frontend/src/app/api/obsidian/sync/route.ts` — rewritten as a thin proxy (see above). No fabricated
  content, no direct filesystem writes.
- `frontend/src/lib/obsidianSync.ts` — attaches the Supabase session's bearer token.
- `frontend/src/app/api/obsidian/files/route.ts` — `category` is now checked against an allowlist of the
  four PARA folder names; `projectSlug` is sanitized before joining into a path.
- `frontend/src/app/api/obsidian/read/route.ts` — removed the arbitrary-absolute-path branch entirely;
  every resolved candidate path is now verified to stay inside `VAULT_ROOT` before `fs.access`/`fs.readFile`.

## Round 2: three more writers Codex found that I'd missed

Codex's review correctly refused to sign off after round 1: two more independent vault writers and a
fake-content viewer were still live, which it flagged rather than fixing (outside its granted scope).
I designed and implemented the fixes myself, per the Claude-codes/Codex-reviews split:

- `frontend/src/app/api/nlm/route.ts` (`add_source_file` action) — when the requested source file wasn't
  found anywhere in the vault, it fabricated a placeholder note ("Course curriculum and ILO specification
  for X.") and wrote it directly into the project's vault so the NotebookLM upload would "succeed." This
  was both a second writer and the exact invented-filler-content the scope lock forbids. Now returns a
  404 with a clear message instead of writing anything.
- `frontend/src/app/api/upload-logo/route.ts` — copied every uploaded org logo into
  `obsidian-vault-template/02_Areas/<org>/_assets/` and into every active project vault's matching folder,
  entirely bypassing the backend. Removed both vault-writing blocks; the route now only saves to
  `public/logos/<org>/` for the app's own web preview (not a vault write, out of STEP 10's scope). Brand
  logo assets are not yet wired into the backend's vault sync at all — flagged below as a known gap, not
  silently patched over.
- `frontend/src/components/ObsidianFileViewerModal.tsx` — never read a real file; it pattern-matched the
  filename and synthesized plausible pharma content client-side, so clicking any real synced note in
  `ObsidianParaBrowser` showed fabricated, unrelated text. It now fetches `/api/obsidian/read` with the
  file's real vault-relative path and shows the actual synced content, with a loading and an error state.
  This needed a one-line companion fix in `ObsidianParaBrowser.tsx`: `onOpenFile` now passes
  `${selectedFolder}/${file.name}` instead of the bare filename, since the read endpoint needs the PARA
  category prefix that the file list previously dropped.

## Round 3: a fourth writer Codex found in the same file

Codex's round-2 review (still correctly withholding sign-off) found that `nlm/route.ts`'s `download_all`
action wrote NotebookLM's downloaded exports (slides/audio/etc.) directly into
`vaults/<project>/80-generation/exports` via a caller-controlled `outputDir` with no path validation at
all — a second writer, and a worse arbitrary-write than the vault-scoped issues fixed so far since
`outputDir` was used verbatim with no containment check whatsoever. Fixed: the caller-supplied `outputDir`
is no longer honored; downloads now land in `VAULT_ROOT/.nlm-downloads/<sanitized-project>/<sanitized-
notebook-id>/`, a non-vault staging location, with both path segments sanitized.

Round 2 also fixed two of its own findings directly (in `upload-logo/route.ts`'s remaining public/logos
write: `orgSlug`/`logoType` validation and a MIME-based extension allowlist, closing a real path-injection
risk in the one write that route still does; and removed now-dead imports/props left over from deleting
`ObsidianFileViewerModal.tsx`'s fabrication function).

## Round 4: both known gaps closed

Both gaps below were closed after round 3 (2026-09-05), following the same "Claude codes" rule — new
implementation, not a fix pulled from a Codex review report.

- **Org logo vault sync.** `IObsidianVaultService.SyncOrgLogoAsync(org, projects, fileName, bytes)` writes
  the uploaded logo into `02_Areas/<org-slug>/_assets/` under every one of the org's project vaults, then
  re-runs `WriteAreaNoteAsync` so the Brand Identity Contract note links whatever files are actually on
  disk (no fabricated content — it lists what it finds in `_assets/`, nothing more). New controller
  endpoint `POST /api/ObsidianSync/sync-org-logo` (multipart: `organizationSlug` + `file`).
  `upload-logo/route.ts` still saves the web-preview copy to `public/logos/<org>/` directly (unrelated to
  the vault), then forwards the same file to the new backend endpoint carrying the caller's bearer token
  — same auth-forwarding-proxy pattern as `/api/obsidian/sync`. A sync failure doesn't fail the upload
  (the preview already succeeded) but is reported truthfully via `vaultSynced`/`vaultError` on the
  response, never silently swallowed. `BrandPaletteEditor.tsx` now attaches the Supabase session token.
- **NotebookLM downloads imported into the vault.** `IObsidianVaultService.SyncNlmDownloadsAsync(project,
  org, notebookIdentifier)` copies whatever `nlm/route.ts`'s `download_all` already staged at
  `.nlm-downloads/<project>/<identifier>/` into `03_Resources/NotebookLM_Generated/<identifier>/`, with a
  real manifest note (filenames + sha256, listing what's actually there) and stale-file reconciliation on
  re-sync — no ingestion into session assets/artifacts, since the downloads (slides, audio, quizzes) are
  reference material, not authored session content. New endpoint `POST
  /api/ObsidianSync/sync-nlm-downloads` (`{ projectId, notebookIdentifier }`, resolved from the DB, not a
  caller-supplied path). `nlm/route.ts`'s `download_all` now returns the sanitized `notebookIdentifier` it
  used, so the frontend doesn't have to guess or re-derive it. New proxy route
  `frontend/src/app/api/obsidian/import-nlm-downloads/route.ts` (same auth-forwarding pattern). Wired into
  `NotebookLMPanel.tsx`: both `handleDownloadOnly` and `runFullPipeline`'s download step call the import
  right after a successful `download_all`; a failed import is logged and shown, not silently dropped, and
  doesn't roll back the (already-successful) download. The panel's misleading "Vault Target:
  vaults/.../80-generation/..." notice (a path nothing has written to since round 3) is corrected to the
  real target, `03_Resources/NotebookLM_Generated/`.

New tests in `ObsidianVaultServiceTests.cs`: `SyncOrgLogoAsync_WritesLogoIntoEachProjectVault_AndAreaNoteLinksIt`,
`SyncNlmDownloadsAsync_CopiesStagedFilesIntoResourcesWithManifest_AndRemovesStaleOnes`,
`SyncNlmDownloadsAsync_ThrowsWhenNothingHasBeenDownloaded`,
`SyncNlmDownloadsAsync_SanitizesNotebookIdentifier_AndCannotEscapeTheVault`. `dotnet test`: 41/41. `npx tsc
--noEmit`: clean.

No remaining known gaps for STEP 10's exit criteria.

## Operator action required

Set the `VAULT_ROOT` environment variable to the same absolute path for both the Next.js dev server and
the .NET API process (e.g. the monorepo root) — otherwise the backend writes to its own default location
and the frontend's `/api/obsidian/files` and `/api/obsidian/read` routes won't find what it wrote. This
is a deployment/env-config action, not something a code change can enforce.

## Tests

- `backend/tests/CourseDeveloper.UnitTests/ObsidianVaultServiceTests.cs` (new): first sync writes
  frontmatter/index/area/resource notes and skips null artifacts (no filler); re-sync with unchanged
  content is byte-identical; re-sync with changed content replaces the file and its hash; assets are
  copied into `assets/`, a missing asset source is recorded not thrown; an unsafe project/session slug
  (`../../etc`, `../../../evil`) is sanitized and cannot escape the vault; `ReadNoteAsync` rejects a
  `..`-escaping path; a dossier file syncs into both `03_Resources` and the project's `Dossier/` folder.
- `backend/tests/CourseDeveloper.UnitTests/AgentOrchestratorTests.cs` (new): the ARTIFACTS stage actually
  calls the vault sync (not just logs it) and propagates a sync failure instead of claiming success.
- `dotnet test`: 35/35 passing (backend).
- `npx tsc --noEmit` (frontend): clean.

## Exit criteria status

- One canonical vault writer: yes (.NET backend); Next.js route retired as a writer, proxies instead.
- `AgentOrchestrator`'s sync claim matches a real sync call: yes.
- Frontmatter-correct notes, populated (not filler) Areas/Resources, path-safe filenames: yes.
- Re-sync is idempotent: yes (atomic overwrite, unchanged content produces an identical file).
- Browser still renders correctly: no frontend read-path or call-shape change; depends on the `VAULT_ROOT`
  operator action above for correctness in an environment where it wasn't already set consistently.
- Acceptance tests cover first sync, repeat sync, updated content, assets, and unsafe paths: yes (see Tests).

## Explicitly not touched

academy-brain's own, separate vault. STEP 11's prompt-authoring proposal. STEP 7's frontend components
beyond the two files listed above (no `ObsidianSyncController` route/URL shape changed from what STEP 7
already wired — only two new endpoints were added: `sync-dossier-file` follows the existing `sync-session`
shape).
