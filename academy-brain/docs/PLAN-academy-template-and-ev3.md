---
type: plan
status: judged-draft
date: 2026-08-21
council: claude (lane), codex (lane, 2 runs), opencode (lane), hermes (no lane — timeout too short; cause since fixed)
judges: opus + codex
purpose: >-
  Turn this vault from a micro:bit course workspace into a reusable Techno Square
  Academy course template, archive the micro:bit content, and add an EV3 domain
  specialist agent so the owner never makes technical content calls.
---

# Academy course template + EV3 specialist — aligned plan

## Council record

| Lane | Outcome |
|---|---|
| claude | delivered |
| codex | delivered (2 runs, second superseded first) |
| opencode | delivered late (18 KB); its sandbox blocked shell calls, its file reads worked |
| hermes | **No lane delivered.** Recorded at the time as a 4th consecutive hang. That diagnosis was wrong: a later investigation (`agent-memory.md:52-72`) found real calls legitimately take 90–220s, so the 100–120s timeout in use killed them mid-run — indistinguishable from a hang. Fixed by `timeout 300` + `-m tencent/hy3:free` + `< /dev/null`, verified 8/8 sequential. Hermes was excluded from the council for a defect that was ours, not its. It is therefore eligible for the reviewer role assigned below. |

**Judging note.** Every checkable claim in the Codex lane was verified against the
real files before acceptance. All passed. Codex found two things the Claude lane
missed, both confirmed:

1. `scripts/swarm/check_assets.py:18` — the asset regex only recognises filenames
   starting `img`, `tata`, or `technosquare`. Course-specific, hidden in a regex.
2. **s8 bug.** `00-contracts/brand-and-output.md:105,126` defines s8 as a graduation
   session with no artifacts. `scripts/swarm/paths.py` accepts only s1–s7. The
   contract and the code disagree today.

**Correction to the Claude lane.** It claimed the vault is "~95% course-agnostic,
~7 lines of coupling." That was a literal-string grep result, and it under-counted.
Structural coupling also lives in `check_assets.py`'s regex, `digest_office.py`'s
PPTX-only ingest, `run_digest.py`, `scaffold_vault.py`, `rubric.md`'s dimensions,
the `ethos-v2` skill's own naming, and the s8 mismatch. Codex's position — that
"scripts are generic, folders are content" is **false** — is the accepted one.

The OpenCode lane added three accepted findings:
- `brand-and-output.md` §0 and §7 carry micro:bit *narrative* ("the L1-s1 generation
  attempt fed NotebookLM one source", "the micro:bit upstream decks are video-first").
  Neutralise the wording; keep the law.
- `generate_session.py` hardcodes `BRAIN_OS` to an absolute path in a *different vault*
  (`D:\vault\GPT_Behavior_Deconstruction_Vault\...`) while a local copy exists at
  `Abdeen_Moon_OS_Docs/`. Portability hazard.
- `30-research/T01` (differentiation), `T02` (assessment) and `T05` (unit pedagogy) are
  pedagogy, not micro:bit. Only `T04` is MakeCode-bound. Promote T01/T02/T05 to the
  template rather than archiving all five.

**Rejected.** OpenCode proposed a single vault holding every course, switched by an
`active_course:` pointer in `course.yaml`. Rejected: micro:bit and EV3 would share one
working tree and one set of stage directories, reintroducing exactly the coupling this
work removes, and muddying git history. Its *underlying* point is accepted though — the
owner is not a developer, so instantiation must be one command, not a git-template
ceremony. `scripts/new_course.py` satisfies that; the template repo is only where the
template lives, never something the owner operates.

OpenCode also called `75-bundle/L1-s1/` "the proof the template works." Rejected — the
receipt says `overall: FAILED` with ten blockers. Codex's framing (a *failed* worked
example, valuable as regression fixtures) is the accepted one.

**Nothing fabricated.** Every EV3 product claim in all three surviving lanes was
correctly marked as needing sourcing rather than asserted. No EV3 hardware, software,
or part fact is treated as known anywhere in this plan.

---

## 1. Separation verdicts

Three verdicts, not two.

### KEEP AS-IS — academy infrastructure, carries to EV3 unchanged
- `Techno Square identity/` — logo, TATA poses.
- `Abdeen_Moon_OS_Docs/Academy_Brain_OS/` — doctrine lineage, read-only, never copied per course.
- `gates/arabic_ratio.py`, `boundary_check.py`, `brand_palette.py`, `cite_filter.py` — academy/locale policy and generic provenance, no robotics content.
- The academy law inside `brand-and-output.md`: brand chrome, TATA state rules, 70/30 language law, student/trainer boundary, the **120-minute all-courses owner ruling** (`:107`), focused-source rule. (§0 and §7 narrate micro:bit history — reword neutrally, keep the law.)
- `30-research/T01`, `T02`, `T05` — differentiation, assessment, unit pedagogy. Course-agnostic. Only `T04` is MakeCode-bound.
- The owner rule in `agent-memory.md`.

