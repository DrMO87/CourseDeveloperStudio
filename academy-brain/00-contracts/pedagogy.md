---
stage: contracts
owner: claude
status: living
purpose: >-
  The academy's course-neutral pedagogy. Defines the cognitive framework every
  course is judged against, the portable teaching principles distilled from
  research, and what a course's own specialist must produce to satisfy them.
  Anchors the `pedagogy` dimension of 00-contracts/rubric.md.
---

# Pedagogy — the academy's teaching contract

Course-neutral by construction. Nothing here names a platform, a device, a
programming environment, or an age. Where a course must supply something, this
file says so and the course supplies it; it never bakes one course's answer in.

This file replaces the practice of treating one course's research files as
academy doctrine. The first course's differentiation, assessment and unit-
pedagogy research (`30-research/T01`, `T02`, `T05`) was repeatedly described as
course-neutral and was not: it carried platform names, lesson-specific
examples, and — in one file — three mutually contradictory age bands. The
*principles* below are what survived that distillation. The originals stay with
their own course as evidence.

## 1. The cognitive framework: Bloom's revised taxonomy

The academy judges learning by Bloom's **revised** taxonomy (Anderson &
Krathwohl, *A Taxonomy for Learning, Teaching, and Assessing*, 2001), not the
1956 original. The revision is two-dimensional, and both dimensions are load
bearing:

**Cognitive process** — what the learner *does* with knowledge:

| Process | Subprocesses |
|---|---|
| Remember | recognizing, recalling |
| Understand | interpreting, exemplifying, classifying, summarizing, inferring, comparing, explaining |
| Apply | executing, implementing |
| Analyze | differentiating, organizing, attributing |
| Evaluate | checking, critiquing |
| Create | generating, planning, producing |

**Knowledge type** — what the learner is doing it *to*: Factual (terminology,
specific details), Conceptual (classifications, principles, models),
Procedural (skills, algorithms, techniques, and the criteria for when to use
them), Metacognitive (strategic knowledge, self-knowledge).

*Source: Armstrong, P., "Bloom's Taxonomy", Vanderbilt University Center for
Teaching, summarizing Bloom et al. (1956) and Anderson & Krathwohl (2001).*

The two dimensions are why the revision is used. One dimension cannot tell
"name the part" (Remember × Factual) apart from "choose which part fits this
job" (Apply × Procedural), and a course that only ever does the first while
claiming to teach the second is the defect this framework exists to catch.

## 2. Bloom's subsumes the course's delivery arc

A course teaches through a **delivery arc** — a named sequence of lesson
stages. The academy's first course used Think → Create → Evaluate → Extend →
Share. A course may name its own; the arc is a course-configurable property,
not doctrine.

The arc is the *sequence*. Bloom's is the *cognitive specification underneath
it*. They are one pedagogy dimension, never two competing checks:

- Each arc stage **declares** the Bloom's cells it is meant to exercise.
- A session is judged on whether its slides **actually** exercise the declared
  cells — not on whether the arc's stage headings are present.
- An arc stage whose declared cells are never actually reached is a pedagogy
  defect, at the same severity as a stage that is missing outright.

A stage heading is not evidence that the thinking behind it happened. That is
the whole reason the arc alone was insufficient.

**Naming collision, stated once so it is never ambiguous:** a course arc may
contain a stage called "Evaluate" that is unrelated to Bloom's *Evaluate*
process. Always qualify: write `arc:Evaluate` and `bloom:Evaluate`. An arc
"Evaluate" stage that only checks whether the build works is
`bloom:Evaluate/checking`; one that asks which of two approaches is better is
`bloom:Evaluate/critiquing`. They are different claims.

### Required coverage

Across the sessions of one level, taken together:

1. Every session must reach at least `bloom:Apply`. A session that never
   leaves Remember/Understand is a demonstration, not a lesson.
2. A level must reach `bloom:Analyze` or higher in at least one session, and
   must reach `bloom:Create` in at least one. A level that plateaus at Apply
   teaches procedure without judgement.
3. The knowledge dimension must not be flat. A level whose every cell is
   Factual is vocabulary instruction wearing a curriculum's clothes.
4. Progression is monotonic in intent, not in every session: later sessions
   may revisit lower processes, but a level's declared ceiling must rise.

These are stated at level scope on purpose. Requiring every session to reach
Create would push every lesson into invention and starve the procedural
fluency that Create depends on.

## 3. Portable teaching principles

