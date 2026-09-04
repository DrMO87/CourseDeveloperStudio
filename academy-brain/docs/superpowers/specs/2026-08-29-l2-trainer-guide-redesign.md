# Design Specification: EV3 Robotics Level 2 Trainer Guide Redesign

**Date:** 2026-08-29  
**Status:** Approved  
**Author:** Pair Programming Session  
**Target Audience:** Arabic-speaking EV3 robotics trainers teaching ages 11–13.  

---

## 1. Problem Statement & Motivation

The current draft of the Level 2 Trainer Guide (`75-bundle/L2-trainer-guide.md` and rendered PDF) suffers from severe quality and usability issues:
1. **Broken Arabic/English Readability & RTL/LTR Inversions:** English keyword lists are dropped raw into incomplete Arabic sentences (`اربط البناء بالوظيفة: Structural frame; bracing; symmetry...`), causing punctuation flips, disjointed reading, and cognitive friction for an Arabic-speaking trainer in a live classroom.
2. **Zero Storytelling & Narrative Engagement:** Level 2 has two major multi-session build arcs (Sessions 1–4: EV3 Puppy robotic pet; Sessions 5–6: Color Sorter industrial automation line; Session 7: Diagnostic Lab; Session 8: Practical Assessment). The current guide treats each session as an isolated list of specs with no mission context or thematic storyline.
3. **Repetitive Copy-Paste Boilerplate:** Sections such as *Before the Session*, *Trainer Explanation*, *Common Debugging Route*, *Differentiation*, and *Exit Ticket* are virtually identical word-for-word across all 8 sessions, providing zero session-specific mechanical or code facilitation guidance.
4. **Missing Practical Classroom Tools:** Missing the rich "Ask Students" guiding questions, specific debugging tables for that session's mechanism, and practical classroom management strategies that existed in Level 1.

---

## 2. Goals & Design Principles

* **70% Arabic / 30% English Balance:** English exclusively for block names, motor/sensor ports, variables, and technical terms (`Port A`, `My Block`, `List/Queue`, `Broadcast`, `Degrees`). Natural, fluent, and friendly Egyptian/Arabic prose for explanations, trainer scripts, and questioning prompts.
* **Coherent Storytelling Arcs:**
  * **Arc 1 (Sessions 1–4): "The Bionic Puppy"** — From chassis foundation, to motorized gait & linkage mechanics, to expressive personality/audio, to autonomous multi-sensor state behavior.
  * **Arc 2 (Sessions 5–6): "Smart Automated Factory"** — From conveyor belt feeding & optical queue scanning, to motorized indexed color sorting and ejection.
  * **Arc 3 (Sessions 7–8): "Diagnostics & Graduation"** — Structured scientific fault diagnosis and rubric-based assessment.
* **12-Section Standardized Session Structure:** Every session provides complete, unique, non-boilerplate guidance for the 120-minute delivery.
* **High-Purity Technical Accuracy:** Exact EV3 ports, angles, variables, and My Block parameters preserved from the source material and L2 digests.

---

## 3. Standardized Per-Session Architecture

Each session will be authored with the following 12 distinct sections:

1. **Header & Metadata:**
   * Session Number & Title
   * Duration: 120 minutes
   * Robot / Subsystem
   * Focus Areas
2. **Session Mission & Storyline (القصة ومهمة اليوم):**
   * Real-world engineering context and narrative mission to hook students.
3. **Session Goal & Learning Evidence (الهدف ومؤشرات التعلم):**
   * Clear, measurable mechanical and programming learning outcomes.
4. **Before the Session (تحضير المدرب والأدوات):**
   * Specific build steps, pre-sorted parts trays, battery/cables, and home position calibrations.
5. **Trainer Flow (الجدول الزمني للسيشن - 120 دقيقة):**
   * Timestamped timeline (`00:00–00:10` to `01:50–02:00`) adhering to `Think → Build → Test → Debug → Explain`.
6. **Trainer Explanation & Concept Delivery (طريقة شرح المفاهيم وتبسيطها):**
   * Conversational guidance on how the trainer should explain and demonstrate key concepts in natural Arabic.
7. **Code & Mechanism Reference:**
   * Structured pseudocode / logic steps clearly formatted.
8. **Ask Students (أسئلة التوجيه والتوقع):**
   * 4–5 targeted questions to provoke prediction before running code.
