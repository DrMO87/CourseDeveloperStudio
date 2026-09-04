---
stage: contracts
owner: claude
status: living
purpose: >-
  Defines `track` — the optional pedagogical category a course may declare in
  its manifest — and states which format decisions are track-conditional
  versus academy-wide. Cross-referenced from pedagogy.md §4.
---

# Track pedagogy

## 1. What `track` is, and is not

`track` is a course-manifest field (`course.yaml`, optional, `""` if
undeclared) naming which of the academy's five pedagogical tracks a course
belongs to. The vocabulary is not invented here — it is Abdeen's own academy
roadmap, `Abdeen_Moon_OS_Docs/Academy_Brain_OS/Techno_Square_Roadmap_Knowledge.md`
(kept in this vault only, never scaffolded — it names specific example
courses, some by other vendors' product names, which is exactly the kind of
course-specific naming a shared contract must not carry into every new
course). This file registers the vocabulary; that file is where to read the
full picture, including which example courses the owner associated with each
track and their typical ages.

| Track | Style |
|---|---|
| `early-childhood-tech` | playful, visual, mascot-supported, very low text |
| `kids-hardware` | hands-on, project-based, guided step-by-step |
| `kids-software` | visual, playful, story-driven |
| `stem-engineering` | project/challenge-based, debugging and reflection |
| `professional-technology` | structured, technical, career-oriented, assessment-driven |

Value is one of the five slugs above, or `""` for undeclared. This is NOT
machine-enforced yet — `config.py` accepts any single-line string. Treat the
five values above as the correct vocabulary regardless.

**`track` is not `audience`.** The roadmap's example courses each carry a
typical age, but that number is guidance for picking a track, not a value to
copy into `audience`. A real course's `audience` is its own declared fact
(pedagogy.md §4), independent of what the roadmap's example course for that
track looked like. Two courses can share a track and declare different
audiences, or share an audience and sit in different tracks — do not collapse
the two into one field, and never infer one from the other.

This file exists because an earlier document
(`.claude/skills/ethos-v2/references/kids-track-rules.md`) framed several
format decisions as "adult EthOS vs. kids EthOS v2" reversals, scoped to two
specific courses by name. That framing does not travel: a third course is
neither of those two, and most of what it reversed has since been settled
one way, academy-wide, below.

## 2. Already academy-wide — NOT track-conditional

The following are binding for every course regardless of track. Do not write
a track-specific override for any of these; if a course seems to need one,
that is a conflict with `00-contracts/brand-and-output.md` to raise, not a
track rule to add here.

- **One idea per slide.** No crowded slides, large titles, simple shapes.
  (`brand-and-output.md` §3)
- **TATA mascot, all four states**, used with intent, never on every slide
  and never absent. (`brand-and-output.md` §4)
- **30% English / 70% Arabic**, and the Arabic must be simple, short,
  age-appropriate, beginner-friendly, and RTL-correct.
  (`brand-and-output.md` §5)
- **Home Summary's five sections and Parent Talk** are required, not an
  optional restoration for one track. (`brand-and-output.md` §1c)
- **No video-only slides.** (`brand-and-output.md` §7)
- **Logo on first/last slide only.** (`brand-and-output.md` §3)

## 3. Genuinely track-conditional — a course may vary these

- **Examples and visuals.** Calibrated to the declared audience (age,
  experience), not to a track label — this already follows from `audience`
  and needs no separate track rule.
- **Explanation depth within the academy language law.** The mandatory 30/70
  ratio and simple, short Arabic remain academy-wide; the source contract's
  ban on adult-level explanation is explicitly scoped to a kids track
  (`brand-and-output.md` §5). Calibrate depth to the declared `audience`; do
  not infer it from `track` alone.

None of the format dimensions the retired reversal table covered survive as
track-conditional once §2 is accounted for. If a future course needs a real
track-conditional format rule, add it here with the same evidence discipline
as everything else in `00-contracts/` — a stated rationale, not an inherited
assumption from one course's decisions.

## 4. Trainer Guide cadence — settled

**Owner ruling: `brand-and-output.md`'s definition governs.** Three contracts
describe the Trainer Guide at different altitudes, which read as a conflict.
They are not in conflict; they describe different objects.

| Object | Cadence | Where |
|---|---|---|
| `trainer-guide.md` **draft** | one per session | `75-bundle/<session>/` |
| Trainer Guide **final PDF** | one per level, never split | owner-run, Antigravity |
| Trainer Guide **track state** | level-wide, independent | not per-session lock |

Read each contract against that table and the disagreement disappears:

- `topology.md` (generated per-course by `new_course.py`) lists
  `trainer-guide.md` among `75-bundle`'s per-session folder contents. That is
  the **draft**, and it is also NBLM source #2 for the student deck
  (`brand-and-output.md` §1). It is not the deliverable.
- `brand-and-output.md` §1b defines the deliverable: **one single PDF, Techno
  Square themed, covering the level.** Do not split it per session, and do not
  spend NBLM quota on it — it renders through Antigravity, manually,
  owner-run.
- `pipeline-lessons.md` §7 is not describing a third artifact. It is a
  state-hygiene rule: the level-wide Trainer Guide track is its own state axis
  and must never be conflated with a session's lock state. A locked session
  says nothing about whether the level's guide exists.

**How drafts reach the final PDF.** They are its source material, not its
sections — the owner composes the level guide from the per-session drafts.
No stage aggregates them mechanically, and none should: §1b assigns the
final artifact to a manual, owner-run Antigravity pass.

Two consequences the pipeline must respect. A session locks without its
Trainer Guide contribution being final — that is not a hole and must not be
recorded as one. And the absence of a level-wide PDF while sessions are still
in flight is expected state, not a missing artifact.
