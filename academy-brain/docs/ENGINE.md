# The Engine — what it is, how it runs, where things live

Orientation map. No functional purpose: nothing reads this file, no gate checks it.
It exists so you can remember what you built.

Last true as of: 2026-08-31.

---

## 1. What the engine is

A course factory. You feed it a source PDF and a domain specialist; it produces
sourced, critiqued, localized, brand-compliant session decks — and refuses to
produce them when the evidence isn't there.

The engine is not the course. The engine is the *rules plus the machinery* that
any course inherits. That distinction is the whole architecture.

---

## 2. The three repos

| Repo | What it is | What lives there |
|---|---|---|
| `D:\vault\academy-brain` | **The war room / factory** | Contracts, gates, scaffolder, templates, specialist framework. New course material starts here. Stage folders stay empty. |
| `D:\vault\ev3-academy` | **A live course** | LEGO MINDSTORMS EV3. L1 + L2 shipped (15 locked sessions). L3 parked awaiting source material. |
| `D:\vault\microbit-academy` | **A shipped archive** | micro:bit, the first course. Full git history. Read-only in practice. |

Two more paths that are not repos:

- `D:\vault\Microbit` — a compatibility junction so old absolute references still resolve. Don't write new references against it.
- `D:\vault\session-master-package` — a **separate project**. Not part of this engine. Hands off.

**The trap:** all three repos have identically-named stage folders (`10-digest`,
`75-bundle`, ...) and overlapping session ids (`L1-s1`..`L2-s8`). A relative path
silently succeeds against the wrong tree. Always absolute paths, always
`git -C "<repo>"`.

---

## 3. The pipeline

Eleven stages, in order. A session may not enter a stage until every stage before
it has evidence or a valid waiver.

```
90-receipts  →  30-research  →  10-digest  →  20-provenance  →  40-critique
     →  50-patch  →  55-refuted  →  60-approved  →  70-localized
     →  75-bundle  →  80-generation
```

| Stage | Folder | What it holds | Scope |
|---|---|---|---|
| receipts | `90-receipts` | The specialist's sourced claim record — what is known, what is a hole | session |
| research | `30-research` | T01–T05: pedagogy, assessment, answer keys, platform reference | **level** |
| digest | `10-digest` | The source material distilled to what the session teaches | session |
| provenance | `20-provenance` | Which source page every claim came from | session |
| critique | `40-critique` | Three independent lanes attack the draft (codex / opencode / hermes) | session |
| patch | `50-patch` | JUDGE adjudicates the three lanes into accepted fixes | session |
| refuted | `55-refuted` | High-severity patches survive one refutation pass | session |
| approved | `60-approved` | The English content, settled | session |
| localized | `70-localized` | Arabic. **Only Claude authors Arabic** — never a critique lane | session |
| bundle | `75-bundle` | slides-source, blueprint, decisions, SOURCES, ASSET-MAPPING, home-summary | session |
| generation | `80-generation` | The actual decks, PDFs, and locked goldens | session |

Research is the one **level-scoped** stage: one research set serves all eight
sessions of a level. Everything else is per-session.

---

## 4. What enforces it

Three different kinds of gate. Knowing which is which saves you an hour.

**The stage gate** — `scripts/swarm/stage_gate.py`
Judges the *vault*, not a file. Answers "may this session enter stage X at all?"
This is the one that closes the original defect: an entire course once ran
`90-receipts → 75-bundle` and skipped six stages with nothing complaining.
Called first thing in `generate_session.py`.

**Registry gates** — `scripts/swarm/gates/`
Pure `text -> GateResult` functions. Each judges the text of one artifact.
Verdicts: PASS / FAIL / UNVERIFIED. Registered with `@register` into `REGISTRY`.
`pedagogy_coverage.py` lives here — it checks Bloom's coverage across a level.

**The contracts** — `00-contracts/`
Prose rules. Some are enforced by a gate; some are only doctrine. Prose that asks
for a justification is not a gate. That lesson is why `stage_gate.py` exists.

### Waivers

A stage is satisfied by evidence **or** by a valid waiver. Nothing else.
A waiver is a structured YAML file, never prose:

- `reason` — closed vocabulary: `not-applicable` | `blocked` | `superseded`
- `blocked` **must** carry an `expires` date (a permanent exemption wearing a temporary label is the exact laundering this stops)
- `superseded` **must** name `covered_by`
- `scope` must match the stage's scope (a level stage takes a level-named waiver: `L1.waiver.yaml`)
- plus `authority` and `granted`

Malformed waiver = refused, never ignored.

### Doctrine versioning

`DOCTRINE_VERSION = 2`, stamped into every receipt. Doctrine does not run
backwards: a session that already shipped a **verified lock** passes the chain
unread. A lock is a `.LOCKED-GOLDEN.pdf` that is a real PDF, byte-identical to
its ordinary counterpart, and not under `_rejected/`. Anything in `_rejected/` is
incident evidence, not a lock.

---

## 5. The pedagogy layer

`00-contracts/pedagogy.md` — course-neutral, portable to any course.

**Bloom's revised taxonomy** (Anderson & Krathwohl 2001), two-dimensional:
6 cognitive processes (Remember / Understand / Apply / Analyze / Evaluate /
Create) × 4 knowledge types (Factual / Conceptual / Procedural / Metacognitive).
Chosen over the 1956 original because one dimension can't separate "name the
part" from "choose the part that fits."

