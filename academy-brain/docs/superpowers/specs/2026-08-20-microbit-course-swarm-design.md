# Micro:bit Course Rebuild — Cross-Provider Agentic Swarm Design

**Date:** 2026-08-20
**Vault:** `D:\vault\Microbit`
**Status:** Approved design, pending implementation plan

---

## 1. Goals

Two goals of equal weight:

1. **Product.** Rebuild the Techno Square Micro:bit course (Level 1 + Level 2) from existing material, improving both content accuracy and pedagogy. Not a re-skin — a genuine content upgrade.
2. **Capability.** Owner learns cross-provider agentic swarm (Claude + Codex + OpenCode + Hermes), as opposed to single-provider swarm which he already does.

### Non-goals

- Owner does not learn micro:bit and will not review curriculum content.
- No per-session trainer guides (superseded — see §4).
- Not building a general-purpose course generator; this is one course.

---

## 2. Binding constraints

These are stated by the owner and override design preference.

**C1 — Owner is not a domain reviewer.** He does not understand micro:bit and does not intend to. No gate, checkpoint, or approval may depend on him catching a pedagogy or technical error. He can judge two things: swarm behaviour, and the visual/aesthetic quality of final decks.

**C2 — Minimal interaction.** The pipeline runs to completion unattended. A design requiring babysitting is a failed design — his existing manual workflow (ask Opus/Gemini, then ask Codex to review) is strictly better than a swarm that needs supervision.

**C3 — Token efficiency.** Cost matters; waste is a defect.

**C4 — Brain OS is law.** `Abdeen_Moon_OS_Docs/Academy_Brain_OS/` defines age, language, branding, QA, and output rules. Agents read it; they do not override it.

---

## 3. Scope

14 sessions: Level 1 × 7, Level 2 × 7.

| Source state | Detail |
| --- | --- |
| L1 | 6 × `session-N.pptx` + 6 × `session-N(summery).docx` on disk. Session 7 is net-new. |
| L2 | 5 × topic-named `.pptx`, no summaries, no numbering. Sessions 6 and 7 are net-new. |

**Provenance hypothesis (to be confirmed by stage R0):** the L2 filenames (`musical-algorithms`, `musical-gestures`, `controlling-music-with-inputs`, `programming-debugging-music`, `evaluating-micro-bit-music`) match the published microbit.org "Music" unit of work near-verbatim. If confirmed, the material is an unlocalised upstream lift, and the primary improvement opportunity is recovering the teacher-facing pedagogy Techno Square dropped during the lift.

**Capstone rule:** session 7 of both levels is a fixed project + assessment session. L2 session 6 is derived by agents from the upstream unit gap.

---

## 4. Output artifacts

| Artifact | Count | Producer | Notes |
| --- | --- | --- | --- |
| Session deck | 14 | NBLM MCP via Claude | NBLM caps at ~21 slides/generation → split and merge |
| Home Summary | 14 | NBLM MCP via Claude | 3 slides/session, session 7 = 2 → **20 slides per level** |
| Trainer guide | 2 | Antigravity (manual, owner-run) | **Per level**, PDF, Techno Square theme. No headless CLI — owner runs it by hand in the Antigravity IDE from a Claude-authored prompt. |

**Change from the AI course pipeline:** trainer guide moves from per-session to per-level PDF; Home Summary is added as a per-session student take-home.

**Home Summary format is already specified** in `Techno_Square_QA_Checklist.md` and is not to be reinvented. Required sections: `Today I Learned`, `New Words`, `Review at Home`, `Parent Talk`, `Mini Activity`.

**Generation (S6) is deferred** until all 14 sessions clear QA. NBLM MCP is not currently wired; the owner wires it when S6 is reached.

---

## 5. Providers and roles

