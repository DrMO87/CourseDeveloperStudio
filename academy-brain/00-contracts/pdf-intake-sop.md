# PDF Intake SOP — from handed-over source material to a running pipeline

Written 2026-08-30. This is the procedure `new_course.py` does not perform:
it scaffolds the empty machinery, this document says what to do with the PDFs
the owner hands you once that machinery exists. Copied into every course this
vault spawns; a course-specific step (a domain specialist's name, a subject's
vocabulary) is an example here, not a requirement.

## 0. Before you scaffold anything

You need to already know, from the handed-over material or from asking the
owner directly, before `new_course.py` can be invoked correctly:

- How many levels, and sessions per level? (`--levels`, `--sessions-per-level`)
- Which sessions produce no student artifact — a graduation/review session
  like EV3's S8? (`--no-artifact-sessions`)
- What will assets be named in this course's slide sources, as a single
  regex with exactly one capture group? (`--asset-ref-pattern`) EV3 used
  `` `((?:shot|render|img)[A-Za-z0-9_.\-]*\.(?:png|svg))` ``
- Which bundle files actually reference assets? (`--asset-source-files`,
  typically `slides-source.md home-summary.md`)
- Providers: which of `claude codex opencode hermes` will actually work this
  course.

Getting these wrong is expensive later — `course.yaml` is the single runtime
manifest every script reads, and none of the above is worth guessing at.

## 1. Scaffold the course

```
cd <war room>
python -m scripts.swarm.new_course <slug> <target-path> \
  --name "<Human Course Name>" \
  --levels 1 2 \
  --sessions-per-level 8 \
  --no-artifact-sessions 8 \
  --providers claude codex opencode hermes \
  --asset-ref-pattern '`(<prefix>[A-Za-z0-9_.\-]*\.(?:png|svg))`' \
  --asset-source-files slides-source.md home-summary.md
```

Must be invoked as a module (`python -m scripts.swarm.new_course`), not as a
script path — the direct form fails on relative imports.

This creates the empty stage tree, a validated `course.yaml`, `topology.md`,
and copies course-neutral machinery (scripts, tests, brand doctrine,
pipeline-lessons, this SOP, the intake schema). It copies zero course
content — no PDFs, no lesson text, no receipts. That is deliberate: a
scaffolder that copies content from the last course into the next one
produces a vault that looks populated and is wrong in a way nobody notices
until a child reads the wrong course's material.

## 2. Land the source PDFs

Put the handed-over PDFs under `<course>/<Course> source/` (EV3's
convention: `EV3 source/LV<n>/`). This is course content, lives inside the
new course's own tree, and is never the war room's problem again.

## 3. Populate the source catalog

Every source PDF needs one entry in `knowledge/<slug>/source-catalog.yaml`,
in the shape defined by `knowledge/_schema/intake-schema.yaml` section 2
(`source_entry`). Required per entry: `source_id`, `tier`, `title`, `origin`
(the repo-relative PDF path), `retrieved_on`, `applicability` (hardware /
software / firmware — `"unknown"` is a legitimate, honest value, not a
blocker to fill in), `confidence`, `license`.

Do not guess a license. "Academy-owned, authored by the course lead" needs an
owner ruling recorded in the entry's `notes:`, same as EV3's did (owner
ruling 2026-08-23, `content PDF is ceiling, not floor`).

If the course has facts that are true before any content exists but must be
settled before certain claims can ship — hardware identity, environment
choice, safety constraints — record them as `known_unknown` entries per
schema section 7, in the course's own `knowledge/<slug>/known-unknowns.yaml`.
Never in the schema file itself; that file is shared doctrine, not this
course's open questions.

## 4. Source the first session

This is the actual content work, and it is what the pipeline exists to gate,
not something this SOP shortcuts. For each session:

1. A domain specialist (an `ev3-specialist`-shaped agent for this course's
   subject — refuses to infer facts, cites every claim, produces a claim-card
   receipt per `knowledge/_schema/intake-schema.yaml`) writes
   `90-receipts/<session>.<specialist>.yaml`. Frozen once written; corrections
   happen through a fresh independent review pass, never a silent edit.
2. Orchestrator authors `10-digest/<session>.md` from the receipt.
3. Independent review (a second agent — never the same one that sourced)
   checks the receipt against the raw PDFs before anything downstream trusts
   it. See `00-contracts/pipeline-lessons.md` §5.
4. Author the six `75-bundle/<session>/` files following the templates
   already copied into this course (`_TEMPLATE-blueprint.md`,
   `_TEMPLATE-debugging-lab.md`).
5. Classify every asset REFERENCE vs EVIDENCE before it is copied through
   the bundle — see `00-contracts/pipeline-lessons.md` §2.

## 5. First live command

Before any `--live` flag, always run the dry call — it spends no quota and
runs the same blueprint gate a live fire would, catching a class of defect
(`00-contracts/pipeline-lessons.md` §4) before it costs anything:

```
python scripts/swarm/generate_session.py <session-id>
```

Fix whatever it reports. Only once that passes clean, and only after
explicit owner fire authorization recorded in the bundle's approval record,
add `--live`. Read `00-contracts/pipeline-lessons.md` §6 before the first
live fire of any new course — the generation-safety contract it describes
(resume semantics, `ArtifactNotReadyError` handling, lock discipline) is not
optional per-course behavior; it is why the generator exists in this shape.

## 6. What this SOP deliberately does not cover

Course-specific pedagogy, session count, artifact schedule, and brand
specifics are the owner's calls, made once at scaffold time (step 0) and
recorded in `course.yaml` and `00-contracts/brand-and-output.md`. This
document is the mechanical path from PDFs to a first passing dry run; it is
not a substitute for reading `00-contracts/pipeline-lessons.md` in full
before running a session, or for the owner's judgment about what the course
should teach.
