'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  Presentation,
  MapPin,
  Headphones,
  Video,
  Copy,
  Check,
  Play,
  RotateCcw,
  ShieldCheck,
  Layers,
  Sliders,
  FileCode,
  Info,
  ExternalLink,
  Loader2,
  AlertCircle
} from 'lucide-react';

import {
  PromptFormat,
  PromptTemplate,
  PROMPT_TEMPLATES,
  extractVaultContext,
  formulatePrompt,
  STRICT_GROUNDING_HEADER
} from '@/lib/prompt-architect';

import type { Organization, CourseProject, CourseSession, ProjectDossierFile } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  org?: Organization | null;
  project?: CourseProject | null;
  activeSession?: CourseSession | null;
  dossierFiles?: ProjectDossierFile[];
  notebookId?: string;
  notebookName?: string;
  onExecutePrompt?: (action: string, promptText: string, extraOptions?: Record<string, any>) => Promise<void>;
  isGenerating?: boolean;
}

export function PromptInjectorModal({
  isOpen,
  onClose,
  org,
  project,
  activeSession,
  dossierFiles,
  notebookId,
  notebookName,
  onExecutePrompt,
  isGenerating = false,
}: Props) {
  const [activeFormat, setActiveFormat] = useState<PromptFormat>('slides');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('slides-detailed-deck');
  const [customSlotValues, setCustomSlotValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [previewTab, setPreviewTab] = useState<'prompt' | 'slots'>('prompt');

  // Extract real vault context from session, project, and org
  const vaultContext = useMemo(() => {
    return extractVaultContext(org, project, activeSession, dossierFiles);
  }, [org, project, activeSession, dossierFiles]);

  // Filter templates by selected format
  const formatTemplates = useMemo(() => {
    return PROMPT_TEMPLATES.filter(t => t.format === activeFormat);
  }, [activeFormat]);

  // When format changes, select the first template of that format
  useEffect(() => {
    const firstOfFormat = PROMPT_TEMPLATES.find(t => t.format === activeFormat);
    if (firstOfFormat) {
      setSelectedTemplateId(firstOfFormat.id);
      setCustomSlotValues({});
    }
  }, [activeFormat]);

  // Current selected template
  const currentTemplate = useMemo(() => {
    return PROMPT_TEMPLATES.find(t => t.id === selectedTemplateId) || formatTemplates[0] || PROMPT_TEMPLATES[0];
  }, [selectedTemplateId, formatTemplates]);

  // Live formulated prompt
  const formulatedPrompt = useMemo(() => {
    return formulatePrompt(currentTemplate, vaultContext, customSlotValues);
  }, [currentTemplate, vaultContext, customSlotValues]);

  // Reset custom slots to vault defaults
  const handleResetSlots = () => {
    setCustomSlotValues({});
  };

  // Safe copy to clipboard with fallback
  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formulatedPrompt);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = formulatedPrompt;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Failed to copy prompt:', e);
    }
  };

  // Execute / Inject action directly into generation
  const handleInjectAndGenerate = async () => {
    if (!onExecutePrompt) return;

    let actionName = 'generate_slides';
    let extraOptions: Record<string, any> = {};

    switch (activeFormat) {
      case 'slides':
        actionName = 'generate_slides';
        if (currentTemplate.id === 'slides-presenter-support') extraOptions.slideFormat = 'presenter_slides';
        break;
      case 'infographic':
        actionName = 'generate_infographic';
        extraOptions.orientation = 'portrait';
        extraOptions.detail = 'standard';
        break;
      case 'audio':
        actionName = 'generate_audio';
        if (currentTemplate.id === 'audio-brief-summary') extraOptions.audioFormat = 'brief';
        else if (currentTemplate.id === 'audio-socratic-debate') extraOptions.audioFormat = 'debate';
        else extraOptions.audioFormat = 'deep_dive';
        break;
      case 'video':
        actionName = 'generate_video';
        extraOptions.format = currentTemplate.id === 'video-micro-lecture' ? 'brief' : 'explainer';
        break;
    }

    try {
      await onExecutePrompt(actionName, formulatedPrompt, extraOptions);
    } catch (e) {
      console.error('Prompt injection failed:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#001428] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-display font-extrabold text-slate-900 dark:text-white">
                  NotebookLM Prompt Architect &amp; Vault Injector
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Grounded on Vault
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/50">
                Architect strict studio steering prompts for Slides, Infographs, Audio &amp; Video based on authentic course content
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 dark:border-white/10 flex items-center gap-2 bg-slate-100/50 dark:bg-black/20 overflow-x-auto">
          <button
            onClick={() => setActiveFormat('slides')}
            className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold flex items-center gap-2 transition whitespace-nowrap ${
              activeFormat === 'slides'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-white/60 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            <Presentation className="w-4 h-4" />
            <span>📊 Slide Decks (16-Slide)</span>
          </button>
          <button
            onClick={() => setActiveFormat('infographic')}
            className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold flex items-center gap-2 transition whitespace-nowrap ${
              activeFormat === 'infographic'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-white/60 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>🗺️ Infographics &amp; Process</span>
          </button>
          <button
            onClick={() => setActiveFormat('audio')}
            className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold flex items-center gap-2 transition whitespace-nowrap ${
              activeFormat === 'audio'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-white/60 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            <Headphones className="w-4 h-4" />
            <span>🎙️ Audio Podcast (Deep Dive)</span>
          </button>
          <button
            onClick={() => setActiveFormat('video')}
            className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold flex items-center gap-2 transition whitespace-nowrap ${
              activeFormat === 'video'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-white/60 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>🎥 Video Explainer (6–10m)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Template Selection & Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-display font-bold text-slate-700 dark:text-white/80 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                Select Architect Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {formatTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-display font-bold text-slate-700 dark:text-white/80 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-purple-500" />
                Template Provenance
              </label>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 text-[11px] text-slate-600 dark:text-white/60">
                <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">{currentTemplate.source}</span>
              </div>
            </div>
          </div>

          {/* Template Description Banner */}
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/20 rounded-2xl flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-purple-900 dark:text-purple-200">{currentTemplate.name}</p>
              <p className="text-purple-700 dark:text-purple-300/80">{currentTemplate.description}</p>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">🎯 Best for: {currentTemplate.recommendedUse}</p>
            </div>
          </div>

          {/* Tabs: Prompt Preview vs Slot Customizer */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewTab('prompt')}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 transition ${
                  previewTab === 'prompt'
                    ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                    : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Formulated Prompt ({formulatedPrompt.length} chars)</span>
              </button>
              <button
                onClick={() => setPreviewTab('slots')}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 transition ${
                  previewTab === 'slots'
                    ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                    : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Vault Slots &amp; Context ({currentTemplate.slots.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {previewTab === 'slots' && (
                <button
                  onClick={handleResetSlots}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 font-medium transition"
                  title="Reset slots to detected vault values"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Vault Defaults</span>
                </button>
              )}
            </div>
          </div>

          {/* Tab 1: Formulated Prompt View */}
          {previewTab === 'prompt' && (
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  readOnly
                  rows={12}
                  value={formulatedPrompt}
                  className="w-full font-mono text-xs p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-900 text-slate-100 dark:bg-black/60 dark:text-slate-200 focus:outline-none resize-none leading-relaxed select-text"
                />
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur transition"
                  title="Copy full prompt to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/50 px-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono">Course: {vaultContext.courseCode} ({vaultContext.sessionCode})</span>
                  <span>•</span>
                  <span>Lang: {vaultContext.languagePrimary.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Strict Grounding Directive Included</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Vault Slots & Customizer View */}
          {previewTab === 'slots' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl text-xs space-y-1">
                <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                  Auto-Extracted Vault Baseline:
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-white/60 pt-1 font-mono">
                  <div><strong>Session:</strong> {vaultContext.sessionTitle}</div>
                  <div><strong>Audience:</strong> {vaultContext.audience}</div>
                  <div><strong>Brand Colors:</strong> {vaultContext.brandPaletteHex.slice(0, 3).join(', ')}</div>
                  <div><strong>Language Policy:</strong> {vaultContext.languagePolicySummary.substring(0, 30)}...</div>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {currentTemplate.slots.map(slot => (
                  <div key={slot.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-display font-bold text-slate-700 dark:text-white/80">
                        [{slot.key}] — {slot.label}
                      </label>
                      <span className="text-[10px] text-slate-400 dark:text-white/40">{slot.description}</span>
                    </div>
                    <input
                      type="text"
                      value={customSlotValues[slot.key] ?? ''}
                      placeholder={slot.defaultValue}
                      onChange={(e) => setCustomSlotValues(prev => ({ ...prev, [slot.key]: e.target.value }))}
                      className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="text-[11px] text-slate-500 dark:text-white/50 flex items-center gap-1">
            <span>Target Notebook:</span>
            <strong className="text-slate-800 dark:text-white font-mono">{notebookName || 'Active Session Notebook'}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-purple-500" />}
              <span>{copied ? 'Copied Prompt' : 'Copy Prompt'}</span>
            </button>

            {onExecutePrompt && (
              <button
                onClick={handleInjectAndGenerate}
                disabled={isGenerating}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-display font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Injecting &amp; Generating...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Inject &amp; Generate {activeFormat === 'slides' ? 'Slides' : activeFormat === 'infographic' ? 'Infographic' : activeFormat === 'audio' ? 'Audio Podcast' : 'Video'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