| Stage | Owner | Rationale |
| --- | --- | --- |
| DIGEST | `digest_office.py` + Codex gate | Mechanical; LLMs add nothing to XML extraction |
| PROVENANCE | Hermes | Web toolsets; proven in this role on the AI course |
| RESEARCH | Hermes + Codex + OpenCode (3-way) | Different providers surface different sources |
| REFINE | Codex + OpenCode + Hermes (3-way) | Highest-judgment stage; Claude excluded so the judge is not also a contestant |
| JUDGE / REFUTE | Claude | Does not compete in the stages it judges |
| QA | Haiku + deterministic scripts | Checklist is pass/fail, not opinion |
| LOCALIZE | Claude only | Only provider trusted with Egyptian-colloquial Arabic |
| GENERATE | NBLM via Claude; Antigravity (manual) for trainer-guide PDFs | Renderers, not reasoners. Antigravity has no headless CLI — owner runs it manually from a Claude-authored prompt |

Claude is deliberately excluded from **both** fan-out stages because it performs the merge and the judging. A provider must not both compete and adjudicate in the same stage. With no human domain review (C1), the judge is the load-bearing component of the quality model and must be impartial. Claude's pedagogical strength is applied at JUDGE, REFUTE, and LOCALIZE instead.

### Language policy — language-neutral swarm

Brain OS mandates literal **30% English / 70% Arabic**, Egyptian colloquial, simple register, RTL-correct.

Codex, OpenCode, and Hermes are materially weaker at colloquial Egyptian Arabic than Claude. Therefore **Arabic never enters the swarm.** All fan-out stages operate in structured English — pedagogy, sequencing, critiques, citations. A single Claude localisation pass (S5b) converts approved English content into 30/70 bilingual copy, gated by `arabic_ratio.py`.

This removes the weakest link rather than scoring it, and keeps the 3-way fan-out honest.

---

## 6. Quality model

C1 means quality must be machine-owned end to end. Three mechanisms substitute for the absent human domain review.

### 6.1 Provenance-bound claims

Every change proposed in REFINE must cite a source: a microbit.org lesson, a MakeCode API doc, a Brain OS rule, or a `master-instructional-design` principle. Uncited changes are rejected by `cite_filter.py` before reaching the judge.

```json
{
  "loc": "slide-7",
  "severity": "high",
  "type": "pedagogy",
  "problem": "flashing introduced before predict step",
  "fix": "insert predict-then-run beat",
  "cites": ["microbit.org/teach/units/music#lesson-2", "MID:predictive-questioning"]
}
```

Agents may reorganise freely. They may not invent curriculum. This is the property that makes an unsupervised pipeline safe: the swarm cannot drift somewhere no source supports.

### 6.2 Adversarial verification

The judge selects and merges; a separate **refuter** agent then attacks each accepted high-severity change on four axes: wrong age band, contradicts Brain OS, misreads the MakeCode API, or not actually present in the cited source. Only survivors land in `60-approved/`.

The refuter is stricter on capstone sessions, which have no upstream source.

### 6.3 Deterministic gates

Model opinion cannot be the final check on rules that are mechanically checkable. Scripts enforce: Arabic ratio, one-idea-per-slide, Tata usage, trainer/student boundary, brand palette, RTL arrow integrity, OCR duplication.

### 6.4 Documented blind spots

Inherited honestly from EthOS. OCR **cannot** detect: a missing connector arrow in a flow diagram, an unlabelled blank placeholder box, or duplicated diagram nodes. These are visual-only defects. The owner's aesthetic review (G3) is the sole control covering this class — it is not ceremonial.

---

## 7. Autonomy policy

### 7.1 Human gates

Exactly one, plus one wiring task:

- **G3 — final deck aesthetics.** The only human gate. Covers the §6.4 blind-spot class.
- **NBLM wiring** before S6. Owner's task, deferred by design.

Topology approval and pilot approval are removed. The pilot gates itself: pass → automatically fans out to the remaining 13; fail → escalates.

### 7.2 Self-repair loop

Extends EthOS's verdict loop (`detect → classify → act same turn`) for unattended operation:

```
gate FAIL
  → classify cause
      prompt/parameter  → regenerate with named fix, retry (max 3)
      source-content    → re-run prior stage, retry (max 2)
      external limit    → apply known workaround, retry
      needs judgment    → ESCALATE
  → retries exhausted   → ESCALATE
```

Retry budgets are capped so a malformed prompt cannot loop indefinitely.

### 7.3 Escalation triggers

The swarm interrupts the owner on exactly four conditions:

