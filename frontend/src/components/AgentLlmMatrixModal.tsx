'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Cpu, 
  Sparkles, 
  Check, 
  Settings2, 
  Sliders, 
  ShieldCheck, 
  Zap, 
  Layers, 
  X, 
  RefreshCw,
  Info,
  Server,
  Key,
  Globe,
  Radio,
  ExternalLink,
  Laptop,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { PipelineStage } from '@/lib/types';

export type ModelProvider = 
  | 'Groq' 
  | 'NVIDIA' 
  | 'LM Studio (Local)' 
  | 'Google' 
  | 'Anthropic' 
  | 'OpenAI' 
  | 'DeepSeek';

export interface ModelOption {
  id: string;
  name: string;
  provider: ModelProvider;
  isFree: boolean;
  contextWindow: string;
  badge: string;
  endpointUrl?: string;
}

export interface AgentLlmConfig {
  agentName: string;
  roleTitle: string;
  stage: PipelineStage;
  stageStep: number;
  provider: ModelProvider;
  modelId: string;
  modelDisplayName: string;
  temperature: number;
  reasoningEffort: 'low' | 'medium' | 'high';
  specialtyTag: string;
}

export const COMPREHENSIVE_MODEL_CATALOG: ModelOption[] = [
  // ─── 💻 LM STUDIO DIRECT CONNECTION (CONTROL FROM LM STUDIO APP) ───
  { 
    id: 'local/lm-studio/active-model', 
    name: 'LM Studio (Active Loaded Model)', 
    provider: 'LM Studio (Local)', 
    isFree: true, 
    contextWindow: 'Auto (from LM Studio)', 
    badge: 'LOCAL · Whatever model is loaded in LM Studio', 
    endpointUrl: 'http://localhost:1234/v1' 
  },
  { 
    id: 'local/ollama/active-model', 
    name: 'Local Ollama Server (localhost:11434)', 
    provider: 'LM Studio (Local)', 
    isFree: true, 
    contextWindow: 'Auto (Ollama)', 
    badge: 'LOCAL · Active Ollama instance', 
    endpointUrl: 'http://localhost:11434/v1' 
  },

  // ─── 🆓 GROQ LPU (FREE TIER & ULTRA-FAST) ───────────────────────
  { 
    id: 'groq/deepseek-r1-distill-llama-70b', 
    name: 'DeepSeek-R1 Distill Llama 70B (Groq)', 
    provider: 'Groq', 
    isFree: true, 
    contextWindow: '128k', 
    badge: 'FREE · 300 tok/s LPU Reasoning' 
  },
  { 
    id: 'groq/deepseek-r1-distill-qwen-32b', 
    name: 'DeepSeek-R1 Distill Qwen 32B (Groq)', 
    provider: 'Groq', 
    isFree: true, 
    contextWindow: '128k', 
    badge: 'FREE · Math & Code Reasoning' 
  },
  { 
    id: 'groq/llama-3.3-70b-versatile', 
    name: 'Llama 3.3 70B Versatile (Groq)', 
    provider: 'Groq', 
    isFree: true, 
    contextWindow: '128k', 
    badge: 'FREE · Ultra-Fast Synthesis' 
  },
  { 
    id: 'groq/llama-3.1-8b-instant', 
    name: 'Llama 3.1 8B Instant (Groq)', 
    provider: 'Groq', 
    isFree: true, 
    contextWindow: '128k', 
    badge: 'FREE · 1000+ tok/s Instant Gate Checks' 
  },
  { 
    id: 'groq/mixtral-8x7b-32768', 
    name: 'Mixtral 8x7B MoE (Groq)', 
    provider: 'Groq', 
    isFree: true, 
    contextWindow: '32k', 
    badge: 'FREE · Fast MoE Execution' 
  },

  // ─── 🆓 NVIDIA NIM / OPENCODE (FREE DEVELOPER TIER) ─────────────
  { 
    id: 'nvidia/deepseek-ai/deepseek-r1', 
    name: 'DeepSeek-R1 Full 671B (NVIDIA NIM)', 
    provider: 'NVIDIA', 
    isFree: true, 
    contextWindow: '64k', 
    badge: 'FREE API · Full 671B Frontier Reasoning' 
  },
  { 
    id: 'nvidia/deepseek-ai/deepseek-v3', 
    name: 'DeepSeek-V3 Full MoE (NVIDIA NIM)', 
    provider: 'NVIDIA', 
    isFree: true, 
    contextWindow: '64k', 
    badge: 'FREE API · General Knowledge MoE' 
  },
  { 
    id: 'nvidia/meta/llama-3.3-70b-instruct', 
    name: 'Llama 3.3 70B Instruct (NVIDIA NIM)', 
    provider: 'NVIDIA', 
    isFree: true, 
    contextWindow: '128k', 
    badge: 'FREE API · High-Fidelity Instruction' 
  },
  { 
    id: 'nvidia/nvidia/llama-3.1-nemotron-70b-instruct', 
    name: 'Nemotron-3.1 70B (NVIDIA)', 
    provider: 'NVIDIA', 
    isFree: true, 
    contextWindow: '128k', 
    badge: 'FREE API · NVIDIA Alignment Tuned' 
  },
  { 
    id: 'nvidia/qwen/qwen2.5-coder-32b-instruct', 
    name: 'Qwen 2.5 Coder 32B (NVIDIA NIM)', 
    provider: 'NVIDIA', 
    isFree: true, 
    contextWindow: '32k', 
    badge: 'FREE API · Code, LaTeX & Schematics' 
  },
  { 
    id: 'nvidia/mistralai/mistral-large-2-instruct', 
    name: 'Mistral Large 2 123B (NVIDIA NIM)', 
    provider: 'NVIDIA', 
    isFree: true, 
    contextWindow: '128k', 
    badge: 'FREE API · Multilingual Powerhouse' 
  },

  // ─── 🌐 GOOGLE GEMINI (FREE AI STUDIO TIER AVAILABLE) ───────────
  { 
    id: 'google/gemini-2.0-flash', 
    name: 'Gemini 2.0 Flash (Next-Gen)', 
    provider: 'Google', 
    isFree: true, 
    contextWindow: '1M', 
    badge: 'FREE TIER · 2.0 Ultra-Fast Multimodal' 
  },
  { 
    id: 'google/gemini-2.0-flash-thinking-exp-01-21', 
    name: 'Gemini 2.0 Flash Thinking (Deep CoT)', 
    provider: 'Google', 
    isFree: true, 
    contextWindow: '1M', 
    badge: 'FREE TIER · Built-in Deep Reasoning' 
  },
  { 
    id: 'google/gemini-1.5-pro-latest', 
    name: 'Gemini 1.5 Pro (2 Million Context)', 
    provider: 'Google', 
    isFree: false, 
    contextWindow: '2M', 
    badge: 'Massive Course Syllabus Intake' 
  },
  { 
    id: 'google/gemini-1.5-flash', 
    name: 'Gemini 1.5 Flash (Lightweight)', 
    provider: 'Google', 
    isFree: true, 
    contextWindow: '1M', 
    badge: 'FREE TIER · Lightweight & Fast' 
  },

  // ─── 🧠 ANTHROPIC CLAUDE (FRONTIER SYNTHESIS) ───────────────────
  { 
    id: 'anthropic/claude-3-7-sonnet', 
    name: 'Claude 3.7 Sonnet (Hybrid Reasoning)', 
    provider: 'Anthropic', 
    isFree: false, 
    contextWindow: '200k', 
    badge: 'FRONTIER · Hybrid Reasoning & Coding' 
  },
  { 
    id: 'anthropic/claude-3-5-sonnet-20241022', 
    name: 'Claude 3.5 Sonnet (Pedagogy Master)', 
    provider: 'Anthropic', 
    isFree: false, 
    contextWindow: '200k', 
    badge: 'Best for Bilingual Deck & Rubrics' 
  },
  { 
    id: 'anthropic/claude-3-5-haiku-latest', 
    name: 'Claude 3.5 Haiku', 
    provider: 'Anthropic', 
    isFree: false, 
    contextWindow: '200k', 
    badge: 'Fast & Precise Extraction' 
  },

  // ─── ⚡ OPENAI (REASONING & MULTIMODAL) ──────────────────────────
  { 
    id: 'openai/o3-mini', 
    name: 'OpenAI o3-mini (High-Speed Reasoning)', 
    provider: 'OpenAI', 
    isFree: false, 
    contextWindow: '200k', 
    badge: 'STEM, Math & Chain-of-Thought' 
  },
  { 
    id: 'openai/o1', 
    name: 'OpenAI o1 (Frontier Deep Reasoning)', 
    provider: 'OpenAI', 
    isFree: false, 
    contextWindow: '200k', 
    badge: 'PhD-Level Scientific Reasoning' 
  },
  { 
    id: 'openai/gpt-4o', 
    name: 'GPT-4o Multimodal Omni', 
    provider: 'OpenAI', 
    isFree: false, 
    contextWindow: '128k', 
    badge: 'Vision & Multimodal Artifacts' 
  },
  { 
    id: 'openai/gpt-4o-mini', 
    name: 'GPT-4o Mini', 
    provider: 'OpenAI', 
    isFree: false, 
    contextWindow: '128k', 
    badge: 'Cost-Effective Fast Dispatch' 
  },

  // ─── 🚀 DEEPSEEK DIRECT API ─────────────────────────────────────
  { 
    id: 'deepseek/deepseek-reasoner', 
    name: 'DeepSeek-R1 (Direct API)', 
    provider: 'DeepSeek', 
    isFree: false, 
    contextWindow: '64k', 
    badge: 'Official DeepSeek-R1 API' 
  },
  { 
    id: 'deepseek/deepseek-chat', 
    name: 'DeepSeek-V3 (Direct API)', 
    provider: 'DeepSeek', 
    isFree: false, 
    contextWindow: '64k', 
    badge: 'Official DeepSeek-V3 API' 
  },
];

