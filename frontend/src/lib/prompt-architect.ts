/**
 * Prompt Architect & Vault Injector Engine
 * Based on DrMO87/NotebookLM-Prompt-Architect (upstream arlinamid/notebooklm-browser-plugin)
 *
 * Implements strict grounding rules, curated templates across 4 modalities
 * (Slides, Infographics, Audio, Video), and dynamic vault content extraction.
 */

import type { Organization, CourseProject, CourseSession, ProjectDossierFile } from './types';

export type PromptFormat = 'slides' | 'infographic' | 'audio' | 'video';

export interface PromptSlot {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  format: PromptFormat;
  description: string;
  source: string;
  recommendedUse: string;
  slots: PromptSlot[];
  systemInstructions: string;
}

export interface VaultContext {
  courseName: string;
  courseCode: string;
  sessionCode: string;
  sessionTitle: string;
  audience: string;
  learningOutcomes: string[];
  brandPaletteHex: string[];
  forbiddenTerms: string[];
  languagePrimary: string;
  languagePolicySummary: string;
  pedagogicalLevel: string;
  evidenceRequirements: string;
}

export const STRICT_GROUNDING_HEADER = `GROUNDING — read this first:
Use my selected sources as the only subject matter. Every claim, figure, name and example must come from them; add nothing from outside knowledge and invent nothing. If the layout calls for something the sources do not cover, drop that element rather than filling it with invented content.

CONTENT FIDELITY & NO SUMMARIZATION:
Follow the original lecture content EXACTLY as authored. Do NOT summarize away, truncate, or omit theoretical mechanisms, scientific equations, mathematical proofs, derivations, or nomenclature. Maintain the complete academic depth, precision, and rigor of the source material.

NO FORCED APPLICATIONS:
CRITICAL RULE: NOT EVERY LECTURE HAS AN APPLICATION. Do NOT force, invent, or hallucinate pharmaceutical, clinical, industrial, or medical applications if they are NOT explicitly present in the original lecture sources. If this lecture focuses on foundational physics, optical theory, or mathematical derivations, present it faithfully as pure foundational theory without inventing artificial applications.

VISUAL REFINEMENT & ASSETS:
You are authorized and instructed to ORGANIZE AND IMPROVE VISUALS. Structure the explanations with clear hierarchical layouts, distinct conceptual sections, process flow sequences, and clean pedagogical scaffolding. Actively incorporate, highlight, and reference the institutional logo and all source images, diagrams, schematics, and figures provided in the sources.

Everything below this line describes ONLY the visual style and structure of the output. It is not the topic — never present, explain or refer to the style guide itself.

Text in [SQUARE BRACKETS] marks a slot for me to fill in. If any slot is still unfilled when you run this, infer a sensible value from the sources and carry on — never ask me to fill it in, and never repeat the bracketed text in your output.`;

