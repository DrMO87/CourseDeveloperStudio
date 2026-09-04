---
stage: contracts
owner: claude
status: living
purpose: >-
  Scoring rubric for JUDGE (S3 REFINE). Used to score critique issues from
  40-critique/<session>/{codex,opencode,hermes}.json and decide which become
  patches in 50-patch/<session>.md. Grounded in 00-contracts/agent-memory.md
  and 30-research/T01-T05.md.
---

# JUDGE rubric

Course-neutral. Every anchor below (T01-T05) resolves to the research set of
the course being judged, not to any one course's documents.

## 1. Dimensions (from critique `type` enum)

| Dimension | Weight | What "good" looks like | Primary research anchor |
|---|---|---|---|
| **pedagogy** | 1.0 | The course's declared delivery arc is intact AND actually exercises the Bloom's cells that arc stage declares (`00-contracts/pedagogy.md`); one idea/slide; concrete-before-abstract for the course's configured age band | `00-contracts/pedagogy.md` + T05 (the course's own unit pedagogy) |
| **technical** | 1.0 | The course platform's programming semantics are correct for every construct the slide uses, and the canonical code matches upstream | T04 (the course's block/API reference) |
| **assessment** | 0.8 | Formative, non-written, embedded at suitable points in the course's declared arc (exit ticket, demo, peer-share) — not a bolted-on written test and not dependent on any fixed arc-stage names | T02 (assessment design) |
| **differentiation** | 0.8 | Explicit support/challenge variants re-inserted where R0 `missing[]` flags them dropped | T01 (differentiation) |
| **other** | 0.5 | Anything real but outside the four buckets above (naming, sequencing, licensing) | — |

Weight scales a dimension's issues before severity multiplies (§2) — technical/pedagogy errors that mislead a child in the target age band outrank cosmetic assessment nits.

## 2. Severity → action

| Severity | Score multiplier | Action |
|---|---|---|
| high | 3 | Always patch. Blocks a session from shipping as-is (wrong code, misconception taught as fact, missing safety-critical step). |
| medium | 2 | Patch unless it conflicts with a higher-scored issue in the same `loc`. |
| low | 1 | Patch only if 2+ providers independently raised the same `loc`+`problem` (cross-lane agreement threshold, see §3). |

`score = weight × multiplier`. Sort candidate patches by score descending within a session.

## 3. Cross-lane agreement (adjudication, not just union)

Unlike 30-research's straight union, JUDGE **adjudicates**:

- **2-of-3 or 3-of-3 lanes flag the same `loc` (same slide/block) with compatible `problem`** → auto-accept, merge into one patch, cite union of both lanes' `cites`.
- **Only 1 lane flags an issue:**
  - `high` severity → accept (a single correct catch still matters; don't let 2 silent lanes veto).
  - `medium`/`low` severity → accept only if the issue is directly traceable to an R0 `missing[]` entry or a T01-T05 claim (i.e., grounded, not the lane's opinion).
- **Lanes disagree** (one says "add X", another says "remove X" at the same `loc`) → do NOT auto-resolve. Escalate to a `## OPEN CONFLICT` block in `50-patch/<session>.md` for the owner, do not silently pick a side.
- Every accepted issue **must carry ≥1 cite** (upstream URL or `MID:*`) — uncited issues are dropped, same rule as `cite_filter.py` applies here.

## 4. What a patch entry contains

```
## <loc>
- severity: high|medium|low
- type: pedagogy|technical|assessment|differentiation|other
- lanes: [codex, opencode]   # which lane(s) raised it
- problem: <one sentence>
- fix: <one sentence, actionable — what changes in the session file>
- cites: [<url or MID>, ...]
```

## 5. Non-negotiables (auto-high regardless of lane count)

Per `agent-memory.md` pipeline decisions — these override the scoring math above:

- Technical error in the course platform's programming model that would make a student's program not do what the slide claims (wrong block, wrong parameter semantics, wrong port or unit — judged against T04).
- A session missing `answer_key` where T03 already supplies the canonical answer — patch it in, don't just flag it.
- A documented misconception left uncorrected, where T03 already records it for this session.
- Arabic-language changes are never authored by codex/opencode/hermes lane suggestions — if a lane proposes Arabic text, drop the text, keep the underlying English fix, flag for Claude at 70-localized.

## 6. Refuter stage (55-refuted, downstream of this rubric)

Accepted `high`-severity patches get one refutation pass: a lane tries to argue the patch is wrong or unnecessary. Patch survives unless the refuter cites a stronger, equally-grounded source. This rubric does not itself run the refuter — it only decides what enters 50-patch/ as a candidate.
