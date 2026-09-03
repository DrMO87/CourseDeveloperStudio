'use client';

import React from 'react';
import { ShieldCheck, ToggleLeft, ToggleRight, Settings2, Sliders } from 'lucide-react';
import type { QualityGateDefinition } from '@/lib/types';

interface Props {
  gateDefinitions: QualityGateDefinition[];
  onToggle: (id: string, is_enabled: boolean) => void;
}

export function GateConfigPanel({ gateDefinitions, onToggle }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Deterministic Quality Gate Enforcers
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Enable or disable automated quality gates. When enabled, every curriculum generation stage must receive a PASS verdict from all active gates before advancing to ARTIFACTS lock.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gateDefinitions.map((gate) => (
          <div
            key={gate.id || gate.gate_code}
            className={`p-4 rounded-xl border transition-all duration-200 ${
              gate.is_enabled
                ? 'bg-slate-900/80 border-slate-700 shadow-md'
                : 'bg-slate-950/40 border-slate-800/60 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-100">{gate.display_name}</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {gate.gate_code}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {getGateDescription(gate.gate_code)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onToggle(gate.id, !gate.is_enabled)}
                className={`p-1 transition-colors ${
                  gate.is_enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-400'
                }`}
                title={gate.is_enabled ? 'Disable Gate' : 'Enable Gate'}
              >
                {gate.is_enabled ? (
                  <ToggleRight className="w-7 h-7" />
                ) : (
                  <ToggleLeft className="w-7 h-7" />
                )}
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className={`font-semibold flex items-center gap-1 ${
                gate.is_enabled ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  gate.is_enabled ? 'bg-emerald-400' : 'bg-slate-600'
                }`} />
                {gate.is_enabled ? 'Active Gatekeeper' : 'Gate Disabled'}
              </span>
              <span className="text-slate-500 font-mono">Priority: #{gate.sort_order}</span>
            </div>
          </div>
        ))}

        {gateDefinitions.length === 0 && (
          <div className="col-span-full py-8 text-center bg-slate-900/40 rounded-xl border border-slate-800">
            <Sliders className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No gate definitions found for this organization.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getGateDescription(code: string): string {
  switch (code) {
    case 'language_ratio':
      return 'Scans Unicode ranges to assert adherence to primary/secondary bilingual script ratios.';
    case 'brand_palette':
      return 'Scans all slide markdown and styling hex codes against approved and retired color lists.';
    case 'boundary_check':
      return 'Guarantees zero lecturer scripts or lecturer notes leak into student-facing outputs.';
    case 'asset_reconciliation':
      return 'Verifies that every referenced visual asset resolves on disk with a valid SHA256 checksum.';
    default:
      return 'Automated quality gate verification.';
  }
}

