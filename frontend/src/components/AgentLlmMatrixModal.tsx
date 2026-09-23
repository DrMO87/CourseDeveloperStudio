'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle,
  ArrowRight,
  Search,
  Globe2,
  Maximize2,
  Minimize2,
  Filter,
  CheckCheck
} from 'lucide-react';
import { PipelineStage } from '@/lib/types';
import { LlmProcessLoadingMeter } from './LlmProcessLoadingMeter';
import { SOTA_2026_MODELS, DiscoveredModel } from '@/lib/llm-catalog';

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
  discoveredLive?: boolean;
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

export const COMPREHENSIVE_MODEL_CATALOG: ModelOption[] = SOTA_2026_MODELS as ModelOption[];

export const DEFAULT_AGENT_MATRIX: AgentLlmConfig[] = [
  {
    agentName: 'CONTEXT_INGESTOR',
    roleTitle: 'Brand & Script Policy Ingestor',
    stage: 'BRAND_SETUP',
    stageStep: 0,
    provider: 'Google',
    modelId: 'google/gemini-3.8-flash',
    modelDisplayName: 'Gemini 3.8 Flash (Latest 2026 Frontier)',
    temperature: 0.2,
    reasoningEffort: 'medium',
    specialtyTag: 'Long-context brand guideline & script policy analysis (1M token window)'
  },
  {
    agentName: 'IDENTITY_AUDITOR',
    roleTitle: 'Palette & Boundary Enforcer',
    stage: 'BRAND_SETUP',
    stageStep: 0,
    provider: 'Groq',
    modelId: 'groq/openai/gpt-oss-20b',
    modelDisplayName: 'OpenAI GPT-OSS 20B (Groq LPU)',
    temperature: 0.0,
    reasoningEffort: 'low',
    specialtyTag: 'Deterministic 500+ tok/s regex, hex color & policy boundary auditing'
  },
  {
    agentName: 'SYLLABUS_ARCHITECT',
    roleTitle: 'ILO & Accreditation Matrix Extractor',
    stage: 'RECEIPT',
    stageStep: 1,
    provider: 'Anthropic',
    modelId: 'anthropic/claude-sonnet-5',
    modelDisplayName: 'Claude Sonnet 5 (Adaptive Thinking)',
    temperature: 0.3,
    reasoningEffort: 'high',
    specialtyTag: 'Accreditation syllabus & matrix deconstruction with 1M context'
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
    specialtyTag: 'Hardware, formula & wet-lab constraint validation on uncompressed 671B'
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
    specialtyTag: '16-Slide cognitive ascent sequencing & dynamic chain-of-thought'
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
    specialtyTag: 'Bloom cognitive taxonomy verification on Groq LPU (300 tok/s)'
  },
  {
    agentName: 'KNOWLEDGE_SYNTHESIZER',
    roleTitle: 'Bilingual Deck Author',
    stage: 'BUNDLE',
    stageStep: 3,
    provider: 'Anthropic',
    modelId: 'anthropic/claude-fable-5-1',
    modelDisplayName: 'Claude Fable 5.1 (Anthropic Flagship)',
    temperature: 0.4,
    reasoningEffort: 'high',
    specialtyTag: 'High-stakes pedagogical prose & bilingual deck synthesis'
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
    specialtyTag: 'Specialist cross-checking, STEM logic & boundary inspection'
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
    specialtyTag: 'Diagram overlays, LaTeX schematics & image reconciliation'
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
    specialtyTag: 'Obsidian markdown frontmatter formatting & instant vault sync'
  }
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orgId?: string;
  onProceedToDossier?: () => void;
}

