---
type: handoff
status: complete
date: 2026-09-05
owner: codex (dispatched via codex-delegate, read-only, session 01a06ee1-279e-78b2-ac59-2df2e1ba2d76)
---

# STEP 9 pre-work — diagnosis of academy-brain's actual digestion pipeline

> Dispatched before STEP 9 Phase A to get an independent, code-grounded answer to
> Dr. Mahmoud's complaint ("the AI doesn't do any content digestion, just text
> extraction") before comparing academy-brain against MVP. Read-only investigation,
> no files modified. All paths below are under
> `D:\vault\SM\CourseDeveloperStudio\academy-brain`.

## Plain-English verdict

The complaint is accurate. The stage that's supposed to distill teaching material
into "what the session actually teaches" doesn't do that — it copies slide text and
speaker notes out of the PowerPoint file, pulls out the images, and reformats it all
as Markdown. No summarizing, no picking out what matters, no restructuring around
what students need to learn.

The problem is bigger than that one file, though. Most of the 11 documented pipeline
stages (receipts, research, digest, provenance, critique, patch, refutation,
approval, localization, bundling, generation) are implemented as **file-presence
gates**, not as real content work: the code checks "does a file with the expected
name exist" (and sometimes light metadata like a citation string being non-empty),
not "is the content in that file actually good." Critique doesn't critique,
refutation doesn't refute, localization doesn't translate — they're gates dressed as
review stages. The one clear exception: the final generation stage really does call
out to NotebookLM to build the Arabic decks — that part is genuine AI generation,
not extraction. But it never receives any real digested understanding from earlier
stages, because that understanding is never produced.

## Stage-by-stage table

| Stage | Verdict | Code citation | Why |
|---|---|---|---|
| Receipts | extraction-only* (gate only) | `scripts/swarm/stage_gate.py:64–75,171–177` (`STAGE_CHAIN`, `check_stage`); `scripts/swarm/gate_runner.py:44–66` (`write_receipt`) | Accepts a matching YAML file; the writer serializes gate results, not sourced claim cards. |
| Research | extraction-only* (gate only) | `scripts/swarm/stage_gate.py:66,171–177`; `scripts/swarm/gates/pedagogy_coverage.py:107–175` (`pedagogy_coverage`) | Checks for research files and declared taxonomy coverage; does not research sources or author assessments. |
| **Digest** | **extraction-only** | `scripts/swarm/digest_office.py:36–107` (`extract_pptx`, `_save_image`, `extract_docx`); `scripts/run_digest.py:44–75` (`render_digest`) | Text, notes, image bytes extracted and reformatted with no semantic synthesis. |
| Provenance | extraction-only* (gate only) | `scripts/swarm/stage_gate.py:68,171–177`; `scripts/swarm/paths.py:55–56` | Derives a filename and checks existence, no claim-to-source tracing. |
| Critique | extraction-only* (gate only) | `scripts/swarm/stage_gate.py:69,171–177`; `scripts/swarm/gates/cite_filter.py:14–47` | Checks supplied issues have a non-empty citation string; no independent critique produced. |
| Patch | extraction-only* (gate only) | `scripts/swarm/stage_gate.py:70,171–177`; `scripts/scaffold_vault.py:39,59–76` | Requires a patch file to exist; nothing adjudicates critiques or applies fixes. |
| Refutation | extraction-only* (gate only) | `scripts/swarm/stage_gate.py:71,171–177`; `scripts/scaffold_vault.py:40,59–76` | Records ownership and requires a file; nothing challenges an accepted claim or patch. |
| Approval | extraction-only* (gate only) | `scripts/swarm/stage_gate.py:72,171–177`; `scripts/swarm/generate_session.py:247–300` (`enforce_blueprint_gate`) | Checks approval artifact/metadata/gap markers; doesn't settle the English content itself. |
| Localization | extraction-only* (gate only) | `scripts/swarm/stage_gate.py:73,171–177`; `scripts/swarm/gates/arabic_ratio.py:23–48` | Character-ratio check only; no translation/adaptation implementation. |
| Bundling | extraction-only* (gate only) | `scripts/swarm/generate_session.py:307–354` (`reconcile_slides`), `471–519` (`build_plan`) | Selects existing bundle text/assets; doesn't author lesson/blueprint/home-summary content. |
| Generation | **hybrid** | `scripts/swarm/generate_session.py:719–744,819–878` (`_run_pass`); `563–600` (`_composite`) | NotebookLM does real generation from sources/instructions; upload/download/compositing around it is mechanical. |

\* "extraction-only" is the closest fit among the three requested categories; these
stages contain no extractor at all, just a file-presence/metadata gate standing in
for the review work the docs describe.

## `digest_office.py` / `run_digest.py` — what it actually does

1. Selects one of 11 hardcoded PPTX files from `SOURCE_MAP` — can't take an arbitrary
   PDF or infer session assignment (`run_digest.py:17–33,78–87`).