### KEEP / GENERALIZE — reusable, but course assumptions are baked in
| File | What's baked in |
|---|---|
| `scripts/swarm/paths.py` | `SESSION_IDS`, session regex, levels `(1,2)`, sessions `1..7`, provider set. **Plus the s8 bug.** |
| `scripts/swarm/generate_session.py` | brand path; `BRAIN_OS` pointing at an absolute path in a **different vault** while a local copy sits in `Abdeen_Moon_OS_Docs/`; three pass keys; Arabic output flag; `"TechnoSquare microbit"` titles; bundle filenames; summary-asset heuristic |
| `scripts/swarm/check_assets.py` | `img|tata|technosquare` regex; source list fixed to two files |
| `scripts/swarm/digest_office.py` | PPTX/DOCX only — an ingest *adapter*, not the universal ingest path |
| `scripts/swarm/prepare.py` | fixed artifact names and directive vocabulary |
| `scripts/swarm/gate_runner.py`, `envelope.py` | generic; only their session-ID dependency needs config |
| `scripts/scaffold_vault.py`, `scripts/run_digest.py` | micro:bit source paths and session maps |
| `00-contracts/topology.md` | generate from config; provider ownership can change |
| `00-contracts/rubric.md` | adjudication mechanics are reusable; dimensions name MakeCode, T01–T05, and "ages 6–9" (which contradicts the 8–10 band the council set) |
| `.claude/skills/ethos-v2/` | doctrine is domain-free; the skill's own name and examples say Micro:bit |
| `75-bundle/_TEMPLATE-blueprint.md` | `kids-microbit`, MakeCode language, and owner-review wording that conflicts with the owner rule |

### EXTRACT BEFORE ARCHIVING — the debugging lab pattern

Caught by the owner at sign-off review. `brand-and-output.md:115` makes a deliberate
debugging segment academy law ("break the code on purpose, students fix it"), and
`_TEMPLATE-blueprint.md:140` gate D15 enforces it per session. So the **requirement**
survives the archive automatically. The **know-how does not** — it lives entirely in
`75-bundle/L1-s1/` slides 16–19 and `trainer-guide.md` Page 5, both of which §6 archives.
The template would carry "you must have a debugging lab" and nothing about how to build one.

Create `75-bundle/_TEMPLATE-debugging-lab.md` capturing the transferable design, which is
not obvious and would otherwise be re-derived from scratch:

- **Bugs are stated as observed symptoms, never as described faults.** The L1-s1 slides say
  "the name shows once then stops", "it shows `Hello!` not my name", "nothing shows at all" —
  never "the `forever` block is missing." Naming the fault destroys the exercise.
- **Predict before fix, every time.** Each bug slide ends with the same prompt
  (`اتوقّع الأول: إيه اللي غلط؟` — "predict first: what's wrong?"). Matches the
  predict-before-run rule at `brand-and-output.md:113`.
- **One failure mode per bug, escalating.** The three form a ladder from partial success to
  total failure: runs-but-stops (lifecycle: `on start` instead of `forever`) → runs-but-wrong-output
  (content: right structure, wrong string) → doesn't-run-at-all (scope: block loose outside the loop).
- **Fixed shape:** one intro slide + N bug slides, `tata_thinks` bound throughout
  (`brand-and-output.md:201` already binds that pose to debugging).
- **Trainer side:** a questions bank and expected trainer responses per bug (`trainer-guide.md` Page 5).
- **Hard verification rule** (`blueprint.md:126`): production must confirm each seeded program
  *actually reproduces its stated symptom*. An unverified seeded bug shows children fake
  debugging evidence. Non-negotiable, carries to EV3 unchanged.

Note this segment is load-bearing twice: `b-03`, the one slide that rendered correctly in the
entire failed run and already designated the evidence-region regression fixture in §5.3, **is
the bug-1 slide.**

### ARCHIVE — micro:bit course state
Populated contents of `10-digest/` … `90-receipts/`; `30-research/T04` + `_lanes/` + `clusters.md` (T04 is MakeCode-bound; the cluster set came from micro:bit deltas and must not seed EV3 — T01/T02/T05 are promoted, see above); `75-bundle/L1-s1/`; `80-generation/L1-s1/` and its prompt files; `docs/superpowers/specs/…microbit…`; `Micro Bit-…-001/`; `.tmp-visual-qa/`; the `_discover.py` / `_forensic.py` incident scripts.

### DELETE
`evidince/`, `test-results/`, `swap/`, `escalate/`, `Sessions`, and the junk files created by shell-quoting accidents.

---

## 2. Template mechanism — all three, distinct jobs

Both lanes converged independently:

1. **Git template repo** — stable code, contract schemas, gates, empty stage dirs, tests, brand pointers, `template_version`.
2. **Root `course.yaml`** — the single runtime manifest every script reads. Minimum: course id/name/slug; levels and sessions *including no-artifact sessions*; audience band; duration; language ratio; providers; brand and doctrine paths; renderer routing per artifact; pass definitions; source-bundle roles; gates per artifact; asset classes; specialist skill + knowledge roots; archive location. Vault root is **derived, never an embedded `D:\...`**.
3. **`scripts/new_course.py`** — copies scaffolding only, writes `course.yaml`, generates `topology.md`, runs a zero-network doctor, refuses a non-empty target, and never copies course content.

Why all three: a template repo alone clones the literals. A scaffolder alone stamps fresh hardcodes per course. Config alone has no packaging. Add `scripts/swarm/config.py` with `load_course(root) -> CourseConfig`; `paths.py` derives IDs from it instead of an import-time tuple.

**One course per vault instance.** Each course gets its own directory and its own stage
tree. The owner never touches git-template mechanics — `new_course.py` is the whole
interface.

Acceptance tests for instantiation: empty valid stage tree; session IDs come only from the seed; `rg -i "micro:?bit|makecode"` finds nothing in the new instance; generator dry-run resolves every source and spends zero quota; missing specialist evidence / blueprint verdict / asset mapping hard-stops before rendering.

---

## 3. What EV3 breaks

