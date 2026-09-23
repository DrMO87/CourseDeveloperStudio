'use client';

import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Cpu, 
  Sparkles, 
  Clock, 
  Activity, 
  Laptop, 
  CheckCircle2, 
  Bot, 
  Layers,
  Info,
  Server,
  Gauge
} from 'lucide-react';

export interface ModelSpeedProfile {
  providerName: string;
  speedRating: 'HYPER' | 'FAST' | 'BALANCED' | 'LOCAL';
  tokensPerSecEstimate: string;
  expectedDurationSec: number;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  description: string;
}

export function getModelSpeedProfile(modelName?: string, provider?: string): ModelSpeedProfile {
  const m = (modelName || '').toLowerCase();
  const p = (provider || '').toLowerCase();

  if (p.includes('engine') || m.includes('ingestion') || m.includes('extract') || p.includes('parser') || p.includes('dossier')) {
    return {
      providerName: 'Dossier Ingestion Engine',
      speedRating: 'FAST',
      tokensPerSecEstimate: 'Binary & Office Syntax Parser',
      expectedDurationSec: 4.5,
      badgeColor: 'text-amber-500 dark:text-gold-400',
      badgeBg: 'bg-amber-500/10',
      badgeBorder: 'border-amber-500/30',
      description: 'Native document syntax parser & Obsidian vault asset pipeline.'
    };
  }

  if (p.includes('groq') || m.includes('groq')) {
    return {
      providerName: 'Groq LPU Engine',
      speedRating: 'HYPER',
      tokensPerSecEstimate: '300 – 500 tok/s',
      expectedDurationSec: 3.5,
      badgeColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/10',
      badgeBorder: 'border-amber-500/30',
      description: 'Ultra-low latency LPU hardware inference.'
    };
  }

  if (p.includes('google') || m.includes('gemini')) {
    return {
      providerName: 'Google Gemini Cloud',
      speedRating: 'FAST',
      tokensPerSecEstimate: '150 – 250 tok/s',
      expectedDurationSec: 5.0,
      badgeColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10',
      badgeBorder: 'border-emerald-500/30',
      description: 'High-throughput multimodal cloud model.'
    };
  }

  if (p.includes('nvidia') || m.includes('nvidia') || m.includes('nim')) {
    return {
      providerName: 'NVIDIA NIM Cloud',
      speedRating: 'FAST',
      tokensPerSecEstimate: '100 – 180 tok/s',
      expectedDurationSec: 6.5,
      badgeColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10',
      badgeBorder: 'border-emerald-500/30',
      description: 'NVIDIA Tensor Core accelerated cloud inference.'
    };
  }

  if (p.includes('anthropic') || m.includes('claude') || p.includes('openai') || m.includes('gpt') || m.includes('o3') || p.includes('deepseek') || m.includes('deepseek')) {
    return {
      providerName: 'Frontier Cloud Reasoning',
      speedRating: 'BALANCED',
      tokensPerSecEstimate: '60 – 90 tok/s',
      expectedDurationSec: 9.0,
      badgeColor: 'text-sky-400',
      badgeBg: 'bg-sky-500/10',
      badgeBorder: 'border-sky-500/30',
      description: 'Deep cognitive reasoning & frontier safety checks.'
    };
  }

  // Local LM Studio / Ollama
  const isLargeLocal = m.includes('35b') || m.includes('32b') || m.includes('70b') || m.includes('r1');
  return {
    providerName: 'LM Studio / Local Hardware',
    speedRating: 'LOCAL',
    tokensPerSecEstimate: isLargeLocal ? '12 – 25 tok/s' : '25 – 45 tok/s',
    expectedDurationSec: isLargeLocal ? 18.0 : 12.0,
    badgeColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/10',
    badgeBorder: 'border-purple-500/30',
    description: isLargeLocal 
      ? 'Large local model running on host GPU/VRAM with CPU offload.' 
      : 'Local neural model running on host device hardware.'
  };
}

