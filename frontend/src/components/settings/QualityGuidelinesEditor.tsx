import React from 'react';
import type { QualityGuidelinesConfig } from '@/lib/types';
import { BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';

interface Props {
  guidelines: QualityGuidelinesConfig;
  onChange: (updated: QualityGuidelinesConfig) => void;
}

export function QualityGuidelinesEditor({ guidelines, onChange }: Props) {
  const updateField = (field: keyof QualityGuidelinesConfig, value: string) => {
    onChange({ ...guidelines, [field]: value });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-display font-bold text-white flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-gold-400" />
          Quality & Accreditation Guidelines
        </h3>
        <p className="text-xs text-white/60 mb-6">
          Provide the accreditation authority (e.g., NQAAA, ABET) and the core guidelines. The AI orchestrator will use these rules to ground all generated curriculum and vault files.
        </p>

        <div className="space-y-5 bg-white/5 border border-white/10 rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/10 rounded-bl-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div>
            <label className="block text-xs font-display font-semibold text-white/80 mb-1.5 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
              Accrediting Authority / Quality Agency Name
            </label>
            <input
              type="text"
              value={guidelines?.authority_name || ''}
              onChange={(e) => updateField('authority_name', e.target.value)}
              placeholder="e.g. NQAAA, CAEP, ABET"
              className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-gold-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold text-white/80 mb-1.5 flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              Reference URL (Optional)
            </label>
            <input
              type="text"
              value={guidelines?.reference_url || ''}
              onChange={(e) => updateField('reference_url', e.target.value)}
              placeholder="https://..."
              className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-gold-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-display font-semibold text-white/80 mb-1.5 flex items-center justify-between">
              <span>Core Guidelines & Prompts</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                AI Grounding Source
              </span>
            </label>
            <textarea
              value={guidelines?.core_guidelines || ''}
              onChange={(e) => updateField('core_guidelines', e.target.value)}
              rows={6}
              placeholder="Describe the key guidelines and quality criteria that all courses must adhere to. The AI will inject this into its system prompt."
              className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-gold-400 transition-colors resize-y min-h-[120px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