| Assumption | Verdict | Replacement |
|---|---|---|
| Headless code screenshots (Playwright → makecode) | **BREAKS** | `UNVERIFIED:` whether a browser-based EV3 editor exists — needs sourcing. Hybrid evidence pipeline below. |
| Two asset classes suffice | **BREAKS** | Four: `REFERENCE` (illustrative, renderer may redraw), `EVIDENCE` (exact, never redraw), `PHYSICAL_EVIDENCE` (academy-captured hardware proof), `PROCEDURAL_SEQUENCE` (ordered build steps, order + continuity gated) |
| Assets are digital-native | **BREAKS** | Physical robot photos. Owner shoots to an agent-written shot list (object, angle, state, background, scale reference, filename). Agents crop, label, map, validate, place. |
| PPTX ingest is the ingest path | **BREAKS** | `digest_office.py` becomes one adapter; EV3 needs PDF / build-sequence / image-folder adapters preserving page/step/frame identity |
| No hardware variance | **BREAKS** | Ports, motors, sensors, and *which kit the academy owns* are sourced facts, never inferred |
| NotebookLM is the renderer | **BREAKS — it is config, not law** | Run a capability spike on one evidence-heavy EV3 pilot. If it cannot preserve ordered visuals and exact placeholders, route student slides to a deterministic slide compositor and keep NBLM only where it demonstrably passes. |
| Pipeline stages 10→90 | HOLDS | domain-free |
| Brand / language / TATA / palette / 120-min | HOLDS | academy-level |
| 7-source NBLM bundle | HOLDS | `brand-and-output.md` §1 row 6 already says "key **robot**/project images" — Abdeen wrote it for a robotics academy, not for micro:bit |
| s1–s8 artifact schedule | **DO NOT CARRY** | make it manifest data; confirm per course |

New deterministic gates this implies: ordered-step continuity, required step count, duplicate/missing step IDs, evidence hash + path, source/license presence, placeholder coordinates, overlay completion. Ordered steps are exactly the OCR blind spot `ethos-v2` already documents (N steps ⇒ N−1 arrows, one direction).

---

## 4. EV3 specialist agent

**Both a doctrine skill and a callable subagent definition, generated from one neutral source.** A skill alone is not callable as an agent by codex/opencode; a Claude-only subagent definition is not readable by the other providers.

- `.claude/skills/ev3-course-specialist/SKILL.md` — operating rules, source hierarchy, citation policy, owned decisions, output schemas, uncertainty rules, QA checklist.
- `.claude/agents/ev3-specialist.md` — role, allowed reads/writes, required skill, inputs, outputs, stop conditions.

  **AMENDED 2026-08-22, lane D, after adversarial review.** The original wording said
  "provider adapters generated from one neutral definition". Built instead as a single
  file with no generator and no per-provider copies: all three providers are handed this
  exact path. Reason: a generator with one output is machinery guarding against drift
  that cannot occur while only one artifact exists — and a generator that emits three
  copies *creates* the drift risk it claims to prevent. Revisit when a provider
  demonstrably cannot consume this file, at which point the generator has a real job.
  `UNVERIFIED:` codex has read this file directly (2026-08-22); opencode has not yet
  been tested against it.
- `knowledge/ev3/` — `source-catalog.yaml` (URL/file, version/date, license, hardware+software applicability, confidence), extracted claim cards, applicability matrix, academy kit inventory, glossary, known-unknowns. **Model memory is never a source.** Official manufacturer material is the primary tier; academy observation proves the actual kit; third-party is supplementary and needs provenance review.

**Owns:** prerequisite graph, terminology, technical objectives, build→program→test sequence, misconception list, troubleshooting tree, sourced safety notes, feasibility, evidence/shot requirements, technical acceptance criteria, technical critique and patch recommendations.

**Owns — and this is the highest-value single deliverable: the seeded-bug ladder.**
Following `_TEMPLATE-debugging-lab.md` (§1), design each session's debugging lab. EV3 makes
this materially harder than micro:bit and the specialist must handle both halves:
- **Code bugs** — the micro:bit-equivalent case.
- **Physical-build bugs** — motor in the wrong port, wheel mounted backwards, sensor aimed
  wrong, cable in the wrong socket. No micro:bit precedent exists for these. `UNVERIFIED:`
  which physical faults are safe and reversible for an 8–10-year-old to induce and undo —
  needs sourcing before any is used.