export const DEFAULT_AGENT_MATRIX: AgentLlmConfig[] = [
  {
    agentName: 'CONTEXT_INGESTOR',
    roleTitle: 'Brand & Script Policy Ingestor',
    stage: 'BRAND_SETUP',
    stageStep: 0,
    provider: 'Google',
    modelId: 'google/gemini-2.0-flash',
    modelDisplayName: 'Gemini 2.0 Flash (Next-Gen)',
    temperature: 0.2,
    reasoningEffort: 'medium',
    specialtyTag: 'Long-context brand guideline & script policy analysis'
  },
  {
    agentName: 'IDENTITY_AUDITOR',
    roleTitle: 'Palette & Boundary Enforcer',
    stage: 'BRAND_SETUP',
    stageStep: 0,
    provider: 'Groq',
    modelId: 'groq/llama-3.1-8b-instant',
    modelDisplayName: 'Llama 3.1 8B Instant (Groq)',
    temperature: 0.0,
    reasoningEffort: 'low',
    specialtyTag: 'Deterministic 1000 tok/s regex & hex color auditing'
  },
  {
    agentName: 'SYLLABUS_ARCHITECT',
    roleTitle: 'ILO & Accreditation Matrix Extractor',
    stage: 'RECEIPT',
    stageStep: 1,
    provider: 'Anthropic',
    modelId: 'anthropic/claude-3-5-sonnet-20241022',
    modelDisplayName: 'Claude 3.5 Sonnet (Pedagogy Master)',
    temperature: 0.3,
    reasoningEffort: 'high',
    specialtyTag: 'Accreditation syllabus & matrix deconstruction'
  },
  {
    agentName: 'CONSTRAINT_VALIDATOR',
    roleTitle: 'Ceiling & Lab Specialist',
    stage: 'RECEIPT',
    stageStep: 1,
    provider: 'NVIDIA',
    modelId: 'nvidia/deepseek-ai/deepseek-r1',
    modelDisplayName: 'DeepSeek-R1 Full 671B (NVIDIA NIM)',
    temperature: 0.1,
    reasoningEffort: 'high',
    specialtyTag: 'Hardware, formula & wet-lab constraint validation'
  },
  {
    agentName: 'CURRICULUM_DECONSTRUCTOR',
    roleTitle: 'Topic Deconstructor',
    stage: 'DIGEST',
    stageStep: 2,
    provider: 'Anthropic',
    modelId: 'anthropic/claude-3-7-sonnet',
    modelDisplayName: 'Claude 3.7 Sonnet (Hybrid Reasoning)',
    temperature: 0.4,
    reasoningEffort: 'medium',
    specialtyTag: '16-Slide cognitive ascent sequencing'
  },
  {
    agentName: 'BLOOM_AUDITOR',
    roleTitle: 'Taxonomy & Matrix Auditor',
    stage: 'DIGEST',
    stageStep: 2,
    provider: 'Groq',
    modelId: 'groq/deepseek-r1-distill-llama-70b',
    modelDisplayName: 'DeepSeek-R1 Distill Llama 70B (Groq)',
    temperature: 0.1,
    reasoningEffort: 'high',
    specialtyTag: 'Bloom cognitive taxonomy verification on Groq LPU'
  },
  {
    agentName: 'KNOWLEDGE_SYNTHESIZER',
    roleTitle: 'Bilingual Deck Author',
    stage: 'BUNDLE',
    stageStep: 3,
    provider: 'Anthropic',
    modelId: 'anthropic/claude-3-5-sonnet-20241022',
    modelDisplayName: 'Claude 3.5 Sonnet (Pedagogy Master)',
    temperature: 0.5,
    reasoningEffort: 'high',
    specialtyTag: 'Bilingual deck synthesis & pedagogical prose'
  },
  {
    agentName: 'CITATION_CHECKER',
    roleTitle: 'Specialist Council Reviewer',
    stage: 'BUNDLE',
    stageStep: 3,
    provider: 'OpenAI',
    modelId: 'openai/o3-mini',
    modelDisplayName: 'OpenAI o3-mini (High-Speed Reasoning)',
    temperature: 0.1,
    reasoningEffort: 'medium',
    specialtyTag: 'Specialist cross-checking & boundary inspection'
  },
  {
    agentName: 'ASSET_GENERATOR',
    roleTitle: 'Visual Evidence Resolver',
    stage: 'ARTIFACTS',
    stageStep: 4,
    provider: 'OpenAI',
    modelId: 'openai/gpt-4o',
    modelDisplayName: 'GPT-4o Multimodal Omni',
    temperature: 0.2,
    reasoningEffort: 'medium',
    specialtyTag: 'Diagram overlays & reserved image reconciliation'
  },
  {
    agentName: 'OBSIDIAN_VAULT_SYNCER',
    roleTitle: 'PARA Vault Syncer',
    stage: 'ARTIFACTS',
    stageStep: 4,
    provider: 'Groq',
    modelId: 'groq/llama-3.3-70b-versatile',
    modelDisplayName: 'Llama 3.3 70B Versatile (Groq)',
    temperature: 0.0,
    reasoningEffort: 'low',
    specialtyTag: 'Obsidian markdown frontmatter formatting & sync'
  }
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orgId?: string;
}

