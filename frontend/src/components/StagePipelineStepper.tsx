'use client';

import React, { useState, useEffect } from 'react';
import { PipelineStage } from '@/lib/types';
import { 
  CheckCircle2, 
  Circle, 
  Play, 
  Sparkles, 
  RotateCcw, 
  Bot, 
  ArrowRight, 
  ShieldCheck, 
  Info, 
  Layers, 
  FileCode2, 
  Cpu, 
  Boxes, 
  ChevronRight,
  Sliders
} from 'lucide-react';
import { AgentLlmMatrixModal, DEFAULT_AGENT_MATRIX, AgentLlmConfig } from '@/components/AgentLlmMatrixModal';

export interface StageInfo {
  key: PipelineStage;
  stepNumber: number;
  name: string;
  tagline: string;
  icon: any;
  fullGoal: string;
  agents: { name: string; role: string }[];
  inputsNeeded: string;
  outputsProduced: string;
  gateCheck: string;
}

export const STAGES_GUIDE: StageInfo[] = [
  {
    key: 'BRAND_SETUP',
    stepNumber: 0,
    name: 'Brand & Rules',
    tagline: 'Identity & Guidelines',
    icon: Sparkles,
    fullGoal: 'Ingest institutional brand palette, approved hex colors, language script policy, mascot persona, and lecturer boundary isolation rules.',
    agents: [
      { name: 'CONTEXT_INGESTOR', role: 'Brand & Script Policy' },
      { name: 'IDENTITY_AUDITOR', role: 'Palette & Boundary Enforcer' }
    ],
    inputsNeeded: 'Institution Profile (Palette, Script target ratio, Mascot, Forbidden strings)',
    outputsProduced: '02_Areas/{Org}/Branding_Rule.md, Mascot_Usage_Guide.md',
    gateCheck: 'Brand Palette Gate & Boundary Isolation'
  },
  {
    key: 'RECEIPT',
    stepNumber: 1,
    name: 'Receipt & Intake',
    tagline: 'ILOs & Time Ceilings',
    icon: FileCode2,
    fullGoal: 'Parse the Course Intake Dossier (Syllabus, Specs, Lab SOPs) to establish Intended Learning Outcomes (ILOs), session timings, and lab constraints.',
    agents: [
      { name: 'SYLLABUS_ARCHITECT', role: 'ILO & Matrix Extractor' },
      { name: 'CONSTRAINT_VALIDATOR', role: 'Ceiling & Lab Specialist' }
    ],
    inputsNeeded: 'Course Dossier Files (Course Specs, Formulas, Schematics, Lab Manuals)',
    outputsProduced: 'Session timing ceilings, pedagogical milestones, hardware limits',
    gateCheck: 'Asset Reconciliation & Constraint Gate'
  },
  {
    key: 'DIGEST',
    stepNumber: 2,
    name: 'Deconstruct & Bloom',
    tagline: 'Cognitive Progression',
    icon: Cpu,
    fullGoal: 'Deconstruct lecture topics into a 16-slide pedagogical ascent following Bloom’s Revised Taxonomy (Remember -> Understand -> Apply -> Analyze -> Evaluate).',
    agents: [
      { name: 'CURRICULUM_DECONSTRUCTOR', role: 'Topic Deconstructor' },
      { name: 'BLOOM_AUDITOR', role: 'Taxonomy & Matrix Auditor' }
    ],
    inputsNeeded: 'Topic outline, legacy decks, Bloom/Miller rubrics',
    outputsProduced: '16-Slide cognitive ascent, concept breakdown, formative questions',
    gateCheck: 'Bloom Cognitive Progression Verification'
  },
  {
    key: 'BUNDLE',
    stepNumber: 3,
    name: 'Staged Bundle',
    tagline: 'Bilingual Source & Deck',
    icon: Boxes,
    fullGoal: 'Synthesize complete bilingual slide deck markdown, pedagogical lesson blueprint, specialist decision logs, and student 3-slide home summary.',
    agents: [
      { name: 'KNOWLEDGE_SYNTHESIZER', role: 'Bilingual Deck Author' },
      { name: 'CITATION_CHECKER', role: 'Specialist Council Reviewer' }
    ],
    inputsNeeded: 'Extracted ILOs, Bloom slide outline, script policies',
    outputsProduced: 'blueprint.md, slides-source.md, home-summary.md, decisions.md',
    gateCheck: 'Language Ratio Gate (Unicode frequencies) & Lecturer Isolation'
  },
  {
    key: 'ARTIFACTS',
    stepNumber: 4,
    name: 'Artifacts & Sync',
    tagline: 'Second Brain Export',
    icon: Layers,
    fullGoal: 'Resolve [Reserved Image Area] overlays, evaluate deterministic quality receipts, and write the complete course bundle to the Obsidian Second Brain PARA vault.',
    agents: [
      { name: 'ASSET_GENERATOR', role: 'Visual Evidence Resolver' },
      { name: 'OBSIDIAN_VAULT_SYNCER', role: 'PARA Vault Syncer' }
    ],
    inputsNeeded: 'Synthesized bundle, disk asset checksums (SHA-256), Obsidian vault path',
    outputsProduced: 'Synced Obsidian vault files in 01_Projects/{Course_Slug}/',
    gateCheck: 'Deterministic Quality Gatekeeper Overall Receipt (PASS/FAIL)'
  },
];