Each bug must still be expressible as an **observed symptom** ("the robot turns instead of
going straight") rather than a named fault, or the exercise collapses. Every seeded bug
requires a `PHYSICAL_EVIDENCE` capture proving it actually reproduces its stated symptom —
the `blueprint.md:126` verification rule, now with a hardware component.

**Does not own:** pricing, schedule, licensing exceptions, purchases, and it never takes a photograph.

**Returns machine-checkable files, not advice:** `30-research/<cluster>.md` + claim records `{claim, source_id, locator, applicability, confidence}`; `60-approved/<session>.technical.yaml`; `75-bundle/<session>/technical-decision-record.md` + the technical part of `ASSET-MAPPING.md`; `90-receipts/<session>.ev3-specialist.yaml` with a verdict per claim.

**Anti-hallucination — enforced, not promised:**
1. Every externally checkable EV3 statement carries `source_id` + exact locator. `gates/cite_filter.py` already drops uncited claims; point it here. Existing code, no new mechanism.
2. Unsettled detail ⇒ emit `NEEDS_SOURCING`. Never infer a part, port, block, limit, compatibility, or behaviour.
3. Applicability must match the configured inventory; mismatch or unknown ⇒ `UNVERIFIED`.
4. Generated diagrams may *explain* cited facts, never *establish* them.
5. Independent citation/sequence reviewer, then the existing `55-refuted/` refuter on high-severity calls. Deterministic gates run first, then visual, then physical verification.
6. Physical-outcome claims stay `UNVERIFIED` until an observation receipt links captured media.
7. The specialist never authors Arabic — `rubric.md` §5 already forbids non-Claude Arabic.

### Blocking conflict found in current code — must be fixed
`generate_session.py:169–177` (`enforce_blueprint_gate`) hard-stops unless the **owner** approved the blueprint, and hard-stops on every `GAP - owner must decide` marker. `75-bundle/L1-s1/blueprint.md` likewise reserves asset review for the owner. Both **contradict the standing owner rule** in `00-contracts/agent-memory.md`. The gate as written routes agent-resolvable technical decisions to a pharmacist.

Fix: replace the single owner gate with a typed approval —
`approval.kind: specialist_council` for technical/content decisions (satisfied by the specialist + refuter + reviewer), and only `approval.kind: owner_business` (genuinely undecidable business judgment) or `physical_action_required` (a photograph) may reach Dr. Refaat.

---

## 5. Porting last night's five root causes into the template

Sources: `90-receipts/L1-s1.production.yaml`, `80-generation/L1-s1/QC-REPORT.md`.

1. **Logo/TATA redrawn or wrong pose** → reclassify exact brand media from `REFERENCE` to `EVIDENCE`. Reserve fixed regions, overlay originals post-export, hash-compare sources, image-diff the overlay region, verify pose-to-trigger mapping. *Never rely on "preserve exactly" prompting as the only control* — it demonstrably failed.
2. **Literal HTML/Markdown on slides** (`<h2>`, `<div dir="rtl">`, `**forever**`, stray `*`) → a renderer-input linter that rejects raw tags and unsupported delimiters in visible copy; express formatting via a structured slide schema. Those four exact failures become its test cases.
3. **Fabricated / unlabelled / colliding evidence regions** → every exact asset row emits `[Reserved Image Area: <asset-id>]` with coordinates; validate one placeholder per asset, no overlap with TATA/logo/text, fail unless overlay completion is receipted. The one slide that worked (`b-03`) is the regression fixture. Extends directly to EV3 `PROCEDURAL_SEQUENCE`.
4. **Pass-B brand drift** → inject the compact brand constraints into **every pass's prompt text**, not merely as an uploaded source; render a small canary page before spending full quota; run palette/layout consistency gates per page and across pass boundaries. Failed canary or any drift blocks assembly.
5. **"Gemini Notebook" watermark** → a renderer-specific postprocessor that detects the mark region, crops, revalidates page dimensions, and **fails closed** if detection differs. Adapter-specific, not core doctrine. `UNVERIFIED:` whether a different EV3 renderer carries it — detection decides at runtime.

### 5b. Asset mapping — the reserved-region contract (raised by the owner, 2026-08-21)

The owner reported that the decks demanded images he does not have and cannot provide,
citing the debugging lab. **Investigated: the images exist.** `b-04` renders
`[Reserved Image Area: bug-2]`, and `img-20-bug2.png` is on disk (35,702 bytes, a genuine
headless MakeCode capture). All three `img-20-bugN.png` resolve.

So the real defect is worse than the one reported: **the pipeline reserved regions for
assets it already had, and then never composited them in.** The overlay step does not
exist. Reserving a region is half the job; the second half was never built. From the
owner's seat an empty dashed box is indistinguishable from a demand for content —
he has no way to know the file is already there. This is precisely the failure
`00-contracts/agent-memory.md`'s owner rule exists to prevent, and it reached him anyway.

Four fixes, all in the template:

1. **Build the overlay step.** After export, composite the mapped asset into every
   reserved region. `generate_session.py` **fails closed** if any region is still
   unfilled at the end. A `[Reserved Image Area: …]` box visible in a delivered artifact
   is an unfinished build, not a deliverable — it must never be reachable by the owner.
2. **Resolve missing assets BEFORE generating — never build, detect, regenerate.**
   (Owner ruling, 2026-08-21: "just don't build it in the first place.") NotebookLM quota
   is the scarce resource; a pass that generates and *then* discovers a hole has already
   spent a slot. The reconciliation is free if it runs before the prompt is written.

   At prompt-build time, `generate_session.py` reconciles the slide list against assets
   that actually resolve on disk, and for any slide whose asset is missing takes one of
   three paths **before** a single token is generated:
   - **redesign** — rewrite the slide so it does not need that asset, or
   - **substitute** — bind an existing asset that carries the same meaning
     (the `img-20-reuse` pattern: slide 11 reused the already-accepted `img-20.png`), or
   - **drop** — remove the slide and renumber.

   The slide never enters the prompt carrying a reference to something that does not exist.
   No empty region is generated, so none has to be detected, and no quota is spent twice.
   (`img-05-labelled` was the honest case: no real board photo with a battery connector
   exists anywhere in the digest pool, so its row was removed rather than shipped as a box.)

   Fix 1's fail-closed check stays, but demoted to a cheap final assertion — a backstop
   that should never fire once this pre-flight is correct, not the primary control.
3. **Derive asset status from disk, never from a hand-written field.** `ASSET-MAPPING.md`'s
   `Produced and mapped` column is hand-editable, and during the 2026-08-21 owner waiver
   every row was bulk-set to `Produced and mapped` — including rows that were not. The
   gate then passed a state that was not true. Status must be computed by `check_assets.py`
   at gate time from actual file existence; the written column becomes display-only.
4. **Separate "waive the review" from "assert the facts."** The owner may waive a quality
   gate — that is his call. A waiver must never be implementable as *editing the factual
   record* of what exists. Model the waiver as an explicit flag
   (`--waive-review`, recorded in the receipt), leaving asset facts untouched and audited.

Applied to EV3 this matters more, not less: `PHYSICAL_EVIDENCE` and `PROCEDURAL_SEQUENCE`
regions are numerous and genuinely may not exist yet — a physical photo cannot be conjured
mid-run the way a headless screenshot could. Every one must be resolved by the fix-2
pre-flight (redesign / substitute / drop) before generation starts, never emitted as an
empty box for the owner to interpret.

**Pre-flight order, cheapest first — nothing expensive runs until everything free has passed:**
`config load → blueprint gate → asset resolution on disk → slide/asset reconciliation
(redesign|substitute|drop) → prompt build → markup-leak lint → NotebookLM generation →
overlay → final assertion`. Every step before generation is local and free. Quota is
spent only on a plan already proven complete.

Also preserve the *process* that caught them: render every PDF to frames, inspect **all** frames not a sample, record PASS/FAIL/UNVERIFIED, classify by cause, repair in the same loop, and never hand the defect list to the owner.

**Scope ruling:** "fix last night's errors" does **not** mean regenerating micro:bit L1-s1. That course is cancelled. The value is only in the five controls above. Spending NotebookLM quota re-rendering a dead course is waste.

---

## 6. Archive plan

1. **Freeze first.** The worktree is dirty with unrelated changes. Identify and commit those separately, then tag/branch (`microbit-final` / `archive/microbit`). Move nothing before this.
2. Move course state to `archive/courses/microbit/2026-08-21/` preserving relative paths, with `ARCHIVE-MANIFEST.yaml` recording original path, archived path, SHA-256, size, provenance/licence pointer, and reason.
3. Keep `75-bundle/L1-s1/` with its outputs and receipts together as an immutable **`FAILED production example`**. It does *not* prove successful rendering — the receipt says `overall: FAILED` with ten blockers. It proves pipeline traversal and supplies regression fixtures.
4. Create a separate sanitized `examples/course-template/L1-s1/` with schemas and synthetic non-domain fixture assets. *This* is the live template proof and must pass dry-run and gates without touching archived micro:bit content.
4b. **Extract `75-bundle/_TEMPLATE-debugging-lab.md` before the archive move** (§1). Once `75-bundle/L1-s1/` is archived, the seeded-bug design reasoning is out of the template's reach and would be re-derived from scratch for EV3. This is a prerequisite of step 2, not a follow-up.
5. Leave an archive index, not symlinks (Windows portability). Remove archived paths from runtime discovery.
6. Verify by hash, run all template tests, instantiate an EV3 skeleton in a temp dir, dry-run the generator, then `rg` to prove the active runtime contains no micro:bit / MakeCode / T01–T05 literals.
7. **Never delete the archive.** Only after hash verification and version-control confirmation may micro:bit outputs be removed from the numbered working dirs.

---

## Execution order

- **A** — Freeze: commit unrelated dirt, tag, branch. Add the five root causes as regression fixtures. **Extract `_TEMPLATE-debugging-lab.md` before anything moves.**
- **B** — Extract: neutral contracts, `config.py`, config-driven `paths.py`. Fix the s8 bug and the `rubric.md` age-band contradiction here. Its public configuration/path API and consumer-contract tests must be **APPROVED** before C1 executor work starts.
- **C0** — OpenCode graduation lane: generalize only `check_assets.py` asset discovery against a frozen interface, using a small reversible diff and an objective fixture oracle.
- **C1** — One Claude-owned executor lane, in order: integrate B's approved API; replace `enforce_blueprint_gate` with typed approvals; add §5b reconciliation; add the post-export overlay and fail-closed unfilled-region check; run shared integration tests. There is no C2/C3 hand-off and no second writer on `generate_session.py`.
- **C4** — Neutralize remaining micro:bit-specific contract/template prose. It may start after A.
- **D** — Specialist: neutral definition, skill, provider adapters, `knowledge/ev3/` intake.
- **E** — Instantiate an empty EV3 course from the template.
- **F1** — Codex sources manufacturer/official EV3 facts now. Unsettled facts remain `NEEDS_SOURCING` or `UNVERIFIED`.
- **F2** — Inventory the physical academy kit only when a person can inspect it. This alone is `physical_action_required`: request only label text, quantities, and photographs of identifying labels, never robotics judgment.

  **Owner ruling, 2026-08-22: F2 is stood down.** Abdeen supplied a course PDF
  carrying the robot name and image, the code, and the lesson content, and the
  owner has ruled a physical kit inspection unnecessary. That PDF becomes a
  tier-1 source and is catalogued like any other.

  One limit is recorded rather than argued: a vendor document establishes what
  EV3 *is and does*, never what hardware is physically in this room. Claims that
  turn on "do we own this part, in this quantity" therefore stay `UNVERIFIED`
  with their source kept — they are sourced, just not confirmed for our kit. No
  other claim is blocked, and nothing is routed to the owner on this basis.

  **Owner ruling, 2026-08-23: the content PDF is ceiling, not floor.**
  `EV3 source/LV 1/EV3-L1_Source-Material_v1.0.pdf` is the exact truth for what
  this course teaches — the robot, the code, the images, the lesson content.
  Agents scope their claims, digest, and generation to what this PDF actually
  contains. They do not invent additional scope, harder objectives, extra
  builds, or "more complete" content beyond it in the name of thoroughness or
  creativity. A gap between what the PDF covers and what a more ambitious
  course might cover is not a defect to fix — it is the syllabus. The owner
  will resolve any real content question directly; agents must not manufacture
  blocking findings out of the PDF being narrower than some hypothetical ideal
  course. `EV3-L1_Trainer-Guide_v1.0.pdf` (same directory) is the paired
  trainer-facing draft and carries the same ceiling rule.
- **G** — One pilot session end-to-end through gates before scaling.
- **H** — *(opened 2026-08-22 by codex's review of lane D)* Build the EV3 validators the
  doctrine currently only promises: claim-card schema validation and source resolution,
  applicability matching against the kit inventory, physical-evidence receipt and hash
  checks, seeded-bug ladder validation, procedural-sequence continuity (unique steps
  `1..N`, exactly `N-1` transitions, one declared direction), localisation-authorship
  provenance, and typed approval routing. Until H lands,
  `.claude/skills/ev3-course-specialist/SKILL.md` §9 records every rule as NOT ENFORCED
  rather than claiming enforcement it does not have. H is gated on the EV3 content
  arriving — validating a schema nothing produces yet is premature.

Archiving happens inside **A**, before the refactor's fixtures exist only in archived form — hence step 4 of §6 creating the sanitized fixture is a prerequisite of **B**, not an afterthought.

## Execution split, review loop, and ownership

Three builders: **claude** (Opus, this session), **codex**, **opencode**. Only F2
may reach the owner because it requires inspection of physical academy property.
Everything else is agent-resolvable under `00-contracts/agent-memory.md`.

### Who builds what

The historical cause of OpenCode's failed shell call is **UNVERIFIED**. Settle it
by retaining the original stderr/session log and reproducing the original command
once without `--auto` and once with it while holding OpenCode version, model
(`opencode/x-preview-f-free`), agent, cwd, prompt, timeout, and environment constant;
record the exact permission request and result. Until then the plan asserts no root
cause for that historical failure.

| Step | Work | Builder | Why |
|---|---|---|---|
| **A** | Freeze: tag `microbit-final`, branch `archive/microbit`. Extract `_TEMPLATE-debugging-lab.md` before anything moves. | claude | Git surgery + doctrine authoring. Irreversible; single owner. |
| **B** | `config.py`, config-driven `paths.py`, fix the s8 bug. Keep `--self-check` + `pytest` green. | codex | Mechanical refactor with a hard test oracle. Codex's strongest shape. |
| **C0** | Generalize asset discovery only; no configuration wiring and no executor edit. | opencode | First real code lane: small, reversible, objectively tested. |
| **C1** | All `generate_session.py` work: config integration, typed approvals, reconciliation, overlay, final assertion, integration tests. | claude | One builder owns the coupled executor behavior end-to-end. |
| **C4** | Neutralize `brand-and-output.md`, `rubric.md`, and `_TEMPLATE-blueprint.md`. | opencode, after C0 approval | Disjoint text-only paths. |
| **D** | EV3 specialist: neutral definition, skill, provider adapters, `knowledge/ev3/` intake schema. | claude | Doctrine authoring + the anti-hallucination contract. |
| **E** | Instantiate an empty EV3 course in a temp dir and run the full proof below. | codex | Verification-shaped. Adversarial by nature. |
| **F1** | Manufacturer/official-source research with source locators and uncertainty. | codex | Agent-resolvable and can start now. |
| **F2** | Physical academy kit inventory only. | `physical_action_required` — owner/academy custodian | A person reads labels and counts hardware; agents interpret the observations. |
| **G** | One pilot session end-to-end through all gates. | claude, codex reviews | Full-pipeline judgment call. |

**Authoritative per-file ownership matrix.** These are the only source files these
lanes may edit. Every path appears once with one lane and builder. If a lane needs
another file, it stops until this matrix is amended before work begins; generated
temp-course files are E outputs, not source edits.

| File path | Owning lane | Owning builder |
|---|---|---|
| `75-bundle/_TEMPLATE-debugging-lab.md` | A | claude |
| `course.yaml` | B | codex |
| `scripts/swarm/config.py` | B | codex |
| `scripts/swarm/paths.py` | B | codex |
| `tests/test_paths.py` | B | codex |
| `tests/test_course_config.py` | B | codex |
| `scripts/swarm/check_assets.py` | C0 -> **C0-int** | opencode -> **claude** |
| `tests/test_check_assets.py` | C0 -> **C0-int** | opencode -> **claude** |
| `scripts/swarm/generate_session.py` | C1 | claude |
| `scripts/swarm/overlay.py` | C1 | claude |
| `pyproject.toml` | C1 | claude |
| `tests/test_overlay.py` | C1 | claude |
| `tests/test_generate_session.py` | C1 | claude |

**Amendment, 2026-08-22 — C0 reassigned to claude as C0-int (integration).**
Review iteration 2 found that the decisive defect (C0-08) could not be fixed
inside lane C0 at all: `asset_discovery` had to move into `scripts/swarm/config.py`,
which lane B owns. Two parsers for one file had drifted apart, and the CLI accepted
a section the canonical loader rejected. The matrix rule says a lane that needs
another lane's file must STOP, so the fix moved to the integration owner rather
than widening C0's scope. `config.py`, `paths.py` and their tests remain lane B's;
they were edited here only to add the validated `asset_discovery` field, and the
change was verified against every existing consumer.


**Amendment, 2026-08-22 — `expect_references` added to the course manifest.**
Review found that inferring misconfiguration from "no references but assets
exist" produces false failures: `assets/` legitimately holds helper scripts and
intermediate frames, and assets may be staged before a deck cites them. The
course now declares `asset_discovery.expect_references` and the gate enforces
only the declared policy. Lane E must set it when creating the EV3 manifest.

| `00-contracts/brand-and-output.md` | C4 | opencode |
| `00-contracts/rubric.md` | C4 | opencode |
| `75-bundle/_TEMPLATE-blueprint.md` | C4 | opencode |
| `.claude/skills/ev3-course-specialist/SKILL.md` | D | claude |
| `.claude/agents/ev3-specialist.md` | D | claude |
| `knowledge/ev3/intake-schema.yaml` | D | claude |
| `scripts/swarm/new_course.py` | E | codex |
| `tests/test_new_course.py` | E | codex |
| `knowledge/ev3/source-catalog.yaml` | F1 | codex |
| `knowledge/ev3/physical-inventory.yaml` | F2 | claude records owner/custodian observations |

The matrix eliminates the former C1/C2/C3 collision. A git worktree supplies branch
and merge isolation only; it does **not** isolate processes, credentials, network,
other worktrees, global configuration, or absolute filesystem paths. Delegated lanes
also require least-privilege credentials and OS-level filesystem/process/network
containment appropriate to the host.

### Required OpenCode lane configuration and graduation gate

Do not use `--auto` as a security boundary. C0 runs in a disposable worktree with
OS-level containment and this deny-by-default configuration; command patterns are
last-match-wins, so the catch-all deny is first:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "deny",
    "read": {"*": "allow", "*.env": "deny", "*.env.*": "deny", "*.env.example": "allow"},
    "glob": "allow", "grep": "allow", "list": "allow", "lsp": "allow",
    "edit": "allow",
    "bash": {
      "*": "deny",
      "git status": "allow", "git status *": "allow",
      "git diff": "allow", "git diff *": "allow",
      "git log": "allow", "git log *": "allow",
      "python --version": "allow",
      "python -m pytest": "allow", "python -m pytest *": "allow",
      "pytest": "allow", "pytest *": "allow",
      "python scripts/swarm/check_assets.py --self-check": "allow",
      "python scripts/swarm/generate_session.py --self-check": "allow"
    },
    "external_directory": "deny", "task": "deny",
    "webfetch": "deny", "websearch": "deny", "question": "deny"
  }
}
```

An allowed interpreter or test runner can execute arbitrary repository code, so the
permission layer is not containment by itself. OpenCode graduates only after C0
produces a reviewable diff and passes pre-authored fixtures for known assets,
declared-to-create assets, unknown names, missing source files, and paths outside the
bundle, followed by Codex `APPROVED`. Before that it receives no shared
infrastructure, Git surgery, permission work, executor work, or overlay work.

**E proof, not grep alone:** run `new_course.py`; validate configuration/schema;
import generated Python modules; run every relevant `--self-check` and full `pytest`;
run path-containment tests; assert semantic fixtures for session counts,
artifact/no-artifact sessions, language, renderer, bundle filenames, and provider
topology; then run `rg -i "micro:?bit|makecode"` over the generated course.

### The review loop

Every lane's output passes the same three rungs, cheapest first. A lane that fails
rung 1 never reaches a reviewer — no model time is spent on work the machine can
already prove broken.

| Rung | Reviewer | Catches | Cost |
|---|---|---|---|
| **1. Tests and gates** | neither model — `pytest`, `--self-check`, the markup-leak linter, `check_assets.py`, the fail-closed region check | everything mechanical: broken imports, regressed sessions, unfilled regions, leaked markup, missing assets | free, seconds |
| **2. Adversarial cross-model review** | a **different model** than the builder, using the independent oracle below | design errors, missed requirements, wrong file touched, requirement satisfied in letter but not spirit | one call |
| **3. Owner** | Dr. Refaat | **nothing in this section.** Reserved for `owner_business` and `physical_action_required` only. | — |

**Rung 1 is non-negotiable and runs first.** It is the only reviewer with no model
bias, and most of this work is scripts with a hard test oracle — the machine catches
more of it than either model will.

### Independent oracle and reviewer assignment — cross-model, never self

Before a builder starts, the assigned oracle author derives acceptance fixtures
directly from the contracts without reading the implementation. They include
negative/mutation cases for no-artifact sessions, unknown asset names, external
paths, and alternate renderer/language configurations; the builder may run them but
may not weaken them. Codex authors and commits the oracle before Claude/OpenCode
lanes; Hermes does so before Codex lanes. The oracle author verifies at final review
that the fixtures were neither removed nor made vacuous.

| Builder | Adversarial reviewer |
|---|---|
| claude | **codex** |
| opencode | **codex** |
| **codex** | **Hermes blind requirements review, then claude integration review** |

Codex is the primary reviewer: it earned that in the council round, catching the
asset regex coupling at `scripts/swarm/check_assets.py:18` and the s8 contract/code
contradiction that the claude lane missed.

**Codex does not review its own work — not even with fresh context.** Clearing a
model's context clears its memory, not its disposition: it keeps the same idioms,
the same API assumptions, and the same blind spots that produced the defect. It
reads its own style as correct because it *is* its style. Same-model self-review
systematically over-approves, and the defect class it cannot see is precisely the
one it just wrote. Codex lanes therefore receive a blind requirements review from
Hermes, which did not co-author this split; Claude reviews integration only and is
not the sole acceptor. OpenCode is not promoted to blind reviewer before C0 proves
real lane reliability; shell access alone is not that proof.

The blind reviewer plus pre-implementation contract fixtures provides an independent
check against a specification error copied identically into code and builder tests.

### Verdict protocol

The reviewer returns exactly one verdict, machine-readable, written to
`90-receipts/<step>.review.yaml`:

```yaml
step: C1
builder: claude
reviewer: codex
verdict: BLOCKED          # APPROVED | BLOCKED
rung1:                    # tests and gates, always recorded
  pytest: PASS
  self_check: PASS
