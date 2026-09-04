---
stage: contracts
owner: claude
status: living
purpose: >-
  Shared second-brain for every agent working this vault (claude, codex,
  opencode, hermes). Read this before any stage — it holds provider quirks,
  pipeline decisions, and schema gotchas already learned the hard way, so no
  agent re-derives or re-breaks them.
---

# Agent Memory — read before you work this vault

## Owner role — read this first, every time (2026-08-21)

**The owner (Dr. Refaat) does not know what a micro:bit is, does not want to
learn, and has no way to judge lesson content, map assets, use the ingested
images, or critique a deck.** This is not a temporary gap — it is the standing
shape of this project. He is a pharmacist who inherited course production; he
is not, and will not become, the domain expert.

Consequences, binding on every agent (claude, codex, opencode, hermes):

- **Never hand the owner a defect that is agent-resolvable and call it his.**
  "Fill the black background yourself," "confirm this image is right," "pick
  which asset goes here" — if an agent could plausibly check or fix it, the
  agent fixes it. The owner is the last resort, not the first stop.
- **The whole point of `75-bundle/<session>/assets/` and `ASSET-MAPPING.md` is
  that agents already did the asset work.** A generated deck with a missing
  background, a wrong palette, a dangling arrow, or an unfilled evidence
  region is a generation/production defect for agents to fix — regenerate,
  re-prompt, patch the PDF, whatever the fix requires — not a punch list to
  forward to the owner.
- **Reserve the owner only for what is genuinely his to decide**: things with
  no correct answer derivable from the bundle/contracts (see `blueprint.md`'s
  "Decisions that need the owner's call"), or a literal physical action only
  he can take (photograph the real hardware, sign off, say "go"). Everything
  else — QC, defect-finding, defect-fixing, asset selection, image placement,
  content critique — is agent work. When in doubt, a 4-agent council decides
  it (see `blueprint.md` Approval record for the pattern); the owner is not
  looped in for council-decidable questions.

## Provider roster and quirks

- **Fan-out lanes (30-research, 40-critique): hermes, codex, opencode.** Gemini is
  NOT in the swarm — it hit unrecoverable 429 quota exhaustion on its free tier
  (not a trust/auth issue; `GEMINI_CLI_TRUST_WORKSPACE=true` fixed the trust error
  but the quota wall remained). OpenCode replaced it.
