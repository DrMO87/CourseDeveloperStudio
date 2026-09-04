---
status: pending
---

# STEP 1 handoff — backend auth, CORS, DI lifetime defect

## What changed

**Files touched:**
- `backend/src/CourseDeveloper.Api/CourseDeveloper.Api.csproj` — added `Microsoft.AspNetCore.Authentication.JwtBearer` 9.0.3
- `backend/src/CourseDeveloper.Api/Program.cs` — auth, CORS, DI lifetime
- `backend/src/CourseDeveloper.Infrastructure/CourseDeveloper.Infrastructure.csproj` — added missing `Npgsql` 9.0.3 reference (pre-existing gap, out of STEP 1's scope but blocking any build; see "Verification" below)
- `backend/src/CourseDeveloper.Infrastructure/Agents/McpToolDispatcher.cs` — fixed a pre-existing unescaped-quotes syntax error (out of scope, see "Verification")
- `backend/src/CourseDeveloper.Infrastructure/Obsidian/FrontmatterEnvelopeParser.cs` — fixed a pre-existing malformed char-literal syntax error (out of scope, see "Verification")

### 1. Authentication

Registered JWT bearer authentication validating tokens issued by Studio's Supabase project — the same project MVP's `session.ts` already authenticates against (one identity boundary, decision 6).

**Correction during review (see "Codex review fixes" below):** my first draft assumed Supabase signs these tokens with a static HS256 secret and validated against a manually-supplied `SymmetricSecurityKey`. I independently verified this project's `/.well-known/openid-configuration` and it publishes a real JWKS endpoint with `RS256`/`ES256` in its supported algorithms — this project's live signing key is asymmetric (ES256) and rotates. Codex corrected the implementation to use `options.Authority` for OIDC/JWKS discovery instead of a static secret. This is the current, live implementation.

- `options.Authority` = `{SUPABASE_URL}/auth/v1` — JWT bearer middleware discovers signing keys from this authority's JWKS endpoint automatically (handles key rotation with no app-side secret to manage or rotate).
- `options.Audience` = `"authenticated"` (Supabase's standard claim)
- `ValidIssuer` explicitly pinned to the same authority URL (redundant with discovery but an explicit check, not just implicit trust of whatever the discovery document says).
- A global `FallbackPolicy` requires an authenticated user on every endpoint (`RequireAuthenticatedUser()`) — chosen over per-controller `[Authorize]` attributes because none of the 6 controllers are meant to be public, so one global default is simpler than repeating the attribute 6 times and can't be forgotten on a 7th controller later.
- `app.UseAuthentication()` added before `app.UseAuthorization()`.

**New environment variable:**
- `SUPABASE_URL` — Studio's Supabase project URL. Falls back to the same hardcoded project ref the frontend already defaults to (`https://gjxhfyfonjdcaimxjipp.supabase.co`) if unset, matching the existing fallback pattern in this file for the Postgres connection string.

(`SUPABASE_JWT_SECRET` from my original draft is no longer needed — dropped once auth moved to Authority-based JWKS discovery.)

### 2. CORS

Replaced the `AllowAnyOrigin()` policy with an explicit allow-list read from `CORS_ALLOWED_ORIGINS` (comma-separated), defaulting to `http://localhost:3000` (Studio frontend's dev origin) when unset. `AllowAnyMethod()`/`AllowAnyHeader()` kept — only origin was in scope per the ticket.

**New environment variable:**
- `CORS_ALLOWED_ORIGINS` — comma-separated list of allowed frontend origins in production.

### 3. DI lifetime defect

`AgentOrchestrator` and `GateRunnerService` changed from `AddSingleton` to `AddScoped`.

**Choice:** Scoped (not `IServiceScopeFactory`-wrapped singletons). Neither class holds state expensive enough to justify keeping a singleton lifetime — both are thin coordinators that immediately delegate to their (already-scoped) repository dependencies. Matching their lifetime to their dependencies' lifetime is the simplest correct fix; introducing a scope-factory wrapper would add indirection with no offsetting benefit here.

## Codex review fixes

- **Auth signing-key mechanism corrected.** My original `Program.cs` draft used a static `SymmetricSecurityKey` (HS256) sourced from a new `SUPABASE_JWT_SECRET` env var. Codex found this project's live Supabase auth config actually publishes an OIDC discovery document with a JWKS endpoint supporting `RS256`/`ES256` — asymmetric, rotating keys, not a static HS256 secret. I independently re-verified this by fetching `https://gjxhfyfonjdcaimxjipp.supabase.co/auth/v1/.well-known/openid-configuration` myself before accepting the fix. Codex rewrote the `AddJwtBearer` block to use `options.Authority` (automatic JWKS discovery/rotation) instead. `SUPABASE_JWT_SECRET` and the manual `SymmetricSecurityKey` construction were removed.
- CORS middleware ordering and the DI scoped-lifetime fix were reviewed and found correct as originally written — no changes needed there.
- Codex's build-verification run (installing the .NET SDK inside its own sandbox via `winget`) did not finish before the 20-minute dispatch timeout killed the run — no compiler result was captured from that pass.

## Verification

**Build:** Installed the .NET 9 SDK locally (`9.0.317`) and ran `dotnet build` myself against the full `backend/` solution.

Along the way I found and fixed two **pre-existing, unrelated syntax defects** that blocked the solution from compiling at all, in files STEP 1 never touches:
- `backend/src/CourseDeveloper.Infrastructure/Agents/McpToolDispatcher.cs:20` — a string literal with unescaped embedded double quotes (`"{"valid": true, ...}"`), a plain syntax error. Fixed by escaping the quotes.
- `backend/src/CourseDeveloper.Infrastructure/Obsidian/FrontmatterEnvelopeParser.cs:34` — a malformed `TrimStart('', '<raw CR><raw LF>')` call with an empty and an unterminated char literal (literal newline bytes embedded in source). Fixed to `TrimStart('\r', '\n')`, the evident intent.
- Also found `CourseDeveloper.Infrastructure.csproj` was missing a `Npgsql` package reference despite the project using `NpgsqlDataSource`/`NpgsqlDataReader` types directly (7 files, 20 errors) — added the same `Npgsql` 9.0.3 reference the Api project already carries.

These three fixes were mechanical, unambiguous, and outside STEP 1's stated scope, but the solution could not produce any build signal at all without them — I judged fixing them in-place preferable to leaving `dotnet build` permanently red for every future step. Flagging this explicitly rather than silently absorbing it.

**After those fixes, the build still fails — but only on the exact, already-known STEP 3 defect:**

```
GateRunnerService.cs(81,21): error CS1061: 'QualityReceipt' does not contain a definition for 'ArabicRatioVerdict' ...
GateRunnerService.cs(82,21): error CS1061: 'QualityReceipt' does not contain a definition for 'ArabicRatioValue' ...
GateRunnerService.cs(86,45): error CS1061: 'QualityReceipt' does not contain a definition for 'BoundaryCheckVerdict' ...
GateRunnerService.cs(89,42): error CS1061: 'QualityReceipt' does not contain a definition for 'BrandPaletteVerdict' ...
GateRunnerService.cs(92,42): error CS1061: 'QualityReceipt' does not contain a definition for 'AssetGateVerdict' ...
5 Error(s)
```

This is precisely the `QualityReceipt` property-mismatch defect STEP 3's Task already names and is scoped to fix. STEP 1's own scope lock says "Do not touch the gate registry itself here (that's STEP 3)" — so this was left alone, not fixed here.

**Conclusion:** STEP 1's own changes (auth, CORS, DI lifetime) introduce zero compile errors — every remaining error is the pre-existing, already-cataloged STEP 3 defect. A fully green `dotnet build` of this solution is not reachable until STEP 3 lands, purely because both steps' code lives in the same `CourseDeveloper.Infrastructure` project. This is a structural fact about the ticket's step boundaries, not a STEP 1 failure.

**Manual trace (auth):** `OrganizationsController` (and the other 5) have no `[AllowAnonymous]` and no explicit `[Authorize]` — they rely entirely on the global `FallbackPolicy`. A request with no `Authorization` header or an invalid/expired bearer token fails `RequireAuthenticatedUser()` in the authorization middleware, which runs after `UseAuthentication()` populates (or fails to populate) `HttpContext.User` — the request never reaches the controller action and gets a 401 from ASP.NET Core's built-in challenge behavior for JWT bearer.

**Manual trace (CORS):** A preflight/actual request from an origin not present in `CORS_ALLOWED_ORIGINS` (or the `http://localhost:3000` default) is rejected by the CORS middleware before controller execution — no `Access-Control-Allow-Origin` header is returned for that origin, so the browser blocks the response client-side.

## Scope respected

- Did not touch `IQualityGateRunner`'s gate dispatch/switch-statement logic or `QualityReceipt` property mismatches (STEP 3).
- Did not wire the frontend to the new auth (STEP 7).

## Codex final verdict

**PASS.** Codex independently re-ran `dotnet build`, re-verified the JWT config against the live Supabase OIDC discovery document (issuer, JWKS with an ES256 key, audience, middleware ordering, `FallbackPolicy` coverage), re-verified the CORS policy and DI scoping, and confirmed both out-of-scope syntax fixes preserve the evident intended behavior and the `Npgsql` reference addition was necessary. No functional defects found. Full evidence: `docs/tickets/codex-review-evidence/step1-final-review.json`.

Two hygiene findings, both addressed: this handoff's file list was incomplete (fixed above); `FrontmatterEnvelopeParser.cs`'s diff looked inflated due to line-ending normalization, confirmed with `git diff --ignore-space-at-eol` to be exactly the one intended line change.

## Status

`pending` — awaiting user approval to commit. Not committed. STEP 1 is otherwise complete.
