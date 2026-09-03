'use client';

import React from 'react';
import { Languages, HelpCircle, Sparkles, Check, Globe } from 'lucide-react';
import type { LanguagePolicy } from '@/lib/types';

interface Props {
  policy: LanguagePolicy;
  onChange: (updated: LanguagePolicy) => void;
}

const SUPPORTED_SCRIPTS = [
  { value: 'latin', label: 'English / Latin Script' },
  { value: 'arabic', label: 'Arabic (العربية)' },
  { value: 'cyrillic', label: 'Cyrillic (Russian / Ukrainian)' },
  { value: 'cjk', label: 'CJK (Chinese / Japanese / Korean)' },
  { value: 'devanagari', label: 'Devanagari (Hindi / Sanskrit)' },
];

export const LANGUAGE_PRESETS = [
  {
    id: 'english-only',
    title: '🇬🇧 100% English Only (Faculty Standard)',
    description: 'All slides, blueprints, and summaries generated purely in English. Zero Arabic text.',
    policy: {
      primary_script: 'latin',
      secondary_script: 'arabic',
      target_ratio: 1.0,
      tolerance: 0.0
    }
  },
  {
    id: 'bilingual-70-30',
    title: '⚖️ Bilingual 70% English / 30% Arabic',
    description: 'English primary instructional delivery with Arabic explanatory annotations.',
    policy: {
      primary_script: 'latin',
      secondary_script: 'arabic',
      target_ratio: 0.70,
      tolerance: 0.08
    }
  },
  {
    id: 'bilingual-65-35',
    title: '⚖️ Bilingual 65% Arabic / 35% English (Standard)',
    description: 'Arabic instructional narrative with English scientific terminology & formulas.',
    policy: {
      primary_script: 'arabic',
      secondary_script: 'latin',
      target_ratio: 0.65,
      tolerance: 0.10
    }
  },
  {
    id: 'bilingual-50-50',
    title: '⚖️ 50% / 50% Equal Balance',
    description: 'Equal bilingual parity across all slide sections and questions.',
    policy: {
      primary_script: 'latin',
      secondary_script: 'arabic',
      target_ratio: 0.50,
      tolerance: 0.10
    }
  },
  {
    id: 'arabic-only',
    title: '🇪🇬 100% Arabic Only',
    description: 'All slides and assessments rendered strictly in Arabic.',
    policy: {
      primary_script: 'arabic',
      secondary_script: 'latin',
      target_ratio: 1.0,
      tolerance: 0.0
    }
  }
];

export function LanguagePolicyEditor({ policy, onChange }: Props) {
  const targetPercent = Math.round(policy.target_ratio * 100);
  const tolerancePercent = Math.round(policy.tolerance * 100);
  const secondaryPercent = 100 - targetPercent;

  const isEnglishOnly = policy.primary_script === 'latin' && targetPercent === 100;
  const isArabicOnly = policy.primary_script === 'arabic' && targetPercent === 100;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Languages className="w-5 h-5 text-sky-500" />
          Linguistic Ratio &amp; Language Policy Control
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure whether this faculty course requires <strong>100% English Only</strong>, <strong>Bilingual (Arabic/English)</strong>, or <strong>100% Arabic</strong>. The AI Swarm, slide deck generator, quality gatekeeper, and NotebookLM will strictly enforce this exact ratio.
        </p>
      </div>

      {/* Quick Preset Selector Cards */}
      <div className="space-y-2">
        <label className="block text-xs font-display font-bold text-slate-700 dark:text-slate-300">
          ⚡ One-Click Presets:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {LANGUAGE_PRESETS.map((preset) => {
            const isSelected = 
              preset.policy.primary_script === policy.primary_script &&
              Math.round(preset.policy.target_ratio * 100) === targetPercent;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(preset.policy)}
                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-sky-500/10 border-sky-500 text-sky-950 dark:text-white shadow-sm ring-2 ring-sky-500/30'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-extrabold text-slate-900 dark:text-white">
                      {preset.title}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {preset.description}
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400">
                  {preset.policy.primary_script.toUpperCase()}: {Math.round(preset.policy.target_ratio * 100)}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual Fine-Tuning Container */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <span className="text-xs font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-amber-500" />
            Custom Fine-Tuning &amp; Script Selection
          </span>
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            {isEnglishOnly ? '100% English Only' : isArabicOnly ? '100% Arabic Only' : `Bilingual ${targetPercent}% / ${secondaryPercent}%`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Primary Script (Instruction &amp; Core Content)
            </label>
            <select
              value={policy.primary_script}
              onChange={(e) => onChange({ ...policy, primary_script: e.target.value })}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-400"
            >
              {SUPPORTED_SCRIPTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Secondary Script (Technical Terms / Annotations)
            </label>
            <select
              value={policy.secondary_script}
              onChange={(e) => onChange({ ...policy, secondary_script: e.target.value })}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-400"
            >
              {SUPPORTED_SCRIPTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ratio Slider with 0-100% range */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center text-xs font-medium">
            <span className="text-sky-600 dark:text-sky-400 font-bold">
              Primary ({policy.primary_script}): <strong>{targetPercent}%</strong>
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">
              Secondary ({policy.secondary_script}): <strong>{secondaryPercent}%</strong>
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={targetPercent}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange({ 
                ...policy, 
                target_ratio: val / 100,
                tolerance: val === 100 ? 0.0 : policy.tolerance || 0.1
              });
            }}
            className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />

          {/* Visual Ratio Bar */}
          <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner border border-slate-300 dark:border-slate-700">
            <div
              className="bg-sky-500 transition-all duration-200 flex items-center justify-center text-[9px] font-bold text-white"
              style={{ width: `${targetPercent}%` }}
            >
              {targetPercent >= 15 && `${targetPercent}%`}
            </div>
            <div
              className="bg-amber-400 transition-all duration-200 flex items-center justify-center text-[9px] font-bold text-slate-900"
              style={{ width: `${secondaryPercent}%` }}
            >
              {secondaryPercent >= 15 && `${secondaryPercent}%`}
            </div>
          </div>
        </div>

        {/* Tolerance (only applicable when bilingual) */}
        {targetPercent < 100 && (
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center text-xs font-medium">
              <span className="text-slate-700 dark:text-slate-300 font-semibold">Acceptable Gate Tolerance: ±{tolerancePercent}%</span>
              <span className="text-slate-500 dark:text-slate-400">
                Valid range: [{Math.max(0, targetPercent - tolerancePercent)}% – {Math.min(100, targetPercent + tolerancePercent)}%]
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="25"
              step="1"
              value={tolerancePercent}
              onChange={(e) => onChange({ ...policy, tolerance: Number(e.target.value) / 100 })}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-400"
            />
          </div>
        )}
      </div>
    </div>
  );
}
