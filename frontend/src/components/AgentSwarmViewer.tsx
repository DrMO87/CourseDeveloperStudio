'use client';

import React, { useState, useEffect } from 'react';
import { AgentLog } from '@/lib/types';
import { Bot, Terminal, Send, Sparkles, CheckCircle2 } from 'lucide-react';

interface Props {
  stageName: string;
  agentLogs: AgentLog[];
  defaultVaultPath?: string;
  onSyncToObsidian: (projectName: string) => void;
}

export default function AgentSwarmViewer({ stageName, agentLogs, defaultVaultPath, onSyncToObsidian }: Props) {
  const [vaultProjectName, setVaultProjectName] = useState(defaultVaultPath || 'Curriculum_Project');

  useEffect(() => {
    if (defaultVaultPath) {
      setVaultProjectName(defaultVaultPath);
    }
  }, [defaultVaultPath]);

  return (
    <div className="bg-white dark:bg-[#001530]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm dark:shadow-2xl backdrop-blur-xl transition-colors">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/10 dark:bg-gold-400/10 border border-amber-500/30 dark:border-gold-400/30 flex items-center justify-center text-amber-700 dark:text-gold-400 shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Multi-Agent Swarm Trace <span className="text-[10px] text-amber-700 dark:text-gold-400 px-2 py-0.5 bg-amber-500/10 dark:bg-gold-400/10 rounded-md border border-amber-500/20 dark:border-gold-400/20 font-mono">Stage: {stageName}</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-white/50">Autonomous multi-role debate, synthesis, and consensus stream</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/50">
          <Terminal className="w-3.5 h-3.5 text-amber-600 dark:text-gold-400" />
          <span className="font-mono text-[11px]">MCP Tool Dispatch</span>
        </div>
      </div>

      {/* Real-time Agent Execution Stream */}
      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {(!agentLogs || agentLogs.length === 0) ? (
          <div className="p-8 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50 dark:bg-black/20">
            <Bot className="w-8 h-8 text-slate-400 dark:text-white/30 mx-auto mb-2 opacity-50" />
            <p className="text-xs text-slate-500 dark:text-white/40">No agent activity logged for this stage yet. Click &quot;Execute Step&quot; above to initiate multi-role synthesis.</p>
          </div>
        ) : (
          (Array.isArray(agentLogs) ? agentLogs : []).map((log, idx) => {
            const formattedTime = log?.created_at && !isNaN(new Date(log.created_at).getTime()) 
              ? new Date(log.created_at).toLocaleTimeString() 
              : '';
            return (
              <div key={idx} className="p-3.5 bg-slate-50 dark:bg-black/40 rounded-2xl border border-slate-200 dark:border-white/10 text-xs hover:border-amber-400/40 dark:hover:border-gold-400/30 transition-all">
                <div className="flex justify-between items-center font-semibold mb-1">
                  <span className="text-amber-700 dark:text-gold-300 font-mono tracking-wide flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-gold-400" />
                    {log?.agent_role || 'AGENT'}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-white/40 font-mono">
                    {formattedTime} {log?.tokens_consumed ? `• ${log.tokens_consumed} tokens` : ''}
                  </span>
                </div>
                <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans text-xs leading-relaxed mt-1">
                  {log?.agent_thoughts || ''}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Obsidian Vault Sync Trigger */}
      <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[11px] text-slate-500 dark:text-white/50 font-display">Target Vault Folder:</span>
          <input
            type="text"
            value={vaultProjectName}
            onChange={(e) => setVaultProjectName(e.target.value)}
            className="flex-1 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white font-mono focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
          />
        </div>
        <button
          onClick={() => onSyncToObsidian(vaultProjectName)}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white rounded-xl text-xs font-display font-bold transition border border-slate-200 dark:border-white/5"
        >
          <Send className="w-3.5 h-3.5 text-amber-600 dark:text-gold-400" />
          <span>Sync PARA Vault</span>
        </button>
      </div>
    </div>
  );
}