2. Validates the session ID against a configured set — not whether the material
   pedagogically belongs in that session (`paths.py:19–33`).
3. Copies slide title + body text verbatim (`digest_office.py:41–61,70–72`).
4. Copies speaker notes separately, never reconciled with slide text or turned into
   teaching guidance (`digest_office.py:63–71`).
5. Saves image bytes + inventory metadata (filename, slide #, extension, byte count)
   — no image interpretation or OCR (`digest_office.py:78–100`).
6. Records extraction warnings (missing title/body/image) — not accuracy or
   pedagogical-quality checks (`digest_office.py:67–68,78–83`).
7. Wraps the extraction as a "digest": heading per slide, body/notes copied,
   images/warnings listed, YAML metadata added, status `gated`/`complete`
   (`run_digest.py:44–75`; `envelope.py:63–78`).
8. Writes Markdown, reports counts, returns 0 even with warnings (`run_digest.py:87–101`).

What real digestion would require but this doesn't do: select the important
concepts, summarize/explain them, restructure around learning objectives, reconcile
conflicting statements, connect related sources, infer prerequisites, evaluate
factual support, derive activities/assessments.

## DIGEST-stage trace

Two different descriptions of how `10-digest/<session>.md` gets populated:

- **Documented PDF workflow** (`00-contracts/pdf-intake-sop.md:84–92`): a specialist
  authors a sourced receipt, then "Orchestrator authors `10-digest/<session>.md`
  from the receipt" — assigned authoring work, not automated.
- **Implemented Office workflow** (`run_digest.py:78–89`): reads a mapped PPTX,
  extracts, renders straight to Markdown — never reads the specialist receipt at all.

Generation doesn't supply the missing transformation either:
`enforce_stage_chain()` → `stage_gate.check_stage()` uses a filename glob and
succeeds if any matching file exists — it doesn't read the digest's actual text or
status (`generate_session.py:211–225`; `stage_gate.py:171–177`). `build_plan()`
consumes already-authored `slides-source.md`/`decisions.md`/`home-summary.md` and
never loads the digest, receipt, provenance, critique, patch, approved, or localized
text as content inputs (`generate_session.py:471–519`).

## Doc-vs-code drift (selected)

- **"Distilled" vs. slide dump**: `docs/ENGINE.md:56` claims digest = "source
  material distilled to what the session teaches"; the code preserves slide
  sequence and copies text with no relevance selection or condensation
  (`digest_office.py:43–75`; `run_digest.py:55–75`).
- **Receipt-derived digest prescribed, not automated**: `00-contracts/pdf-intake-sop.md:89`
  assigns digest-authoring to an "Orchestrator" from a receipt; the only executable
  runner ignores receipts entirely and works straight from PPTX
  (`run_digest.py:83–89`; `generate_session.py:1407–1414`).
- **Independent critique/adjudication/refutation not executable**: `docs/ENGINE.md:58–60`
  describes three independent critique lanes, a judge, and a refutation pass; the
  stage gate only checks that matching JSON/Markdown files exist
  (`stage_gate.py:69–71,171–177`; `scaffold_vault.py:59–76`). The docs themselves
  concede some contracts are "only doctrine" (`ENGINE.md:86–88`).
- **Older spec's extraction scope exceeds what's implemented**: the 2026-08-20 design
  spec describes 11 PPTX + 6 DOCX, full `ppt/media/` enumeration, dimensions/alt-text
  in the manifest, and coverage/orphan gates; the implemented runner only processes
  the 11 PPTX (never calls `extract_docx`), only saves images found via recognized
  slide shapes, records no dimensions/alt-text, and has no coverage/orphan gate
  (`docs/superpowers/specs/2026-08-20-microbit-course-swarm-design.md:277–281`;
  `run_digest.py:21–33,78–101`; `digest_office.py:43–100`).
- **Localization gate doesn't localize**: spec claims "approved English content
  becomes 30/70 bilingual copy"; `arabic_ratio.check()` only counts characters, it
  doesn't translate — Arabic generation happens later, separately, through
  NotebookLM (`docs/superpowers/specs/2026-08-20-microbit-course-swarm-design.md:327–329`;
  `arabic_ratio.py:23–48`; `generate_session.py:819–824`).
- Notably, the **original** design spec calls DIGEST "Mechanical; LLMs add nothing to
  XML extraction" (`...design.md:73`) — the implementation matches that original
  intent. The drift is against the *newer* "distilled" description in `ENGINE.md`,
  and against treating the documented authoring procedure as already-automated.

## Why this matters for STEP 9

This confirms the real target is broader than "does academy-brain have a capability
MVP already solved." Most of academy-brain's own pipeline stages are gates checking
for a file's existence, not stages that do the content work their names promise.
STEP 9 Phase A must diagnose and propose fixes for academy-brain's own gate-only
stages directly — using MVP's pipeline as one candidate source of transferable
capability, not the only one, since MVP may not have equivalents for stages like
critique/patch/refutation.