export function AgentLlmMatrixModal({ isOpen, onClose, orgId }: Props) {
  const [configs, setConfigs] = useState<AgentLlmConfig[]>(DEFAULT_AGENT_MATRIX);
  const [selectedAgentName, setSelectedAgentName] = useState<string>('KNOWLEDGE_SYNTHESIZER');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [showOnlyFree, setShowOnlyFree] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // LM Studio Dynamic Connection State
  const [localLmStudioUrl, setLocalLmStudioUrl] = useState('http://localhost:1234/v1');
  const [lmStudioStatus, setLmStudioStatus] = useState<'idle' | 'checking' | 'connected' | 'offline'>('idle');
  const [detectedLmModel, setDetectedLmModel] = useState<string>('');

  const [groqApiKey, setGroqApiKey] = useState('');
  const [nvidiaApiKey, setNvidiaApiKey] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = `cds_agent_llm_matrix_${orgId || 'default'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setConfigs(parsed);
          }
        } catch (e) {
          console.error(e);
        }
      }
      setLocalLmStudioUrl(localStorage.getItem('cds_local_endpoint_url') || 'http://localhost:1234/v1');
      setGroqApiKey(localStorage.getItem('cds_groq_api_key') || '');
      setNvidiaApiKey(localStorage.getItem('cds_nvidia_api_key') || '');
    }
  }, [orgId, isOpen]);

  // Ping LM Studio server via server proxy and auto-detect loaded model
  const checkLmStudioConnection = async (endpoint: string) => {
    setLmStudioStatus('checking');
    try {
      const res = await fetch('/api/llm/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointUrl: endpoint })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          const firstModel = data.activeModel || data?.models?.[0] || 'Active Model';
          setDetectedLmModel(firstModel);
          setLmStudioStatus('connected');
        } else {
          setLmStudioStatus('offline');
        }
      } else {
        setLmStudioStatus('offline');
      }
    } catch {
      setLmStudioStatus('offline');
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkLmStudioConnection(localLmStudioUrl);
    }
  }, [isOpen, localLmStudioUrl]);

  if (!isOpen) return null;

  const activeConfig = (configs && configs.find(c => c.agentName === selectedAgentName)) || (configs && configs[0]) || DEFAULT_AGENT_MATRIX[0];

  const handleModelChange = (agentName: string, newModelId: string) => {
    const model = COMPREHENSIVE_MODEL_CATALOG.find(m => m.id === newModelId);
    if (!model) return;

    setConfigs(prev => prev.map(c => {
      if (c.agentName === agentName) {
        return {
          ...c,
          modelId: model.id,
          modelDisplayName: model.name,
          provider: model.provider
        };
      }
      return c;
    }));
  };

  const handleTemperatureChange = (agentName: string, temp: number) => {
    setConfigs(prev => prev.map(c => c.agentName === agentName ? { ...c, temperature: temp } : c));
  };

  const handleReasoningChange = (agentName: string, effort: 'low' | 'medium' | 'high') => {
    setConfigs(prev => prev.map(c => c.agentName === agentName ? { ...c, reasoningEffort: effort } : c));
  };

  // 1-Click Stack Presets
  const applyPresetStack = (type: 'FREE_TIER' | 'LOCAL_LM_STUDIO' | 'MAX_QUALITY') => {
    if (type === 'FREE_TIER') {
      // 100% Free: Groq LPU + NVIDIA NIM + Gemini 2.0 Flash Free
      setConfigs(prev => prev.map(c => {
        if (c.agentName === 'CONSTRAINT_VALIDATOR' || c.agentName === 'BLOOM_AUDITOR') {
          return {
            ...c,
            modelId: 'nvidia/deepseek-ai/deepseek-r1',
            modelDisplayName: 'DeepSeek-R1 Full 671B (NVIDIA NIM)',
            provider: 'NVIDIA' as ModelProvider
          };
        }
        if (c.agentName === 'KNOWLEDGE_SYNTHESIZER' || c.agentName === 'CURRICULUM_DECONSTRUCTOR') {
          return {
            ...c,
            modelId: 'groq/llama-3.3-70b-versatile',
            modelDisplayName: 'Llama 3.3 70B Versatile (Groq)',
            provider: 'Groq' as ModelProvider
          };
        }
        if (c.agentName === 'CONTEXT_INGESTOR' || c.agentName === 'SYLLABUS_ARCHITECT') {
          return {
            ...c,
            modelId: 'google/gemini-2.0-flash',
            modelDisplayName: 'Gemini 2.0 Flash (Next-Gen)',
            provider: 'Google' as ModelProvider
          };
        }
        return {
          ...c,
          modelId: 'groq/llama-3.1-8b-instant',
          modelDisplayName: 'Llama 3.1 8B Instant (Groq)',
          provider: 'Groq' as ModelProvider
        };
      }));
    } else if (type === 'LOCAL_LM_STUDIO') {
      // Route all 10 agents to whatever model the user has loaded in LM Studio!
      setConfigs(prev => prev.map(c => ({
        ...c,
        modelId: 'local/lm-studio/active-model',
        modelDisplayName: detectedLmModel ? `LM Studio: ${detectedLmModel}` : 'LM Studio (Active Loaded Model)',
        provider: 'LM Studio (Local)' as ModelProvider
      })));
    } else if (type === 'MAX_QUALITY') {
      setConfigs(DEFAULT_AGENT_MATRIX);
    }
  };

  const handleSaveMatrix = () => {
    if (typeof window !== 'undefined') {
      const key = `cds_agent_llm_matrix_${orgId || 'default'}`;
      localStorage.setItem(key, JSON.stringify(configs));
      localStorage.setItem('cds_agent_llm_matrix_default', JSON.stringify(configs));
      localStorage.setItem('cds_agent_llm_matrix', JSON.stringify(configs));
      localStorage.setItem('cds_local_endpoint_url', localLmStudioUrl);
      localStorage.setItem('cds_groq_api_key', groqApiKey);
      localStorage.setItem('cds_nvidia_api_key', nvidiaApiKey);
      window.dispatchEvent(new Event('cds_storage_updated'));
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const filteredCatalog = COMPREHENSIVE_MODEL_CATALOG.filter(m => {
    if (showOnlyFree && !m.isFree) return false;
    if (providerFilter !== 'ALL' && m.provider !== providerFilter) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/15 rounded-3xl max-w-5xl w-full p-5 sm:p-7 space-y-5 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-gold-400/10 border border-amber-500/30 dark:border-gold-400/30 flex items-center justify-center text-amber-700 dark:text-gold-400 shadow-sm">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-display font-extrabold text-slate-900 dark:text-white">
                  Multi-Agent LLM Model Matrix
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  LM Studio + Cloud SOTA
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">
                Connect directly to <strong>LM Studio</strong> (change models dynamically inside LM Studio) or use <strong>NVIDIA NIM (Free)</strong>, <strong>Groq LPU (Free)</strong>, <strong>Claude 3.7</strong>, &amp; <strong>Gemini 2.0</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1-Click Stack Presets Banner */}
        <div className="p-3 bg-slate-50 dark:bg-black/30 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-gold-400" />
            <span className="text-xs font-display font-bold text-slate-800 dark:text-white">
              1-Click Model Stacks:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* LM STUDIO 1-CLICK STACK */}
            <button
              onClick={() => applyPresetStack('LOCAL_LM_STUDIO')}
              className="px-3.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40 text-xs font-display font-bold hover:bg-sky-100 dark:hover:bg-sky-900/60 transition flex items-center gap-1.5 shadow-sm"
            >
              <Laptop className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>💻 Route All to LM Studio (`localhost:1234`)</span>
            </button>

            <button
              onClick={() => applyPresetStack('FREE_TIER')}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-xs font-display font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>🆓 100% Free Cloud Stack (NVIDIA NIM + Groq)</span>
            </button>

            <button
              onClick={() => applyPresetStack('MAX_QUALITY')}
              className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-gold-400/10 text-amber-800 dark:text-gold-300 border border-amber-300 dark:border-gold-400/30 text-xs font-display font-bold hover:bg-amber-100 dark:hover:bg-gold-400/20 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-gold-400" />
              <span>⚡ Max Frontier Quality (Claude 3.7 + DeepSeek-R1)</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto pr-1 flex-1">
          {/* Left Column: 10 Swarm Agents (5 Cols) */}
          <div className="md:col-span-5 space-y-2">
            <p className="text-xs font-display font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider px-1">
              Select Agent to Assign
            </p>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {configs.map((c) => {
                const isSelected = c.agentName === selectedAgentName;
                const matchedModel = COMPREHENSIVE_MODEL_CATALOG.find(m => m.id === c.modelId);

                return (
                  <button
                    key={c.agentName}
                    onClick={() => setSelectedAgentName(c.agentName)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 dark:bg-gold-400/10 border-amber-500 dark:border-gold-400 shadow-sm'
                        : 'bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                        {c.agentName}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/70">
                        Step {c.stageStep}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-white/50 truncate mt-0.5">
                      {c.roleTitle}
                    </p>
                    <div className="mt-2 pt-1.5 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-[10px]">
                      <span className="text-amber-700 dark:text-gold-400 font-semibold font-mono truncate max-w-[200px]">
                        ⚡ {c.modelDisplayName}
                      </span>
                      {matchedModel?.provider === 'LM Studio (Local)' ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded">
                          LM STUDIO
                        </span>
                      ) : matchedModel?.isFree ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded">
                          FREE
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Agent Model Selector & LM Studio Live Status */}
          <div className="md:col-span-7 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 space-y-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-extrabold text-amber-700 dark:text-gold-400">
                    {activeConfig.agentName}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/70 font-display">
                    {activeConfig.stage} (Step {activeConfig.stageStep})
                  </span>
                </div>
                <h3 className="text-base font-display font-bold text-slate-900 dark:text-white mt-1">
                  {activeConfig.roleTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">
                  {activeConfig.specialtyTag}
                </p>
              </div>

              {/* LM Studio Direct Connect Highlight Card */}
              <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/30 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span className="text-xs font-display font-bold text-slate-900 dark:text-white">
                      LM Studio Local Server Status:
                    </span>
                  </div>
                  {lmStudioStatus === 'checking' ? (
                    <span className="text-[10px] font-mono text-slate-500 animate-pulse">Pinging localhost:1234...</span>
                  ) : lmStudioStatus === 'connected' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected ({detectedLmModel || 'Active'})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-md">
                      <AlertCircle className="w-3 h-3" />
                      Server Offline
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={localLmStudioUrl}
                    onChange={(e) => setLocalLmStudioUrl(e.target.value)}
                    placeholder="http://localhost:1234/v1"
                    className="flex-1 bg-white dark:bg-black/50 border border-sky-200 dark:border-white/10 rounded-lg px-2.5 py-1 font-mono text-[11px] text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => checkLmStudioConnection(localLmStudioUrl)}
                    className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-display font-bold transition flex items-center gap-1 shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Detect
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModelChange(activeConfig.agentName, 'local/lm-studio/active-model')}
                    className="px-3 py-1 bg-white dark:bg-white/10 hover:bg-sky-50 dark:hover:bg-white/20 text-sky-700 dark:text-white rounded-lg text-[11px] font-display font-bold border border-sky-300 dark:border-white/10 transition shrink-0"
                  >
                    Assign LM Studio
                  </button>
                </div>
              </div>

              {/* Provider Filter Tabs */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-display font-bold text-slate-700 dark:text-white/80">
                    Filter by Provider:
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-emerald-600 dark:text-emerald-400 font-display font-bold text-[11px]">
                    <input
                      type="checkbox"
                      checked={showOnlyFree}
                      onChange={(e) => setShowOnlyFree(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span>Show Only Free Tiers</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {['ALL', 'LM Studio (Local)', 'NVIDIA', 'Groq', 'Google', 'Anthropic', 'OpenAI', 'DeepSeek'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProviderFilter(p)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-display font-bold transition ${
                        providerFilter === p
                          ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-sm'
                          : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Choice Dropdown */}
              <div>
                <label className="block text-xs font-display font-bold text-slate-700 dark:text-white/80 mb-1.5">
                  Assigned LLM Model:
                </label>
                <select
                  value={activeConfig.modelId}
                  onChange={(e) => handleModelChange(activeConfig.agentName, e.target.value)}
                  className="w-full bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                >
                  {filteredCatalog.map((m) => (
                    <option key={m.id} value={m.id} className="bg-white dark:bg-[#001530] text-slate-900 dark:text-white">
                      [{m.provider}] {m.name} — ({m.badge})
                    </option>
                  ))}
                </select>
              </div>

              {/* Temperature & Reasoning Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="flex items-center justify-between text-xs font-display font-bold mb-1">
                    <span className="text-slate-700 dark:text-white/80">Temperature:</span>
                    <span className="font-mono text-amber-700 dark:text-gold-400">{activeConfig.temperature.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={activeConfig.temperature}
                    onChange={(e) => handleTemperatureChange(activeConfig.agentName, parseFloat(e.target.value))}
                    className="w-full accent-amber-500 dark:accent-gold-400 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 dark:text-white/40 block">0.0 (Strict) ↔ 1.0 (Creative)</span>
                </div>

                <div>
                  <label className="block text-xs font-display font-bold text-slate-700 dark:text-white/80 mb-1">
                    Reasoning Effort:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['low', 'medium', 'high'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handleReasoningChange(activeConfig.agentName, lvl)}
                        className={`py-1.5 rounded-lg text-[11px] font-display font-bold uppercase transition-all ${
                          activeConfig.reasoningEffort === lvl
                            ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-sm'
                            : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
          <button
            onClick={() => setConfigs(DEFAULT_AGENT_MATRIX)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-white/60 text-xs font-display font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-display font-semibold text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMatrix}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  <span>Apply LLM Assignments</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