findings:
  - id: C1-01
    severity: blocking    # blocking | advisory
    file: scripts/swarm/check_assets.py
    line: 18
    problem: <one sentence — the defect>
    failure_scenario: <concrete input/state -> wrong output>
    required_fix: <what must change>
```

Rules:

1. **`BLOCKED` if any blocking finding exists, or if rung 1 failed.** A reviewer may
   not issue `APPROVED` over a failing test — rung 1 is not waivable by verdict.
2. **The builder fixes and resubmits.** The lane loops: build → rung 1 → review →
   fix → rung 1 → review. It exits **only** on `APPROVED`.
3. **Every iteration reruns the complete non-waivable suite**, never a predicted
   subset. After the final fix, the reviewer performs a full-lane adversarial review
   of the complete diff, contracts, ownership matrix, oracle fixtures, negative/
   mutation cases, and all suite results. Advisories become named follow-ups.
4. **The loop has no iteration cap.** A step that cannot reach `APPROVED` is a
   design problem, not a budget problem — it escalates to a redesign of that step,
   not to the owner.
5. **Adversarial means adversarial.** The reviewer's job is to find what is wrong,
   with a default of skepticism: assume the work is broken until the diff and the
   tests show otherwise. "Looks fine" is not a review. A review with zero findings
   must state what was actually checked and how.
6. **Dependencies are per substep.** A → B → C1. B's public configuration/path API
   and consumer-contract tests must be `APPROVED` before C1 executor work starts.
   Within C1: config integration → typed approvals → reconciliation → overlay/final
   assertion. C0 asset-discovery behavior may proceed against B's frozen interface,
   but its configuration wiring waits for B approval. C4 may start after A. B →
   D-definition. D plus completed template/scaffolder → E. F1 and F2 → G; F2 does
   not block A–E.
7. **Nothing in this loop reaches the owner.** A blocked lane is agent work. Per
   `agent-memory.md`, forwarding a defect list to the owner is itself a defect.

---

## Open questions for the owner (business only — nothing agent-resolvable)

**Status: one narrow physical question is parked; agent sourcing is active.** The
owner has NOT received the academy content (confirmed 2026-08-22). F1 starts now
from manufacturer/official sources; unsettled claims remain `NEEDS_SOURCING` or
`UNVERIFIED` and are never guessed.

Do not ask the owner for robotics facts or research. Steps A–E are agent work and
need no inventory answer. Only G needs both sourced facts and physical inventory.

| # | Question | Answer likely comes from |
|---|---|---|
| 1 | Which EV3 programming environment/version is evidenced? | F1 official research, then delivered content; otherwise `NEEDS_SOURCING` |
| 2 | What kit label text and quantities are physically present? | F2 owner/academy custodian reads labels/counts and supplies identifying-label photographs |
| 3 | What course shape is specified: levels, sessions, graduation session? | delivered content; otherwise `UNVERIFIED` |

**Now and on content arrival — agents do this, not the owner:**

1. Read the delivered EV3 material and answer whatever it answers. Record each
   answer with its locator (file + page/section) in `knowledge/ev3/source-catalog.yaml`.
2. F1 records only manufacturer/official claims with URLs and locators. Anything
   unsettled stays `NEEDS_SOURCING` or `UNVERIFIED`.
3. Only F2 reaches the owner/custodian: report physical label text, quantities, and
   identifying-label photographs. Agents interpret them; the owner is not asked to
   identify compatibility, choose software, or make robotics judgments.
4. Whatever is settled is written into `course.yaml`, which is what steps E–G read.

---

## Future project — parked until EV3 course is done and stable

**Multi-course reuse porting pass.** Owner asked (2026-08-22) whether this vault is
ready to host another Techno Square course. Dispatched codex and opencode
independently for a read-only audit; both converged. Verdict: ~80% ready. The
manifest/scaffold/asset-gate core (`config.py`, `paths.py`, `check_assets.py` CLI,
`new_course.py`, `gate_runner.py`, `envelope.py`, `overlay.py`) is genuinely
course-agnostic and tested. Scoped to another *Techno Square* course (not a
foreign academy), the fixed Techno Square branding / 70% Arabic / 120-minute
session assumptions in `brand-and-output.md` and `_TEMPLATE-blueprint.md` are
correct defaults, not bugs.

Remaining ~20%, when this becomes active work:

1. `generate_session.py` is hardcoded to this course: absolute external path
   (`D:\vault\GPT_Behavior_Deconstruction_Vault\...`), notebook titles literally
   say "TechnoSquare microbit", forced `ar` output, and bundle filenames
   (`slides-source.md`, `trainer-guide.md`, etc.) are hardcoded instead of read
   from `asset_discovery.source_files` — a course declaring different source
   files passes `check_assets` then dies in preflight. Needs to read these from
   `course.yaml` instead.
2. `new_course.SCAFFOLD_DIRS` only copies `scripts/` and `tests/` — a scaffolded
   course gets **no** `.claude/` directory, no doctrine skill, no agent
   definitions, no `knowledge/<domain>/` schema, and critically no
   `00-contracts/agent-memory.md` (carries the owner-never-touches-agent-resolvable-defects
   rule). Every new course currently has to hand-author these from scratch.
3. `.claude/agents/ev3-specialist.md` is ~85% generic scaffolding (role,
   read/write envelope, verdict/approval/review-receipt structure) and
   `.claude/skills/ev3-course-specialist/SKILL.md` is roughly half generic
   (citation discipline, ownership routing, no-Arabic rule, QA skeleton) / half
   EV3-specific (source hierarchy, physical-build seeded bugs, physical-evidence
   asset class). Porting to a new domain = copy + rename + swap the
   domain-specific half, not a rewrite.
4. Two smaller latent bugs found in the audit: `check_assets.py`'s module-level
   `audit()`/`unused()` API still defaults to micro:bit regex/naming (only the
   CLI path is manifest-driven); and `scaffold_vault.py` writes a second
   `00-contracts/topology.md` with hardcoded providers that can disagree with
   `new_course.py`'s manifest-derived root `topology.md`.

Estimated effort: roughly a day of focused porting work, not a redesign. Do not
start until the EV3 course (this plan) reaches G/H and is stable — porting
against a second real course, not a guess, is what makes the abstraction trustworthy.