// ─── Curated Templates Library (from NotebookLM Prompt Architect) ─────────────

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // ─── SLIDES ─────────────────────────────────────────────────────────────────
  {
    id: 'slides-detailed-deck',
    name: 'Academic Detailed Deck (Standalone Lecture)',
    format: 'slides',
    description: 'Comprehensive 16-slide academic lecture presentation following Bloom\'s Revised Taxonomy cognitive ascent with delivery notes.',
    source: 'NotebookLM Prompt Architect / vibeproductmarketing',
    recommendedUse: 'Formal academic lectures, standalone study slide decks, accreditation review',
    slots: [
      { key: 'AUDIENCE', label: 'Target Audience', description: 'Academic level and student demographic', defaultValue: 'University pharmacy undergraduates' },
      { key: 'TOPIC_ILOS', label: 'Topic & Outcomes', description: 'Session title and intended learning outcomes', defaultValue: 'Spectrophotometry Fundamentals & ILOs 1.1, 2.1' },
      { key: 'PALETTE', label: 'Brand Palette', description: 'Approved institutional hex colors', defaultValue: '#002060, #FFC000, #FFFFFF' },
      { key: 'LANGUAGE', label: 'Language Policy', description: 'Primary language and script constraints', defaultValue: 'English primary with technical nomenclature' },
    ],
    systemInstructions: `${STRICT_GROUNDING_HEADER}

Create a Detailed Deck for [AUDIENCE].
Subject Focus: [TOPIC_ILOS]

Structure (16-Slide Cognitive Ascent):
1. Title Slide: Course code, session title, academic term, institutional branding
2. Intended Learning Outcomes (ILOs) & Cognitive Map (Bloom's Taxonomy)
3. Foundational Principles & Core Terminology
4-7. Progressive Deep Dive: Mechanisms, Instrumentation, Governing Equations (Miller's Knows & Knows How)
8-11. Practical Applications, Methodologies, and Analytical Protocols
12-14. Case Studies, Data Analysis, and Critical Troubleshooting
15. Summary Matrix & Real-World Synthesis
16. Self-Assessment Checkpoints & Reference Citations

Style Guidelines (Motion Graphic Design Specification):
- STRICTLY UNIFORM BACKGROUND: Pure white (#FFFFFF) / high-key canvas on every single slide. Never alternate between dark and light backgrounds.
- SINGLE UNIFIED SANS-SERIF FONT: One modern geometric sans-serif typeface (Segoe UI / Inter / Helvetica) across the entire deck.
- CLEAN MOTION GRAPHIC LAYOUT: Minimalist layout with at least 35% negative space, clean modular cards with subtle borders (#E2E8F0), numbered step pills, horizontal process arrows.
- Brand Palette: [PALETTE] (Horus Navy #002060 for headers, Warm Gold #FFC000 for key tags, Slate #1E293B for body).
- Language: [LANGUAGE]
- Each slide MUST include: Slide Title, 3-4 structured bullet points or data callouts, and 1 practical Lecturer Delivery Note
- Exclude: Generic corporate clip art, hollow motivational quotes, ungrounded external claims, busy decorative gradients`,
  },
  {
    id: 'slides-antigravity-artifact',
    name: 'Anti-Gravity Living Artifact Presentation',
    format: 'slides',
    description: 'Minimalist, ultra-clean aesthetic with white space discipline, modern sans-serif typography, and system-in-operation layouts.',
    source: 'NotebookLM Prompt Architect / Original Library',
    recommendedUse: 'High-impact keynote slides, executive summaries, calm visual clarity',
    slots: [
      { key: 'AUDIENCE', label: 'Target Audience', description: 'Who the presentation is intended for', defaultValue: 'Faculty review board and advanced students' },
      { key: 'TOPIC_ILOS', label: 'Topic & Core Concept', description: 'Central thesis and concepts', defaultValue: 'Core Mechanisms and Scientific Systems' },
      { key: 'PALETTE', label: 'Palette Accents', description: 'Minimalist accent colors', defaultValue: 'Pure white canvas with #002060 navy and subtle gold accents' },
      { key: 'LANGUAGE', label: 'Language', description: 'Primary script', defaultValue: 'English' },
    ],
    systemInstructions: `${STRICT_GROUNDING_HEADER}

Style Name: Anti-Gravity / Living Artifact Presentation
Audience: [AUDIENCE]
Topic: [TOPIC_ILOS]

1. Core Concept:
This presentation is a living artifact. Visualizes thinking becoming structure.
Feels like an interface for ideas. Calm, modern, confident, precise.
Apple-level clarity, DeepMind research decks aesthetic.

2. Canvas & Palette:
- Pure white background (#FFFFFF) with high negative space
- Restrained color accents: [PALETTE]
- No visual noise, no heavy grids, no saturated background boxes

3. Typography & Hierarchy:
- Clean, modern sans-serif
- Calm authority: Large headline → One concise explanatory sentence → Structured cards
- Language: [LANGUAGE]

4. Slide Structures:
- Slide 1: System Title & Vision
- Slide 2: The Core Problem / Phenomenon
- Slide 3: Three-Column Capability / Component Cards
- Slide 4: Sequential System Pipeline (Input → Transform → Output)
- Slide 5: Data Evidence & Metric Proof
- Slide 6: Summary & Next Horizon

What to Avoid:
- No emojis, no pixel art, no thick borders, no marketing hype`,
  },
  {
    id: 'slides-presenter-support',
    name: 'Presenter Speaking Support Deck',
    format: 'slides',
    description: 'Minimal on-slide text with rich speaker prompts, cues, and cognitive pacing for live instructors.',
    source: 'NotebookLM Prompt Architect / vibeproductmarketing',
    recommendedUse: 'Live classroom lectures, instructor-led training, seminar presentations',
    slots: [
      { key: 'AUDIENCE', label: 'Target Audience', description: 'Learner audience profile', defaultValue: 'Undergraduate students in active classroom session' },
      { key: 'TOPIC_ILOS', label: 'Topic & Key Questions', description: 'Session subject and inquiry prompts', defaultValue: 'Analytical Instrumentation and Principles' },
      { key: 'LANGUAGE', label: 'Language', description: 'Delivery language', defaultValue: 'English with bilingual technical terminology' },
    ],
    systemInstructions: `${STRICT_GROUNDING_HEADER}

Create a Presenter Support Deck for [AUDIENCE].
Subject Focus: [TOPIC_ILOS]

Format:
- Minimal on-slide text (maximum 25 words per slide)
- Prominent visual placeholders, diagrams, and numerical callouts
- Language: [LANGUAGE]

For every slide provide:
1. VISUAL SLIDE:
   - One bold takeaway headline (max 8 words)
   - 2-3 concise anchor statements
   - 1 structured diagram or comparison table specification

2. INSTRUCTOR PROMPTER SCRIPT:
   - "Say This": 2-3 verbatim sentences introducing the concept
   - "Ask This": 1 targeted Socratic question to test student comprehension
   - "Watch Out For": Common student misconception grounded strictly in the source material`,
  },

  // ─── INFOGRAPHICS ───────────────────────────────────────────────────────────
  {
    id: 'infographic-process-timeline',
    name: 'Process Flow & Sequential Timeline',
    format: 'infographic',
    description: 'Isometric journey illustration or chronological spine with numbered milestones and clear progression flow.',
    source: 'NotebookLM Prompt Architect / Custom Validated',
    recommendedUse: 'Laboratory protocols, analytical workflows, chemical synthesis pipelines, curriculum roadmaps',
    slots: [
      { key: 'TOPIC', label: 'Process / Protocol Name', description: 'The workflow or procedure to illustrate', defaultValue: 'Step-by-step Analytical Protocol' },
      { key: 'PALETTE', label: 'Palette & Visual Accents', description: 'Color styling for stages', defaultValue: 'Soft slate, deep navy #002060, and warm amber accents' },
      { key: 'LANGUAGE', label: 'Language', description: 'Display labels language', defaultValue: 'English' },
    ],
    systemInstructions: `${STRICT_GROUNDING_HEADER}

Format: Vertical Process Timeline Infographic
Subject: [TOPIC]
Orientation: Portrait (9:16)
Palette: [PALETTE]
Language: [LANGUAGE]

Layout Architecture:
- Central vertical spine or winding isometric journey flowing top-to-bottom
- Sequential stations numbered 01 through 06/07
- Clear dependency connectors linking predecessor to successor steps

For Each Stage:
1. Distinct numbered badge with milestone title
2. Concrete action verbs derived strictly from the sources
3. Key scientific parameters, temperatures, formulas, or control thresholds
4. Critical checkpoint / quality verification badge

Visual Rule:
- Minimal text clutter, high visual hierarchy
- Visual storytelling through spatial progression and structured cards`,
  },
  {
    id: 'infographic-architecture-data',
    name: 'System Architecture & Data Topology',
    format: 'infographic',
    description: 'High-density visual schematic displaying component boundaries, inputs, transformations, and outputs.',
    source: 'NotebookLM Prompt Architect / Custom Validated',
    recommendedUse: 'Instrument anatomy, software pipeline architecture, dataflow diagrams, molecular pathways',
    slots: [
      { key: 'SYSTEM_NAME', label: 'System / Instrument', description: 'Name of the apparatus or system', defaultValue: 'Spectrophotometer Optical & Electronic System' },
      { key: 'PALETTE', label: 'Color Hierarchy', description: 'System boundary colors', defaultValue: 'Technical blue #002060, teal, and slate dark mode' },
      { key: 'LANGUAGE', label: 'Language', description: 'Diagram labels', defaultValue: 'English' },
    ],
    systemInstructions: `${STRICT_GROUNDING_HEADER}

Format: System Architecture & Dataflow Infographic
System: [SYSTEM_NAME]
Orientation: Landscape (16:9) or Portrait
Palette: [PALETTE]
Language: [LANGUAGE]

Visual Specification:
1. System Boundary: Clear boundary line separating external inputs from internal modules
2. Component Boxes:
   - Module Name
   - Core Scientific Function
   - Ingoing and Outgoing Signal / Matter specifications
3. Flow Connectors: Directional arrows indicating sequence of signal propagation
4. Governance / Quality Callout: Reference standards and validation criteria
5. High-contrast typography with clean bounding cards`,
  },
  {
    id: 'infographic-comparative-matrix',
    name: 'Comparative Matrix & Trade-Off Analysis',
    format: 'infographic',
    description: 'Side-by-side structured comparison evaluating methodologies, instruments, or principles against key criteria.',
    source: 'NotebookLM Prompt Architect / Custom Validated',
    recommendedUse: 'Technique comparisons (e.g. UV vs Visible, HPLC vs GC), diagnostic trade-offs',
    slots: [
      { key: 'SUBJECTS', label: 'Compared Entities', description: 'Two or three items being contrasted', defaultValue: 'Analytical Technique A vs Technique B' },
      { key: 'CRITERIA', label: 'Comparison Criteria', description: 'Dimensions of comparison', defaultValue: 'Sensitivity, Selectivity, Cost, Sample Preparation' },
      { key: 'LANGUAGE', label: 'Language', description: 'Language of matrix', defaultValue: 'English' },
    ],
    systemInstructions: `${STRICT_GROUNDING_HEADER}

Format: Comparative Matrix Infographic
Entities: [SUBJECTS]
Evaluation Criteria: [CRITERIA]
Language: [LANGUAGE]

Layout:
- Top Header: Clear identification of entities with brief one-line definitions
- Comparative Rows:
  - Row 1: Underlying Physical / Chemical Principle
  - Row 2: Sensitivity & Detection Limits
  - Row 3: Operational Requirements & Equipment Cost
  - Row 4: Key Advantages & Practical Bottlenecks
- Bottom Summary: Decision Tree ("Choose A when... Choose B when...")
- Icons for pros/cons with zero decorative fluff`,
  },

  // ─── AUDIO ──────────────────────────────────────────────────────────────────
  {
    id: 'audio-deep-dive-technical',
    name: 'Technical Deep Dive Podcast',
    format: 'audio',
    description: 'Analytical two-host discussion examining core mechanisms, challenging edge cases, and resolving contradictions between sources.',
    source: 'NotebookLM Prompt Architect / greeden.me',
    recommendedUse: 'In-depth conceptual study, commute listening for students, advanced exam preparation',
    slots: [
      { key: 'TOPIC', label: 'Specific Topic', description: 'Deep dive focus subject', defaultValue: 'Core Analytical Instrumentation Mechanisms' },
      { key: 'AUDIENCE_LEVEL', label: 'Expertise Level', description: 'Target listener background', defaultValue: 'Undergraduate pharmacy & science students' },
      { key: 'KEY_QUESTIONS', label: 'Core Questions', description: 'Central problems explored', defaultValue: 'Why does Beer-Lambert law deviate at high concentrations?' },
    ],
    systemInstructions: `Text in [SQUARE BRACKETS] marks a slot for me to fill in. If any slot is still unfilled when you run this, infer a sensible value from the sources and carry on — never ask me to fill it in, and never repeat the bracketed text in your output.

Format: Deep Dive (Two Hosts)
Length: Long / In-depth

Focus Instructions:
- Prioritize [TOPIC] grounded strictly in the provided sources
- Explore the core questions: [KEY_QUESTIONS]
- Target expertise level: [AUDIENCE_LEVEL]
- Have Host A unpack the primary theoretical framework while Host B probes edge cases, practical anomalies, and real-world failure modes
- Rigorously explain mathematical and physical dependencies using vivid verbal analogies
- Address common student misconceptions and clarify potential exam traps
- Maintain an intellectual, engaging, and curious conversational tempo without superficial banter`,
  },
  {
    id: 'audio-brief-summary',
    name: 'Executive Audio Briefing',
    format: 'audio',
    description: 'High-velocity 3-5 minute audio synthesis capturing essential takeaways, ILO milestones, and exam readiness cues.',
    source: 'NotebookLM Prompt Architect / Wonder Tools',
    recommendedUse: 'Pre-class primer, post-lecture recap, quick review before practical lab sessions',
    slots: [
      { key: 'TOPIC', label: 'Briefing Topic', description: 'Subject of the briefing', defaultValue: 'Session Essential Concepts & Takeaways' },
      { key: 'TARGET_EXAM_FOCUS', label: 'Key Focus Areas', description: 'High-yield points to retain', defaultValue: 'Definitions, formulas, and calibration rules' },
    ],
    systemInstructions: `Text in [SQUARE BRACKETS] marks a slot for me to fill in. If any slot is still unfilled when you run this, infer a sensible value from the sources and carry on — never ask me to fill it in, and never repeat the bracketed text in your output.

Format: Brief Overview / Executive Summary
Length: Short (3-5 minutes)

Focus Instructions:
- Deliver a rapid, high-yield audio brief on [TOPIC]
- Highlighting specifically: [TARGET_EXAM_FOCUS]
- Structure:
  1. The 30-Second Elevator Pitch (What is this and why does it matter?)
  2. The 3 Non-Negotiable Rules / Theorems
  3. One Crucial Common Pitfall to Avoid
- Tone: Direct, punchy, and clear`,
  },
  {
    id: 'audio-socratic-debate',
    name: 'Socratic Dialogue & Scientific Debate',
    format: 'audio',
    description: 'Dynamic dialectic between two researchers testing opposing hypotheses or evaluating the trade-offs of competing techniques.',
    source: 'NotebookLM Prompt Architect / Custom Validated',
    recommendedUse: 'Critical thinking development, case study analysis, thesis defense preparation',
    slots: [
      { key: 'TOPIC', label: 'Debate Proposition', description: 'The tension or question under debate', defaultValue: 'Accuracy vs Speed in High-Throughput Analysis' },
      { key: 'AUDIENCE_LEVEL', label: 'Audience Level', description: 'Academic background', defaultValue: 'Advanced scientific researchers & pharmacy students' },
    ],
    systemInstructions: `Text in [SQUARE BRACKETS] marks a slot for me to fill in. If any slot is still unfilled when you run this, infer a sensible value from the sources and carry on — never ask me to fill it in, and never repeat the bracketed text in your output.

Format: Debate (Two Opposing Perspectives)
Length: Standard

Focus Instructions:
- Debate topic: [TOPIC]
- Target audience: [AUDIENCE_LEVEL]
- Host 1 defends the conventional, highly rigorous baseline methodology
- Host 2 advocates for novel, high-speed, or automated alternatives
- Ground every argument and rebuttal directly in source data and empirical evidence
- End with a synthesized compromise outlining exact clinical or laboratory conditions for each approach`,
  },

  // ─── VIDEO ──────────────────────────────────────────────────────────────────
  {
    id: 'video-comprehensive-explainer',
    name: 'Comprehensive Scientific Explainer Video (6–10 min)',
    format: 'video',
    description: 'Full structured explainer video covering problem context, underlying physics, instrumentation walkthrough, and validation.',
    source: 'NotebookLM Prompt Architect / Wonder Tools',
    recommendedUse: 'Flipped classroom pre-recorded lecture, laboratory demonstration walkthrough, MOOC module',
    slots: [
      { key: 'AUDIENCE', label: 'Target Audience', description: 'Viewers background', defaultValue: 'Undergraduate pharmacy & biomedical students' },
      { key: 'TOPIC_FOCUS', label: 'Core Subject', description: 'Scientific topic to explain', defaultValue: 'Principles of Molecular Absorption & Instrumentation' },
      { key: 'VISUAL_STYLE', label: 'Visual & Scene Style', description: 'Animation and diagram direction', defaultValue: 'Clean technical animation with whiteboard schematics and real instrument overlays' },
      { key: 'LANGUAGE', label: 'Language', description: 'Audio narration & text language', defaultValue: 'English narration with bilingual subtitles' },
    ],
    systemInstructions: `${STRICT_GROUNDING_HEADER}

Create an EXPLAINER video script and storyboard outline for [AUDIENCE].
Subject Focus: [TOPIC_FOCUS]

Visual Style Direction: [VISUAL_STYLE]
Language: [LANGUAGE]

Video Architecture (6-10 Minutes):
1. The Hook & The Problem (0:00 - 1:00)
   - Real-world pharmaceutical challenge (e.g. assessing drug purity)
   - Why simple visual inspection fails
2. Fundamental Theory & Governing Law (1:00 - 3:00)
   - Derivation and physical meaning of the core mathematical law
   - Step-by-step schematic of photon-electron interaction
3. Component Walkthrough: Inside the Instrument (3:00 - 5:30)
   - Light source, wavelength selector, sample cuvette, detector, readout
   - What happens at each stage
4. Practical Protocol & Calibration (5:30 - 7:30)
   - Preparing blanks, standard curves, and calculating unknown concentrations
5. Limitations & Troubleshooting (7:30 - 9:00)
   - Deviations from ideality, chemical interferences
6. Key Takeaways & Practical Self-Check (9:00 - 10:00)

Narration Tone: Clear, professorial, engaging, free of marketing fluff.`,
  },
  {
    id: 'video-micro-lecture',
    name: 'Micro-Lecture Quick Explainer (2–3 min)',
    format: 'video',
    description: 'Bite-sized, high-retention video focusing exclusively on a single core theorem or equation derivation.',
    source: 'NotebookLM Prompt Architect / Wonder Tools',
    recommendedUse: 'Mobile micro-learning, pre-lab teaser, quick concept clarification before exams',
    slots: [
      { key: 'CONCEPT_NAME', label: 'Single Concept', description: 'The exact equation or principle', defaultValue: 'Derivation and Application of Beer-Lambert Law' },
      { key: 'AUDIENCE', label: 'Audience', description: 'Student audience', defaultValue: 'First-time learners in analytical sciences' },
    ],
    systemInstructions: `${STRICT_GROUNDING_HEADER}

Create a Quick Explainer Micro-Video (2-3 Minutes).
Subject: [CONCEPT_NAME]
Audience: [AUDIENCE]

Structure:
1. 0:00 - 0:20: The Core Question (What does this formula actually do?)
2. 0:20 - 1:15: Deconstructing the Formula Variables visually one by one
3. 1:15 - 2:00: One Concrete Numerical / Experimental Example worked out step-by-step
4. 2:00 - 2:30: The Golden Rule to Remember on Exam Day

Visual Pacing: Fast, graphic-driven, bold on-screen mathematical notations with dynamic highlights.`,
  },
];