1. **Systematic failure** — the same gate fails across ≥3 sessions, indicating a faulty rubric or prompt rather than faulty content.
2. **Provider outage** — 2 of 3 lanes dead on a session. One dead lane is tolerated; the swarm continues on two.
3. **Legal ambiguity** — a session's licence cannot be determined and the material is clearly derived.
4. **Capstone invention** — the refuter rejects a capstone change with no valid source and no alternative found.

All other conditions are decided by the swarm and logged. Silence means progress.

### 7.4 Audit trail

`90-receipts/` makes review optional and retrospective rather than blocking:

- every accepted change with its citation (spot-checkable by following a link, requiring no micro:bit knowledge)
- gate verdicts per session: `PASS` / `FAIL` / `UNVERIFIED` — never silently omitted
- lane divergence log (where the three providers disagreed)
- token spend per stage
- every escalation and its resolution

Plus a single final report: what changed, what was recovered from upstream, what was invented, what could not be verified.

---

## 8. Vault contract

The vault is optimised for agents, not humans. Flat, stage-numbered, path-derivable from `{level, session}` without searching.

```
D:\vault\Microbit\
├── 00-contracts\          frozen after S0; read by all
│     context-pack.md          distilled Brain OS: age, language, brand, Tata
│     rubric.md                derived quality rubric — the judge's law
│     output-strategy.md       Course Output Strategy (mandated by Brain OS)
│     topology.md              machine-readable roles + ownership
├── 10-digest\             script-written
│     L1-s1.md … L2-s7.md
│     _assets\L1-s1\img-01.png + manifest.json
├── 20-provenance\         Hermes
├── 30-research\
│     _lanes\T01\{hermes,codex,opencode}.json
│     T01.md … T06.md         merged
├── 40-critique\
│     L1-s1\{codex,opencode,hermes}.json
├── 50-patch\              judge output: merged change-set
├── 55-refuted\            refuter verdicts
├── 60-approved\           canonical English content, post-QA
├── 70-localized\          bilingual 30/70 — Claude only
├── 80-generation\         NBLM prompts, Antigravity trainer-guide prompts (manual), rendered output
└── 90-receipts\           gate verdicts, token accounting, divergence, escalations
```

