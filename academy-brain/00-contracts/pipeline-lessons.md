# Pipeline Lessons — Standing SOP

Distilled 2026-08-30 from 13 session-by-session lesson files accumulated
across EV3 Levels 1-2 (`S1`..`S8`, `L2-S2`..`L2-S7`, ~3,000 lines). Every
course spawned from this vault inherits this file. It is the operating
doctrine for running the pipeline correctly, not a record of what happened —
that history stays in each course's own `00-contracts/*-PIPELINE-LESSONS.md`.

Copied by `scripts/swarm/new_course.py`. Edit here to change doctrine for
every future course; a fix scoped to one course's incident belongs in that
course's own lessons file, not here.

## 1. Ownership and process discipline

- Only the course's designated content specialist may perform sourcing,
  receipt, digest, or bundle authorship. Independent review/fix passes
  (inline Codex, dispatched review) may diagnose and patch, never author.
- Verify every specialist completion against its promised filesystem
  outputs before advancing. If files are absent or partial, resume the
  same agent and preserve exclusive path ownership — never start a
  competing writer while the first may still be active.
- Never recover clipped or garbled source text by plausibility. Quote only
  fully legible fragments, mark line breaks explicitly, record missing
  characters as a narrow hole. Fabricated recovery and literal-condition
  loss are two distinct defect classes — review for both, separately.
- Preserve every literal program predicate, port, value, unit, wait,
  branch, reset, and terminal action through source-chain and bundle
  review. If wording is intentionally abstract, label the abstraction.
- Treat the approved source PDFs as the content ceiling. Resolve
  unsupported silence by narrow omission and remove dropped sections
  completely — headings, placeholders, GAP panels, explanatory trace text
  included, not just the prose.

## 2. Asset classification (REFERENCE vs EVIDENCE)

Decide during the RECEIPT stage, before the class is copied through digest,
provenance, and every bundle file — reclassifying after curation forces a
cross-file correction sweep:

1. Extract every image in the session's source-page range; don't stop at
   an image-count or dimension check.
2. Open each image and inspect its visible content.
3. Compare it against the sourced claims and surrounding pages.
4. Confirmed genuine academy material (including a confirmed-genuine code
   screenshot) becomes `REFERENCE`, uploaded and placed normally.
5. Only classify `EVIDENCE` while authenticity is genuinely unresolved.
   Never use it merely because the asset is a screenshot or technical
   exhibit.
6. Reconcile the chosen class across every file that names it: receipt,
   digest, provenance, `blueprint.md`, `slides-source.md`,
   `home-summary.md`, `ASSET-MAPPING.md`, `SOURCES.md`, `decisions.md`.

## 3. Audience-scope enforcement (trainer content vs. student content)

Enforce at all three layers before firing — manifest prose and a clean
slide source are not proof:

1. Grep the actual learner-facing source files for excluded content.
2. Inspect every row of every notebook upload table.
3. Grep the actual bundle files the generator will upload, and read the
   generator's executable upload code path itself. An unconditional
   auxiliary upload can ship excluded trainer content even when the
   primary source file is clean.

Keep scope exclusion and omission-by-silence distinct: preserve
trainer-only material as `SOURCED` for its legitimate trainer use, but
never repeat its concrete answers, weights, thresholds, or other sensitive
detail in any file the student-notebook path uploads. Classify trainer
shapes by function, not heading familiarity — the gate applies to grading
rubrics, answer keys, checklists, scripts, differentiation notes, exit
tickets, and concealment instructions, not just things literally labeled
"trainer."

## 4. Blueprint gates and the GAP-marker regex

The `blueprint.md` gate matches any physical line starting with `GAP` plus
a dash plus a token — the regex has no understanding of Markdown prose vs.
a real routing marker. Line-wrapped prose beginning `GAP-by-omission;` at
the start of a physical line will trip a false-positive HARD STOP.

Standing rule: never let literal `GAP` start a physical line in
`blueprint.md` prose unless it is a genuine marker routed to
`owner_business`, `physical_action_required`, or `specialist_council`.
Write ordinary prose as ordinary prose.

Always run the dry (no `--live`) generation call before ever adding
`--live` — it spends no quota and executes the same blueprint gate,
catching this class of defect before a live fire.

Owner fire authorization is two explicit gate transitions, not one: the
blueprint authorization gate and the asset production gate. Validate the
shared course manifest too — check `course.yaml`'s `artifact_schedule`
entry for the target session against the session's actual required
outputs before session-level fire approval. Treat any schedule mismatch as
a course-scope decision: show the exact stale value and get explicit owner
authorization rather than silently flipping it.

## 5. Independent review is a real gate, not a formality

Require independent review after specialist self-review, every time:
recheck claim counts, both source PDFs' shared boundary pages, locators,
qualifiers, attribution, image inventories, and the exact width of every
GAP. Confirm a claimed-zero-images session with the image-extraction API
plus a visual render, not source prose alone. Reconcile claim and hole
counts across all six bundle files; grep for omitted-content traces,
trainer-only vocabulary, and contradictory upload rows before
authorization.

A clean recount that finds no error is itself a successful, worth-recording
verification result — it is evidence the check works, not evidence the
check was unnecessary. Treat frozen receipt lists, never summary
arithmetic, as authoritative when the two disagree.

## 6. Generation safety (NotebookLM `--live`)

Before every live fire: run the self-check in the notebooklm-mcp Python
environment, then the ordinary dry preflight. After any host restart,
re-run login before any fire, retry, or resume.

