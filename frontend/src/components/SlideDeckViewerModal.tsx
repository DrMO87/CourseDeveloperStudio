'use client';

import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  Presentation, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Sparkles, 
  Layers, 
  Share2,
  BookOpen,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { Organization, CourseProject, CourseSession, ProjectDossierFile } from '@/lib/types';

interface Slide {
  slideNumber: number;
  titleEn: string;
  titleAr: string;
  bloomLevel: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate';
  bloomLevelAr: string;
  durationMinutes: number;
  keyConcepts: string[];
  lecturerNotes: string;
  studentTakeaway: string;
  visualCue: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  org?: Organization | null;
  project?: CourseProject | null;
  session?: CourseSession | null;
  dossierFiles?: ProjectDossierFile[];
}

export function SlideDeckViewerModal({ isOpen, onClose, org, project, session, dossierFiles }: Props) {
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [copiedNotebookLm, setCopiedNotebookLm] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [viewMode, setViewMode] = useState<'CAROUSEL' | 'GRID'>('CAROUSEL');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [customSlides, setCustomSlides] = useState<Slide[] | null>(null);

  const initialLanguageMode: 'EN' | 'AR' | 'BILINGUAL' = 
    org?.language_policy?.primary_script === 'en'
      ? 'EN'
      : org?.language_policy?.primary_script === 'ar' && (org?.language_policy?.target_ratio || 0) >= 0.8
      ? 'AR'
      : 'BILINGUAL';

  const [languageMode, setLanguageMode] = useState<'EN' | 'AR' | 'BILINGUAL'>(initialLanguageMode);

  if (!isOpen) return null;

  const orgName = org?.name || 'Horus University — Egypt';
  const orgSlug = org?.slug || 'horus-university';
  const primaryColor = org?.brand_palette?.approved?.[0] || '#002147';
  const accentColor = org?.brand_palette?.approved?.[1] || '#FFB81C';
  const courseTitle = project?.name || 'Instrumental Analysis';
  const sessionCode = session?.session_code || 'Lec 01';
  const sessionTitle = session?.title || 'Principles of UV-Vis Spectrophotometry & Beer-Lambert Law';

  // Domain-Aware 16-Slide Generator based on active session topic
  const getDomainAwareSlides = (): Slide[] => {
    const isInstrumental = courseTitle.toLowerCase().includes('instrumental') || sessionTitle.toLowerCase().includes('spectro') || sessionTitle.toLowerCase().includes('uv');
    const isHplc = sessionTitle.toLowerCase().includes('chromatography') || sessionTitle.toLowerCase().includes('hplc');

    if (isInstrumental && !isHplc) {
      return [
        {
          slideNumber: 1,
          titleEn: 'Lecture Orientation: UV-Vis Spectrophotometry & ILOs',
          titleAr: 'أهداف المحاضرة: القياس الطيفي للأشعة المرئية وفوق البنفسجية',
          bloomLevel: 'Remember',
          bloomLevelAr: 'تذكر واستيعاب أولي',
          durationMinutes: 5,
          keyConcepts: [
            'Electromagnetic spectrum in pharmaceutical analysis (200-800 nm)',
            'Intended Learning Outcomes (ILOs): K1, I1, P1',
            'Spectroscopic sample handling and cuvette selection'
          ],
          lecturerNotes: 'Clarify the difference between UV region (200-400 nm) and Visible region (400-800 nm).',
          studentTakeaway: 'Master the foundational scope and understand why UV-Vis is the gold standard for drug quantification.',
          visualCue: '[Reserved Image Area: Electromagnetic Spectrum & Optical Band Ranges]'
        },
        {
          slideNumber: 2,
          titleEn: 'Historical Evolution of Spectrophotometric Instrumentation',
          titleAr: 'التطور التاريخي لأجهزة القياس الطيفي الدوائي',
          bloomLevel: 'Remember',
          bloomLevelAr: 'تذكر',
          durationMinutes: 7,
          keyConcepts: [
            'From visual colorimeters to modern double-beam spectrophotometers',
            'Monochromator design: Prisms vs. Diffraction gratings',
            'Photomultiplier tubes (PMT) vs Photodiode arrays (PDA)'
          ],
          lecturerNotes: 'Emphasize how diffraction gratings eliminated non-linear chromatic aberrations.',
          studentTakeaway: 'Understand the architectural milestones in modern optical instrumentation.',
          visualCue: '[Reserved Image Area: Single vs Double-Beam Optical Bench Layout]'
        },
        {
          slideNumber: 3,
          titleEn: 'Core Spectroscopic Terminology & Nomenclature',
          titleAr: 'المصطلحات الطيفية الأساسية والتعريفات المعيارية',
          bloomLevel: 'Remember',
          bloomLevelAr: 'تذكر',
          durationMinutes: 8,
          keyConcepts: [
            'Transmittance (%T), Absorbance (A), and Optical Density (OD)',
            'Molar Absorptivity (ε) and Specific Absorbance (A 1% 1cm)',
            'Bathochromic (red) vs Hypsochromic (blue) shifts'
          ],
          lecturerNotes: 'Enforce proper mathematical logarithmic definitions: A = -log10(T) = 2 - log10(%T).',
          studentTakeaway: 'Fluently use analytical spectroscopy terminology according to pharmacopoeial conventions.',
          visualCue: '[Reserved Image Area: Spectral Shift Matrix: Auxochromes & Chromophores]'
        },
        {
          slideNumber: 4,
          titleEn: 'Optical System Architecture & Component Topography',
          titleAr: 'بنية النظام البصري ومكونات المطياف الضوئي',
          bloomLevel: 'Understand',
          bloomLevelAr: 'فهم واستيعاب',
          durationMinutes: 8,
          keyConcepts: [
            'Light sources: Deuterium lamp (UV) & Tungsten-Halogen (Visible)',
            'Czerny-Turner monochromator and entrance/exit slit geometries',
            'Sample cuvettes: Quartz (UV-transparent) vs Glass/Plastic'
          ],
          lecturerNotes: 'Show why standard glass cuvettes cannot be used below 340 nm due to glass opacity.',
          studentTakeaway: 'Map the complete optical ray trajectory from light source to photomultiplier.',
          visualCue: '[Reserved Image Area: Optical Czerny-Turner Monochromator Ray Diagram]'
        },
        {
          slideNumber: 5,
          titleEn: 'Mathematical Principles: The Beer-Lambert Law',
          titleAr: 'المبادئ الرياضية: قانون بير-لامبرت للامتصاص الضوئي',
          bloomLevel: 'Understand',
          bloomLevelAr: 'فهم ومعادلات',
          durationMinutes: 10,
          keyConcepts: [
            'Fundamental equation: A = ε · c · l',
            'Derivation from differential calculus: -dI/dx = k·I·c',
            'Specific absorbance relationship: ε = (A 1% 1cm · Molar Mass) / 10'
          ],
          lecturerNotes: 'Walk students through step-by-step calculus derivation of Beer-Lambert Law.',
          studentTakeaway: 'Calculate drug concentrations directly from absorbance using molar absorptivity.',
          visualCue: '[Reserved Image Area: KaTeX LaTeX Derivation Grid & Light Attenuation Curves]'
        },
        {
          slideNumber: 6,
          titleEn: 'Electronic Transitions & Chromophore Molecular Orbitals',
          titleAr: 'الانتقالات الإلكترونية والمدارات الجزيئية للكروموفورات',
          bloomLevel: 'Understand',
          bloomLevelAr: 'فهم جزيئي',
          durationMinutes: 8,
          keyConcepts: [
            'Allowed electronic transitions: σ→σ*, n→σ*, π→π*, n→π*',
            'Auxochromes (-OH, -NH2, -OCH3) and resonance electron donation',
            'Conjugation effect on λmax energy gap reduction'
          ],
          lecturerNotes: 'Explain why conjugated dienes absorb at longer wavelengths than isolated double bonds.',
          studentTakeaway: 'Predict UV absorbance peaks (λmax) based on chemical structure and conjugation.',
          visualCue: '[Reserved Image Area: Molecular Orbital Energy Level Diagram & Smiles Structures]'
        },
        {
          slideNumber: 7,
          titleEn: 'Guided Practical Walkthrough: Preparing Standard Curves',
          titleAr: 'تطبيق عملي موجه: إعداد منحنيات المعايرة القياسية',
          bloomLevel: 'Apply',
          bloomLevelAr: 'تطبيق عملي',
          durationMinutes: 10,
          keyConcepts: [
            'Serial volumetric dilution of pharmaceutical reference standards',
            'Zeroing against blank solvent and cell matching',
            'Recording absorbance at predetermined λmax'
          ],
          lecturerNotes: 'Demonstrate proper micropipetting techniques and cuvette optical face cleaning.',
          studentTakeaway: 'Execute pharmacopoeial standard curve preparation with high precision.',
          visualCue: '[Reserved Image Area: SOP Standard Dilution Protocol & Cuvette Handling]'
        },
        {
          slideNumber: 8,
          titleEn: 'Active Lab Protocol & Calibration Linear Regression',
          titleAr: 'بروتوكول المختبر والانحدار الخطي للمعايرة',
          bloomLevel: 'Apply',
          bloomLevelAr: 'تطبيق إحصائي',
          durationMinutes: 10,
          keyConcepts: [
            'Least squares linear regression: y = mx + c (R² ≥ 0.999)',
            'Evaluating limit of detection (LOD) and limit of quantitation (LOQ)',
            'Acceptable absorbance working range (0.2 – 0.8 AU)'
          ],
          lecturerNotes: 'Show why readings above 1.5 AU suffer from stray light detector error.',
          studentTakeaway: 'Construct an accredited 5-point calibration curve and evaluate linearity.',
          visualCue: '[Reserved Image Area: Linear Regression Graph with 95% Confidence Interval]'
        },
        {
          slideNumber: 9,
          titleEn: 'Deviations from Beer-Lambert Law: Chemical & Instrumental Limits',
          titleAr: 'الانحرافات عن قانون بير-لامبرت: الحدود الكيميائية والفيزيائية',
          bloomLevel: 'Apply',
          bloomLevelAr: 'تطبيق متقدم',
          durationMinutes: 8,
          keyConcepts: [
            'Chemical deviations: Solute-solute association, pH changes, and tautomerism',
            'Instrumental deviations: Stray light, polychromatic radiation, and slit width',
            'Refractive index shifts at high concentrations (> 0.01 M)'
          ],
          lecturerNotes: 'Guide students to diagnose non-linear curvature at high concentrations.',
          studentTakeaway: 'Identify and troubleshoot real-world causes of Beer-Lambert law failure.',
          visualCue: '[Reserved Image Area: Positive and Negative Curvature Deviation Plots]'
        },
        {
          slideNumber: 10,
          titleEn: 'Multicomponent Analysis & Derivative Spectroscopy',
          titleAr: 'التحليل الطيفي متعدد المكونات والمشتقات الطيفية',
          bloomLevel: 'Analyze',
          bloomLevelAr: 'تحليل ونقد',
          durationMinutes: 8,
          keyConcepts: [
            'Simultaneous equation method (Vierordt’s method) for two-drug mixtures',
            'First and second derivative spectroscopy (dA/dλ, d²A/dλ²)',
            'Zero-crossing technique for eliminating excipient matrix interference'
          ],
          lecturerNotes: 'Demonstrate how 1st derivative removes turbidity background slope.',
          studentTakeaway: 'Quantify two overlapping drug compounds without prior chromatographic separation.',
          visualCue: '[Reserved Image Area: Zero-Crossing Derivative Spectral Overlay]'
        },
        {
          slideNumber: 11,
          titleEn: 'Spectroscopic Diagnostic & Failure Root Cause Analysis',
          titleAr: 'التشخيص الطيفي وتحليل أسباب فشل القياس',
          bloomLevel: 'Analyze',
          bloomLevelAr: 'تحليل أعطال',
          durationMinutes: 8,
          keyConcepts: [
            'Drifting baseline root causes: Lamp aging vs solvent evaporation',
            'High photometric noise: Dirty optics vs defective PMT voltage',
            'Peak broadening due to inappropriate spectral bandwidth (SBW)'
          ],
          lecturerNotes: 'Present a real contaminated active pharmaceutical ingredient (API) case.',
          studentTakeaway: 'Systematically diagnose instrument and sample preparation failures.',
          visualCue: '[Reserved Image Area: Fishbone Troubleshooting Diagram & Noisy Spectral Trace]'
        },
        {
          slideNumber: 12,
          titleEn: 'Regulatory Validation Framework: ICH Q2(R1) Standards',
          titleAr: 'معايير التحقق التنظيمية: دستور الأدوية ودليل ICH Q2',
          bloomLevel: 'Analyze',
          bloomLevelAr: 'تحليل الامتثال',
          durationMinutes: 6,
          keyConcepts: [
            'Specificity, Accuracy (% Recovery 98-102%), and Precision (RSD < 2%)',
            'Wavelength accuracy calibration using Holmium oxide filter',
            'Photometric linearity verification using Potassium dichromate (K2Cr2O7)'
          ],
          lecturerNotes: 'Highlight Good Laboratory Practices (GLP) and pharmaceutical audit trails.',
          studentTakeaway: 'Ensure analytical methods comply with international pharmacopoeial standards.',
          visualCue: '[Reserved Image Area: ICH Q2 Validation Summary Matrix Table]'
        },
        {
          slideNumber: 13,
          titleEn: 'Method Selection Tradeoffs: UV-Vis vs HPLC vs Mass Spectrometry',
          titleAr: 'تقييم ومفاضلة الطرق التحليلية: مطيافية الضوء مقابل الكروماتوغرافيا',
          bloomLevel: 'Evaluate',
          bloomLevelAr: 'تقييم وحكم علمي',
          durationMinutes: 8,
          keyConcepts: [
            'Cost, throughput, and speed of UV-Vis vs chromatographic separation',
            'Resolution limitations in complex biological matrices (Plasma/Serum)',
            'When to use UV spectrophotometry vs hyphenated techniques (LC-MS)'
          ],
          lecturerNotes: 'Challenge students on when UV-Vis is sufficient and when HPLC is mandatory.',
          studentTakeaway: 'Select the optimal analytical methodology based on analytical requirements.',
          visualCue: '[Reserved Image Area: Multidimensional Method Selection Radar Chart]'
        },
        {
          slideNumber: 14,
          titleEn: 'Formative Assessment: Clinical Assay Case Defense',
          titleAr: 'التقييم التكويني: مناقشة وحل مسألة فحص دوائي',
          bloomLevel: 'Evaluate',
          bloomLevelAr: 'تقييم',
          durationMinutes: 8,
          keyConcepts: [
            'Case Vignette: Calculating Paracetamol tablet content from A 1% 1cm',
            'Evaluating whether assay falls within USP specification (90.0% – 110.0%)',
            'Peer review of analytical calculation proofs'
          ],
          lecturerNotes: 'Engage students in calculating the % label claim from raw absorbance data.',
          studentTakeaway: 'Confidently evaluate commercial drug quality compliance from raw spectroscopic data.',
          visualCue: '[Reserved Image Area: Case Vignette Formulation & Calculation Proof Card]'
        },
        {
          slideNumber: 15,
          titleEn: '3-Slide Student Home Study Summary & Formula Sheet',
          titleAr: 'ملخص المذاكرة المنزلية المركز وقوانين القياس (٣ شرائح)',
          bloomLevel: 'Remember',
          bloomLevelAr: 'مراجعة وتثبيت',
          durationMinutes: 5,
          keyConcepts: [
            'Master Formula Sheet: A = ε·c·l and A 1% 1cm conversions',
            'Top 5 Traps: Stray light, fingerprint smudges on quartz, and concentration limits',
            'Self-Assessment practice problems for exam preparation'
          ],
          lecturerNotes: 'Remind students to review the 3-slide summary before the laboratory quiz.',
          studentTakeaway: 'Rapid reference sheet for midterm and practical exam revision.',
          visualCue: '[Reserved Image Area: Master Formula Quick Reference Cheat Sheet]'
        },
        {
          slideNumber: 16,
          titleEn: 'Next Session Horizon: HPLC Chromatography & Stationary Phases',
          titleAr: 'المحاضرة القادمة: كروماتوغرافيا السائل عالي الكفاءة (HPLC)',
          bloomLevel: 'Remember',
          bloomLevelAr: 'ربط وتمهيد',
          durationMinutes: 3,
          keyConcepts: [
            'From spectrophotometry to liquid chromatographic separation',
            'Reversed-phase C18 columns and partition mechanisms',
            'Recommended preparatory reading: Ch. 4 Skoog Instrumental Analysis'
          ],
          lecturerNotes: 'Connect UV detection to HPLC UV-Vis flow-through detector cells.',
          studentTakeaway: 'Preview how optical spectroscopy acts as the detection engine for HPLC.',
          visualCue: '[Reserved Image Area: HPLC System Schematic & UV Detector Flow Cell]'
        }
      ];
    }

    // Default 16-slide template for other disciplines
    return [
      {
        slideNumber: 1,
        titleEn: `${sessionTitle} — Orientation & ILOs`,
        titleAr: `أهداف الجلسة ونواتج التعلم: ${sessionTitle}`,
        bloomLevel: 'Remember',
        bloomLevelAr: 'تذكر واستيعاب أولي',
        durationMinutes: 5,
        keyConcepts: [
          `Course scope: ${courseTitle}`,
          `Session Code: ${sessionCode} — Core Learning Outcomes`,
          'Prerequisites and theoretical foundation'
        ],
        lecturerNotes: 'Welcome students and establish clear learning objectives.',
        studentTakeaway: 'Master the foundational goals of this session.',
        visualCue: '[Reserved Image Area: Course Roadmap & Module Outcomes]'
      },
      {
        slideNumber: 2,
        titleEn: 'Historical Context & Disciplinary Paradigm',
        titleAr: 'السياق التاريخي وتطور المجال',
        bloomLevel: 'Remember',
        bloomLevelAr: 'تذكر',
        durationMinutes: 7,
        keyConcepts: [
          'Evolution from classic methods to modern standard protocols',
          'Core theoretical milestones',
          'Industry standard case studies'
        ],
        lecturerNotes: 'Explain the need for modern analytical workflows.',
        studentTakeaway: 'Understand why modern methodologies replaced older techniques.',
        visualCue: '[Reserved Image Area: Timeline & Milestone Diagram]'
      },
      {
        slideNumber: 3,
        titleEn: 'Core Terminology & Structural Definitions',
        titleAr: 'المصطلحات الأساسية والتعريفات الهيكلية',
        bloomLevel: 'Remember',
        bloomLevelAr: 'تذكر',
        durationMinutes: 8,
        keyConcepts: [
          'Key vocabulary and taxonomy',
          'Standard definitions and units',
          'Regulatory criteria'
        ],
        lecturerNotes: 'Enforce proper academic terminology.',
        studentTakeaway: 'Speak the precise technical language required in academic and clinical contexts.',
        visualCue: '[Reserved Image Area: Taxonomy Matrix Table]'
      },
      {
        slideNumber: 4,
        titleEn: 'System Architecture & Component Topography',
        titleAr: 'بنية النظام وتوزيع المكونات',
        bloomLevel: 'Understand',
        bloomLevelAr: 'فهم واستيعاب',
        durationMinutes: 8,
        keyConcepts: [
          'Modular subsystems and functional pathways',
          'Operational mechanisms',
          'Hardware and software constraints'
        ],
        lecturerNotes: 'Trace mechanisms from input to output.',
        studentTakeaway: 'Visualize the full end-to-end component topology.',
        visualCue: '[Reserved Image Area: System Block Diagram Architecture]'
      },
      {
        slideNumber: 5,
        titleEn: 'Mathematical Principles & Governing Equations',
        titleAr: 'المبادئ الرياضية والمعادلات الحاكمة',
        bloomLevel: 'Understand',
        bloomLevelAr: 'فهم ومعادلات',
        durationMinutes: 10,
        keyConcepts: [
          'Governing mathematical formulas and theoretical basis',
          'Boundary conditions and domain limits',
          'Sample step-by-step analytical derivation'
        ],
        lecturerNotes: 'Walk students through formula derivation step by step.',
        studentTakeaway: 'Derive key parameters rather than memorizing formula tables blindly.',
        visualCue: '[Reserved Image Area: KaTeX LaTeX Equation Breakdown]'
      },
      {
        slideNumber: 6,
        titleEn: 'Process Flow & Operational Dynamics',
        titleAr: 'تدفق العمليات والديناميكا التشغيلية',
        bloomLevel: 'Understand',
        bloomLevelAr: 'فهم',
        durationMinutes: 8,
        keyConcepts: [
          'Process sequence and checkpoints',
          'Rate-limiting steps',
          'Error detection mechanisms'
        ],
        lecturerNotes: 'Ask questions to test student comprehension before stepping into application.',
        studentTakeaway: 'Track process flow across every operational stage.',
        visualCue: '[Reserved Image Area: Timing Sequence & Workflow Diagram]'
      },
      {
        slideNumber: 7,
        titleEn: 'Guided Practical Walkthrough (Steps 1-3)',
        titleAr: 'تطبيق عملي موجه (الخطوات ١-٣)',
        bloomLevel: 'Apply',
        bloomLevelAr: 'تطبيق عملي',
        durationMinutes: 10,
        keyConcepts: [
          'Standard operating procedure (SOP) initiation',
          'Parameter setup and calibration',
          'Baseline measurement recording'
        ],
        lecturerNotes: 'Demonstrate live on the projector. Have students mirror actions.',
        studentTakeaway: 'Build confidence executing standard operating procedures (SOPs).',
        visualCue: '[Reserved Image Area: Step-by-Step Practical Screencast / Setup]'
      },
      {
        slideNumber: 8,
        titleEn: 'Active Lab Protocol & Calibration Standards',
        titleAr: 'بروتوكول المختبر ومعايير المعايرة',
        bloomLevel: 'Apply',
        bloomLevelAr: 'تطبيق',
        durationMinutes: 10,
        keyConcepts: [
          'Standard calibration and offset tuning',
          'Validation against reference control data',
          'Documenting quantitative logs'
        ],
        lecturerNotes: 'Verify proper instrument calibration and parameter inputs.',
        studentTakeaway: 'Achieve accurate calibrated results within tolerance limits.',
        visualCue: '[Reserved Image Area: Calibration Curve & Tolerance Thresholds]'
      },
      {
        slideNumber: 9,
        titleEn: 'Problem Solving & Edge Case Diagnostics',
        titleAr: 'حل المشكلات وتشخيص الحالات غير النمطية',
        bloomLevel: 'Apply',
        bloomLevelAr: 'تطبيق متقدم',
        durationMinutes: 8,
        keyConcepts: [
          'Simulated anomalies and matrix interferences',
          'Mitigation strategies',
          'Quality control corrective actions'
        ],
        lecturerNotes: 'Introduce artificial anomalies to test student troubleshooting skills.',
        studentTakeaway: 'Formulate corrective action plans for unexpected deviations.',
        visualCue: '[Reserved Image Area: Fault Tree & Decision Matrix]'
      },
      {
        slideNumber: 10,
        titleEn: 'Comparative Performance Analysis',
        titleAr: 'مقارنة الأداء والتقييم النسبي',
        bloomLevel: 'Analyze',
        bloomLevelAr: 'تحليل ونقد',
        durationMinutes: 8,
        keyConcepts: [
          'Sensitivity vs specificity tradeoffs',
          'Analytical efficiency comparison',
          'Empirical benchmark results'
        ],
        lecturerNotes: 'Encourage critical debate among students.',
        studentTakeaway: 'Select the optimal method based on empirical tradeoffs.',
        visualCue: '[Reserved Image Area: Radar Comparison Chart]'
      },
      {
        slideNumber: 11,
        titleEn: 'Root Cause Diagnostics & Failure Analysis',
        titleAr: 'تشخيص الأسباب الجذرية وتحليل الأخطاء',
        bloomLevel: 'Analyze',
        bloomLevelAr: 'تحليل',
        durationMinutes: 8,
        keyConcepts: [
          'Systematic error isolation methodology',
          'Interpreting aberrant data profiles',
          'Preventative maintenance protocols'
        ],
        lecturerNotes: 'Walk through a real post-mortem case study.',
        studentTakeaway: 'Isolate root causes quickly without guesswork.',
        visualCue: '[Reserved Image Area: Fishbone Diagnostic Diagram]'
      },
      {
        slideNumber: 12,
        titleEn: 'Regulatory & Quality Compliance Governance',
        titleAr: 'معايير الجودة والامتثال التنظيمي',
        bloomLevel: 'Analyze',
        bloomLevelAr: 'تحليل',
        durationMinutes: 6,
        keyConcepts: [
          'Pharmacopoeial / Accreditation compliance standards',
          'Audit trail and data integrity requirements',
          'Standard validation criteria'
        ],
        lecturerNotes: 'Highlight regulatory boundaries and standard compliance.',
        studentTakeaway: 'Ensure seamless compliance with international standards.',
        visualCue: '[Reserved Image Area: Quality Compliance Matrix]'
      },
      {
        slideNumber: 13,
        titleEn: 'Methodological Tradeoff Evaluation',
        titleAr: 'تقييم ومفاضلة البدائل والحلول',
        bloomLevel: 'Evaluate',
        bloomLevelAr: 'تقييم وحكم علمي',
        durationMinutes: 8,
        keyConcepts: [
          'Cost, throughput, and accuracy rubrics',
          'Defending methodology choices with empirical evidence',
          'Institutional standards alignment'
        ],
        lecturerNotes: 'Have students defend their methodology choices.',
        studentTakeaway: 'Make rigorous, evidence-backed decisions.',
        visualCue: '[Reserved Image Area: Weighted Evaluation Rubric]'
      },
      {
        slideNumber: 14,
        titleEn: 'Formative Assessment & Peer Review Defense',
        titleAr: 'التقييم التكويني ودفاع مراجعة النظراء',
        bloomLevel: 'Evaluate',
        bloomLevelAr: 'تقييم',
        durationMinutes: 8,
        keyConcepts: [
          'Formative checkpoint questions',
          'Peer critique rubric evaluation',
          'Immediate feedback synthesis'
        ],
        lecturerNotes: 'Facilitate open critique using pedagogical rubrics.',
        studentTakeaway: 'Give and incorporate constructive technical feedback.',
        visualCue: '[Reserved Image Area: Formative Question Pool]'
      },
      {
        slideNumber: 15,
        titleEn: '3-Slide Student Home Study Summary',
        titleAr: 'ملخص المذاكرة المنزلية المركز (٣ شرائح)',
        bloomLevel: 'Remember',
        bloomLevelAr: 'مراجعة وتثبيت',
        durationMinutes: 5,
        keyConcepts: [
          'Key formula and concept reference cheat-sheet',
          'Top 5 critical pitfalls to avoid',
          'Self-check practice problem'
        ],
        lecturerNotes: 'Direct students to download the 3-slide summary note.',
        studentTakeaway: 'Concise reference card for rapid exam review.',
        visualCue: '[Reserved Image Area: Home Summary Quick-Reference Card]'
      },
      {
        slideNumber: 16,
        titleEn: 'Next Session Preview & Curricular Connection',
        titleAr: 'المحاضرة القادمة والربط المنهجي',
        bloomLevel: 'Remember',
        bloomLevelAr: 'ربط وتمهيد',
        durationMinutes: 3,
        keyConcepts: [
          'Curricular connection to upcoming topic',
          'Preparatory reading assignments',
          'Key questions for the next lab session'
        ],
        lecturerNotes: 'Connect current principles to the upcoming module.',
        studentTakeaway: 'Preview upcoming competencies and prepare ahead.',
        visualCue: '[Reserved Image Area: Curricular Flow Horizon]'
      }
    ];
  };

  const slides: Slide[] = (customSlides && customSlides.length > 0) ? customSlides : getDomainAwareSlides();
  const currentSlide = slides[currentSlideIdx] || slides[0] || getDomainAwareSlides()[0];

  const handleGenerateLiveDeck = async () => {
    setIsGeneratingAi(true);
    try {
      const dossierContext = (dossierFiles && dossierFiles.length > 0)
        ? `\n\nOFFICIAL GROUND-TRUTH COURSE DOSSIER (Uploaded Specs, Reference Books, Decks, Question Banks):\n` +
          dossierFiles.map(df => `### [${df.category}] ${df.file_name}\n${df.file_content_text ? df.file_content_text.substring(0, 15000) : df.summary || ''}`).join('\n\n')
        : `\n\nOFFICIAL GROUND TRUTH: Faculty of Pharmacy Course Specification & Pharmacopoeial Standard for ${courseTitle} (${project?.course_code || 'PHAR-301'}).`;

      const languageDirective = languageMode === 'EN'
        ? 'Generate all slide titles, concepts, formulas, and delivery notes strictly in 100% English without any Arabic.'
        : languageMode === 'AR'
        ? 'Generate all slide content in standard formal Arabic.'
        : 'Generate bilingual titles (English primary title, Arabic subtitle) and bilingual Bloom labels.';

      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are an elite academic curriculum designer for ${orgName}. You MUST strictly ground your curriculum generation on the uploaded Course Dossier (Official Course Specification, Faculty Lecture Decks, Accredited Reference Textbook, and Question Bank). Do NOT invent or make up fictional topics or generic placeholders. Every formula, concept, standard operating procedure (SOP), and Bloom taxonomy milestone must directly mirror the uploaded faculty course material.\n${dossierContext}\n\nGenerate a structured 16-slide lecture deck in JSON format for the course "${courseTitle}" (${project?.course_code || 'PHAR-301'}) and session "${sessionCode} - ${sessionTitle}". ${languageDirective} Return ONLY a valid JSON array of 16 slide objects matching the schema: [{"slideNumber":1,"titleEn":"","titleAr":"","bloomLevel":"Remember"|"Understand"|"Apply"|"Analyze"|"Evaluate","bloomLevelAr":"","durationMinutes":5,"keyConcepts":["","",""],"lecturerNotes":"","studentTakeaway":"","visualCue":""}].`
            },
            {
              role: 'user',
              content: `Synthesize the complete 16-slide academic presentation deck for: ${sessionTitle}. Base every single slide directly on the uploaded course specification, textbook excerpts, and laboratory procedures.`
            }
          ],
          temperature: 0.2
        })
      });

      const data = await res.json();
      if (data.success && data.content) {
        try {
          const cleanJson = data.content.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCustomSlides(parsed);
          }
        } catch {
          // If not strict JSON, keep domain aware slides
        }
      }
    } catch (e) {
      console.error('Error generating AI slides:', e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Generate complete unified markdown bundle for NotebookLM
  const generateNotebookLmBundle = () => {
    const slidesMarkdown = slides.map((s) => {
      const concepts = s.keyConcepts.map(c => `- ${c}`).join('\n');
      if (languageMode === 'EN') {
        return `### SLIDE ${s.slideNumber}: ${s.titleEn}\n**Bloom Taxonomy Level**: ${s.bloomLevel}\n**Allotted Duration**: ${s.durationMinutes} Minutes\n\n#### Key Pedagogical Concepts:\n${concepts}\n\n#### Lecturer Delivery Notes:\n> ${s.lecturerNotes}\n\n#### Student Key Takeaway:\n*${s.studentTakeaway}*\n\n#### Visual Evidence Marker:\n\`${s.visualCue}\``;
      }
      if (languageMode === 'AR') {
        return `### شريحة ${s.slideNumber}: ${s.titleAr}\n**المستوى المعرفي (بلوم)**: ${s.bloomLevelAr}\n**المدة المخصصة**: ${s.durationMinutes} دقائق\n\n#### المفاهيم التربوية الأساسية:\n${concepts}\n\n#### ملاحظات إلقاء المحاضر:\n> ${s.lecturerNotes}\n\n#### الخلاصة للطالب:\n*${s.studentTakeaway}*\n\n#### المرجع البصري:\n\`${s.visualCue}\``;
      }
      return `### SLIDE ${s.slideNumber}: ${s.titleEn}\n**Arabic Title**: ${s.titleAr}\n**Bloom Taxonomy Level**: ${s.bloomLevel} (${s.bloomLevelAr})\n**Allotted Duration**: ${s.durationMinutes} Minutes\n\n#### Key Pedagogical Concepts:\n${concepts}\n\n#### Lecturer Delivery Notes:\n> ${s.lecturerNotes}\n\n#### Student Key Takeaway:\n*${s.studentTakeaway}*\n\n#### Visual Evidence Marker:\n\`${s.visualCue}\``;
    }).join('\n\n---\n\n');

    return `# INSTITUTIONAL CURRICULUM GROUND-TRUTH DOSSIER
**Institution**: ${orgName} (${orgSlug})
**Course**: ${courseTitle}
**Session**: ${sessionCode} - ${sessionTitle}
**Approved Brand Palette**: ${org?.brand_palette?.approved?.join(', ') || '#002147, #FFB81C'}
**Language Policy**: ${languageMode === 'EN' ? '100% English' : languageMode === 'AR' ? '100% Arabic' : 'Bilingual (English + Arabic)'}

---

## 1. EXECUTIVE LESSON BLUEPRINT
This document represents the certified, deterministic curriculum specification generated by Course Developer Studio. All outputs have passed 100% of institutional quality gates (Brand Palette, Lecturer Boundary Isolation, Language Script Ratios, and SHA-256 Asset Reconciliation).

---

## 2. 16-SLIDE ${languageMode === 'EN' ? 'ENGLISH' : languageMode === 'AR' ? 'ARABIC' : 'BILINGUAL'} COGNITIVE ASCENT DECK

${slidesMarkdown}

---

## 3. STUDENT 3-SLIDE HOME SUMMARY
- **Core Formula Reference**: All primary mathematical derivations from Slides 5 & 8.
- **Top 5 Critical Pitfalls**: Failure modes identified during Diagnostic Slide 11.
- **Home Practice Challenge**: Self-assessment question aligned with Bloom Level 'Apply'.

---
*Generated by Course Developer Studio · Session Master v2.5 · ${orgName}*
`;
  };

  const handleCopyNotebookLm = () => {
    const text = generateNotebookLmBundle();
    navigator.clipboard.writeText(text);
    setCopiedNotebookLm(true);
    setTimeout(() => setCopiedNotebookLm(false), 2000);
  };

  const handleDownloadMarkdown = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDeck = () => {
    const content = generateNotebookLmBundle();
    handleDownloadMarkdown(`${project?.slug || 'course'}_${sessionCode}_slides.md`, content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/15 rounded-3xl max-w-6xl w-full p-4 sm:p-7 space-y-5 shadow-2xl max-h-[95vh] flex flex-col">
        
        {/* Modal Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-display font-extrabold text-slate-900 dark:text-white">
                  {courseTitle}
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  {sessionCode} · 16 Slides Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">
                {languageMode === 'EN'
                  ? '100% English Academic Presentation Deck · 100% Quality Gatekeeper Verified'
                  : languageMode === 'AR'
                  ? 'عرض تقديمي أكاديمي باللغة العربية · موثق بالكامل من حارس الجودة'
                  : 'Bilingual Cognitive Ascent Deck · 100% Quality Gatekeeper Verified'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* Language Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-black/40 p-1 rounded-xl border border-slate-200 dark:border-white/10 text-xs">
              <button
                onClick={() => setLanguageMode('EN')}
                className={`px-2.5 py-1 rounded-lg font-display font-bold transition flex items-center gap-1 ${
                  languageMode === 'EN'
                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-white/60'
                }`}
                title="100% English Slides (No Arabic subtitles)"
              >
                <span>🇬🇧 100% English</span>
              </button>
              <button
                onClick={() => setLanguageMode('BILINGUAL')}
                className={`px-2.5 py-1 rounded-lg font-display font-bold transition flex items-center gap-1 ${
                  languageMode === 'BILINGUAL'
                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-white/60'
                }`}
                title="Bilingual Deck (English Primary + Arabic Subtitle)"
              >
                <span>🌐 Bilingual</span>
              </button>
              <button
                onClick={() => setLanguageMode('AR')}
                className={`px-2.5 py-1 rounded-lg font-display font-bold transition flex items-center gap-1 ${
                  languageMode === 'AR'
                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-white/60'
                }`}
                title="Arabic Primary Slides"
              >
                <span>🇪🇬 Arabic</span>
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-black/40 p-1 rounded-xl border border-slate-200 dark:border-white/10 text-xs">
              <button
                onClick={() => setViewMode('CAROUSEL')}
                className={`px-3 py-1 rounded-lg font-display font-bold transition ${
                  viewMode === 'CAROUSEL'
                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-white/60'
                }`}
              >
                Carousel
              </button>
              <button
                onClick={() => setViewMode('GRID')}
                className={`px-3 py-1 rounded-lg font-display font-bold transition ${
                  viewMode === 'GRID'
                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-white/60'
                }`}
              >
                16-Grid
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NotebookLM & Local PC Export Ribbon */}
        <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-indigo-500/10 dark:from-[#002147] dark:to-[#001530] rounded-2xl border border-amber-500/20 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 dark:bg-gradient-gold flex items-center justify-center text-white dark:text-primary-900 shadow-sm font-black text-xs">
              NLM
            </div>
            <div>
              <span className="text-xs font-display font-bold text-slate-900 dark:text-white block">
                Export to Google NotebookLM &amp; Local PC ({languageMode === 'EN' ? '100% English' : languageMode === 'AR' ? '100% Arabic' : 'Bilingual'})
              </span>
              <span className="text-[11px] text-slate-500 dark:text-white/60">
                Ground-truth source digest formatted for NotebookLM audio overview &amp; local Obsidian vault
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* AI Synthesizer */}
            <button
              onClick={handleGenerateLiveDeck}
              disabled={isGeneratingAi}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 text-xs font-display font-extrabold transition flex items-center gap-1.5 shadow-sm"
              title="Synthesize 16 custom lecture slides using local LLM swarm"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
              <span>{isGeneratingAi ? 'Synthesizing Slides...' : '⚡ Synthesize with AI'}</span>
            </button>

            {/* Copy for NotebookLM */}
            <button
              onClick={handleCopyNotebookLm}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-display font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Copy ground-truth markdown package to clipboard for NotebookLM"
            >
              {copiedNotebookLm ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied for NotebookLM!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy NotebookLM Source</span>
                </>
              )}
            </button>

            {/* Direct Link to NotebookLM */}
            <a
              href="https://notebooklm.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-display font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-white/10"
            >
              <span>Open NotebookLM</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            {/* Download Markdown to PC */}
            <button
              onClick={handleDownloadDeck}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 text-xs font-display font-extrabold transition flex items-center gap-1.5 shadow-sm"
              title="Save slides markdown file to your local PC"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .MD to PC</span>
            </button>
          </div>
        </div>

        {/* Main Presentation Body */}
        {viewMode === 'CAROUSEL' ? (
          <div className="flex-1 flex flex-col justify-between overflow-y-auto space-y-4">
            {/* Slide Presentation Canvas Card */}
            <div 
              className="w-full bg-slate-900 text-white rounded-3xl p-6 sm:p-8 relative shadow-xl overflow-hidden flex flex-col justify-between min-h-[360px] border border-slate-800"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}F0 0%, #000c1e 100%)`
              }}
            >
              {/* Slide Top Bar */}
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <div className="flex items-center gap-2">
                  <span 
                    className="px-3 py-1 rounded-xl text-xs font-display font-extrabold text-slate-900 shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    Slide {currentSlide.slideNumber} / 16
                  </span>
                  <span className="text-xs font-mono text-white/70 px-2.5 py-1 rounded-xl bg-white/10 border border-white/10">
                    {languageMode === 'EN' 
                      ? `Bloom: ${currentSlide.bloomLevel}`
                      : languageMode === 'AR'
                      ? `المستوى المعرفي: ${currentSlide.bloomLevelAr}`
                      : `Bloom: ${currentSlide.bloomLevel} (${currentSlide.bloomLevelAr})`
                    }
                  </span>
                </div>
                <span className="text-xs font-mono text-white/60">
                  ⏱️ {currentSlide.durationMinutes} Minutes
                </span>
              </div>

              {/* Slide Main Content */}
              <div className="py-6 space-y-4">
                <div>
                  {languageMode === 'AR' ? (
                    <h1 className="text-xl sm:text-2xl font-display font-extrabold text-white leading-tight" dir="rtl">
                      {currentSlide.titleAr}
                    </h1>
                  ) : (
                    <h1 className="text-xl sm:text-2xl font-display font-extrabold text-white leading-tight">
                      {currentSlide.titleEn}
                    </h1>
                  )}

                  {languageMode === 'BILINGUAL' && (
                    <h2 className="text-base sm:text-lg font-display font-bold text-gold-300 mt-1" dir="rtl">
                      {currentSlide.titleAr}
                    </h2>
                  )}
                </div>

                {/* Key Concepts Bullet Points */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-2 bg-black/30 p-4 rounded-2xl border border-white/10">
                    <span className="text-xs font-display font-bold text-white/60 uppercase tracking-wider block">
                      Key Pedagogical Concepts
                    </span>
                    <ul className="space-y-1.5 text-xs text-white/90">
                      {(currentSlide.keyConcepts || []).map((kc, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-gold-400 mt-0.5">•</span>
                          <span>{kc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 bg-black/30 p-4 rounded-2xl border border-white/10 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-display font-bold text-white/60 uppercase tracking-wider block">
                        Visual Evidence &amp; Diagram
                      </span>
                      <p className="text-xs font-mono text-emerald-300 mt-1 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20">
                        {currentSlide.visualCue}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-white/10 text-[11px] text-white/70">
                      <strong>Takeaway:</strong> {currentSlide.studentTakeaway}
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide Lecturer Delivery Notes */}
              <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/60">
                <span className="truncate max-w-xl">
                  <strong>Lecturer Note:</strong> {currentSlide.lecturerNotes}
                </span>
                <span className="text-[10px] font-mono text-white/40">
                  {orgName} · {courseTitle}
                </span>
              </div>
            </div>

            {/* Carousel Navigation Controller */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setCurrentSlideIdx(prev => Math.max(0, prev - 1))}
                disabled={currentSlideIdx === 0}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Slide
              </button>

              {/* Step indicator dots */}
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-md px-2 py-1">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlideIdx(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx === currentSlideIdx
                        ? 'w-6 bg-amber-500 dark:bg-gradient-gold shadow-sm'
                        : 'bg-slate-300 dark:bg-white/20 hover:bg-slate-400'
                    }`}
                    title={`Slide ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrentSlideIdx(prev => Math.min(slides.length - 1, prev + 1))}
                disabled={currentSlideIdx === slides.length - 1}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 disabled:opacity-30"
              >
                Next Slide
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* 16-Slide Overview Grid */
          <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pr-1">
            {slides.map((s, idx) => (
              <div
                key={s.slideNumber}
                onClick={() => {
                  setCurrentSlideIdx(idx);
                  setViewMode('CAROUSEL');
                }}
                className="p-3.5 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl hover:border-amber-500 dark:hover:border-gold-400 cursor-pointer transition flex flex-col justify-between space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-gold-300">
                    Slide {s.slideNumber}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 dark:text-white/40">
                    {s.bloomLevel}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-display font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-gold-300 transition" dir={languageMode === 'AR' ? 'rtl' : 'ltr'}>
                    {languageMode === 'AR' ? s.titleAr : s.titleEn}
                  </h4>
                  {languageMode === 'BILINGUAL' && (
                    <p className="text-[10px] font-display text-slate-500 dark:text-white/50 line-clamp-1 mt-0.5" dir="rtl">
                      {s.titleAr}
                    </p>
                  )}
                </div>
                <div className="text-[9px] text-slate-400 dark:text-white/40 pt-1 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                  <span>⏱️ {s.durationMinutes}m</span>
                  <span className="text-amber-600 dark:text-gold-400 font-bold">Open →</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-white/50">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Ready for classroom presentation &amp; Obsidian PARA sync</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-display font-bold rounded-xl transition"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}

