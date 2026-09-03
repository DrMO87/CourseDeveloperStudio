'use client';

import React, { useState } from 'react';
import { ShieldAlert, Plus, Trash2, Tag } from 'lucide-react';
import type { BoundaryTermsConfig } from '@/lib/types';

interface Props {
  boundaryTerms: BoundaryTermsConfig;
  onChange: (updated: BoundaryTermsConfig) => void;
}

export function BoundaryTermsEditor({ boundaryTerms, onChange }: Props) {
  const [newTerm, setNewTerm] = useState('');

  const addTerm = () => {
    const trimmed = newTerm.trim();
    if (!trimmed) return;
    if (!boundaryTerms.forbidden_strings.includes(trimmed)) {
      onChange({
        forbidden_strings: [...boundaryTerms.forbidden_strings, trimmed]
      });
      setNewTerm('');
    }
  };

  const removeTerm = (term: string) => {
    onChange({
      forbidden_strings: boundaryTerms.forbidden_strings.filter(t => t !== term)
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          Lecturer Boundary Isolation Rules
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Specify forbidden lecturer-only words, lecturer tags, or answer markers. If any of these strings appear in learner-facing slide source or student summaries, the Lecturer Boundary Gate triggers an immediate hard FAIL.
        </p>
      </div>

      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="e.g. lecturer note, ملاحظة للمدرب, expected answer"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTerm();
              }
            }}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-400"
          />
          <button
            type="button"
            onClick={addTerm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Forbidden Marker
          </button>
        </div>

        <div className="pt-2">
          <div className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Active Forbidden Phrases ({boundaryTerms.forbidden_strings.length})
          </div>

          <div className="flex flex-wrap gap-2">
            {boundaryTerms.forbidden_strings.map((term) => (
              <div
                key={term}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-900/40 bg-rose-950/30 text-rose-200 text-xs font-medium"
              >
                <span>{term}</span>
                <button
                  type="button"
                  onClick={() => removeTerm(term)}
                  className="text-rose-400 hover:text-rose-200 transition ml-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {boundaryTerms.forbidden_strings.length === 0 && (
              <span className="text-xs text-slate-500 italic">No boundary markers configured.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