Inspect `80-generation/{session}/` before firing or retrying. Resume a
surviving `.task_id`. Investigate a `.lock` by checking its owning PID and
actual process command line before deleting it — never clear a lock on
inference alone. Distrust a PDF that still has a task sidecar next to it.

The crash-safe generation contract, preserved across every future course:
exclusive fresh claim, whole-pass execution lock, durable notebook/task
identity, transient-vs-terminal error distinction, scratch-copy
compositing, atomic output promotion, cleanup only after full-pass
success. Exactly one live invocation executes the complete ordered plan.

`ArtifactNotReadyError` during download is an expected, non-fatal safe
pause. Preserve the notebook/task identity and rerun the identical ordered
plan — do not fire a replacement command or a separate summary command.

Distinguish readiness failures, content defects, rendering defects, and
notebook contamination — they have different fixes. Resume the same
notebook for a timing issue; fix the source of record for a content
defect; retire a corrupted or contaminated notebook via rename (so a
fixed-title lookup cannot reuse it) and create a genuinely fresh one only
for rendering corruption or contamination.

For an isolated rendered-slide defect, prefer a single-slide revision call
over a full-deck regeneration. Poll and download using the revision's own
returned task ID, then close with per-page pixmap hashes proving only the
target slide changed.

Move rejected and intermediate generations into
`80-generation/{session}/_rejected/` with dated names. Never delete
incident evidence.

A bundle's authored slide count and the rendered PDF's page count are not
guaranteed 1:1 — pagination is a renderer decision outside pipeline
control. Record both in the production receipt; treat a mismatch as
informational, not a defect, once the owner has reviewed and approved the
actual delivered artifact.

## 7. Lock and close

Treat blueprint approval as permission to spend quota, not content
acceptance. Owner visual review is required before lock, and either
content or rendering defects are valid grounds for rejection at that
stage.

Lock every accepted artifact with: SHA-256, byte count, page count, a
byte-identical `.LOCKED-GOLDEN.pdf`, and a note recording approval plus
any recovery, rejection, or contamination provenance.

Immediately after lock, run a dedicated lifecycle reconciliation across
every file that could restate the session's state: blueprint, decisions,
slide source, summary source, asset mapping, upload manifest, production
receipt. Grep both frontmatter and prose. No stale `generated: false`,
`pending`, `unverified`, `not authorized`, `not requested`, `not
generated`, or `not fired` statement may survive a locked session — this
recurred as a defect class across multiple sessions and is worth a
dedicated pass every time, not a side effect of the lock commit.

Keep these states distinct and never let one stand in for another:
receipt-schema `BLOCKED`, learner readiness, owner permission to spend
quota, generation, visual approval, lock state, and an independent
level-wide Trainer Guide track.

## 8. Stage prerequisites — starting a course, starting a level

This section exists because a rule of this kind already failed once. A course
contract required each session to "either produce the required research
artifact or explicitly record why the stage is not applicable"; neither was
ever done, and fifteen sessions shipped through a pipeline whose research,
critique, patch and refutation stages were empty. Nothing objected, because
nothing was checking. Prose asking for a justification is not a gate.

### 8.1 The chain

The ordered stages are: `90-receipts` → `30-research` → `10-digest` →
`20-provenance` → `40-critique` → `50-patch` → `55-refuted` → `60-approved` →
`70-localized` → `75-bundle` → `80-generation`. A session may not enter a
stage until every earlier stage is satisfied. `scripts/swarm/stage_gate.py`
is the executable statement of this list; `generate_session.py` calls it
before any other gate, so a skipped stage hard-stops before quota is spent.

Research is the one stage scoped to the LEVEL, not the session — one research
set at `30-research/L<level>/*.md` serves every session in its level. Every
other stage is per-session. Research stored for a different level is not
evidence for the level being checked.

### 8.2 Satisfying a stage

A stage is satisfied by evidence or by a waiver. Nothing else — not a
directory that exists, not an empty file, not a note in a commit message.

A waiver is `<stage-dir>/<session>.waiver.yaml` and must carry `reason`,
`authority`, `scope`, and `granted`. `reason` is one of exactly three values:

- `not-applicable` — the stage cannot apply to this session, ever.
- `blocked` — the stage is owed and not yet done. **Requires `expires`.**
- `superseded` — another artifact covers this session. Requires `covered_by`.

The vocabulary is the point. Free text collapses "we will do this next week"
and "this will never apply" into one indistinguishable sentence, and the
first silently becomes the second. A `blocked` waiver without an expiry date
is a permanent exemption wearing a temporary label, and is refused. An
expired waiver is refused. A malformed waiver is refused, never ignored.

### 8.3 Starting a new LEVEL of an existing course

A new level is not a new course and not a continuation. It inherits, and it
must not inherit, along a fixed line:

- **Inherited:** contracts, brand and output rules, schemas, gates, the
  course manifest, and the course's specialist agent framework.
- **NOT inherited — must be produced fresh:** the level's own research set,
  its source catalog and the approved-source ceiling, its learning
  progression, and its audience assumptions.

Reusing the previous level's research to satisfy a new level is the specific
failure this rule prevents: an L1 research file has never seen L3's material
and cannot have judged it.

### 8.4 Doctrine versioning

`stage_gate.DOCTRINE_VERSION` is stamped into every prerequisite receipt. A
later doctrine change does not retroactively invalidate a locked session:
artifacts are read under the doctrine version they passed under. Never
regenerate, rewrite, or re-judge a locked session to make it retrospectively
compliant with a rule written after it shipped. Backfill new doctrine into a
course's forthcoming levels, never into its shipped ones.