Read-only sources, never written to: `Abdeen_Moon_OS_Docs\`, `Techno Square identity\`, `Micro Bit-20260723T182752Z-1-001\`.

**Naming:** `L{1|2}-s{1..7}` (14 IDs). Topic clusters `T01..T06`. No spaces.

### 8.1 Ownership rule

**One writer per file — never one writer per folder.**

Fan-out stages write to separate lane files whose paths do not intersect:

```
40-critique/L1-s3/codex.json     only Codex writes
40-critique/L1-s3/opencode.json  only OpenCode writes
40-critique/L1-s3/hermes.json    only Hermes writes
50-patch/L1-s3.md                only the judge (Claude) writes
```

Three providers run concurrently with zero locking. Merging is a separate stage with a single owner. This satisfies ruflo's own concurrency rule (explicit file ownership, never two writers in one scope) without needing a git worktree per agent.

### 8.2 Handoff schema

Frontmatter is the message envelope — this is what makes the vault a bus rather than a folder.

```yaml
---
id: L1-s3
stage: critique
owner: codex
status: complete          # pending | complete | failed | gated
inputs: [10-digest/L1-s3.md, 20-provenance/L1-s3.md, 00-contracts/context-pack.md]
reads_allowed: [00-contracts/**, 10-digest/L1-s3.*, 20-provenance/L1-s3.md, 30-research/T0*.md]
gate: {name: critique-schema, verdict: PASS}
tokens: 8420
run: wf_abc123
---
```

`reads_allowed` makes agent scope declared rather than discovered — the primary token-efficiency lever. An agent reads one session's files plus the frozen contracts. Never the vault. `00-contracts/**` always includes `agent-memory.md`, the shared second-brain for every provider on this job — provider quirks, pipeline decisions, and schema gotchas already learned. Every dispatch prompt should point at it explicitly, not rely on agents to find it inside `00-contracts/**` unprompted.

### 8.3 Single source of truth

The vault is truth. Ruflo memory is an **index only** (stage state, embeddings for similarity lookup). On disagreement, the vault wins and the index is rebuilt from it. The same rule binds Hermes's `memory-graph`: scratch within a run, never authoritative. Without this, five providers desynchronise within a few sessions.

---

## 9. Stage specification

### S0 · CONTRACT — 1 run, Claude, blocking

Reads all 12 Brain OS files, the AI course vault's existing rubrics, and `master-instructional-design`. Writes and freezes `00-contracts/`.

**Rubric derivation.** Source rubrics in the AI course vault (`07-RESEARCH/Arabic Content Quality Assessment.md`, `08-REFERENCE/Session Assets/Session 9/S9 Completion Rubric.md`) target an adult audience. Adaptation is dimension-by-dimension, not simplification:

| Dimension | Adult (AI course) | Kids (Micro:bit) |
| --- | --- | --- |
| Slide density | one concept + 2–4 points (DEC-023) | **one idea per slide**, strict |
| Tata mascot | beat-markers only (DEC-021) | **full 4-state**, still not every slide |
| Examples | role/profession-calibrated | age-calibrated, concrete, physical |
| Visuals | real screenshots | colourful, child-friendly, icons and arrows |
| Arabic | 30/70 literal | 30/70 literal, simpler register |
| Take-home | Parent Talk dropped | **Parent Talk restored** |

Target age is read from Brain OS, not assumed.

Because C1 forbids owner validation of the rubric, S0 terminates with an **adversarial rubric review**: a **Codex** agent (deliberately not the Claude agent that authored it) attacks the rubric for contradictions with Brain OS and for criteria that cannot be objectively scored. Unresolved contradictions escalate under §7.3 trigger 1. This replaces human sign-off.

### S1 · DIGEST — script, ~0 LLM tokens

`digest_office.py` walks 11 `.pptx` and 6 `.docx`. Per session extracts: title, slide text, speaker notes, and every image from `ppt/media/` into `_assets/` with a manifest (source slide, dimensions, alt-text candidate). Codex gates: full slide coverage, no empty extractions, no orphaned images.

Images are preserved at full fidelity before any LLM touches the material.

### R0 · PROVENANCE — 14 runs, Hermes

Per session:

```yaml
id: L2-s1
source: microbit.org | MakeCode | BBC | TS-original | unknown
upstream_url: ...
upstream_title: ...
confidence: high | medium | low
license: CC-BY-SA-4.0 | MIT | unknown
delta: {added: [], dropped: [], altered: []}
missing: [learning_objectives, teacher_notes, assessment, answer_key, differentiation]
recoverable: [urls...]
```

`missing` is the highest-value field in the pipeline: it enumerates the pedagogy dropped when the upstream unit was lifted. It feeds REFINE directly.

Research targets: `microbit.org/teach` (units of work, lesson plans, teacher guidance), `microbit.org/projects`, Microsoft MakeCode "Intro to CS" curriculum, MakeCode block/API reference, microbit.org accessibility guidance.

Attribution note: microbit.org owns the teaching material (Micro:bit Educational Foundation); Microsoft owns MakeCode; the BBC owns original 2016 launch material. Three sources, three licences.

### R1 / R2 · RESEARCH — N clusters × 3 lanes, then N merges

Clusters are derived from R0 output, not guessed. Sessions share fundamentals, so research is per-topic rather than per-session. **N is expected to be 5–7 and is capped at 8**; cost figures in §13 assume N = 6. If R0 yields more than 8 candidate clusters, they are merged down to 8 before fan-out rather than expanding the budget.

Merge is **union plus dedup by claim** (Haiku), not adjudication — there is no contest, so no self-judging problem. Disagreements between lanes are preserved and flagged rather than resolved; REFINE resolves them with session context.

### S3 · REFINE — 14 sessions × 3 lanes

Each provider reads digest + provenance + relevant clusters + contracts, and returns **structured JSON critiques, never prose rewrites**. Output volume drops roughly 60% versus full rewrites, and the judge — the most expensive agent — reads short issue lists rather than three full documents.

`cite_filter.py` drops uncited items before the judge sees them.

### S4 · JUDGE + REFUTE — 14 judge runs + ~10 refuter runs

Judge (Claude) reads the three critique lists, scores against `rubric.md`, and emits one merged change-set to `50-patch/`. The refuter then attacks accepted high-severity changes per §6.2. Survivors land in `60-approved/`.

Lane divergence is logged to `90-receipts/` — both the swarm-learning artifact and a map of where the original material was weakest.

### S5 · QA — 14 runs, Haiku + scripts

Deterministic gates run first, then the Brain OS checklist. Verdicts are `PASS` / `FAIL` / `UNVERIFIED`; a gate that could not be checked is `UNVERIFIED`, never silently omitted. Failures enter the §7.2 self-repair loop and are acted on in the same turn, never batched for a later cleanup pass.

### S5b · LOCALIZE — 14 runs, Claude only

Approved English content becomes 30/70 bilingual copy. Gated by `arabic_ratio.py`.

### S6 · GENERATE — deferred

Runs only after all 14 sessions clear S5, and only after the owner wires NBLM MCP. Session decks and Home Summaries via NBLM; trainer guides via Antigravity, run manually by the owner from a Claude-authored prompt (Antigravity has no headless CLI). The ~21-slide NBLM cap requires split-and-merge for session decks; the 20-slide Home Summary fits a single generation.

### Capstone handling

L1-s7 and L2-s7 have no digest input. They enter at S3 with a capstone brief (project + assessment) rather than extracted material. L2-s6 is derived from the upstream gap identified in R0.

---

## 10. Orchestration

**Ruflo holds coordination; EthOS v2 holds doctrine.** The split is strict:

- **EthOS v2 answers "what is correct?"** — gates, rules, verdict loop, brand and language law, stage contracts. It never decides scheduling.
- **Ruflo answers "what runs next?"** — spawning, parallelism, memory, hooks, handoffs. It never decides quality.

Without this split, "full-pipeline successor" produces two competing conductors.

### Topology

Hierarchical (queen-led), not mesh — stages are ordered and gated, and peer negotiation makes gates leaky.

```
queen (hierarchical-coordinator)
 └── stage coordinator        one per stage, owns that stage's gate
      └── workers             one per session, or per session × lane on fan-out
```

- `swarm_init` (hierarchical) at S0
- `memory_store` after each gate → stage index
- `hooks` post-edit → gate scripts fire on write, not on agent goodwill
- `task_*` → 14-session progress board
- Concurrency cap ~12

**Failure policy.** A failed lane does not block its session (2 of 3 is a valid fan-out; 1 of 3 escalates). A failed gate does block — that is a gate's purpose.

Ruflo's control flow is model-driven, which creates a risk that an agent skips a gate. Mitigated by binding gates to write-hooks rather than to agent compliance.

### Provider adapters

| Provider | Invocation | Adapter skill |
| --- | --- | --- |
| Codex | `codex exec` | `codex-delegate` (installed) |
| OpenCode | `opencode run -m <model>` | direct CLI call (`opencode-delegate` skill is for code-implementation delegation with diff review, not a fit for single-JSON research lanes — invoked directly instead) |

Codex requires a trusted git directory; invoke as `codex exec --skip-git-repo-check "<prompt>" < /dev/null` from the vault root. Verified working 2026-08-20.

OpenCode has no default model — a bare `opencode run` errors — so every call passes `-m opencode/hy3-free` (opencode's own free-tier model, no separate API key needed, distinct from `GEMINI_API_KEY`). Free tier is fragile under load like Hermes's Nous Portal tier: **sequential calls only, never parallel.**
| Hermes | `hermes -z "<prompt>" --skills … -t …` | **`hermes-delegate` (must be written)** |

Hermes is installed at `C:\Users\ET\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes` and supports non-interactive `-z`, `--skills`, `-t` toolsets, and provider/model selection.

`hermes moa` (Mixture-of-Agents) is deliberately **not** used: it hides divergence inside a single call, defeating the cross-provider comparison this project exists to produce.

Every adapter obeys one contract: read only `reads_allowed`, write exactly one lane file, emit a token receipt. That uniformity lets ruflo treat four different CLIs as interchangeable workers.

---

## 11. EthOS v2

Location: `D:\vault\Microbit\.claude\skills\ethos-v2\`

```
ethos-v2/
  SKILL.md              trigger, pipeline map, verdict loop, hard rules
  references/
    stage-contracts.md    per-stage input/output/gate definitions
    kids-track-rules.md   adult→kids reversals, explicit
    qa-gates.md           each gate: what it catches, what it cannot
    generation.md         NBLM specifics + Antigravity manual trainer-guide workflow, 21-slide workaround
  scripts/                deterministic gates
```

**Retained from EthOS** (each earned through a real production failure):

- Diagnose-before-produce: state target and sources before invoking any generator.
- QA verdict loop: `PASS` / `FAIL` / `UNVERIFIED`, classify every failure by cause, act in the same turn, never batch defects.
- Do not generate on invocation alone; require an explicit target.
- Documented blind spots (§6.4) stated honestly rather than papered over.

**Reversed for the kids track:** see the table in §9 S0, plus trainer guide per level and Home Summary added.

**Brand palette carries over unchanged:** `#231F20` near-black, `#FFED10` yellow, `#585858` grey, white. The retired `#F5B301` gold is a FAIL condition.

---

## 12. Scripts

| Script | Status | Responsibility |
| --- | --- | --- |
| `digest_office.py` | new | pptx/docx → markdown + images + manifest |
| `arabic_ratio.py` | port from `preflight_check.py` | 30/70 language ratio enforcement |
| `cite_filter.py` | new (~30 lines) | drop uncited critique items before judging |
| `qc_deck.py` | port | OCR duplication; `shared_clause()` ≥18 chars |
| `boundary_check.py` | new | detect trainer-only content in student output |
| `gate_runner.py` | new | execute gates, write verdicts to `90-receipts/` |

Ports come from `D:\vault\Dr mahmoud AI course\08-REFERENCE\Brand Assets\`.

---

## 13. Cost

| Stage | Runs |
| --- | --- |
| S0 contract + adversarial rubric review | 2 |
| S1 digest (script) | ~1 |
| R0 provenance | 14 |
| R1/R2 research (6 × 3 + 6 merges) | 24 |
| S3 refine (14 × 3) | 42 |
| S4 judge + refute | 24 |
| S5 QA | 14 |
| S5b localise | 14 |
| **Total (pre-generation)** | **~135 runs ≈ 2.4M tokens** |

Estimates carry roughly ±40% variance until measured on the pilot session.

**Comparison:** unoptimised hybrid ≈ 4.75M; full three-way fan-out on all stages ≈ 9.5M; single-owner-per-stage with review gate ≈ 3.2M. The optimised hybrid is cheaper than the single-owner design while retaining three-way fan-out on the two stages where judgement matters.

**Efficiency levers applied:** script-based extraction; topic-clustered rather than per-session research; critique-mode rather than rewrite-mode refinement; frozen context-pack exploiting prompt caching; Haiku on mechanical stages; declared `reads_allowed` scope; resume rather than re-run.

---

## 14. Build order

1. Write `hermes-delegate`; smoke-test all four CLIs for reachability.
2. Build and run `digest_office.py` across all 14 sessions (near-free; de-risks everything downstream).
3. Build EthOS v2 skill and the gate scripts.
4. Run S0: contracts plus adversarial rubric review.
5. Initialise the ruflo swarm and wire the topology.
6. Run the pilot (L1-s1) end to end. It gates itself: pass → automatic fan-out; fail → escalate.
7. Fan out the remaining 13.
8. Owner wires NBLM MCP; run S6; owner performs G3 aesthetic review.

---

## 15. Risks

| Risk | Mitigation |
| --- | --- |
| Ruflo's model-driven control flow skips a gate | Gates bound to write-hooks, not agent compliance |
| microbit.org content is CC BY-SA 4.0; share-alike and attribution likely bind the branded derivative | R0 captures licence per session before generation; escalates when undeterminable |
| NBLM MCP not wired | S6 blocked by design; owner wires it when reached |
| Capstone sessions have no upstream source — likeliest site of unsourced invention | Refuter applies stricter standards; unresolvable cases escalate |
| Visual defects invisible to OCR (missing arrows, blank placeholders, duplicated diagram nodes) | G3 human aesthetic review — the sole control for this class |
| Providers drift apart on shared state | Vault is single source of truth; ruflo memory and Hermes memory-graph are indexes/scratch only |
| A malformed prompt loops in self-repair | Retry budgets capped per cause class; systematic failure across ≥3 sessions escalates |
