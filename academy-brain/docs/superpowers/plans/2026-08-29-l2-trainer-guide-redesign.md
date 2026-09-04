# Implementation Plan - EV3 Robotics Level 2 Trainer Guide Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author and render a rich, Arabic-first, narrative-driven Level 2 Trainer Guide (`L2-trainer-guide.md` & `L2-trainer-guide.pdf`) covering all 8 sessions with complete pedagogical depth, 120-minute pacing, and zero boilerplate.

**Architecture:** 
- Markdown source authored in `D:\vault\ev3-academy\75-bundle\L2-trainer-guide.md` following the 12-section per-session structure.
- Content structured into 3 distinct thematic arcs: The EV3 Puppy Arc (S1–S4), The Color Sorter Arc (S5–S6), and Diagnostics & Assessment (S7–S8).
- Rendered into a styled PDF (`D:\vault\ev3-academy\80-generation\L2-trainer-guide.pdf`) via Markdown-to-HTML/CSS and Chrome headless print.
- Provenance ledger updated in `D:\vault\ev3-academy\90-receipts\L2-trainer-guide.ev3-specialist.yaml`.

**Tech Stack:** Markdown, Arabic typography (RTL/LTR handling), HTML5/CSS3, Python / Chrome headless PDF generator.

## Global Constraints

- **Language Balance:** 70% Arabic (friendly Egyptian/Arabic explanation, scripts, questions) / 30% English (block names, variables, ports, STEM terms).
- **Session Duration:** 120 minutes per session (five-block clock-time timeline: `00:00–00:10` to `01:50–02:00`).
- **Standardized Sections:** 12 distinct sections per session with zero repeated boilerplate.
- **Technical Integrity:** Exact EV3 motor ports (`A`, `C`, `D`), sensor ports (`Port 3`, `Port 4`), angular indexing (`10°`, `132°`, `360°`, `530°`), and logic structures preserved from source digests.
- **Graduation Rubric:** Session 8 rubric weights strictly maintained (20% Build, 20% Modular Code, 20% Sensor/State/Queue, 15% Motor Integration, 15% Debugging Evidence, 10% Explanation).

---

## Tasks

### Task 1: Level Overview & Arc 1: EV3 Puppy (Sessions 1–2)

**Files:**
- Modify: `D:\vault\ev3-academy\75-bundle\L2-trainer-guide.md`

**Content to Author:**
- **Level Overview:** Pedagogical transition from single-session builds (L1) to multi-session complex systems (L2), 5-phase delivery framework (`Think → Build → Test → Debug → Explain`), and safe storage protocols.
- **Session 1 — Puppy Build: Foundation:**
  - *Mission & Story:* Laying the rigid anatomical chassis and hub support for the bionic puppy.
  * *Trainer Explanation:* Explaining structural rigidity, cross-bracing, and symmetry in natural Arabic.
  * *Ask Students & Bugs:* Specific questions about structural load, axle friction, and motor assignment (`Ports A, C, D`).
- **Session 2 — Puppy Build: Motion System:**
  - *Mission & Story:* Giving the puppy walking and sitting motion via dual motorized 4-bar linkages.
  * *Trainer Explanation:* Teaching motor degree counting, degree resets, and synchronized motion using `Broadcast` and `Boolean flags`.
  * *Ask Students & Bugs:* Questions on phase alignment, binding linkages, and independent motor control.

- [ ] **Step 1: Draft Level Overview and Sessions 1–2 in Markdown**
- [ ] **Step 2: Verify Arabic fluency, RTL/LTR cleanliness, and technical accuracy**
- [ ] **Step 3: Update `L2-trainer-guide.md` with Level Overview and Sessions 1–2**

---

### Task 2: Arc 1: EV3 Puppy (Sessions 3–4)

**Files:**
- Modify: `D:\vault\ev3-academy\75-bundle\L2-trainer-guide.md`

**Content to Author:**
- **Session 3 — Puppy Build: Head & Final Assembly:**
  - *Mission & Story:* Adding personality, expressive head movement, and audio reactions (snoring, whining).
  * *Trainer Explanation:* Explaining parameterized My Blocks (`move head(position)`), motor position feedback, audio loops, and state variables (`snoring = true/false`).
  * *Ask Students & Bugs:* Questions on cable clearance, sound interrupt handling, and center of mass.
- **Session 4 — Puppy Programming & Integration:**
  - *Mission & Story:* Bringing the robotic puppy to life as an autonomous companion with independent behaviors.
  * *Trainer Explanation:* Teaching elapsed timers, randomized intervals (`1–5s` for blinking, `1–10s` for looking), non-blocking logic, and subsystem integration.
  * *Ask Students & Bugs:* Questions on timer drift, posture stability, and multi-subsystem coordination.