**Subsume, not compete.** The course names its own delivery arc (EV3's is
Think → Create → Evaluate → Extend → Share). Each arc stage declares which
Bloom's cells it exercises. A session is judged on what it *reaches*. One rubric
dimension, not two competing checks.

Coverage floor:
- every session reaches at least **Apply**
- the level reaches **Analyze** and **Create**
- knowledge types are not uniformly Factual

Measured over **sessions only**. What the arc *intends* doesn't count toward the
ceiling — otherwise a level declares Create in its arc and passes while no
session ever gets there.

**Naming collision:** always qualify `arc:Evaluate` vs `bloom:Evaluate`. They are
not the same thing and the ambiguity has bitten before.

---

## 6. The specialist

Every course needs a domain expert agent. It is the thing that refuses to invent
hardware facts.

- `.claude/agents/_TEMPLATE-course-specialist.md` — the neutral template, `COURSE` / `SUBJECT` placeholders
- `.claude/agents/ev3-specialist.md` — the live EV3 instance

The specialist owns: prerequisite graphs, terminology, technical objectives,
build/program/test sequences, misconception lists, troubleshooting trees, sourced
safety notes, feasibility calls, seeded-bug ladders, evidence and shot
requirements, and **the level's pedagogy record** (`30-research/<level>-pedagogy.yaml`).

Its output is the `90-receipts` entry — including its *holes*. A hole is carried
forward through digest, provenance, and bundle unresolved. Nobody downstream
invents a resolution.

---

## 7. Starting a new course

```bash
python -m swarm.new_course <slug> <target-dir> \
    --name "..." --audience "ages 9-12, no prior programming" \
    --subject "LEGO MINDSTORMS EV3" --levels 1 2 \
    --asset-ref-pattern '...' --asset-source-files slides-source.md
```

`--audience` is required. `--subject` defaults to `--name`.

**Inherited** (the scaffolder copies it):
`pyproject.toml`, the six contracts (`brand-and-output`, `rubric`,
`pipeline-lessons`, `pedagogy`, `pdf-intake-sop`, `agent-memory`), the intake
schema, the two bundle templates, and the specialist template.

**Generated** (not copied — written fresh per course):
`course.yaml`, `topology.md`, and `.claude/agents/<slug>-specialist.md`
(the template with its placeholders filled).

**Not inherited** (the new course must author it):
the research set, the source catalog and its ceiling, the learning progression,
and the audience assumptions.

A contamination test asserts no source-course naming leaks into a generated
course. It has caught real leaks — including one of mine.

---

## 8. Where the holes still are

Six were found. The three code ones are fixed. Three still need a decision from you.

| # | Gap | State |
|---|---|---|
| 1 | `nblm-student-deck-prompts.md` — hard-required by `generate_session.py:1339`, exists nowhere. **Blocks generation in any new course.** | OPEN — needs a decision (authoring the prompt shapes every future deck) |
| 2 | Brand assets — `BRAND = VAULT / "Techno Square identity"`, never scaffolded | OPEN — needs a decision (copy per course, or point at one central copy?) |
| 3 | Specialist copied but never instantiated | **fixed** — `_instantiate_specialist()` writes `.claude/agents/<slug>-specialist.md` with `COURSE`/`SUBJECT` filled and `TODO(<slug>)` markers left for the human |
| 4 | `.claude/skills/COURSE-course-specialist/SKILL.md` — required by the template, doesn't exist | OPEN — needs a decision (what neutral doctrine does it carry?) |
| 5 | `00-contracts/agent-memory.md` absent from `SCAFFOLD_FILES` | **fixed** — scaffolded; two source-course mentions inside it also removed |
| 6 | `audience` missing from the manifest schema | **fixed** — required field on `CourseConfig` and `Seed`, `--audience` required on the CLI |

Gap 6 is enforced, not optional: an optional field is inherited by omission, and
inheriting an age band is the exact thing `pedagogy.md` §4 forbids. Note the name
collision — manifest `audience` is the learner age band; `prepare.audience_of()`
is a different question about a different file (is this artifact learner- or
trainer-facing).

**Drift to watch:** `ev3-academy` carries its own copy of `scripts/swarm/`, so its
`config.py` still has no `audience` and its `course.yaml` still lacks the field.
Nothing is broken there today. The next script sync will break it until
`ev3-academy/course.yaml` gains an `audience:` line.

Also open, lower stakes:
- `.claude/skills/ethos-v2/references/kids-track-rules.md` still holds micro:bit-specific pedagogy sitting in academy doctrine.
- `.test-tmp/` is ACL-locked by a Codex sandbox. Untracked, harmless, unremovable.
- 3 pre-existing failures in `ev3-academy/tests/test_overlay.py` — `_composite()` writes `deck.pdf.compositing<pid>` while `overlay._handlers()` dispatches on the final suffix. Predates this work.

---

## 9. Gotchas worth remembering

- `course.yaml` in academy-brain is a **placeholder, not a course**. It can't be deleted: `paths.py` loads a manifest at import time. If you're editing it to describe real material, you're in the wrong vault.
- EV3 L3 will fail session-id validation until `ev3-academy/course.yaml` extends `levels` to `[1,2,3]`.
- Never let prose reach a shell unquoted. `->` and `>` are redirects; they silently create 0-byte junk files in the repo root. This has happened more than once.
- `python` works for pytest. The notebooklm venv python does **not** have pytest but **is** required for `generate_session.py --self-check`.
- Test counts as of last run: academy-brain 264 passed / 4 skipped. ev3-academy 250 passed / 4 skipped / 3 pre-existing failures.
