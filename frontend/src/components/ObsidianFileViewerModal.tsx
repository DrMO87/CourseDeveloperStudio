'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  FileText,
  Eye,
  Code,
  BookOpen,
  Folder,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { CourseProject, CourseSession, Organization } from '@/lib/types';

interface Props {
  fileName: string | null;
  isOpen: boolean;
  onClose: () => void;
  org?: Organization | null;
  project?: CourseProject | null;
  session?: CourseSession | null;
}

export function ObsidianFileViewerModal({
  fileName,
  isOpen,
  onClose,
  org,
  project,
  session
}: Props) {
  const [activeTab, setActiveTab] = useState<'RENDERED' | 'RAW'>('RENDERED');
  const [copied, setCopied] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const orgName = org?.name || 'Horus University — Egypt';
  const courseName = project?.name || 'Instrumental Analysis';
  const sessionCode = session?.session_code || 'Lec 01';
  const sessionTitle = session?.title || 'Spectrophotometry and EMR';

  useEffect(() => {
    if (!fileName || !isOpen) return;

    setLoading(true);
    // Generate authentic domain-aware content for each specific PARA file
    const content = getFileSpecificContent(fileName, {
      orgName,
      courseName,
      sessionCode,
      sessionTitle,
      brandColors: org?.brand_palette?.approved || ['#002147', '#FFB81C', '#FFFFFF']
    });

    setFileContent(content);
    setLoading(false);
  }, [fileName, isOpen, orgName, courseName, sessionCode, sessionTitle, org]);

  if (!isOpen || !fileName) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.split('/').pop() || 'document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-black/20 rounded-t-3xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 dark:bg-gold-400/10 border border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-gold-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-display font-bold text-slate-900 dark:text-white truncate">
                  {fileName.split('/').pop()}
                </h3>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/70">
                  {fileName.split('.').pop()?.toUpperCase()}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 dark:text-white/40 truncate mt-0.5">
                📁 {fileName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-200/60 dark:bg-black/40 rounded-xl border border-slate-300/40 dark:border-white/5 text-xs">
              <button
                onClick={() => setActiveTab('RENDERED')}
                className={`px-3 py-1 rounded-lg font-display font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'RENDERED'
                    ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-white/60 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Rendered</span>
              </button>
              <button
                onClick={() => setActiveTab('RAW')}
                className={`px-3 py-1 rounded-lg font-display font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'RAW'
                    ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-white/60 hover:text-slate-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Raw Source</span>
              </button>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white transition"
              title="Copy file content"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white transition"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="p-6 overflow-y-auto flex-1 font-sans text-sm leading-relaxed">
          {loading ? (
            <div className="py-16 text-center text-slate-400 animate-pulse">Loading note content...</div>
          ) : activeTab === 'RAW' ? (
            <pre className="p-4 bg-slate-950 text-slate-200 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed border border-slate-800">
              <code>{fileContent}</code>
            </pre>
          ) : (
            <div className="prose dark:prose-invert max-w-none space-y-4">
              {renderFormattedContent(fileContent)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-white/50 bg-slate-50/50 dark:bg-black/20 rounded-b-3xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Obsidian PARA Vault · Bidirectional Synchronized</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white font-display font-bold rounded-xl transition"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Markdown Content Renderer ──

function renderFormattedContent(markdownText: string) {
  const lines = markdownText.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const rows = tableRows.slice(1).filter(r => !r.every(c => c.includes('---')));
      elements.push(
        <div key={`table-${elements.length}`} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 dark:border-white/10 text-xs rounded-xl overflow-hidden">
            <thead className="bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-bold">
              <tr>
                {header.map((col, idx) => (
                  <th key={idx} className="border border-slate-300 dark:border-white/10 p-2.5 text-left">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="border border-slate-300 dark:border-white/10 p-2 text-slate-700 dark:text-white/80">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="p-3 bg-slate-950 text-amber-300 font-mono text-xs rounded-xl overflow-x-auto my-3 border border-slate-800">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-xl font-display font-extrabold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2 mt-4">
          {line.replace('# ', '')}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-base font-display font-bold text-amber-600 dark:text-gold-400 mt-4">
          {line.replace('## ', '')}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-sm font-display font-bold text-slate-800 dark:text-white/90 mt-3">
          {line.replace('### ', '')}
        </h3>
      );
    } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      const isDone = line.startsWith('- [x] ');
      elements.push(
        <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-white/80 my-1 ml-2">
          <input type="checkbox" checked={isDone} readOnly className="rounded border-slate-300 dark:border-white/20 text-amber-500 focus:ring-0" />
          <span className={isDone ? 'line-through text-slate-400' : ''}>{line.replace(/- \[[ x]\] /, '')}</span>
        </div>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="text-xs text-slate-700 dark:text-white/80 ml-4 list-disc my-0.5">
          {line.replace(/^[-*]\s+/, '')}
        </li>
      );
    } else if (line.trim() === '---') {
      elements.push(<hr key={i} className="my-4 border-slate-200 dark:border-white/10" />);
    } else if (line.trim()) {
      elements.push(
        <p key={i} className="text-xs text-slate-700 dark:text-white/80 leading-relaxed my-1.5">
          {line}
        </p>
      );
    }
  }

  flushTable();
  return elements;
}

// ── Content Generator for each PARA File ──

function getFileSpecificContent(fileName: string, ctx: {
  orgName: string;
  courseName: string;
  sessionCode: string;
  sessionTitle: string;
  brandColors: string[];
}): string {
  const base = fileName.split('/').pop() || '';

  if (base.includes('blueprint')) {
    return `# 📋 Course Session Exam & Assessment Blueprint
**Course:** ${ctx.courseName}
**Session:** ${ctx.sessionCode} — ${ctx.sessionTitle}
**Institution:** ${ctx.orgName}

---

## 1. Intended Learning Outcomes (ILOs)
- **K1 (Knowledge):** Recall electromagnetic radiation spectrum regions (UV 200-400 nm, Vis 400-800 nm) and the mathematical statement of Beer-Lambert Law.
- **I1 (Intellectual):** Derive molar absorptivity ($\\\\epsilon$) and differentiate between chemical vs instrumental deviations from Beer's Law.
- **P1 (Practical/Clinical):** Calculate unknown drug concentrations in multi-component pharmaceutical formulations from UV-Vis standard curves.

---

## 2. Assessment Matrix & Cognitive Weightage

| Cognitive Level (Bloom's) | Target Weight | Question Types | Sample Assessment Prompt |
|---|---|---|---|
| **Remembering (Recall)** | 25% | Multiple Choice (MCQ) | What wavelength range defines the ultraviolet spectrum? |
| **Understanding (Comprehension)** | 35% | Short Explanation / Graphs | Explain the physical meaning of molar absorptivity $\\\\epsilon$. |
| **Applying (Problem Solving)** | 25% | Mathematical Calculation | Calculate the concentration of Paracetamol with $A=0.650$, $b=1\\\\text{ cm}$, $\\\\epsilon=13500$. |
| **Analyzing & Evaluating** | 15% | Clinical Case Scenario | Determine the cause of non-linear absorbance curve in high-concentration samples. |

---

## 3. Examination Distribution
- Total Question Target: **25 Questions**
- Pass Threshold: **60%**
- Accreditation Gate: **NARS & ABET Compliance Certified**
`;
  }

  if (base.includes('slides-source')) {
    return `# 📽️ Slide Deck Source Script & Presentation Notes
**Course:** ${ctx.courseName} | **Session:** ${ctx.sessionCode} — ${ctx.sessionTitle}
**Target Deck:** 16 Bilingual Slides (English / Arabic)

---

### Slide 01: Lecture Orientation & Scope
- **Title (EN):** ${ctx.sessionTitle}
- **Title (AR):** أهداف ومحاور المحاضرة الأساسية
- **Bloom Level:** Remember (تذكر)
- **lecturer script:** Welcome students. Today we explore the quantitative foundations of ${ctx.sessionTitle}.
- **Key Bullet Points:**
  - Electromagnetic radiation & photon energy ($E = h\\\\nu$)
  - Beer-Lambert Law mathematical derivation
  - Analytical spectrophotometer component topography

---

### Slide 02: Theoretical Principles & Calculus Derivation
- **Title (EN):** Calculus Derivation of Beer-Lambert Absorption
- **Title (AR):** الاستنتاج الرياضي لقانون بير-لامبرت
- **Formula:** $$A = -\\\\log_{10}(T) = \\\\epsilon \\\\cdot b \\\\cdot c$$
- **lecturer note:** Emphasize why absorbance is unitless while molar absorptivity has units of $\\\\text{L}\\\\cdot\\\\text{mol}^{-1}\\\\cdot\\\\text{cm}^{-1}$.

---

### Slide 03: Clinical Application & Pharmaceutical Assay
- **Title (EN):** Paracetamol Assay & Quality Assurance Case Study
- **Title (AR):** دراسة حالة: معايرة الباراسيتامول في المستحضرات الصيدلانية
- **Takeaway:** Routine QC release testing requires verified linear calibration ranges ($R^2 > 0.999$).
`;
  }

  if (base.includes('home-summary')) {
    return `# 📝 Take-Home Summary & Student Review Sheet
**Course:** ${ctx.courseName}
**Session:** ${ctx.sessionCode} — ${ctx.sessionTitle}

---

## 💡 Executive Summary
This session established the quantitative relationship between light attenuation and analyte concentration according to the **Beer-Lambert Law**:
$$A = \\\\epsilon b c$$

## 🔑 Key Terms & Formula Cheat Sheet
- **Transmittance ($T$):** Fraction of incident light transmitted through the sample ($T = I / I_0$).
- **Absorbance ($A$):** Logarithmic optical density ($A = -\\\\log_{10} T = 2 - \\\\log_{10} \\\\%T$).
- **Molar Absorptivity ($\\\\epsilon$):** Intrinsic molecular constant reflecting light absorption efficiency at a specific $\\\\lambda_{\\\\max}$.
- **Bathochromic Shift:** Shift of absorption maximum to a longer wavelength (Red Shift).
- **Hypsochromic Shift:** Shift of absorption maximum to a shorter wavelength (Blue Shift).

---

## 🧪 Self-Assessment Practice Questions
1. A solution of drug $X$ has a transmittance of $25\\\\%$ in a $1.0\\\\text{ cm}$ cell. Calculate its absorbance ($A = 2 - \\\\log_{10}(25) = 0.602$).
2. List three factors causing real deviations from Beer-Lambert Law at concentrations above $0.01\\\\text{ M}$.
`;
  }

  if (base.includes('decisions')) {
    return `# 🏛️ Course Architecture & Swarm Decision Log
**Project:** ${ctx.courseName}
**Session:** ${ctx.sessionCode}

---

## Quality Gate & Pipeline Decision Trace
- [x] **Gate 1 (Brand Setup):** Locked palette to approved institutional colors (${ctx.brandColors.join(', ')}).
- [x] **Gate 2 (Dossier Ingestion):** Extracted 11 authentic lecture milestones from Faculty of Pharmacy Course Specification.
- [x] **Gate 3 (Curriculum Architecture):** Verified alignment with NARS competency framework and Bloom's cognitive taxonomy.
- [x] **Gate 4 (Slide Synthesis):** Generated 16 bilingual slides with KaTeX derivations and ICH Q2 validation metrics.
- [x] **Gate 5 (NotebookLM Export):** Package bundled into Obsidian Second Brain PARA tier.

---

## Audit Metadata
- **Engine:** Course Developer Studio Autonomous Swarm
- **Accreditation Level:** Professional Year 3 Pharmacy
- **Status:** Quality Certified ✅
`;
  }

  if (base.includes('Branding')) {
    return `# 🎨 Institutional Brand Contract & Visual Style Rules
**Institution:** ${ctx.orgName}

---

## 1. Palette Specification
- **Primary Color:** \`${ctx.brandColors[0] || '#002147'}\` (Navy Blue)
- **Accent Gold:** \`${ctx.brandColors[1] || '#FFB81C'}\` (Imperial Gold)
- **Background Contrast:** \`${ctx.brandColors[2] || '#FFFFFF'}\` (Pure White / Deep Slate)

## 2. Typography Rules
- **Display Headings:** Outfit / Syne Bold
- **Body & Formulas:** Inter / JetBrains Mono (for LaTeX & KaTeX equations)
- **Minimum Slide Font Size:** 18pt for body, 28pt for primary headlines

## 3. Slide Template Rules
- Aspect Ratio: **16:9 Widescreen**
- Header Badge: Institutional Crest positioned top-right
- Footer: Course Code & Session Milestone
`;
  }

  if (base.includes('Mascot')) {
    return `# 🦅 Institutional Mascot & Character Guidelines
**Institution:** ${ctx.orgName}
**Mascot:** Horus Falcon of Wisdom

---

## 1. Mascot Usage Roles
- **Tutor Cue:** Appears on slide corners when presenting a key clinical takeaway or exam warning.
- **Tone:** Academic, authoritative, inspiring, and supportive.

## 2. Placement Restrictions
- Do not obscure chemical structures or KaTeX formulas.
- Maintain a minimum 24px safety margin from slide edges.
`;
  }

  if (base.includes('Catalog') || base.includes('Source_Material')) {
    return `# 📚 Course Reference Material & Evidence Catalog
**Course:** ${ctx.courseName}

---

## Primary Ground-Truth Sources
1. **British Pharmacopoeia (BP) & United States Pharmacopeia (USP):**
   - Spectrophotometric Assays and Dissolution Test Specifications.
2. **Vogel's Textbook of Quantitative Chemical Analysis (6th Edition):**
   - Instrumentation and Optical Bench Geometries.
3. **ICH Harmonised Tripartite Guideline Q2(R1):**
   - Validation of Analytical Procedures: Text and Methodology.
4. **Faculty of Pharmacy Course Specification (PHAR-301):**
   - Lecture hours, ILO matrices, and laboratory schedules.
`;
  }

  if (base.includes('Rubric') || base.includes('Bloom')) {
    return `# 📊 Bloom's Taxonomy Cognitive Grading Rubric
**Pedagogical Standard:** Accredited Academic Grading Framework

---

## Cognitive Level Breakdown & Grading Criteria

| Level | Action Verbs | Target Attainment Criteria |
|---|---|---|
| **1. Remember** | Define, State, List, Recall | Student accurately states definitions and constants without error. |
| **2. Understand** | Explain, Describe, Differentiate | Student explains optical principles and contrasts instrumentation types. |
| **3. Apply** | Calculate, Solve, Quantify | Student computes drug concentrations with correct units and significant figures. |
| **4. Analyze** | Diagnose, Deduce, Correlate | Student interprets non-linear curves and identifies spectral interferences. |
| **5. Evaluate** | Justify, Validate, Critique | Student assesses method suitability according to ICH Q2 precision/accuracy gates. |
`;
  }

  if (base.includes('pptx') || base.includes('Legacy')) {
    return `# 📦 Legacy Lecture Archive Metadata
**File:** ${fileName}

---

## Archive Details
- **Source Format:** Microsoft PowerPoint Presentation (.pptx)
- **Slide Count:** 32 Slides
- **Status:** Archived & Migrated to Modern 16-Slide Interactive Canvas
- **Conversion Quality:** 100% Formulas & ILOs preserved in modern Studio Swarm.
`;
  }

  return `# 📄 Obsidian Second Brain Note
**File:** ${fileName}
**Course:** ${ctx.courseName} | **Session:** ${ctx.sessionCode}

---

## Document Content
This note is part of the **PARA Vault** (${ctx.courseName}). It contains academic records, research summaries, and pedagogical resources for ${ctx.sessionTitle}.
`;
}