// ─── Vault Context Extractor ─────────────────────────────────────────────────

export function extractVaultContext(
  org?: Organization | null,
  project?: CourseProject | null,
  activeSession?: CourseSession | null,
  dossierFiles?: ProjectDossierFile[]
): VaultContext {
  const courseName = project?.name || 'Academic Course Curriculum';
  const courseCode = project?.course_code || 'COURSE-101';
  const sessionCode = activeSession?.session_code || 'Lec 01';
  const sessionTitle = activeSession?.title || 'Course Lecture & Session';

  // Audience
  const audience = project?.target_age_band 
    ? `${project.target_age_band} (${project.academic_term || 'Higher Education'})`
    : 'University Undergraduate Students';

  // Learning Outcomes (ILOs)
  const learningOutcomes: string[] = [];
  if (activeSession?.blueprint_markdown) {
    const iloMatches = activeSession.blueprint_markdown.match(/(?:ILO|Outcome|Objective)\s*[\d.]*[:\-]\s*[^\n\r]+/gi);
    if (iloMatches && iloMatches.length > 0) {
      learningOutcomes.push(...iloMatches.slice(0, 5).map(m => m.trim()));
    }
  }

  // Brand Palette
  const approvedColors = org?.brand_palette?.approved || [];
  const brandPaletteHex = approvedColors.length > 0 
    ? approvedColors 
    : ['#002060', '#FFC000', '#FFFFFF', '#1E293B'];

  // Forbidden terms
  const forbiddenTerms = org?.boundary_terms?.forbidden_strings || [];

  // Language Policy
  const primaryScript = org?.language_policy?.primary_script || 'en';
  const targetRatio = org?.language_policy?.target_ratio ?? 1.0;
  const isEn = primaryScript.toLowerCase().includes('en');
  const isAr = primaryScript.toLowerCase().includes('ar');

  let languagePolicySummary = 'English primary academic nomenclature';
  if (isAr && targetRatio >= 0.85) {
    languagePolicySummary = 'Arabic Modern Standard (الفصحى الأكاديمية) with Latin formulas and IUPAC terminology';
  } else if (isAr) {
    languagePolicySummary = 'Bilingual Arabic/English (Arabic delivery with Latin technical equations and terms)';
  } else if (isEn) {
    languagePolicySummary = '100% English Academic Delivery strictly adhering to international curriculum standards';
  }

  // Pedagogy
  const pedagogicalLevel = "Bloom's Revised Taxonomy (Remember -> Understand -> Apply -> Analyze) & Miller's Pyramid (Knows -> Knows How)";

  return {
    courseName,
    courseCode,
    sessionCode,
    sessionTitle,
    audience,
    learningOutcomes,
    brandPaletteHex,
    forbiddenTerms,
    languagePrimary: primaryScript,
    languagePolicySummary,
    pedagogicalLevel,
    evidenceRequirements: org?.evidence_marker_pattern || 'Visual Evidence & Primary Source Markers Required',
  };
}