Distilled from the first course's T01/T02/T05 research. Each is stated
without the course that produced it, and each names the Bloom's work it
protects. Course-specific research must ground these in its own material and
its own cited sources — inheriting a principle is not inheriting its evidence.

**Concrete before abstract.** Anchor each new idea to a tangible artefact or
observable action before naming the abstraction. Builds the Factual and
Conceptual base that Apply and Analyze stand on. *(Merrill, First Principles
of Instruction.)*

**One idea per slide.** Manage extraneous cognitive load; chunk construction
into small steps. A novice spending working memory on layout is not spending
it on the concept. *(Sweller, Cognitive Load Theory; segmenting principle.)*

**Predict before doing.** Open with a short prediction about a familiar action
before showing the mechanism. This is `bloom:Understand/inferring`, and it is
the cheapest way to surface a misconception while it is still cheap to fix.

**Formative assessment is embedded, not appended.** Check understanding inside
the arc — a demonstration, a one-question exit check, a peer explanation —
never a bolted-on written test. A learner explaining their own artefact is
performing `bloom:Understand/explaining`; a learner judging a peer's is
performing `bloom:Evaluate/critiquing`. Both are assessment *and* instruction.

**Differentiation is paired, not substituted.** Offer support and challenge as
options around a common core task; never replace the core task for either
group. Support scaffolds the same Bloom's cell by another route. Challenge
raises the process one level — it is not "more of the same, faster."

**Extension is bounded and optional.** Placed after the core build works, with
a defined endpoint. Unbounded extension silently converts into a prerequisite
and penalizes the learners it was meant to serve. *(Universal Design for
Learning.)*

**Debugging is taught, not merely survived.** Frame fault-finding as a
deliberate practice with its own method — observe the symptom, predict the
cause, test the prediction. This is `bloom:Analyze/attributing`, and it is
usually the highest-value Analyze work a beginner course contains. See
`75-bundle/_TEMPLATE-debugging-lab.md`.

**Sharing is performance, not paperwork.** Close by having learners show and
say what they made. Written reflection substituted for demonstration converts
a competence-and-relatedness moment into a literacy test. *(Self-Determination
Theory.)*

## 4. Course-configurable — never assume these

A course MUST declare, and the academy must never inherit from another course:

- **Audience.** The age band or experience level, declared once in the course
  manifest and referenced everywhere else. Never restated inline. The first
  course's research carried three different age bands across its own files
  precisely because each mention was written independently.
- **Track** (optional). The pedagogical category the course belongs to.
  Distinct from audience — see `00-contracts/track-pedagogy.md` for the
  boundary and for which format decisions are actually track-conditional
  versus already academy-wide.
- **The delivery arc.** Its stage names and their declared Bloom's cells.
- **The platform and its vocabulary.**
- **The approved source ceiling.** Pedagogy research may not expand the
  syllabus beyond the sources approved for that course and level.

## 5. What the course specialist owes

Every course has its own specialist agent (see
`.claude/agents/_TEMPLATE-course-specialist.md`). Pedagogy is part of that
agent's job, not a separate reviewer's. For each level, the specialist must
produce a **pedagogy record** at `30-research/<level>-pedagogy.yaml`:

```yaml
level: 1
arc: [Think, Create, Evaluate, Extend, Share]   # this course's own arc
arc_bloom:                                       # declared cells per stage
  Think:    [Remember/recalling, Understand/inferring]
  Create:   [Apply/executing]
  Evaluate: [Evaluate/checking]
  Extend:   [Analyze/differentiating, Create/generating]
  Share:    [Understand/explaining, Evaluate/critiquing]
sessions:
  L1-s1:
    reaches: [Remember/recalling, Understand/inferring, Apply/executing]
    knowledge: [Factual, Procedural]
    assessment: "learner runs the artefact and names the step that produced it"
```

`scripts/swarm/gates/pedagogy_coverage.py` checks this record against §2's
required coverage. The gate checks the record; the specialist is responsible
for the record being true of the actual slides. A gate cannot read intent —
it can only refuse a level that never even *claims* to reach Analyze.

## 6. Applying a doctrine change

This file is versioned by `stage_gate.DOCTRINE_VERSION`. A change here applies
to levels that have not yet been researched. It never applies backwards: a
locked, shipped session is read under the doctrine it passed under, and is
never regenerated, re-judged, or rewritten to satisfy a rule written after it
shipped. See `pipeline-lessons.md` §8.4.