9. **Session Challenge (التحدي الإضافي للمتميزين):**
   * Extension challenge for fast-finishing teams.
10. **Common Bugs & Troubleshooting Guide (أشهر الأخطاء وحلولها):**
    * Concrete mechanical and software bugs specific to that session, with trainer guidance.
11. **Safe Stop & Storage (نقطة الإيقاف الآمن والتخزين):**
    * Exact instructions for preserving the incomplete build for the next session without disassembly.
12. **Exit Ticket (تذكرة الخروج):**
    * Session-specific reflection prompt.

---

## 4. Content Matrix Across Sessions

### Session 1 — Puppy Build: Foundation
* **Theme:** Skeletal Structure & Hub Integration
* **Key Concepts:** Structural bracing, symmetry, axle alignment, friction reduction, port assignment (A, C, D).
* **Story:** Designing the sturdy skeletal chassis for our robotic pet to ensure it can withstand dynamic leg movements.

### Session 2 — Puppy Build: Motion System
* **Theme:** Motorized Gait & Dual-Motor Synchronization
* **Key Concepts:** Linkages, 4-bar motion, motor degrees counting, degree reset, `Broadcast`, `Boolean flags`, `wait until [flag AND flag]`.
* **Story:** Giving the puppy walking and sitting capabilities by synchronizing two independent leg motors.

### Session 3 — Puppy Build: Head & Final Assembly
* **Theme:** Expressive Mechanism & Audio Behaviors
* **Key Concepts:** My Blocks with parameters (`move head(position)`), motor position feedback, sound looping (`snoring`), state variables (`snoring = true/false`), sequential behaviors (`stretch`).
* **Story:** Bringing personality and life to the puppy with responsive head movement and sounds.

### Session 4 — Puppy Programming & Integration
* **Theme:** Autonomous Intelligence & State Machine Integration
* **Key Concepts:** Timers (`elapsed time`), random intervals (`random 1-5s` for blinking, `random 1-10s` for looking direction), non-blocking logic, complete system integration.
* **Story:** Transforming our puppy into an autonomous companion that behaves naturally on its own.

### Session 5 — Color Sorter Build: Conveyor & Scanner
* **Theme:** Smart Conveyor Feeding & Optical Data Queue
* **Key Concepts:** Conveyor belt mechanics, Color Sensor calibration, constant mapping (`BLUE=2, GREEN=3, YELLOW=4, RED=5`), `List/Queue` (FIFO), debouncing color reads.
* **Story:** Building an automated factory sorting line that scans parts and buffers them into a digital memory queue.

### Session 6 — Color Sorter Build: Sorting & Ejection
* **Theme:** Indexed Motor Turntable & Actuator Ejection
* **Key Concepts:** Queue iteration, angle mapping (`Blue 10°, Green 132°, Yellow 360°, Red 530°`), dual-direction actuation (Motor A clockwise 90° then counter-clockwise 90°), pipeline coordination (`reset → scan → sort`).
* **Story:** Completing the automated factory with motorized precision sorting and automated packaging ejection.

### Session 7 — Level 2 Review & Debugging Lab
* **Theme:** Diagnostic Mastery & Systematic Troubleshooting
* **Key Concepts:** `Input → Process → Output`, mechanical vs. software fault isolation, single-variable testing, state inspection, debugging records.
* **Story:** Operating as certified robotics engineers diagnosing and resolving real-world faults on both robotic platforms.

### Session 8 — Level 2 Practical Assessment
* **Theme:** Practical Demonstration & Engineering Defense
* **Key Concepts:** 6-criterion rubric evaluation (Build quality 20%, Modular code 20%, Sensor/State/Queue 20%, Motor output 15%, Testing/Debugging 15%, Explanation 10%), 60% pass threshold.
* **Story:** Graduation day where student teams repair, program, and defend an EV3 robotics subsystem independently.

---

## 5. File Deliverables

* `D:/vault/ev3-academy/75-bundle/L2-trainer-guide.md`: Fully redesigned Markdown source.
* `D:/vault/ev3-academy/80-generation/L2-trainer-guide.pdf`: Rendered high-quality PDF.
* `D:/vault/ev3-academy/90-receipts/L2-trainer-guide.ev3-specialist.yaml`: Updated verification receipt.