// ─── Slot Replacement & Formulator Engine ─────────────────────────────────────

export function formulatePrompt(
  template: PromptTemplate,
  context: VaultContext,
  customSlotValues: Record<string, string> = {}
): string {
  let prompt = template.systemInstructions;

  // Compute smart defaults based on the extracted vault context
  const smartDefaults: Record<string, string> = {
    AUDIENCE: context.audience,
    TOPIC_ILOS: `${context.sessionTitle} (${context.sessionCode} — ${context.courseName})` +
      (context.learningOutcomes.length > 0 ? ` | ILOs: ${context.learningOutcomes.join('; ')}` : ''),
    TOPIC: `${context.sessionTitle} (${context.courseName})`,
    SYSTEM_NAME: `${context.sessionTitle} System Architecture`,
    SUBJECTS: `${context.sessionTitle} Methodologies`,
    CRITERIA: 'Accuracy, Sensitivity, Limit of Detection, Protocol Complexity',
    PALETTE: `Approved Brand Colors: ${context.brandPaletteHex.join(', ')}`,
    LANGUAGE: context.languagePolicySummary,
    AUDIENCE_LEVEL: context.audience,
    KEY_QUESTIONS: `Core mechanisms, governing laws, and laboratory implementation of ${context.sessionTitle}`,
    TARGET_EXAM_FOCUS: `High-yield ILOs and mathematical relationships of ${context.sessionTitle}`,
    TOPIC_FOCUS: `${context.sessionTitle} (${context.courseName})`,
    VISUAL_STYLE: `Rigorous academic schematics using brand colors (${context.brandPaletteHex.slice(0, 2).join(', ')}), clean white background, and directional process arrows`,
    CONCEPT_NAME: `${context.sessionTitle} Core Law & Equation`,
  };

  // Replace each bracketed slot [KEY] or [KEY: description]
  template.slots.forEach(slot => {
    const value = customSlotValues[slot.key] || smartDefaults[slot.key] || slot.defaultValue;
    // Replace exact slot [KEY] or [KEY: ...]
    const regex = new RegExp(`\\[${slot.key}(?::[^\\]]+)?\\]`, 'g');
    prompt = prompt.replace(regex, value);
  });

  // Replace any remaining known keys from smartDefaults
  Object.entries(smartDefaults).forEach(([key, val]) => {
    const regex = new RegExp(`\\[${key}(?::[^\\]]+)?\\]`, 'g');
    prompt = prompt.replace(regex, val);
  });

  // If organization has forbidden boundary terms, append a strict negative constraint
  if (context.forbiddenTerms && context.forbiddenTerms.length > 0) {
    prompt += `\n\nSTRICT BOUNDARY CONSTRAINTS:\nNever mention, cite, or use the following forbidden terms under any circumstances: ${context.forbiddenTerms.join(', ')}.`;
  }

  return prompt;
}
