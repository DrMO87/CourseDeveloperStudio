# Resume point — paused 2026-08-22 14:20

Plain English first, detail below.

## Where things stand

Goal: turn this micro:bit project into a reusable template so the EV3 course
starts from a working environment instead of a redesign.

Done and tested (138 tests green, nothing committed yet):

- The course is now described by one file, `course.yaml`, instead of being
  hardcoded. A second course can be created without editing code.
- The generator refuses to build a session that the course says produces no
  artifacts (session 8, graduation). Before, it would have built a full deck.
- Slides and assets are now cross-checked before generation, so a slide can no
  longer point at an image that does not exist.
- New `scripts/swarm/overlay.py` puts the images into the exported deck and
  fails hard if any reserved image box is still empty. This is the bug that hit
  L1-s1: empty dashed boxes shipped while the images sat on disk.
- The EV3 specialist agent, its doctrine, and its data schema exist.
- The debugging-lab design rules were extracted into a reusable template before
  anything gets archived.

## In flight at the pause — FINISHED CLEAN

OpenCode completed its rewrite of `scripts/swarm/check_assets.py` at 14:2x,
exit code 0. The tree is not broken:

- full suite: **152 passed** (was 138 before this lane)
- `check_assets.py --self-check`: OK
- it stayed inside its file scope — only `check_assets.py` and its test changed

So there is nothing to clean up on resume. The work is done but **not yet
reviewed**, which is the first item below.

## Next, in order

1. Verify + adversarially review the check_assets fix. Settle whether opencode
   is trusted with real code lanes (deferred, see `graduation_note`).
2. Re-review the EV3 specialist work — fixes are applied, reviewer has not
   looked again. Not done until APPROVED.
3. Wire `overlay.overlay()` and `overlay.assert_filled()` into the live path in
   `generate_session.py`, after the PDF download. The module and its 17 tests
   exist; only the call is missing. Until then a deck with an empty image box
   can still be delivered.
4. Get the executor lane reviewed.
5. Then: neutralise the micro:bit wording in the shared templates, create an
   empty EV3 course, start EV3 source research, run a pilot session.

## The only thing that needs Dr. Refaat

Read the labels on the EV3 kit boxes, count them, photograph the labels.
No robotics judgment — the agents do that.

## Housekeeping

Nothing is committed since `35f53dd`. Everything above is in the working tree.
Shell quoting on Windows keeps dropping zero-byte junk files in the repo root;
clear with:

```bash
find . -maxdepth 1 -type f -size 0 -not -path "./.git/*" -delete
```