- **Hermes (Nous Portal free tier): sequential calls only, never parallel.**
  Parallel invocation silently drops output — no error, no file written, just
  nothing. Confirmed empirically (5-way parallel batch lost one lane's file).
- **Hermes "hangs" (2026-08-21 investigation): mostly not hangs — just slow.**
  A real research/critique call (glob-read several files, synthesize a
  schema'd claim, write JSON) legitimately takes **90–220s** on the pinned
  free-tier model. Killed at a 100–120s timeout this looks identical to a
  hang (0 CPU visible mid-poll, nothing written) but 8/8 sequential foreground
  reproductions completed cleanly once given 240–300s. Fix applied to both
  `_run_research_fanout.sh` and `_run_critique_fanout.sh`:
  `timeout 300 hermes -z "<prompt>" -m tencent/hy3:free --provider nous
  --skills master-instructional-design -t file,web --safe-mode < /dev/null`.
  Always redirect stdin — a detached/backgrounded call with no stdin attached
  can stall waiting on input. **Model is pinned to `tencent/hy3:free` via
  `-m`/`--provider`** (verified working, and the only model this Nous free-tier
  account is confirmed to have — `hermes model`'s live picker and the Portal
  dashboard are the only ways to see alternatives, both off-limits without
  re-auth). Do not drop the pin: an un-pinned call falls back to account
  default, which can silently drift if Portal's free-tier offering changes.
  The historical 12–15 min zero-CPU freezes were NOT reproduced in this
  investigation — if a true multi-minute freeze recurs on a strictly
  sequential, `< /dev/null`, `timeout`-wrapped call, that's a distinct,
  unexplained failure mode, not this one. Full isolation matrix in
  `.claude/skills/hermes-delegate/SKILL.md`.
- **OpenCode free tier: sequential calls only, same fragility as Hermes.**
  - No default model — a bare `opencode run` errors. Always pass
    `-m opencode/x-preview-f-free` — shown in the OpenCode TUI as
    **"Ox Alpha Free (Unlimited)"** (opencode's own free tier; separate from
    `GEMINI_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY`, needs no auth).
    Set 2026-08-21, replacing `opencode/hy3-free`.
  - The TUI shows display names, `opencode models` shows IDs, and they do not
    match. Resolve a display name to its ID via `models.dev/api.json` under the
    `opencode` provider before assuming a model is missing.
  - Defaults to the `build` agent, which can wander into grepping/reading files
    or making web calls instead of answering directly — this burns the run
    against a ~90s timeout with no JSON produced. For research-lane calls,
    explicitly instruct: "Answer directly from your own knowledge, do NOT read
    or search any files."
  - `opencode-delegate` skill (`.claude/skills/opencode-delegate/`) is for
    code-implementation delegation with diff review/commit — wrong shape for a
    single-JSON research answer. Call `opencode run` directly instead.
- **Antigravity has no headless CLI.** Cannot be a swarm worker. Trainer-guide
  PDF generation (80-generation) is manual — owner runs it in the Antigravity
  IDE from a Claude-authored prompt (`80-generation/antigravity-trainer-guide-prompts.md`).
- **Codex:** `codex exec --skip-git-repo-check "<prompt>" < /dev/null`, run from
  vault root.

## Pipeline decisions already made

- Level 1 only, 6 sessions (L1-s1..s6). Stop before `80-generation` (NBLM) — owner
  wires NBLM MCP separately when that stage is reached.
- Localization (Arabic) is Claude-only. No other provider writes Arabic, ever —
  they're materially weaker at Egyptian-colloquial register.
- Research clusters (30-research) are derived from R0 `missing[]`/`delta[]`
  fields — never guessed. Current set: T01 (differentiation), T02 (assessment),
  T03 (answer-key conventions), T04 (MakeCode block/API reference), T05
  (unit pedagogy / Brain OS rubric alignment).
- Codex is the preferred reviewer for judge/refuter-flavored work — demonstrated
  strength using `/master-instructional-design`. Route S4 review work to it when
  possible.
- One writer per file, never one writer per folder — fan-out lanes write to
  non-intersecting paths (`_lanes/<cluster>/<provider>.json`,
  `<stage>/<session>/<provider>.json`).

## R0 provenance schema (20-provenance/*.md)

Required fields, exact names: `id`, `source`, `upstream_url`, `upstream_title`,
`confidence` (high|medium|low), `license`, `delta: {added, dropped, altered}`,
`missing: []` (fixed vocabulary: `learning_objectives`, `teacher_notes`,
`assessment`, `answer_key`, `differentiation`), `recoverable: []` (URLs). A
generic "claim verification table" is NOT this schema — check before writing.

## Research/critique claim schema (lane JSON files)

```json
{"cluster":"<ID>","provider":"<name>","claims":[{"claim":"<one sentence>","source":"<URL or MID:principle-name>","applies_to":["L1-sN", ...]}]}
```
Every claim needs a source. Uncited claims get dropped by `cite_filter.py` before
reaching the judge — don't bother writing them.

## Brand/output doctrine recovered (2026-08-20)

The academy doctrine source of truth is
`Abdeen_Moon_OS_Docs/Academy_Brain_OS/` in this vault.
It is now restated as a binding contract: `00-contracts/brand-and-output.md`.
**Read that contract before producing any artifact.** Key facts it settles:

- The L1-s1 deck failed because NBLM got ONE source (a text-only markdown).
  Doctrine requires SEVEN. That single omission caused all four reported
  defects: no logo, no TATA, no original course assets, passive video slides.
- New stage `75-bundle/<session>/` assembles the NBLM source bundle:
  `slides-source.md`, `home-summary.md`, `trainer-guide.md`, `decisions.md`,
  `SOURCES.md`, `assets/`. `70-localized` is never modified — the bundle
  derives from it.
- Renderer routing: **NBLM** = student slide deck + student summary deck
  (3 slides/session, 2 for s7). **Antigravity** = Trainer Guide, one PDF for
  the whole level, manual owner-run. NBLM quota is scarce — do not spend it
  on the trainer guide.
- Trainer Guide is mandatory and comes FIRST; the student deck consumes it
  as a source.
- TATA has four documented states with defined triggers. Missing TATA is a
  defect; TATA on every slide is also a defect. Target ~40% of slides.
- Interaction law (EthOS v2 addition): a video/link-only slide is a defect.
  Video URLs live in the Trainer Guide only.
- The 30/70 Arabic rule originates here, not in EthOS. Confirmed kept.

## Gate scoping (2026-08-20)

`scripts/swarm/prepare.py` now preprocesses before gates run:
- strips YAML frontmatter, NBLM render directives (`- **TATA:**`,
  `- **Asset:**`), blockquoted rendering rules, and provenance tails
- classifies artifact audience from frontmatter and runs only the gates that
  apply (`arabic-ratio`/`trainer-boundary` are student-only)
- gates that do not apply are recorded UNVERIFIED, never silently dropped

Without this, arabic-ratio measured asset filenames and read 26% on a file
whose actual prose is 60%. Gate names are **hyphenated** (`arabic-ratio`,
`trainer-boundary`, `brand-palette`, `cite-filter`) — underscore names are
"gate not registered". `brand-palette` on a markdown source is legitimately
UNVERIFIED; palette is checkable only on rendered output.

## NotebookLM ingestion (2026-08-20)

The `notebooklm` MCP exposes `add_source_text` and `add_source_url` only — **no
file upload**. That is a wrapper gap, not a capability gap. The CLI does it:
`notebooklm source add -n <id> --type file <path>` (same auth/profile).

Images reach slides by being uploaded as sources AND named per-slide in the text
package (`- **Asset:** img-NN.png`). NBLM places them at generation time. Owner
confirmed — he built a package-prep tool on this mechanism before.

Never degrade to a text-only generation because the MCP lacks an upload tool.
That reproduces the original L1-s1 failure. Check the CLI first.

CLI and MCP both inherit `VIRTUAL_ENV` from the cwd; run from the server dir or
pass `--active`, or the vault `.venv` shadows the server env.
