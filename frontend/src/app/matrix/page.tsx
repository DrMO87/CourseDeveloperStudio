'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Bot, 
  Cpu, 
  Sparkles, 
  Check, 
  Zap, 
  Layers, 
  RefreshCw,
  Server,
  Laptop,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Search,
  Globe2,
  Maximize2,
  Sliders,
  Settings2,
  ExternalLink,
  Loader2,
  HardDrive,
  Smartphone,
  Monitor
} from 'lucide-react';
import { PipelineStage } from '@/lib/types';
import { LlmProcessLoadingMeter } from '@/components/LlmProcessLoadingMeter';
import { SOTA_2026_MODELS, DiscoveredModel } from '@/lib/llm-catalog';
import { WorkflowProgressBar } from '@/components/layout/WorkflowProgressBar';
import { fetchProjects } from '@/lib/supabase';
import { useDeviceMode, isLocalModel } from '@/lib/device-detection';
import { 
  ModelProvider, 
  ModelOption, 
  AgentLlmConfig, 
  DEFAULT_AGENT_MATRIX, 
  COMPREHENSIVE_MODEL_CATALOG 
} from '@/components/AgentLlmMatrixModal';

function MatrixContent() {
  const { isMobile, isDesktop } = useDeviceMode();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryOrgId = searchParams.get('orgId') || '';
  const queryProjectId = searchParams.get('projectId') || '';
  const queryAgent = searchParams.get('agent') || '';
  const returnTo = searchParams.get('returnTo') || '/dossier/validate';

  const [projectId, setProjectId] = useState<string>(queryProjectId);
  const [projectName, setProjectName] = useState<string>('');
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
  const [lmModelsList, setLmModelsList] = useState<{
    id: string;
    name: string;
    isLoaded: boolean;
    state: string;
    arch?: string;
    quantization?: string;
    maxContextLength?: number;
    loadedContextLength?: number;
  }[]>([]);
  const [selectedLmModelId, setSelectedLmModelId] = useState<string>('');
  const [isMountingModel, setIsMountingModel] = useState<boolean>(false);
  const [mountNotice, setMountNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [groqApiKey, setGroqApiKey] = useState('');
  const [nvidiaApiKey, setNvidiaApiKey] = useState('');

  // Load saved configuration and discovered catalog
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const activeOrg = queryOrgId || localStorage.getItem('cds_active_org_id') || 'default';
      const key = `cds_agent_llm_matrix_${activeOrg}`;
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
  }, [queryOrgId]);

  useEffect(() => {
    if (queryAgent && configs.some(c => c.agentName === queryAgent)) {
      setSelectedAgentName(queryAgent);
    }
  }, [queryAgent, configs]);

  useEffect(() => {
    async function loadProjectInfo() {
      try {
        const savedProjId = queryProjectId || (typeof window !== 'undefined' ? localStorage.getItem('cds_active_project_id') : null);
        if (savedProjId) {
          setProjectId(savedProjId);
          const projs = await fetchProjects();
          const safeProjs = Array.isArray(projs) ? projs : [];
          const target = safeProjs.find(p => p.id === savedProjId);
          if (target) {
            setProjectName(target.name);
          }
        }
      } catch (e) {
        console.error('Failed to load project info:', e);
      }
    }
    loadProjectInfo();
  }, [queryProjectId]);

  // Ping LM Studio server via server proxy and auto-detect loaded models (PC/Desktop only)
  const checkLmStudioConnection = async (endpoint: string) => {
    if (isMobile) {
      setLmStudioStatus('offline');
      setLmModelsList([]);
      return;
    }
    setLmStudioStatus('checking');
    try {
      const res = await fetch('/api/llm/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointUrl: endpoint, clientPlatform: 'desktop' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          const firstModel = data.activeModel || data?.models?.[0] || 'Active Model';
          setDetectedLmModel(firstModel);
          setLmStudioStatus('connected');

          if (Array.isArray(data.detailedModels) && data.detailedModels.length > 0) {
            setLmModelsList(data.detailedModels);
            if (!selectedLmModelId || !data.detailedModels.some((m: any) => m.id === selectedLmModelId)) {
              setSelectedLmModelId(firstModel);
            }

            // Inject discovered LM Studio models into the main catalog
            const lmStudioOptions: ModelOption[] = data.detailedModels.map((dm: any) => ({
              id: `local/lm-studio/${dm.id}`,
              name: `LM Studio: ${dm.id}`,
              provider: 'LM Studio (Local)' as ModelProvider,
              isFree: true,
              contextWindow: dm.maxContextLength ? `${Math.round(dm.maxContextLength / 1024)}k` : 'Local',
              badge: dm.isLoaded ? '🟢 LOADED IN VRAM' : '⚪ DISK · MOUNTABLE',
              endpointUrl: data.endpoint,
              discoveredLive: true
            }));

            setCatalog(prev => {
              const existingIds = new Set(lmStudioOptions.map(m => m.id));
              return [...lmStudioOptions, ...prev.filter(p => !existingIds.has(p.id))];
            });
          }
        } else {
          setLmStudioStatus('offline');
          setLmModelsList([]);
        }
      } else {
        setLmStudioStatus('offline');
        setLmModelsList([]);
      }
    } catch {
      setLmStudioStatus('offline');
      setLmModelsList([]);
    }
  };

  useEffect(() => {
    if (!isMobile) {
      checkLmStudioConnection(localLmStudioUrl);
    }
  }, [localLmStudioUrl, isMobile]);

  // Mount model into LM Studio memory via lms CLI
  const handleMountInLmStudio = async (targetId?: string) => {
    const modelToMount = targetId || selectedLmModelId || detectedLmModel;
    if (!modelToMount) return;

    setIsMountingModel(true);
    setMountNotice(null);
    try {
      const res = await fetch('/api/llm/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mount',
          endpointUrl: localLmStudioUrl,
          modelId: modelToMount
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMountNotice({ type: 'success', text: `✅ Loaded "${modelToMount}" into LM Studio memory!` });
        await checkLmStudioConnection(localLmStudioUrl);
      } else {
        setMountNotice({ type: 'error', text: data.error || 'Failed to mount model in LM Studio' });
      }
    } catch (e: any) {
      setMountNotice({ type: 'error', text: `Mount failed: ${e.message}` });
    } finally {
      setIsMountingModel(false);
    }
  };

  // Mount model into Course Developer Studio program (All Agents)
  const handleMountInProgramAll = (targetId?: string) => {
    const modelToMount = targetId || selectedLmModelId || detectedLmModel || 'active-model';
    const modelFullId = modelToMount.startsWith('local/lm-studio/') ? modelToMount : `local/lm-studio/${modelToMount}`;
    const cleanName = modelToMount.replace(/^local\/lm-studio\//, '');

    setConfigs(prev => prev.map(c => ({
      ...c,
      modelId: modelFullId,
      modelDisplayName: `LM Studio: ${cleanName}`,
      provider: 'LM Studio (Local)' as ModelProvider
    })));

    setMountNotice({
      type: 'success',
      text: `🚀 Mounted "${cleanName}" across ALL agents in program!`
    });
  };

  // Mount model for the currently selected agent
  const handleMountForSelectedAgent = (targetId?: string) => {
    const modelToMount = targetId || selectedLmModelId || detectedLmModel || 'active-model';
    const modelFullId = modelToMount.startsWith('local/lm-studio/') ? modelToMount : `local/lm-studio/${modelToMount}`;
    const cleanName = modelToMount.replace(/^local\/lm-studio\//, '');

    handleModelChange(activeConfig.agentName, modelFullId);
    setMountNotice({
      type: 'success',
      text: `🎯 Mounted "${cleanName}" for [${activeConfig.agentName}]`
    });
  };

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

        const existingIds = new Set(remoteCatalog.map(m => m.id));
        const combined = [...remoteCatalog, ...COMPREHENSIVE_MODEL_CATALOG.filter(c => !existingIds.has(c.id))];
        setCatalog(combined);

        if (typeof window !== 'undefined') {
          localStorage.setItem('cds_discovered_model_catalog', JSON.stringify(combined));
        }

        setCatalogNotice(
          `Discovered ${data.totalFound || remoteCatalog.length} models (${data.lmStudioConnected ? 'LM Studio connected' : 'Local server offline'}). Catalog updated!`
        );
      } else {
        setCatalogNotice('Could not connect to model discovery endpoint. Using built-in 2026 catalog.');
      }
    } catch (err: any) {
      setCatalogNotice(`Update error: ${err.message || 'Check network'}`);
    } finally {
      setUpdatingCatalog(false);
    }
  };

  const handleModelChange = (agentName: string, newModelId: string) => {
    const selectedModel = catalog.find(m => m.id === newModelId);
    if (!selectedModel) return;

    setConfigs(prev => prev.map(c => {
      if (c.agentName !== agentName) return c;
      return {
        ...c,
        modelId: selectedModel.id,
        modelDisplayName: selectedModel.name,
        provider: selectedModel.provider
      };
    }));
    setTestResult(null);
  };

  const handleTemperatureChange = (agentName: string, temp: number) => {
    setConfigs(prev => prev.map(c => c.agentName === agentName ? { ...c, temperature: temp } : c));
  };

  const handleReasoningChange = (agentName: string, effort: 'low' | 'medium' | 'high') => {
    setConfigs(prev => prev.map(c => c.agentName === agentName ? { ...c, reasoningEffort: effort } : c));
  };

  const activeConfig = useMemo(() => {
    return configs.find(c => c.agentName === selectedAgentName) || configs[0] || DEFAULT_AGENT_MATRIX[0];
  }, [configs, selectedAgentName]);

  const handleTestModel = async () => {
    setTestingModel(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeConfig.modelId,
          messages: [
            {
              role: 'system',
              content: `You are the ${activeConfig.agentName} agent (${activeConfig.roleTitle}) for Horus University Course Developer Studio. Respond in one concise sentence verifying your operational status.`
            },
            {
              role: 'user',
              content: 'Ping test. Confirm agent readiness and model identity.'
            }
          ],
          temperature: activeConfig.temperature
        })
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setTestResult({
          success: true,
          message: `200 OK (${data.provider || activeConfig.provider}): "${data.text.slice(0, 140)}..."`
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem('cds_llm_verified', 'true');
          localStorage.setItem('cds_verified_model', activeConfig.modelDisplayName);
          window.dispatchEvent(new Event('cds_storage_updated'));
        }
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Model response failed. Verify API keys or local LM Studio host.'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Network ping failed: ${err.message}`
      });
    } finally {
      setTestingModel(false);
    }
  };

  const applyPresetStack = (preset: 'FREE_TIER' | 'MAX_QUALITY' | 'LOCAL_LM_STUDIO') => {
    setConfigs(prev => prev.map(c => {
      if (preset === 'LOCAL_LM_STUDIO') {
        return {
          ...c,
          provider: 'LM Studio (Local)',
          modelId: 'local/lm-studio/active-model',
          modelDisplayName: detectedLmModel ? `LM Studio (${detectedLmModel})` : 'LM Studio (Active Model)'
        };
      }
      if (preset === 'FREE_TIER') {
        if (c.agentName === 'CURRICULUM_DECONSTRUCTOR' || c.agentName === 'BLOOM_AUDITOR') {
          return {
            ...c,
            provider: 'Groq',
            modelId: 'groq/deepseek-r1-distill-llama-70b',
            modelDisplayName: 'DeepSeek-R1 Distill Llama 70B (Groq Free)'
          };
        }
        if (c.agentName === 'KNOWLEDGE_SYNTHESIZER' || c.agentName === 'SYLLABUS_ARCHITECT') {
          return {
            ...c,
            provider: 'NVIDIA',
            modelId: 'nvidia/deepseek-ai/deepseek-r1',
            modelDisplayName: 'DeepSeek-R1 Full 671B (NVIDIA Free)'
          };
        }
        return {
          ...c,
          provider: 'Google',
          modelId: 'google/gemini-3.8-flash',
          modelDisplayName: 'Gemini 3.8 Flash (Free)'
        };
      }
      if (preset === 'MAX_QUALITY') {
        if (c.agentName === 'KNOWLEDGE_SYNTHESIZER') {
          return {
            ...c,
            provider: 'Anthropic',
            modelId: 'anthropic/claude-fable-5-1',
            modelDisplayName: 'Claude Fable 5.1 (Anthropic Flagship)'
          };
        }
        if (c.agentName === 'CURRICULUM_DECONSTRUCTOR' || c.agentName === 'SYLLABUS_ARCHITECT') {
          return {
            ...c,
            provider: 'Anthropic',
            modelId: 'anthropic/claude-sonnet-5',
            modelDisplayName: 'Claude Sonnet 5 (Adaptive Thinking)'
          };
        }
        return {
          ...c,
          provider: 'OpenAI',
          modelId: 'openai/o3-mini',
          modelDisplayName: 'OpenAI o3-mini (High-Speed Reasoning)'
        };
      }
      return c;
    }));
    setTestResult(null);
  };

  const handleSaveMatrix = (proceedToNext = false) => {
    if (typeof window !== 'undefined') {
      const activeOrg = queryOrgId || localStorage.getItem('cds_active_org_id') || 'default';
      const key = `cds_agent_llm_matrix_${activeOrg}`;
      localStorage.setItem(key, JSON.stringify(configs));
      localStorage.setItem('cds_llm_verified', 'true');
      localStorage.setItem('cds_verified_model', activeConfig.modelDisplayName);
      localStorage.setItem('cds_local_endpoint_url', localLmStudioUrl);
      window.dispatchEvent(new Event('cds_storage_updated'));
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      if (proceedToNext) {
        const nextUrl = projectId ? `/projects?projectId=${projectId}` : '/projects';
        router.push(nextUrl);
      }
    }, 400);
  };

  const filteredCatalog = useMemo(() => {
    if (!Array.isArray(catalog)) return [];
    return catalog.filter(m => {
      if (!m) return false;
      // MOBILE GATING: Exclude all local models on mobile devices
      if (isMobile && isLocalModel(m.id, m.provider)) return false;
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
  }, [catalog, showOnlyFree, providerFilter, searchQuery, isMobile]);

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

  return (
    <div className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 space-y-6">
      
      {/* 1. Chronological Lifecycle Workflow Progress Bar */}
      <WorkflowProgressBar
        currentStep="LLM_MATRIX"
        projectId={projectId || undefined}
        projectName={projectName || undefined}
        progressPercent={33}
      />

      {/* 2. Step 2 Header & Navigation Bar */}
      <div className="bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm dark:shadow-card backdrop-blur-md flex flex-col md:flex-row md:items-center md:justify-between gap-5 transition-colors">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Cpu className="w-7 h-7 text-amber-500 dark:text-gold-400" />
              Step 2: LLM Model Matrix &amp; Swarm Engine
            </h1>
            <span className="text-[10px] uppercase font-display font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              SOTA 2026 Frontier
            </span>
            <span
              className={`text-[10px] font-display font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shadow-xs ${
                isMobile
                  ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                  : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
              }`}
            >
              {isMobile ? (
                <>
                  <Smartphone className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span>Mobile: Cloud Models Only</span>
                </>
              ) : (
                <>
                  <Monitor className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>PC Mode: Local &amp; Cloud</span>
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
            {isMobile
              ? 'Mobile PWA Mode: Swarm agents execute exclusively via high-speed Cloud models (Groq LPU, Google Gemini, OpenAI, Claude, DeepSeek).'
              : 'Assign frontier AI models and local LM Studio instances to each specialist swarm agent before running the Studio Swarm synthesis pipeline.'}
          </p>
        </div>

        {/* Step Navigation CTAs */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/organizations"
            className="px-3.5 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white font-display font-bold rounded-xl text-xs transition"
          >
            &larr; Step 1: Institutions
          </Link>
          <button
            type="button"
            onClick={() => handleSaveMatrix(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <span>Proceed to Step 3: Curriculum Projects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. 1-Click Preset Stacks & Quick Actions Ribbon */}
      <div className="bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!isMobile ? (
            <button
              onClick={() => applyPresetStack('LOCAL_LM_STUDIO')}
              className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40 text-xs font-display font-bold hover:bg-sky-100 dark:hover:bg-sky-900/60 transition flex items-center gap-1.5 shadow-sm"
              title="Route all 10 agents to your locally running LM Studio or Ollama server"
            >
              <Laptop className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Route All to LM Studio</span>
            </button>
          ) : (
            <div
              className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 text-xs font-display font-bold flex items-center gap-1.5"
              title="Local hardware servers are disabled on mobile devices"
            >
              <Smartphone className="w-3.5 h-3.5 text-purple-500" />
              <span>Cloud Only (Mobile Mode)</span>
            </div>
          )}

          <button
            onClick={() => applyPresetStack('FREE_TIER')}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-xs font-display font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center gap-1.5"
            title="Groq LPU (GPT-OSS 120B) + NVIDIA NIM (DeepSeek-R1 671B) + Google Gemini 3.8 Flash Free"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>100% Free Stack</span>
          </button>

          <button
            onClick={() => applyPresetStack('MAX_QUALITY')}
            className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-gold-400/10 text-amber-800 dark:text-gold-300 border border-amber-300 dark:border-gold-400/30 text-xs font-display font-bold hover:bg-amber-100 dark:hover:bg-gold-400/20 transition flex items-center gap-1.5"
            title="Claude Fable 5.1 / Sonnet 5 + DeepSeek-R1 671B + Gemini 3.8 + OpenAI o3"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-gold-400" />
            <span>Max Frontier Quality</span>
          </button>

          {/* Dynamic Internet / API Discovery Button */}
          <button
            onClick={handleUpdateModelsViaInternet}
            disabled={updatingCatalog}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-display font-black shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            title="Update model list using live internet search and host server probe"
          >
            {updatingCatalog ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Models...</span>
              </>
            ) : (
              <>
                <Globe2 className="w-3.5 h-3.5" />
                <span>🌐 Update Models</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSaveMatrix(false)}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-black rounded-xl text-xs shadow-sm transition flex items-center gap-1.5"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved to Project!</span>
              </>
            ) : (
              <>
                <Bot className="w-3.5 h-3.5" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── 4. 3-COLUMN WORKBENCH: ORDERED TO KEEP MODEL WITH SWARM AGENT ───────── */}
      <div className="min-h-[640px] h-auto lg:h-[820px] bg-white dark:bg-[#001530]/90 border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm dark:shadow-xl backdrop-blur-xl flex flex-col lg:flex-row overflow-hidden">
        
        {/* ─── COLUMN 1: 10 SWARM AGENTS LIST (Left, ~260-290px) ─────────────────── */}
        <div className="w-full lg:w-64 xl:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/10 p-3 flex flex-col min-h-[320px] lg:min-h-0 bg-slate-50/50 dark:bg-black/20">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10 shrink-0">
            <span className="text-xs font-display font-extrabold uppercase tracking-wider text-slate-600 dark:text-white/60">
              10 Swarm Agents
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-gold-400 border border-amber-500/20 truncate max-w-[130px]">
              {activeConfig.agentName}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1 min-h-0 custom-scrollbar">
            {configs.map((c) => {
              const isSelected = c.agentName === selectedAgentName;
              const matchedModel = catalog.find(m => m.id === c.modelId);

              return (
                <button
                  key={c.agentName}
                  onClick={() => setSelectedAgentName(c.agentName)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between group ${
                    isSelected
                      ? 'bg-amber-500/10 dark:bg-gold-400/10 border-amber-500 dark:border-gold-400 shadow-sm ring-1 ring-amber-500/40'
                      : 'bg-white dark:bg-black/40 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[11px] font-black text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-gold-300 transition-colors">
                      {c.agentName}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 font-bold shrink-0">
                      Step {c.stageStep}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-white/60 truncate mt-0.5 font-medium">
                    {c.roleTitle}
                  </p>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] gap-1.5">
                    <span className="text-amber-700 dark:text-gold-400 font-bold font-mono truncate max-w-[140px] flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                      <span className="truncate">{c.modelDisplayName}</span>
                    </span>
                    {matchedModel?.provider === 'LM Studio (Local)' ? (
                      <span className="text-[8px] font-bold px-1.5 py-0.2 bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded shrink-0">
                        LM STUDIO
                      </span>
                    ) : matchedModel?.isFree ? (
                      <span className="text-[8px] font-bold px-1.5 py-0.2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded shrink-0">
                        FREE
                      </span>
                    ) : (
                      <span className="text-[8px] font-bold px-1.5 py-0.2 bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded shrink-0 truncate max-w-[60px]">
                        {c.provider}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[10px] text-slate-400 dark:text-white/40 font-mono">
            <button
              onClick={() => setConfigs(DEFAULT_AGENT_MATRIX)}
              className="text-slate-500 hover:text-amber-600 dark:hover:text-gold-400 transition flex items-center gap-1"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Reset Defaults</span>
            </button>
            <span>10 Agents Configured</span>
          </div>
        </div>

        {/* ─── COLUMN 2: ACTIVE AGENT MODEL & ENGINE INSPECTOR (~280-320px) ───── */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/10 p-3.5 flex flex-col overflow-y-auto space-y-3 min-h-[380px] lg:min-h-0 bg-white/60 dark:bg-black/30 custom-scrollbar">
          
          {/* Active Agent Profile Card */}
          <div className="bg-amber-50/50 dark:bg-black/40 border border-amber-500/30 dark:border-gold-400/30 rounded-2xl p-3 space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-mono font-black text-amber-700 dark:text-gold-400 truncate">
                {activeConfig.agentName}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-gold-300 font-bold border border-amber-500/20 shrink-0">
                Step {activeConfig.stageStep}
              </span>
            </div>
            <h3 className="text-xs font-display font-extrabold text-slate-900 dark:text-white truncate">
              {activeConfig.roleTitle}
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-white/70 line-clamp-2 leading-relaxed">
              {activeConfig.specialtyTag}
            </p>
            <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-xs gap-1">
              <span className="text-slate-500 dark:text-white/50 font-semibold text-[11px] shrink-0">Assigned:</span>
              <span className="font-mono font-extrabold text-[11px] text-slate-900 dark:text-white truncate" title={activeConfig.modelDisplayName}>
                {activeConfig.modelDisplayName}
              </span>
            </div>
          </div>

          {/* ─── LM Studio Local Hub (PC) vs Mobile Cloud Hub (Mobile) ─── */}
          {isMobile ? (
            <div className="bg-gradient-to-br from-purple-50/90 to-indigo-50/50 dark:from-purple-950/40 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-500/30 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-display font-extrabold text-purple-900 dark:text-purple-200">
                    Mobile Cloud Mode Active
                  </h4>
                  <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400 font-bold">
                    Cloud-Only Gating Enforced
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-white/70 leading-relaxed">
                Operating from a mobile device or tablet. Local hardware servers (<code className="font-mono text-[10px] bg-purple-100 dark:bg-purple-900/40 px-1 py-0.5 rounded">localhost:1234</code>) are bypassed. Swarm agents connect directly to high-speed Cloud frontier models.
              </p>
              <div className="pt-2 border-t border-purple-200/60 dark:border-white/10 flex flex-wrap gap-1.5 text-[10px] font-mono font-bold">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  ✓ Groq LPU (300+ t/s)
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
                  ✓ Google Gemini
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                  ✓ Anthropic Claude
                </span>
              </div>
            </div>
          ) : (
          <div className="bg-gradient-to-br from-sky-50/90 to-blue-50/50 dark:from-sky-950/40 dark:to-blue-950/20 border border-sky-200 dark:border-sky-500/30 rounded-2xl p-3 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 shrink-0">
                <Laptop className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-display font-bold text-slate-900 dark:text-white">
                  LM Studio Local Hub
                </span>
              </div>
              {lmStudioStatus === 'checking' ? (
                <span className="text-[9px] font-mono text-slate-500 animate-pulse flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Scanning...
                </span>
              ) : lmStudioStatus === 'connected' ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                  {lmModelsList.length} Models Found
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
                  <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                  Port 1234 Offline
                </span>
              )}
            </div>

            {/* Server Endpoint URL Bar */}
            <div className="flex items-center gap-1 text-xs">
              <input
                type="text"
                value={localLmStudioUrl}
                onChange={(e) => setLocalLmStudioUrl(e.target.value)}
                placeholder="http://localhost:1234/v1"
                className="flex-1 bg-white dark:bg-black/50 border border-sky-200 dark:border-white/10 rounded-lg px-2 py-1 font-mono text-[10px] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 min-w-0"
              />
              <button
                type="button"
                onClick={() => checkLmStudioConnection(localLmStudioUrl)}
                disabled={lmStudioStatus === 'checking'}
                className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-display font-bold transition flex items-center gap-1 shrink-0 disabled:opacity-50"
                title="Scan LM Studio for all downloaded & loaded models"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${lmStudioStatus === 'checking' ? 'animate-spin' : ''}`} />
                Scan
              </button>
            </div>

            {/* Models Dropdown & Mount Controls */}
            {lmStudioStatus === 'connected' && lmModelsList.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-sky-200/60 dark:border-white/10">
                <div>
                  <label className="text-[10px] font-display font-bold text-slate-700 dark:text-white/80 block mb-1">
                    Select LM Studio Model:
                  </label>
                  <select
                    value={selectedLmModelId || detectedLmModel}
                    onChange={(e) => setSelectedLmModelId(e.target.value)}
                    className="w-full bg-white dark:bg-black/60 border border-sky-300 dark:border-sky-500/40 rounded-xl px-2.5 py-1.5 text-[11px] font-mono font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    {lmModelsList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.isLoaded ? '🟢 [LOADED] ' : '⚪ [DISK] '} {m.id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Model Spec Pill */}
                {(() => {
                  const curr = lmModelsList.find(m => m.id === (selectedLmModelId || detectedLmModel));
                  if (!curr) return null;
                  return (
                    <div className="p-2 rounded-xl bg-sky-100/60 dark:bg-black/40 border border-sky-200 dark:border-white/10 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono text-slate-600 dark:text-white/60">Status:</span>
                        <span className={`font-bold font-mono px-1.5 py-0.2 rounded text-[9px] ${
                          curr.isLoaded 
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30' 
                            : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/60'
                        }`}>
                          {curr.isLoaded ? '🟢 LOADED IN VRAM' : '⚪ SAVED ON DISK'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[9px] font-mono text-slate-500 dark:text-white/50">
                        {curr.arch && <span className="bg-white/70 dark:bg-white/5 px-1 rounded">{curr.arch}</span>}
                        {curr.quantization && <span className="bg-white/70 dark:bg-white/5 px-1 rounded">{curr.quantization}</span>}
                        {curr.maxContextLength && (
                          <span className="bg-white/70 dark:bg-white/5 px-1 rounded">
                            {Math.round(curr.maxContextLength / 1024)}k ctx
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Mount Actions */}
                <div className="space-y-1.5">
                  {/* Mount into LM Studio memory if not loaded */}
                  {(() => {
                    const curr = lmModelsList.find(m => m.id === (selectedLmModelId || detectedLmModel));
                    const needsLoad = curr && !curr.isLoaded;
                    return (
                      <button
                        type="button"
                        onClick={() => handleMountInLmStudio()}
                        disabled={isMountingModel}
                        className={`w-full py-1.5 rounded-xl text-[11px] font-display font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-50 ${
                          needsLoad
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white animate-pulse'
                            : 'bg-sky-100 hover:bg-sky-200 dark:bg-white/10 dark:hover:bg-white/15 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-white/10'
                        }`}
                        title="Load model into LM Studio memory (RAM/VRAM)"
                      >
                        {isMountingModel ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                            <span>Mounting into LM Studio...</span>
                          </>
                        ) : (
                          <>
                            <HardDrive className="w-3 h-3 shrink-0" />
                            <span>{needsLoad ? '⚡ Mount / Load in LM Studio' : '🔄 Reload in LM Studio'}</span>
                          </>
                        )}
                      </button>
                    );
                  })()}

                  {/* Mount in Program (All Agents) */}
                  <button
                    type="button"
                    onClick={() => handleMountInProgramAll()}
                    className="w-full py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-xl text-[11px] font-display font-extrabold shadow-xs transition flex items-center justify-center gap-1.5"
                    title="Configure ALL agents in Course Developer Studio to use this LM Studio model"
                  >
                    <Zap className="w-3 h-3 shrink-0 text-amber-300" />
                    <span>🎯 Mount for ALL Agents in Program</span>
                  </button>

                  {/* Mount for Selected Agent */}
                  <button
                    type="button"
                    onClick={() => handleMountForSelectedAgent()}
                    className="w-full py-1 bg-white hover:bg-sky-50 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white/80 rounded-xl text-[10px] font-display font-bold border border-slate-200 dark:border-white/10 transition flex items-center justify-center gap-1.5"
                    title={`Assign only to active agent [${activeConfig.agentName}]`}
                  >
                    <Bot className="w-3 h-3 text-sky-500 shrink-0" />
                    <span className="truncate">Mount for [{activeConfig.agentName}]</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mount feedback notice */}
            {mountNotice && (
              <div className={`p-2 rounded-xl text-[10px] font-bold flex items-start justify-between gap-1 ${
                mountNotice.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30'
              }`}>
                <span>{mountNotice.text}</span>
                <button
                  type="button"
                  onClick={() => setMountNotice(null)}
                  className="text-xs font-mono opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          )}

          {/* Hyperparameters: Temperature & Reasoning Effort */}
          <div className="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-3 space-y-2.5 shadow-xs">
            <span className="text-xs font-display font-bold text-slate-700 dark:text-white/80 block">
              Agent Parameters
            </span>

            {/* Temperature Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-display font-bold mb-1">
                <span className="text-slate-600 dark:text-white/70 text-[11px]">Temperature:</span>
                <span className="font-mono text-amber-600 dark:text-gold-400 font-extrabold text-xs">
                  {(typeof activeConfig?.temperature === 'number' ? activeConfig.temperature : 0.2).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={typeof activeConfig?.temperature === 'number' ? activeConfig.temperature : 0.2}
                onChange={(e) => handleTemperatureChange(activeConfig.agentName, parseFloat(e.target.value))}
                className="w-full accent-amber-500 dark:accent-gold-400 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-white/40 font-mono">
                <span>0.0 (Strict)</span>
                <span>1.0 (Creative)</span>
              </div>
            </div>

            {/* Reasoning Effort */}
            <div>
              <label className="block text-[11px] font-display font-bold text-slate-600 dark:text-white/70 mb-1">
                Reasoning Level:
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['low', 'medium', 'high'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleReasoningChange(activeConfig.agentName, lvl)}
                    className={`py-1 rounded-lg text-[10px] font-display font-bold uppercase transition-all ${
                      activeConfig.reasoningEffort === lvl
                        ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-xs font-extrabold'
                        : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:bg-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Model Verification & Speed Meter */}
          <div className="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-3 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${testResult?.success ? 'bg-emerald-500 shadow-glow-emerald animate-pulse' : 'bg-amber-500'}`} />
                <span className="text-xs font-display font-bold text-slate-900 dark:text-white">
                  Response Benchmark
                </span>
              </div>
              {testResult?.success && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              )}
            </div>

            <p className="text-[10px] text-slate-500 dark:text-white/60 line-clamp-2">
              {testResult ? testResult.message : 'Ping model to verify responsiveness, latency & token output stream.'}
            </p>

            <button
              type="button"
              onClick={handleTestModel}
              disabled={testingModel}
              className="w-full py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-gold-300 border border-amber-500/30 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              {testingModel ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3 text-amber-500 dark:text-gold-400" />
                  <span>Test Active Model</span>
                </>
              )}
            </button>

            {testingModel && (
              <div className="mt-1">
                <LlmProcessLoadingMeter
                  inline={true}
                  isActive={testingModel}
                  processTitle="Testing Model Speed"
                  processSubtitle={`Pinging ${activeConfig?.modelDisplayName || 'Active Model'}`}
                  modelName={activeConfig?.modelDisplayName || 'Active Model'}
                  provider={activeConfig?.provider || 'Groq'}
                  activeAgent={activeConfig?.agentName || 'Agent'}
                  phases={[
                    `Connecting to ${activeConfig?.provider || 'provider'} endpoint`,
                    'Dispatching verification prompt & measuring time-to-first-token',
                    'Receiving token stream & checking model consistency',
                    'Registering latency benchmark in local environment'
                  ]}
                />
              </div>
            )}
          </div>

        </div>

        {/* ─── COLUMN 3: MODEL CATALOG BROWSER & ASSIGNMENT CENTER (Right, flex-1) ─ */}
        <div className="flex-1 min-w-0 flex flex-col p-4 min-h-[460px] lg:min-h-0 bg-slate-50/20 dark:bg-black/10">
          {/* Catalog Notification Banner */}
          {catalogNotice && (
            <div className="mb-2.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-700 dark:text-blue-300 font-display font-bold flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-150">
              <span className="flex items-center gap-1.5 truncate">
                <Globe2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate">{catalogNotice}</span>
              </span>
              <button
                onClick={() => setCatalogNotice(null)}
                className="text-blue-500 hover:text-blue-700 text-xs font-bold shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* Search & Provider Filter Controls */}
          <div className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-white/10 shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models (e.g. GPT-OSS, Claude 5, DeepSeek-R1, Gemini, LM Studio)..."
                  className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 dark:focus:border-gold-400 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Free Only Toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer text-emerald-600 dark:text-emerald-400 font-display font-bold text-xs shrink-0 select-none bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl">
                <input
                  type="checkbox"
                  checked={showOnlyFree}
                  onChange={(e) => setShowOnlyFree(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                <span>Free Tiers Only</span>
              </label>
            </div>

            {/* Provider Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'All' },
                ...(!isMobile ? [{ id: 'LM Studio (Local)', label: 'LM Studio' }] : []),
                { id: 'Groq', label: 'Groq' },
                { id: 'NVIDIA', label: 'NVIDIA' },
                { id: 'Google', label: 'Google' },
                { id: 'Anthropic', label: 'Anthropic' },
                { id: 'OpenAI', label: 'OpenAI' },
                { id: 'DeepSeek', label: 'DeepSeek' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProviderFilter(p.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-display font-bold transition-all ${
                    providerFilter === p.id
                      ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-xs font-extrabold'
                      : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <span className="text-[11px] font-mono text-slate-400 dark:text-white/40 ml-auto hidden lg:inline">
                {filteredCatalog.length} models
              </span>
            </div>
          </div>

          {/* Scrollable Model Cards Grid */}
          <div className="flex-1 overflow-y-auto py-3 pr-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-3 auto-rows-max custom-scrollbar">
            {filteredCatalog.map((m) => {
              const isAssignedToActive = activeConfig.modelId === m.id;
              const displayProvider = m.provider === 'LM Studio (Local)' ? 'LM Studio' : m.provider;

              return (
                <div
                  key={m.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between relative group ${
                    isAssignedToActive
                      ? 'bg-amber-500/10 dark:bg-gold-400/10 border-amber-500 dark:border-gold-400 shadow-sm ring-1 ring-amber-500/30'
                      : 'bg-white dark:bg-black/30 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border shrink-0 truncate max-w-[100px] ${getProviderColor(m.provider)}`}>
                        {displayProvider}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.isFree && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            FREE
                          </span>
                        )}
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/70">
                          {m.contextWindow}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4
                        className="text-xs font-display font-bold text-slate-900 dark:text-white leading-snug truncate group-hover:text-amber-600 dark:group-hover:text-gold-400 transition-colors"
                        title={m.name}
                      >
                        {m.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-white/60 line-clamp-2 mt-1 font-medium leading-normal">
                        {m.badge}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-white/5 flex items-center justify-between gap-2">
                    {isAssignedToActive ? (
                      <div className="w-full py-1.5 px-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-display font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5 shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">Assigned to Agent</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleModelChange(activeConfig.agentName, m.id)}
                        title={`Assign ${m.name} to ${activeConfig.agentName}`}
                        className="w-full py-1.5 px-3 bg-slate-100/90 dark:bg-white/10 hover:bg-amber-500 hover:text-white dark:hover:bg-gradient-gold dark:hover:text-primary-950 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl text-xs font-display font-bold transition flex items-center justify-center gap-1.5 shadow-xs group/btn"
                      >
                        <span className="truncate">Assign to Agent</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredCatalog.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 dark:text-white/40">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-display font-bold">No models match your filter criteria.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setProviderFilter('ALL');
                    setShowOnlyFree(false);
                  }}
                  className="mt-2 text-xs text-amber-600 dark:text-gold-400 underline font-bold"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

export default function MatrixPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-white/50 animate-pulse">Loading Multi-Agent Model Matrix Workbench...</div>}>
      <MatrixContent />
    </Suspense>
  );
}