interface Props {
  currentStage: PipelineStage;
  completedStages: PipelineStage[];
  onSelectStage: (stage: PipelineStage) => void;
  onRunStage: (stage: PipelineStage) => void;
  onResetPipeline: () => void;
  isRunning: boolean;
}

export default function StagePipelineStepper({ 
  currentStage, 
  completedStages, 
  onSelectStage, 
  onRunStage, 
  onResetPipeline, 
  isRunning 
}: Props) {
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showLlmModal, setShowLlmModal] = useState(false);
  const [activeMatrix, setActiveMatrix] = useState<AgentLlmConfig[]>(DEFAULT_AGENT_MATRIX);

  const loadMatrix = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cds_agent_llm_matrix_default') || localStorage.getItem('cds_agent_llm_matrix');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setActiveMatrix(parsed);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  useEffect(() => {
    loadMatrix();
    window.addEventListener('cds_storage_updated', loadMatrix);
    return () => window.removeEventListener('cds_storage_updated', loadMatrix);
  }, []);

  const currentStageInfo = STAGES_GUIDE.find(s => s.key === currentStage) || STAGES_GUIDE[0];
  const currentIndex = STAGES_GUIDE.findIndex(s => s.key === currentStage);

  return ( <>
    <div className="bg-white dark:bg-[#001530]/90 border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-sm dark:shadow-2xl backdrop-blur-xl relative overflow-hidden transition-colors flex flex-col">
      
      {/* 5-Stage Connected Stepper Section */}
      <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 dark:bg-gradient-gold text-amber-700 dark:text-primary-900 flex items-center justify-center font-display font-black text-sm shadow-sm dark:shadow-glow-gold">
              ⚡
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-display font-extrabold text-slate-900 dark:text-white tracking-wide">
                Multi-Agent Swarm Pipeline
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-white/50">
                Deterministic 5-stage progression governed by autonomous specialist agents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowLlmModal(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white/80 text-xs font-display font-semibold transition flex items-center gap-1.5 border border-slate-200 dark:border-white/5"
              title="Configure LLM Models per Agent"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-600 dark:text-gold-400" />
              <span>LLM Matrix</span>
            </button>
            <button
              onClick={() => setShowGuideModal(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white/70 text-xs font-display font-semibold transition flex items-center gap-1.5 border border-slate-200 dark:border-white/5"
            >
              <Info className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Step Guide</span>
            </button>
            <button
              onClick={onResetPipeline}
              disabled={isRunning}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-white/60 text-xs font-display font-semibold transition flex items-center gap-1.5 border border-slate-200 dark:border-white/5 disabled:opacity-40"
              title="Reset progress to Step 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Linear Progress Stepper */}
        <div className="relative mb-2">
          {/* Background Connecting Line */}
          <div className="absolute top-5 left-[10%] right-[10%] h-[2px] bg-slate-100 dark:bg-white/10 -z-10" />
          
          {/* Dynamic Progress Line */}
          <div 
            className="absolute top-5 left-[10%] h-[2px] bg-amber-500 dark:bg-gold-500 transition-all duration-500 ease-in-out -z-10"
            style={{ width: `calc(${currentIndex / (STAGES_GUIDE.length - 1)} * 80%)` }}
          />

          <div className="flex justify-between items-start">
            {STAGES_GUIDE.map((s, idx) => {
              const isDone = completedStages.includes(s.key);
              const isCurrent = s.key === currentStage;
              
              return (
                <div
                  key={s.key}
                  onClick={() => onSelectStage(s.key)}
                  className="group flex flex-col items-center w-1/5 text-center relative cursor-pointer focus:outline-none"
                >
                  {/* Step Circle */}
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 shadow-sm relative z-10 ${
                      isCurrent 
                        ? "bg-amber-500 border-white dark:border-[#001530] text-white scale-110 shadow-glow-gold" 
                        : isDone
                        ? "bg-emerald-500 border-white dark:border-[#001530] text-white"
                        : "bg-slate-100 border-white dark:border-[#001530] text-slate-400 dark:bg-slate-800/80 dark:text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                    }`}
                  >
                    {isDone && !isCurrent ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-display font-bold text-sm">{idx}</span>
                    )}
                  </div>

                  {/* Labels */}
                  <div className={`mt-3 px-1 transition-all ${isCurrent ? "mt-4" : ""}`}>
                    <p className={`text-[11px] sm:text-xs font-display font-bold leading-tight ${
                      isCurrent ? "text-amber-600 dark:text-gold-400" :
                      isDone ? "text-emerald-700 dark:text-emerald-400" :
                      "text-slate-500 dark:text-slate-400"
                    }`}>
                      {s.name}
                    </p>
                    <p className="text-[9px] sm:text-[10px] mt-1 text-slate-400 dark:text-white/40 hidden sm:block">
                      {s.tagline}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hero Single Execution Console (Integrated) */}
      <div className="p-5 sm:p-6 bg-slate-50/50 dark:bg-black/20 flex flex-col md:flex-row md:items-center md:justify-between gap-5 transition-colors">
        {/* Left: Active Step Details & Agent Swarm Tagging */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-display font-extrabold uppercase tracking-wide bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-sm dark:shadow-glow-gold">
              Step {currentIndex} · {currentStageInfo.name}
            </span>
            <span className="text-xs text-slate-500 dark:text-white/40 font-mono">
              Deterministic Gate: <span className="text-slate-800 dark:text-white/70 font-semibold">{currentStageInfo.gateCheck}</span>
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-700 dark:text-white/80 leading-relaxed">
            {currentStageInfo.fullGoal}
          </p>

          {/* Assigned Agents Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-display font-bold text-slate-500 dark:text-white/40 flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-amber-600 dark:text-gold-400" /> Assigned Agents:
            </span>
            {currentStageInfo.agents.map((ag) => {
              const matchedConfig = (Array.isArray(activeMatrix) ? activeMatrix : DEFAULT_AGENT_MATRIX).find(m => m.agentName === ag.name) || DEFAULT_AGENT_MATRIX.find(m => m.agentName === ag.name);
              const modelBadge = matchedConfig?.modelDisplayName || 'Claude 3.5 Sonnet';

              return (
                <button
                  key={ag.name}
                  onClick={() => setShowLlmModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-black/40 hover:bg-slate-200 dark:hover:bg-black/60 border border-slate-200 dark:border-white/10 text-[11px] text-slate-800 dark:text-white/90 transition text-left cursor-pointer"
                  title="Click to customize LLM model & temperature"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-gold-400" />
                  <span className="font-mono font-bold text-amber-700 dark:text-gold-300">{ag.name}</span>
                  <span className="text-slate-500 dark:text-white/50 text-[10px] font-mono">({modelBadge})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: High-Impact Execution Button */}
        <div className="shrink-0 flex items-center gap-3">
          <button
            onClick={() => onRunStage(currentStage)}
            disabled={isRunning}
            className="w-full sm:w-auto px-6 py-3.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold dark:hover:opacity-95 text-white dark:text-primary-900 font-display font-extrabold text-xs sm:text-sm rounded-2xl shadow-sm dark:shadow-glow-gold transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 select-none group"
          >
            {isRunning ? (
              <>
                <Circle className="animate-spin w-4 h-4" />
                <span>Synthesizing Step {currentIndex}...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current group-hover:translate-x-0.5 transition-transform" />
                <span>Execute Step {currentIndex}: {currentStageInfo.name}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>

      {/* LLM Model Matrix Modal */}
      <AgentLlmMatrixModal
        isOpen={showLlmModal}
        onClose={() => {
          setShowLlmModal(false);
          loadMatrix();
        }}
      />

      {/* Step-by-Step Educational Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/15 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500 dark:text-gold-400" />
                  Course Developer Swarm Architecture
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">5-stage cognitive synthesis pipeline reference</p>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-white/80">
              {STAGES_GUIDE.map((stage) => (
                <div key={stage.key} className="p-4 bg-slate-50 dark:bg-black/40 rounded-2xl border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 flex items-center justify-center text-xs font-black">
                        {stage.stepNumber}
                      </span>
                      {stage.name}
                    </span>
                    <span className="text-[11px] font-mono text-amber-700 dark:text-gold-300">
                      {stage.agents.map(a => a.name).join(' + ')}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-white/70 text-xs">{stage.fullGoal}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5">
                      <span className="text-slate-400 dark:text-white/40 block font-semibold">Inputs Needed:</span>
                      <span className="text-slate-800 dark:text-white/80">{stage.inputsNeeded}</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5">
                      <span className="text-slate-400 dark:text-white/40 block font-semibold">Outputs Produced:</span>
                      <span className="text-slate-800 dark:text-white/80">{stage.outputsProduced}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs shadow-sm"
              >
                Close Reference
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