export function AgentLlmMatrixModal({ isOpen, onClose, orgId, onProceedToDossier }: Props) {
  const [configs, setConfigs] = useState<AgentLlmConfig[]>(DEFAULT_AGENT_MATRIX);
  const [catalog, setCatalog] = useState<ModelOption[]>(COMPREHENSIVE_MODEL_CATALOG);
  const [selectedAgentName, setSelectedAgentName] = useState<string>('KNOWLEDGE_SYNTHESIZER');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [showOnlyFree, setShowOnlyFree] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Internet / Live Model Discovery State
  const [updatingCatalog, setUpdatingCatalog] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);

  // Model Live Testing State
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // LM Studio Dynamic Connection State
  const [localLmStudioUrl, setLocalLmStudioUrl] = useState('http://localhost:1234/v1');
  const [lmStudioStatus, setLmStudioStatus] = useState<'idle' | 'checking' | 'connected' | 'offline'>('idle');
  const [detectedLmModel, setDetectedLmModel] = useState<string>('');

  const [groqApiKey, setGroqApiKey] = useState('');
  const [nvidiaApiKey, setNvidiaApiKey] = useState('');

  // Load saved configuration and discovered catalog
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load saved configuration and discovered catalog
      const key = `cds_agent_llm_matrix_${orgId || 'default'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sanitized: AgentLlmConfig[] = parsed
              .filter((item: any) => item && typeof item === 'object' && item.agentName)
              .map((item: any) => ({
                agentName: String(item.agentName),
                roleTitle: String(item.roleTitle || ''),
                stage: item.stage || 'BRAND_SETUP',
                stageStep: typeof item.stageStep === 'number' ? item.stageStep : 0,
                provider: (item.provider || 'Google') as ModelProvider,
                modelId: String(item.modelId || 'google/gemini-3.8-flash'),
                modelDisplayName: String(item.modelDisplayName || item.modelId || 'Frontier Model'),
                temperature: typeof item.temperature === 'number' && !isNaN(item.temperature) ? item.temperature : 0.2,
                reasoningEffort: (item.reasoningEffort || 'medium') as 'low' | 'medium' | 'high',
                specialtyTag: String(item.specialtyTag || '')
              }));
            if (sanitized.length > 0) {
              setConfigs(sanitized);
            }
          }
        } catch (e) {
          console.error('Failed to parse saved LLM matrix:', e);
        }
      }

      // Check for dynamically cached models
      const cachedCatalog = localStorage.getItem('cds_discovered_model_catalog');
      if (cachedCatalog) {
        try {
          const parsedCatalog = JSON.parse(cachedCatalog);
          if (Array.isArray(parsedCatalog) && parsedCatalog.length > 0) {
            const validParsed = parsedCatalog
              .filter((m: any) => m && typeof m === 'object' && m.id && m.name)
              .map((m: any) => ({
                id: String(m.id),
                name: String(m.name),
                provider: (m.provider || 'Groq') as ModelProvider,
                isFree: Boolean(m.isFree),
                contextWindow: String(m.contextWindow || '128k'),
                badge: String(m.badge || ''),
                endpointUrl: m.endpointUrl ? String(m.endpointUrl) : undefined,
                discoveredLive: Boolean(m.discoveredLive)
              }));
            const existingIds = new Set(validParsed.map((m: any) => m.id));
            const merged = [...validParsed, ...COMPREHENSIVE_MODEL_CATALOG.filter(c => !existingIds.has(c.id))];
            setCatalog(merged as ModelOption[]);
          }
        } catch (e) {
          console.error('Failed to parse cached model catalog:', e);
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

  // Internet & Live Probe Catalog Update Handler
  const handleUpdateModelsViaInternet = async () => {
    setUpdatingCatalog(true);
    setCatalogNotice(null);
    try {
      const res = await fetch('/api/llm/models/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: localLmStudioUrl,
          groqApiKey: groqApiKey || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.catalog)) {
        const remoteCatalog: ModelOption[] = data.catalog.map((m: any) => ({
          id: String(m.id || ''),
          name: String(m.name || m.id || 'Model'),
          provider: (m.provider || 'Groq') as ModelProvider,
          isFree: Boolean(m.isFree),
          contextWindow: String(m.contextWindow || '128k'),
          badge: String(m.badge || ''),
          endpointUrl: m.endpointUrl ? String(m.endpointUrl) : undefined,
          discoveredLive: Boolean(m.discoveredLive)
        }));

        setCatalog(prev => {
          const existingIds = new Set(remoteCatalog.map(m => m.id));
          const combined = [...remoteCatalog, ...prev.filter(p => !existingIds.has(p.id))];
          if (typeof window !== 'undefined') {
            localStorage.setItem('cds_discovered_model_catalog', JSON.stringify(combined));
          }
          return combined;
        });

        setCatalogNotice(
          `✓ Updated 2026 Model Catalog! Found ${data.count} models (${data.liveDiscoveredCount} live active from host LM Studio & Groq).`
        );
        setTimeout(() => setCatalogNotice(null), 6000);
      } else {
        setCatalogNotice(`⚠️ Model discovery notice: ${data.error || 'Using built-in 2026 frontier registry.'}`);
        setTimeout(() => setCatalogNotice(null), 5000);
      }
    } catch (err: any) {
      setCatalogNotice(`⚠️ Could not reach internet probe: ${err.message}. Current 2026 catalog active.`);
      setTimeout(() => setCatalogNotice(null), 5000);
    } finally {
      setUpdatingCatalog(false);
    }
  };

  // Safe active configuration hook (unconditional)
  const activeConfig = useMemo(() => {
    const list = Array.isArray(configs) && configs.length > 0 ? configs : DEFAULT_AGENT_MATRIX;
    const found = list.find(c => c && c.agentName === selectedAgentName);
    return found || list[0] || DEFAULT_AGENT_MATRIX[0];
  }, [configs, selectedAgentName]);

  const handleModelChange = (agentName: string, newModelId: string) => {
    const model = catalog.find(m => m && m.id === newModelId);
    if (!model) return;

    setConfigs(prev => prev.map(c => {
      if (c && c.agentName === agentName) {
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
    setConfigs(prev => prev.map(c => (c && c.agentName === agentName) ? { ...c, temperature: temp } : c));
  };

  const handleReasoningChange = (agentName: string, effort: 'low' | 'medium' | 'high') => {
    setConfigs(prev => prev.map(c => (c && c.agentName === agentName) ? { ...c, reasoningEffort: effort } : c));
  };

  // 1-Click Stack Presets
  const applyPresetStack = (type: 'FREE_TIER' | 'LOCAL_LM_STUDIO' | 'MAX_QUALITY') => {
    if (type === 'FREE_TIER') {
      setConfigs(prev => prev.map(c => {
        if (!c) return c;
        if (c.agentName === 'CONSTRAINT_VALIDATOR') {
          return {
            ...c,
            modelId: 'nvidia/deepseek-ai/deepseek-r1',
            modelDisplayName: 'DeepSeek-R1 Full 671B (NVIDIA NIM)',
            provider: 'NVIDIA' as ModelProvider
          };
        }
        if (c.agentName === 'BLOOM_AUDITOR') {
          return {
            ...c,
            modelId: 'groq/deepseek-r1-distill-llama-70b',
            modelDisplayName: 'DeepSeek-R1 Distill Llama 70B (Groq)',
            provider: 'Groq' as ModelProvider
          };
        }
        if (c.agentName === 'KNOWLEDGE_SYNTHESIZER' || c.agentName === 'CURRICULUM_DECONSTRUCTOR') {
          return {
            ...c,
            modelId: 'groq/openai/gpt-oss-120b',
            modelDisplayName: 'OpenAI GPT-OSS 120B (Groq LPU)',
            provider: 'Groq' as ModelProvider
          };
        }
        if (c.agentName === 'CONTEXT_INGESTOR') {
          return {
            ...c,
            modelId: 'google/gemini-3.8-flash',
            modelDisplayName: 'Gemini 3.8 Flash (Latest 2026 Frontier)',
            provider: 'Google' as ModelProvider
          };
        }
        if (c.agentName === 'SYLLABUS_ARCHITECT') {
          return {
            ...c,
            modelId: 'google/gemini-3.7-flash',
            modelDisplayName: 'Gemini 3.7 Flash (Agentic & Code)',
            provider: 'Google' as ModelProvider
          };
        }
        if (c.agentName === 'CITATION_CHECKER') {
          return {
            ...c,
            modelId: 'groq/deepseek-r1-distill-qwen-32b',
            modelDisplayName: 'DeepSeek-R1 Distill Qwen 32B (Groq)',
            provider: 'Groq' as ModelProvider
          };
        }
        if (c.agentName === 'ASSET_GENERATOR') {
          return {
            ...c,
            modelId: 'google/gemini-2.5-flash',
            modelDisplayName: 'Gemini 2.5 Flash (Adaptive Speed)',
            provider: 'Google' as ModelProvider
          };
        }
        return {
          ...c,
          modelId: 'groq/openai/gpt-oss-20b',
          modelDisplayName: 'OpenAI GPT-OSS 20B (Groq LPU)',
          provider: 'Groq' as ModelProvider
        };
      }));
    } else if (type === 'LOCAL_LM_STUDIO') {
      setConfigs(prev => prev.map(c => {
        if (!c) return c;
        return {
          ...c,
          modelId: 'local/lm-studio/active-model',
          modelDisplayName: detectedLmModel ? `LM Studio: ${detectedLmModel}` : 'LM Studio (Active Loaded Model)',
          provider: 'LM Studio (Local)' as ModelProvider
        };
      }));
    } else if (type === 'MAX_QUALITY') {
      setConfigs(DEFAULT_AGENT_MATRIX);
    }
  };

  const handleTestModel = async () => {
    setTestingModel(true);
    setTestResult(null);
    try {
      const active = activeConfig;
      const apiKey = active.provider === 'Groq' ? groqApiKey : active.provider === 'NVIDIA' ? nvidiaApiKey : undefined;
      
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: localLmStudioUrl,
          model: active.modelId,
          messages: [{ role: 'user', content: 'Reply with "AI Model Online" and your model name in under 10 words.' }],
          temperature: 0.1,
          max_tokens: 60,
          apiKey
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.content) {
        setTestResult({
          success: true,
          message: `Model responding: "${data.content.trim()}"`
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem('cds_llm_verified', 'true');
          localStorage.setItem('cds_verified_model', data.model || active.modelDisplayName);
          window.dispatchEvent(new Event('cds_storage_updated'));
        }
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to get response from model'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection to model failed'
      });
    } finally {
      setTestingModel(false);
    }
  };

  const handleSaveMatrix = (proceedToDossier = false) => {
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
      if (proceedToDossier && onProceedToDossier) {
        onProceedToDossier();
      }
    }, 600);
  };

  // Filter Catalog by Search Query, Provider, and Free Tier (Called unconditionally before any early returns)
  const filteredCatalog = useMemo(() => {
    if (!Array.isArray(catalog)) return [];
    return catalog.filter(m => {
      if (!m) return false;
      if (showOnlyFree && !m.isFree) return false;
      if (providerFilter !== 'ALL' && m.provider !== providerFilter) return false;
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (m.name || '').toLowerCase().includes(q);
        const matchId = (m.id || '').toLowerCase().includes(q);
        const matchBadge = (m.badge || '').toLowerCase().includes(q);
        const matchProvider = (m.provider || '').toLowerCase().includes(q);
        return matchName || matchId || matchBadge || matchProvider;
      }
      return true;
    });
  }, [catalog, showOnlyFree, providerFilter, searchQuery]);

  // Provider Pill Badge Helper
  const getProviderColor = (p: ModelProvider) => {
    switch (p) {
      case 'LM Studio (Local)':
        return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/30';
      case 'Groq':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30';
      case 'NVIDIA':
        return 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-400/30';
      case 'Google':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/30';
      case 'Anthropic':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30';
      case 'OpenAI':
        return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-400/30';
      case 'DeepSeek':
        return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-400/30';
      default:
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-400/30';
    }
  };

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      window.location.href = `/matrix?orgId=${orgId || ''}`;
    }
  }, [isOpen, orgId]);

  // Safe early exit: never render an overlay modal
  return null;
}