- [ ] **Step 1: Draft Sessions 3–4 in Markdown**
- [ ] **Step 2: Verify Arabic fluency and non-blocking state machine explanations**
- [ ] **Step 3: Append Sessions 3–4 to `L2-trainer-guide.md`**

---

### Task 3: Arc 2: Smart Automated Factory / Color Sorter (Sessions 5–6)

**Files:**
- Modify: `D:\vault\ev3-academy\75-bundle\L2-trainer-guide.md`

**Content to Author:**
- **Session 5 — Color Sorter Build: Conveyor & Scanner:**
  - *Mission & Story:* Constructing the factory conveyor feed and optical scanning station with digital queue memory.
  * *Trainer Explanation:* Explaining Color Sensor modes, constant mapping (`BLUE=2, GREEN=3, YELLOW=4, RED=5`), the FIFO `List/Queue` data structure, and optical debouncing.
  * *Ask Students & Bugs:* Questions on conveyor belt tension, false color triggers, and queue length.
- **Session 6 — Color Sorter Build: Sorting & Ejection:**
  - *Mission & Story:* Automating precision color sorting via an indexed rotating turntable and motorized ejector.
  * *Trainer Explanation:* Explaining queue iteration, angle mapping (`Blue 10°, Green 132°, Yellow 360°, Red 530°`), dual-direction actuation (Motor A $\pm 90^\circ$), and full pipeline coordination (`reset → scan → sort`).
  * *Ask Students & Bugs:* Questions on motor zeroing, jam clearance, and batch testing up to 8 blocks.

- [ ] **Step 1: Draft Sessions 5–6 in Markdown**
- [ ] **Step 2: Verify queue logic, indexed degree tables, and mechanical troubleshooting**
- [ ] **Step 3: Append Sessions 5–6 to `L2-trainer-guide.md`**

---

### Task 4: Arc 3: Diagnostics & Graduation Assessment (Sessions 7–8)

**Files:**
- Modify: `D:\vault\ev3-academy\75-bundle\L2-trainer-guide.md`

**Content to Author:**
- **Session 7 — Level 2 Review & Debugging Lab:**
  - *Mission & Story:* Acting as certified robotics diagnostic engineers across two specialized fault stations (Puppy Station & Sorter Station).
  * *Trainer Explanation:* Guiding students through the scientific debugging ladder (`Predict → Test → Isolate → Single-Variable Change → Retest → Explain`).
  * *Stations & Faults:* Concrete seeded fault scenarios (e.g., reversed motor polarity, uncalibrated sensor threshold, queue index mismatch).
- **Session 8 — Level 2 Practical Assessment:**
  - *Mission & Story:* Graduation day practical demonstration and engineering defense.
  * *Trainer Explanation:* Managing the assessment floor, evaluating individual contributions within teams, and conducting oral defense.
  * *Assessment Rubric:* Complete 6-criterion rubric with evidence descriptors and 60% pass threshold.

- [ ] **Step 1: Draft Sessions 7–8 in Markdown**
- [ ] **Step 2: Verify assessment procedures, rubric calculations, and debugging templates**
- [ ] **Step 3: Append Sessions 7–8 to `L2-trainer-guide.md`**

---

### Task 5: PDF Generation, Visual QA & Receipt Verification

**Files:**
- Create/Update: `D:\vault\ev3-academy\80-generation\L2-trainer-guide.pdf`
- Modify: `D:\vault\ev3-academy\90-receipts\L2-trainer-guide.ev3-specialist.yaml`

- [ ] **Step 1: Render `L2-trainer-guide.md` to HTML with Techno Square brand styles and high-quality RTL Arabic typography**
- [ ] **Step 2: Compile to PDF via Chrome headless**
- [ ] **Step 3: Visually verify generated PDF pages for flawless layout, pagination, and RTL/LTR text rendering**
- [ ] **Step 4: Update verification receipt `L2-trainer-guide.ev3-specialist.yaml`**

---

## Verification Plan

### Automated Checks
- Verify markdown file syntax and completeness across all 8 sessions.
- Run Python verification script to confirm:
  - All 12 required sections exist in every session.
  - Zero empty boilerplate phrases.
  - Correct 70/30 Arabic/English balance.
- Check PDF generation exit code and verify generated page count.

### Manual / Visual Verification
- Review PDF pages to ensure Arabic text renders naturally with proper glyph shaping, correct bidirectional text flow, and crisp Techno Square brand styling.