export interface LlmProcessLoadingMeterProps {
  isActive: boolean;
  isComplete?: boolean;
  processTitle: string;
  processSubtitle?: string;
  activeAgent?: string;
  modelName?: string;
  provider?: string;
  customExpectedSeconds?: number;
  currentPhaseText?: string;
  phases?: string[];
  onCancel?: () => void;
  inline?: boolean;
}

export function LlmProcessLoadingMeter({
  isActive,
  isComplete = false,
  processTitle,
  processSubtitle,
  activeAgent = 'SYLLABUS_ARCHITECT',
  modelName,
  provider,
  customExpectedSeconds,
  currentPhaseText,
  phases = [
    'Parsing document syntax & structure',
    'Routing prompt to cognitive LLM matrix',
    'Synthesizing pedagogical units & constraints',
    'Synchronizing Obsidian vault & database records'
  ],
  onCancel,
  inline = false
}: LlmProcessLoadingMeterProps) {
  const [elapsed, setElapsed] = useState(0);
  const [activeModel, setActiveModel] = useState(modelName || '');

  // Detect active model from context or localStorage if not explicitly passed
  useEffect(() => {
    if (!modelName && (activeAgent === 'CONTEXT_INGESTOR' || processTitle?.toLowerCase().includes('ingest'))) {
      setActiveModel('Dossier Ingestion Engine');
    } else if (!modelName && typeof window !== 'undefined') {
      const savedModel = localStorage.getItem('cds_verified_model');
      if (savedModel) setActiveModel(savedModel);
    } else if (modelName) {
      setActiveModel(modelName);
    }
  }, [modelName, activeAgent, processTitle]);

  const effectiveProvider = (activeAgent === 'CONTEXT_INGESTOR' || processTitle?.toLowerCase().includes('ingest')) 
    ? (provider || 'engine') 
    : provider;
  const profile = getModelSpeedProfile(activeModel, effectiveProvider);
  const targetDuration = customExpectedSeconds || profile.expectedDurationSec;

  // High-precision elapsed ticker
  useEffect(() => {
    if (!isActive) {
      setElapsed(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const current = (Date.now() - startTime) / 1000;
      setElapsed(current);
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive && !isComplete) return null;

  // Smooth asymptotic progression towards 95%, snapping to 100% on complete
  let progressPercent = 0;
  if (isComplete) {
    progressPercent = 100;
  } else {
    const ratio = elapsed / targetDuration;
    if (ratio < 1.0) {
      progressPercent = Math.min(88, Math.round((1 - Math.exp(-ratio * 2.2)) * 100));
    } else {
      const overtime = ratio - 1.0;
      progressPercent = Math.min(96, Math.round(88 + (1 - Math.exp(-overtime * 0.5)) * 8));
    }
  }

  const phaseIndex = Math.min(
    phases.length - 1,
    Math.floor((progressPercent / 100) * phases.length)
  );

  const estimatedRemaining = Math.max(0, Math.round((targetDuration - elapsed) * 10) / 10);

  const content = (
    <div className="space-y-4">
      {/* Header: Title & Model Speed Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 dark:text-gold-400 flex items-center justify-center font-bold">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-ping" />
          </div>
          <div>
            <h4 className="text-sm font-display font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{processTitle}</span>
              {activeAgent && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-gold-400 border border-amber-500/20">
                  {activeAgent}
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-500 dark:text-white/60">
              {processSubtitle || `Processing with ${activeModel || profile.providerName}`}
            </p>
          </div>
        </div>

        {/* Speed Profile Tag */}
        <div className={`self-start sm:self-auto px-3 py-1.5 rounded-xl border flex items-center gap-2 ${profile.badgeBg} ${profile.badgeBorder}`}>
          {profile.speedRating === 'HYPER' && <Zap className={`w-4 h-4 ${profile.badgeColor} animate-bounce`} />}
          {profile.speedRating === 'FAST' && <Sparkles className={`w-4 h-4 ${profile.badgeColor}`} />}
          {profile.speedRating === 'BALANCED' && <Bot className={`w-4 h-4 ${profile.badgeColor}`} />}
          {profile.speedRating === 'LOCAL' && <Laptop className={`w-4 h-4 ${profile.badgeColor}`} />}
          
          <div className="text-left">
            <div className={`text-[11px] font-display font-extrabold ${profile.badgeColor}`}>
              {profile.providerName}
            </div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-white/50">
              ⚡ {profile.tokensPerSecEstimate}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Progress Meter Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-display font-bold text-slate-700 dark:text-white/80 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {currentPhaseText || phases[phaseIndex]}
          </span>
          <span className="font-mono font-black text-amber-600 dark:text-gold-400 text-sm">
            {progressPercent}%
          </span>
        </div>

        {/* Outer Bar */}
        <div className="relative w-full h-3.5 bg-slate-200 dark:bg-black/50 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-white/15 shadow-inner">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 transition-all duration-300 ease-out relative overflow-hidden shadow-sm shadow-amber-500/50"
            style={{ width: `${progressPercent}%` }}
          >
            {/* Shimmer Light Streak */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
          </div>
        </div>
      </div>

      {/* Metrics Row: Elapsed, Est. Remaining, Speed Rating */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 dark:text-white/40 font-display font-bold uppercase">
            <Clock className="w-3 h-3 text-slate-400" />
            Elapsed
          </div>
          <div className="text-xs font-mono font-bold text-slate-800 dark:text-white mt-0.5">
            {elapsed.toFixed(1)}s
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 dark:text-white/40 font-display font-bold uppercase">
            <Gauge className="w-3 h-3 text-amber-500" />
            Est. Left
          </div>
          <div className="text-xs font-mono font-bold text-amber-600 dark:text-gold-400 mt-0.5">
            {isComplete ? 'Done' : elapsed > targetDuration ? '~Finishing...' : `~${estimatedRemaining.toFixed(0)}s`}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 dark:text-white/40 font-display font-bold uppercase">
            <Server className="w-3 h-3 text-sky-500" />
            Est. Speed
          </div>
          <div className="text-xs font-mono font-bold text-sky-600 dark:text-sky-300 mt-0.5 truncate" title={profile.tokensPerSecEstimate}>
            {profile.tokensPerSecEstimate.split(' ')[0]} t/s
          </div>
        </div>
      </div>

      {/* Real-Time Processing Phase Step Indicators */}
      <div className="bg-slate-100/70 dark:bg-black/20 rounded-2xl p-3 space-y-2 border border-slate-200 dark:border-white/5">
        <div className="text-[10px] uppercase font-display font-extrabold text-slate-400 dark:text-white/40 tracking-wider">
          Active Pipeline Phases
        </div>
        <div className="space-y-1.5">
          {phases.map((phase, idx) => {
            const isFinished = idx < phaseIndex || isComplete;
            const isCurrent = idx === phaseIndex && !isComplete;

            return (
              <div 
                key={idx}
                className={`flex items-center gap-2.5 text-xs transition-colors ${
                  isFinished 
                    ? 'text-emerald-700 dark:text-emerald-400 font-medium' 
                    : isCurrent 
                      ? 'text-slate-900 dark:text-white font-bold' 
                      : 'text-slate-400 dark:text-white/30'
                }`}
              >
                {isFinished ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                ) : isCurrent ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-white/20 flex-shrink-0" />
                )}
                <span className="truncate">{phase}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Helpful Hardware Notice */}
      <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-white/50 bg-amber-500/[0.04] border border-amber-500/10 rounded-xl p-2.5">
        <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <span>{profile.description}</span>
          {profile.speedRating === 'LOCAL' && (
            <span className="ml-1 text-slate-600 dark:text-white/70">
              Response speed scales with your GPU VRAM. Multi-page specifications take ~15–25s to analyze thoroughly.
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="bg-white dark:bg-[#001530] border-2 border-amber-500/40 rounded-3xl p-5 shadow-xl transition-all animate-in fade-in duration-200">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#001530] border border-amber-500/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        {content}
      </div>
    </div>
  );
}