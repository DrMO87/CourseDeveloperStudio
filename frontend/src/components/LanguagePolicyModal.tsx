'use client';

import React, { useState, useEffect } from 'react';
import { Languages, X, Sparkles, Check, Globe, Sliders } from 'lucide-react';
import type { LanguagePolicy, CourseProject, Organization } from '@/lib/types';
import { LANGUAGE_PRESETS } from './settings/LanguagePolicyEditor';
import { updateOrganization } from '@/lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  org: Organization | null;
  project: CourseProject | null;
  onUpdatePolicy: (updated: LanguagePolicy) => void;
}

export function LanguagePolicyModal({
  isOpen,
  onClose,
  org,
  project,
  onUpdatePolicy
}: Props) {
  const currentPolicy: LanguagePolicy = 
    org?.language_policy || {
      primary_script: 'latin',
      secondary_script: 'arabic',
      target_ratio: 1.0,
      tolerance: 0.0
    };

  const [policy, setPolicy] = useState<LanguagePolicy>(currentPolicy);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org?.language_policy) {
      setPolicy(org.language_policy);
    }
  }, [org]);

  if (!isOpen) return null;

  const targetPercent = Math.round(policy.target_ratio * 100);
  const secondaryPercent = 100 - targetPercent;
  const isEnglishOnly = policy.primary_script === 'latin' && targetPercent === 100;
  const isArabicOnly = policy.primary_script === 'arabic' && targetPercent === 100;

  const handleApply = async () => {
    setSaving(true);
    try {
      if (org) {
        await updateOrganization(org.id, {
          language_policy: policy
        });
      }
      onUpdatePolicy(policy);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-sm">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Language &amp; Script Ratio Controller
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/50">
                Course: <span className="font-semibold text-slate-800 dark:text-white">{project?.name || 'Active Course'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Active Mode Notice */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            isEnglishOnly
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
              : 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-500/40 text-sky-900 dark:text-sky-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <span className="text-xs font-display font-extrabold block">
                  Active Mode: {isEnglishOnly ? '🇬🇧 100% English Only (Faculty Standard)' : isArabicOnly ? '🇪🇬 100% Arabic Only' : `⚖️ Bilingual (${targetPercent}% ${policy.primary_script} / ${secondaryPercent}% ${policy.secondary_script})`}
                </span>
                <span className="text-[11px] opacity-80 block">
                  {isEnglishOnly 
                    ? 'All Swarm stages, presentation decks, and NotebookLM exports will be generated 100% in English with zero Arabic text.'
                    : 'Generated slides, summaries, and questions will follow this exact linguistic ratio.'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <label className="text-xs font-display font-bold text-slate-700 dark:text-slate-300 block">
              Select Preset:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {LANGUAGE_PRESETS.map((preset) => {
                const isSelected = 
                  preset.policy.primary_script === policy.primary_script &&
                  Math.round(preset.policy.target_ratio * 100) === targetPercent;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPolicy(preset.policy)}
                    className={`p-3.5 rounded-2xl border text-left transition flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500 text-slate-900 dark:text-white ring-2 ring-sky-500/30'
                        : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-display font-extrabold block">
                        {preset.title}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-white/50 block mt-0.5 leading-snug">
                        {preset.description}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Slider */}
          <div className="p-4 bg-slate-50 dark:bg-black/30 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-display font-bold">
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-500" /> Custom Ratio Adjuster
              </span>
              <span className="text-sky-600 dark:text-sky-400 font-mono">
                {policy.primary_script.toUpperCase()}: {targetPercent}% | {policy.secondary_script.toUpperCase()}: {secondaryPercent}%
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
                setPolicy({
                  ...policy,
                  target_ratio: val / 100,
                  tolerance: val === 100 ? 0.0 : 0.10
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2.5 bg-slate-50 dark:bg-black/20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-display font-bold text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-display font-extrabold bg-sky-500 hover:bg-sky-600 text-white shadow-sm transition flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Apply Language Policy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
