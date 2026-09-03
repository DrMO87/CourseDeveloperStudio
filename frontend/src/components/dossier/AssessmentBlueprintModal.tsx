'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  BookOpen,
  CheckCircle2,
  Brain,
  FileText,
  Sliders,
  Play,
  Loader2,
  X,
  Plus,
  Trash2,
  GraduationCap,
  HelpCircle,
  Download,
  Copy,
  Check
} from 'lucide-react';
import type { ProjectDossierFile, CourseProject } from '@/lib/types';
import { createDossierFile } from '@/lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  blueprintFile: ProjectDossierFile;
  project: CourseProject;
  onGenerated: () => void;
}

export function AssessmentBlueprintModal({
  isOpen,
  onClose,
  blueprintFile,
  project,
  onGenerated
}: Props) {
  let parsedBlueprint: any = null;
  try {
    parsedBlueprint = JSON.parse(blueprintFile.file_content_text || '{}');
  } catch {
    parsedBlueprint = null;
  }

  const [questionCount, setQuestionCount] = useState<number>(parsedBlueprint?.target_question_count || 20);
  const [includeRationales, setIncludeRationales] = useState<boolean>(true);
  const [includeDistractorAnalysis, setIncludeDistractorAnalysis] = useState<boolean>(true);
  const [difficultyMix, setDifficultyMix] = useState<string>('Standard (30% Recall, 50% Application, 20% Analysis)');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedBank, setGeneratedBank] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedBank(null);

    const systemPrompt = `You are a Senior Academic Assessment & Question Bank Designer specialized in University higher-education and accreditation standards (ABET, NARS, NAQAAE).
Your task is to generate a rigorous, scientifically accurate, calibrated Question Bank based on the provided Course Assessment Blueprint (جدول المواصفات).`;

    const userPrompt = `Course: ${project.name} (${project.course_code || 'Academic Course'})
Assessment Blueprint Matrix:
${blueprintFile.file_content_text || JSON.stringify(blueprintFile.extracted_metadata)}

GENERATION SPECIFICATIONS:
- Total Questions: ${questionCount}
- Difficulty Distribution: ${difficultyMix}
- Include Detailed Answer Key: ${includeRationales ? 'Yes with exhaustive rationales' : 'Yes'}
- Include Distractor Analysis: ${includeDistractorAnalysis ? 'Yes (explain why distractors are wrong)' : 'No'}

FORMAT REQUIRED:
Generate each question formatted in Markdown with:
1. **[Q-ID] Topic & Bloom Level** (e.g. [Q01] UV-Vis Spectrophotometry | Bloom Level: Application | ILO: I1)
2. **Stem / Problem Statement** (clear clinical or scientific scenario)
3. **Four Options** (A, B, C, D)
4. **Correct Answer**
5. **Pedagogical Rationale** (step-by-step scientific proof or clinical rationale)
6. **Distractor Analysis** (why other options are incorrect)

Generate the questions now in a clear, academic Markdown format:`;

    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to communicate with LLM engine.');
      }

      const generatedContent = data.content || 'No output received from model.';
      setGeneratedBank(generatedContent);

      // Automatically save the generated question bank to the Course Dossier!
      const fileName = `Question_Bank_${(project.course_code || project.slug || 'Course').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now().toString().slice(-4)}.md`;
      await createDossierFile({
        project_id: project.id,
        file_name: fileName,
        category: 'CASE_STUDY_BANK',
        summary: `Calibrated Question Bank (${questionCount} items) synthesized from Assessment Blueprint Matrix.`,
        extracted_metadata: {
          generated_from: blueprintFile.file_name,
          question_count: questionCount,
          model: data.model || 'Agent Swarm',
          bloom_levels: ['Recall', 'Application', 'Analysis']
        },
        file_content_text: generatedContent
      });

      onGenerated();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedBank) return;
    navigator.clipboard.writeText(generatedBank);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/15 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-gold-400/10 border border-amber-500/30 dark:border-gold-400/30 flex items-center justify-center text-amber-700 dark:text-gold-400 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Assessment Blueprint &amp; Question Bank Matrix
              </h2>
              <p className="text-xs text-slate-500 dark:text-white/50">
                {blueprintFile.file_name} · {project.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Blueprint Overview / Table */}
        {parsedBlueprint && parsedBlueprint.topic_blueprint && (
          <div className="space-y-3">
            <h4 className="text-xs font-display font-bold text-slate-700 dark:text-white/80 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-sky-500" />
              <span>Exam Specification Table (جدول المواصفات)</span>
            </h4>
            <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-black/40 text-slate-700 dark:text-white/70 font-display font-bold border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="p-3">Course Topic / Lecture Unit</th>
                    <th className="p-3">Weight</th>
                    <th className="p-3">Target ILOs</th>
                    <th className="p-3">Target Question Types</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-800 dark:text-white/90">
                  {parsedBlueprint.topic_blueprint.map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="p-3 font-semibold">{t.topic}</td>
                      <td className="p-3 font-mono font-bold text-amber-600 dark:text-gold-400">{t.weight}</td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {t.ilos?.map((ilo: string) => (
                            <span key={ilo} className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-mono text-[10px] font-bold">
                              {ilo}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-[11px] text-slate-500 dark:text-white/60">
                        {t.question_distribution ? Object.entries(t.question_distribution).map(([k, v]) => `${v} ${k.replace('_', ' ')}`).join(', ') : 'Standard MCQs'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Generator Controls */}
        <div className="p-5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-3xl space-y-4">
          <h4 className="text-xs font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-500 dark:text-gold-400" />
            <span>Question Bank Synthesis Parameters</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1">
                Question Target Volume
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              >
                <option value={10}>10 Questions (Quick Review Formative Quiz)</option>
                <option value={20}>20 Questions (Midterm Exam Pool)</option>
                <option value={30}>30 Questions (Comprehensive Bank)</option>
                <option value={50}>50 Questions (Full Semester Accredited Exam Bank)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1">
                Cognitive Difficulty Mix
              </label>
              <select
                value={difficultyMix}
                onChange={(e) => setDifficultyMix(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              >
                <option value="Standard (30% Recall, 50% Application, 20% Analysis)">Standard Bloom Ascent (30% Recall, 50% App, 20% Analysis)</option>
                <option value="Higher Order Focus (10% Recall, 50% Application, 40% Evaluation)">Higher Order Analytical (10% Recall, 50% App, 40% Eval)</option>
                <option value="Fundamental Mastery (50% Recall, 40% Comprehension, 10% Application)">Fundamental Mastery (50% Recall, 40% Comp, 10% App)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-white/80 font-medium">
              <input
                type="checkbox"
                checked={includeRationales}
                onChange={(e) => setIncludeRationales(e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-500"
              />
              <span>Generate Exhaustive Answer Key &amp; Pedagogical Rationales</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-white/80 font-medium">
              <input
                type="checkbox"
                checked={includeDistractorAnalysis}
                onChange={(e) => setIncludeDistractorAnalysis(e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-500"
              />
              <span>Include Distractor Analysis (Why false options fail)</span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 font-display font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Question Bank via LLM Swarm...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>⚡ Synthesize Calibrated Question Bank</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Section */}
        {generatedBank && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-display font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Generated &amp; Saved to Course Dossier</span>
              </h4>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
              </button>
            </div>

            <div className="p-4 bg-slate-950 dark:bg-black/70 rounded-2xl border border-slate-800 dark:border-white/10 max-h-72 overflow-y-auto font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
              {generatedBank}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
