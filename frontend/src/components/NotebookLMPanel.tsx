'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Loader2,
  CheckCircle2,
  XCircle,
  FolderUp,
  Presentation,
  Headphones,
  HelpCircle,
  Download,
  BookOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Brain,
  Layers,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  ShieldX,
  Search,
  RotateCcw,
  FolderCheck,
  Zap,
  ClipboardPaste,
} from 'lucide-react';

import { syncCourseToObsidian } from '@/lib/obsidianSync';
import type { Organization, CourseProject, CourseSession } from '@/lib/types';

interface Props {
  projectName?: string;
  sessionCode?: string;
  bundlePath?: string;
  completedStages: string[];
  org?: Organization | null;
  project?: CourseProject | null;
  sessions?: CourseSession[];
  activeSession?: CourseSession | null;
}

type NlmStatus = 'idle' | 'running' | 'success' | 'error';

interface StepState {
  status: NlmStatus;
  message: string;
}

const INITIAL_STEPS: Record<string, StepState> = {
  auth: { status: 'idle', message: 'Check authentication' },
  create: { status: 'idle', message: 'Create notebook' },
  upload: { status: 'idle', message: 'Upload source files & specs' },
  slides: { status: 'idle', message: 'Generate slide deck' },
  audio: { status: 'idle', message: 'Generate audio podcast' },
  download: { status: 'idle', message: 'Download artifacts to PC' },
};

async function callNlm(action: string, params: Record<string, string> = {}): Promise<any> {
  let res: Response;
  let rawText = '';

  try {
    res = await fetch('/api/nlm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    });
    rawText = await res.text();
  } catch (err: any) {
    throw new Error(`Network/Connection to Studio backend failed: ${err.message}`);
  }

  let data: any = null;
  try {
    data = JSON.parse(rawText);
  } catch {
    if (res.status === 404) {
      throw new Error('API route /api/nlm was reloading or momentarily busy. Please click "📥 Download Artifacts" again.');
    }
    throw new Error(`Server returned error (${res.status}): ${rawText.substring(0, 120)}`);
  }

  if (!data.success) {
    throw new Error(data.error || 'Unknown NLM error');
  }
  return data;
}

export function NotebookLMPanel({ 
  projectName, 
  sessionCode, 
  bundlePath, 
  completedStages,
  org,
  project,
  sessions,
  activeSession
}: Props) {
  const storageKey = `cds_nlm_state_${project?.slug || 'default'}_${sessionCode || 's1'}`;

  const [steps, setSteps] = useState<Record<string, StepState>>({ ...INITIAL_STEPS });
  const [activeNotebookId, setActiveNotebookId] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [notebookName, setNotebookName] = useState('');
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showManualAuth, setShowManualAuth] = useState(false);
  const [manualCookieText, setManualCookieText] = useState('');
  const [isImportingCookie, setIsImportingCookie] = useState(false);

  const pipelineComplete = completedStages.length >= 5;
  const defaultNotebookName = projectName
    ? `${projectName} ${sessionCode || 's1'}`
    : '';

  // 1. Restore state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.steps) setSteps(parsed.steps);
          if (parsed.notebookId) setActiveNotebookId(parsed.notebookId);
          if (parsed.notebookName) setNotebookName(parsed.notebookName);
          if (Array.isArray(parsed.logs)) setLogs(parsed.logs);
        }
      } catch (e) {
        console.warn('Failed to restore NLM state:', e);
      }
    }
  }, [storageKey]);

  // 2. Persist state to localStorage on changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          steps,
          notebookId: activeNotebookId,
          notebookName,
          logs: logs.slice(-25)
        }));
      } catch (e) {}
    }
  }, [steps, activeNotebookId, notebookName, logs, storageKey]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('en-GB');
    setLogs((prev) => [...prev.slice(-30), `[${ts}] ${msg}`]);
  }, []);

  const setStep = useCallback((key: string, status: NlmStatus, message: string) => {
    setSteps((prev) => ({ ...prev, [key]: { status, message } }));
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // LIVE Auth Check — actually calls list_notebooks to verify session
  // ═══════════════════════════════════════════════════════════════════
  const verifyAuthLive = useCallback(async (): Promise<boolean> => {
    setIsCheckingAuth(true);
    setStep('auth', 'running', 'Testing live connection to Google NotebookLM...');
    addLog('🔍 Testing LIVE connection to Google NotebookLM (listing notebooks)...');
    try {
      const res = await callNlm('live_auth_check');
      setStep('auth', 'success', 'Authenticated & Live ✓');
      addLog('✅ Live session confirmed — Google NotebookLM is reachable.');
      setIsCheckingAuth(false);
      return true;
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('expired') || msg.includes('nlm login') || msg.includes('Authentication')) {
        setStep('auth', 'error', 'Session expired — sign in required');
        addLog('❌ Session expired. Click "🔑 Sign In with Google" to authenticate.');
      } else {
        setStep('auth', 'error', msg.substring(0, 120));
        addLog(`❌ Auth test failed: ${msg}`);
      }
      setIsCheckingAuth(false);
      return false;
    }
  }, [addLog, setStep]);

  // ═══════════════════════════════════════════════════════════════════
  // Auto-Discover & Reconnect Existing Notebook
  // ═══════════════════════════════════════════════════════════════════
  const handleDiscoverAndLinkNotebook = async () => {
    setIsDiscovering(true);
    const targetName = (notebookName.trim() || defaultNotebookName).toLowerCase();
    addLog(`🔍 Searching NotebookLM for notebook matching "${targetName}"...`);
    try {
      const listRes = await callNlm('list_notebooks', {});
      const nbList = JSON.parse(listRes.output || '[]');
      
      const match = nbList.find((n: any) => {
        const title = (n.title || '').toLowerCase();
        return (
          title === targetName ||
          (project?.name && title.includes(project.name.toLowerCase())) ||
          (sessionCode && title.includes(sessionCode.toLowerCase()))
        );
      });

      if (match) {
        setActiveNotebookId(match.id);
        if (!notebookName) setNotebookName(match.title);
        setStep('create', 'success', `Linked: "${match.title}"`);
        setStep('auth', 'success', 'Authenticated & Live ✓');
        addLog(`♻️ Reconnected to Notebook: "${match.title}" (ID: ${match.id})`);
        addLog(`👉 You can now directly click "Download Artifacts" or generate slides/podcasts!`);
      } else {
        addLog(`ℹ️ No matching notebook found among ${nbList.length} notebooks. You can create one via Step 2.`);
      }
    } catch (e: any) {
      addLog(`⚠️ Notebook search failed: ${e.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Reset Flow State
  // ═══════════════════════════════════════════════════════════════════
  const handleResetFlow = () => {
    if (confirm('Reset NotebookLM flow state for this session? This clears local checklist indicators.')) {
      setSteps({ ...INITIAL_STEPS });
      setActiveNotebookId('');
      setLogs([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
      addLog('🔄 Flow state reset to initial.');
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Launch Sign-In Window
  // ═══════════════════════════════════════════════════════════════════
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    addLog('🔑 Opening Google sign-in window (your browser tabs stay open)...');
    try {
      await callNlm('launch_login');
      addLog('🚀 Sign-in helper launched in a visible CMD window. Complete sign-in, then click "🔄 Verify Auth".');
    } catch (e: any) {
      addLog(`❌ Failed to launch sign-in window: ${e.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Fast 10-Second Cookie / cURL Session Import
  // ═══════════════════════════════════════════════════════════════════
  const handleImportCookies = async () => {
    if (!manualCookieText.trim()) {
      alert('Please paste your cURL command or Cookie string first.');
      return;
    }
    setIsImportingCookie(true);
    addLog('⚡ Importing NotebookLM credentials directly (bypassing browser automation)...');
    try {
      const res = await callNlm('import_cookies', { cookieText: manualCookieText.trim() });
      addLog(`✅ Session imported successfully: ${res.output || 'Authenticated'}`);
      setManualCookieText('');
      setShowManualAuth(false);
      await verifyAuthLive();
    } catch (e: any) {
      addLog(`❌ Session import failed: ${e.message}`);
      alert(`Import error: ${e.message}\n\nPlease ensure you copied a valid request from https://notebooklm.google.com.`);
    } finally {
      setIsImportingCookie(false);
    }
  };

  // On mount: check auth and try to reconnect
  useEffect(() => {
    verifyAuthLive().then((isOk) => {
      if (isOk) {
        handleDiscoverAndLinkNotebook();
      }
    });
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // Individual Step Handlers
  // ═══════════════════════════════════════════════════════════════════

  const handleCreateNotebookOnly = async () => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;
    const authOk = await verifyAuthLive();
    if (!authOk) { addLog('⛔ Cannot create notebook — sign in first.'); return; }

    setStep('create', 'running', `Creating notebook "${name}"...`);
    addLog(`Creating notebook: ${name}`);
    try {
      const cr = await callNlm('create_notebook', { notebookName: name });
      const createdId = cr.output?.match(/"notebook_id":\s*"([^"]+)"/)?.[1] || cr.output?.match(/"id":\s*"([^"]+)"/)?.[1] || '';
      if (createdId) setActiveNotebookId(createdId);
      setStep('create', 'success', `Notebook "${name}" ready`);
      addLog(`✅ Notebook created: ${cr.output?.substring(0, 120)}`);
    } catch (e: any) {
      if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
        setStep('create', 'success', `Notebook "${name}" ready (existing)`);
        addLog(`♻️ Notebook already exists, ready to use`);
        handleDiscoverAndLinkNotebook();
      } else {
        setStep('create', 'error', e.message);
        addLog(`❌ Create failed: ${e.message}`);
      }
    }
  };

  const handleUploadSourceFilesOnly = async () => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;

    setStep('upload', 'running', 'Syncing & uploading course source files...');
    addLog('Ensuring all course specs & session files are synced to disk...');

    if (project) {
      try {
        const syncRes = await syncCourseToObsidian(org || null, project, sessions, activeSession);
        addLog(`💾 Auto-synced course files to disk (${syncRes.syncedCount || 'all'} files).`);
      } catch (err: any) {
        addLog(`⚠️ Auto-sync warning: ${err.message}`);
      }
    }

    const pSlug = project?.slug || 'instrumental-analysis-pharmaceutical';
    const sid = sessionCode || 'Lec 01';
    const vaultRoot = process.env.NEXT_PUBLIC_VAULT_ROOT || '.';
    const projectDir = `${vaultRoot}/vaults/${pSlug}/01_Projects/${pSlug}`;

    const sourceCandidates = [
      `${projectDir}/Dossier/Course_Specification_ILOs.md`,
      `${projectDir}/Dossier/Assessment_Specification_Blueprint.md`,
      `${projectDir}/Dossier/Question_Bank_Calibrated_PHAR301.md`,
      `${projectDir}/${sid}/blueprint.md`,
      `${projectDir}/${sid}/slides-source.md`,
      `${projectDir}/${sid}/home-summary.md`,
      `${projectDir}/${sid}/SOURCES.md`,
      `${projectDir}/${sid}/decisions.md`,
      `${projectDir}/${sid}/ASSET-MAPPING.md`,
    ];

    let uploadedCount = 0;
    const uploadedSet = new Set<string>();

    for (const fp of sourceCandidates) {
      const fileName = fp.split('/').pop() || fp;
      if (uploadedSet.has(fileName)) continue;

      try {
        await callNlm('add_source_file', { 
          notebookId: activeNotebookId, 
          notebookName: name, 
          filePath: fp, 
          projectSlug: pSlug 
        });
        uploadedCount++;
        uploadedSet.add(fileName);
        addLog(`  📄 Uploaded: ${fileName}`);
      } catch (e: any) {
        addLog(`  ⚠️ Skipped ${fileName}: ${e.message?.substring(0, 80)}`);
      }
    }

    if (uploadedCount > 0) {
      setStep('upload', 'success', `${uploadedCount} source file(s) uploaded`);
    } else {
      setStep('upload', 'error', 'No files uploaded — check vault path');
    }
  };

  const getSlideInstructions = () => {
    const isEnglish = (org?.language_policy?.primary_script === 'en') || ((org?.language_policy?.primary_script || '').toLowerCase().includes('en'));
    const isArabic = (org?.language_policy?.primary_script === 'ar') && ((org?.language_policy?.target_ratio || 0) >= 0.85);

    if (isEnglish) {
      return `Create a comprehensive 16-slide university academic lecture presentation deck strictly in 100% English following Bloom's Revised Taxonomy cognitive ascent. All slide titles, pedagogical concepts, chemical/mathematical formulas, and lecturer delivery notes must be in pure English with zero untranslated fragments. Include visual evidence markers.`;
    }
    if (isArabic) {
      return `أنشئ عرضاً تقديمياً أكاديمياً متكاملاً من 16 شريحة باللغة العربية الفصحى وفق التدرج المعرفي لتصنيف بلوم المحدث. يتضمن العرض نواتج التعلم، المفاهيم الأساسية، وملاحظات إلقاء المدرب، ومعايير الجودة الأكاديمية.`;
    }
    return `Create a detailed 16-slide academic presentation deck following Bloom's Revised Taxonomy cognitive ascent. Use the organization's language policy: ${org?.language_policy?.primary_script || 'English'} with bilingual support where applicable. Include lecturer delivery notes and visual evidence markers.`;
  };

  const handleGenerateSlidesOnly = async () => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;
    setStep('slides', 'running', 'Generating slide deck...');
    addLog('🎬 Generating slide deck...');
    try {
      const sl = await callNlm('generate_slides', {
        notebookId: activeNotebookId,
        notebookName: name,
        instructions: getSlideInstructions(),
      });
      setStep('slides', 'success', 'Slide deck generated ✓');
      addLog(`✅ Slides generated: ${sl.output?.substring(0, 100)}`);
    } catch (e: any) {
      setStep('slides', 'error', e.message?.substring(0, 120));
      addLog(`❌ Slide generation failed: ${e.message}`);
    }
  };

  const handleGenerateAudioOnly = async () => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;
    setStep('audio', 'running', 'Generating audio podcast...');
    addLog('🎙️ Generating audio podcast...');
    try {
      const au = await callNlm('generate_audio', { 
        notebookId: activeNotebookId, 
        notebookName: name 
      });
      setStep('audio', 'success', 'Audio podcast generated ✓');
      addLog(`✅ Audio podcast: ${au.output?.substring(0, 100)}`);
    } catch (e: any) {
      setStep('audio', 'error', e.message?.substring(0, 120));
      addLog(`❌ Audio generation failed: ${e.message}`);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Direct On-Demand Download (No rerunning earlier steps!)
  // ═══════════════════════════════════════════════════════════════════
  const handleDownloadOnly = async () => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;
    const pSlug = project?.slug || 'instrumental-analysis-pharmaceutical';
    const sid = sessionCode || 'Lec 01';
    const vaultRoot = process.env.NEXT_PUBLIC_VAULT_ROOT || '.';
    const outputDir = `${vaultRoot}/vaults/${pSlug}/80-generation/${sid}`;

    setStep('download', 'running', 'Downloading artifacts from NotebookLM...');
    addLog(`📥 Downloading all generated artifacts to ${pSlug}/80-generation/${sid}...`);
    try {
      let resolvedId = activeNotebookId;
      if (!resolvedId) {
        // Auto-discover notebook ID if not set
        try {
          const listRes = await callNlm('list_notebooks', {});
          const nbList = JSON.parse(listRes.output || '[]');
          const match = nbList.find((n: any) => 
            n.title === name || 
            (project?.name && n.title?.includes(project.name))
          );
          if (match) {
            resolvedId = match.id;
            setActiveNotebookId(match.id);
          }
        } catch (e) {}
      }

      const dl = await callNlm('download_all', {
        notebookId: resolvedId,
        notebookName: name,
        outputDir,
        projectSlug: pSlug
      });

      setStep('download', 'success', `Saved to 80-generation/${sid} ✓`);
      addLog(`✅ Artifacts downloaded successfully!`);
      if (dl.output) addLog(`📄 Output: ${dl.output.substring(0, 150)}`);
    } catch (e: any) {
      setStep('download', 'error', e.message?.substring(0, 120));
      addLog(`⚠️ Download error: ${e.message}`);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Full 6-Step Pipeline
  // ═══════════════════════════════════════════════════════════════════

  const runFullPipeline = async () => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;
    setIsRunningAll(true);

    // Step 1: LIVE Auth check
    const authOk = await verifyAuthLive();
    if (!authOk) {
      setIsRunningAll(false);
      return;
    }

    // Step 2: Create / Reconnect notebook
    setStep('create', 'running', `Creating/Checking notebook "${name}"...`);
    addLog(`Checking notebook: ${name}`);
    let activeId = activeNotebookId;
    try {
      const listRes = await callNlm('list_notebooks', {});
      try {
        const nbList = JSON.parse(listRes.output || '[]');
        const existing = nbList.find((n: any) => n.title === name);
        if (existing) {
          activeId = existing.id;
          setActiveNotebookId(existing.id);
        }
      } catch (e) {}

      if (activeId) {
        setStep('create', 'success', `Notebook "${name}" ready (reused)`);
        addLog(`♻️ Notebook already exists, reusing ID: ${activeId}`);
      } else {
        const cr = await callNlm('create_notebook', { notebookName: name });
        activeId = cr.output?.match(/"notebook_id":\s*"([^"]+)"/)?.[1] || cr.output?.match(/"id":\s*"([^"]+)"/)?.[1] || '';
        if (activeId) setActiveNotebookId(activeId);
        setStep('create', 'success', `Notebook "${name}" ready`);
        addLog(`✅ Notebook created: ${cr.output?.substring(0, 120)}`);
      }
    } catch (e: any) {
      setStep('create', 'error', e.message);
      addLog(`❌ Create failed: ${e.message}`);
      setIsRunningAll(false);
      return;
    }

    // Step 3: Auto-sync & Upload source files
    setStep('upload', 'running', 'Uploading course specs & session files...');
    addLog('Auto-syncing & uploading curriculum source files...');

    if (project) {
      try {
        const syncRes = await syncCourseToObsidian(org || null, project, sessions, activeSession);
        addLog(`💾 Auto-synced files to disk (${syncRes.syncedCount || 'all'} files).`);
      } catch (err: any) {
        addLog(`⚠️ Auto-sync warning: ${err.message}`);
      }
    }

    const pSlug = project?.slug || 'instrumental-analysis-pharmaceutical';
    const sid = sessionCode || 'Lec 01';
    const vaultRoot = process.env.NEXT_PUBLIC_VAULT_ROOT || '.';
    const projectDir = `${vaultRoot}/vaults/${pSlug}/01_Projects/${pSlug}`;

    const sourceCandidates = [
      `${projectDir}/Dossier/Course_Specification_ILOs.md`,
      `${projectDir}/Dossier/Assessment_Specification_Blueprint.md`,
      `${projectDir}/Dossier/Question_Bank_Calibrated_PHAR301.md`,
      `${projectDir}/${sid}/blueprint.md`,
      `${projectDir}/${sid}/slides-source.md`,
      `${projectDir}/${sid}/home-summary.md`,
      `${projectDir}/${sid}/SOURCES.md`,
      `${projectDir}/${sid}/decisions.md`,
      `${projectDir}/${sid}/ASSET-MAPPING.md`,
    ];

    let uploadedCount = 0;
    const uploadedSet = new Set<string>();

    for (const fp of sourceCandidates) {
      const fileName = fp.split('/').pop() || fp;
      if (uploadedSet.has(fileName)) continue;

      try {
        const res = await callNlm('add_source_file', { 
          notebookId: activeId, 
          notebookName: name, 
          filePath: fp, 
          projectSlug: pSlug 
        });
        if (res.error) {
           addLog(`⚠️ Skipped ${fileName}: ${res.error.substring(0, 80)}`);
           continue;
        }
        uploadedCount++;
        uploadedSet.add(fileName);
        addLog(`  📄 Uploaded: ${fileName}`);
      } catch (e: any) {
        addLog(`⚠️ Skipped ${fileName}: ${e.message?.substring(0, 80)}`);
      }
    }

    if (uploadedCount > 0) {
      setStep('upload', 'success', `${uploadedCount} source file(s) uploaded`);
    } else {
      setStep('upload', 'error', 'No files uploaded — check bundle path');
      setIsRunningAll(false);
      return;
    }

    // Step 4: Generate slide deck
    setStep('slides', 'running', 'Generating 16-slide presentation deck...');
    addLog('🎬 Generating slide deck via NotebookLM...');
    try {
      const sl = await callNlm('generate_slides', {
        notebookId: activeId,
        notebookName: name,
        instructions: getSlideInstructions(),
      });
      setStep('slides', 'success', 'Slide deck generated ✓');
      addLog(`✅ Slides generated: ${sl.output?.substring(0, 100)}`);
    } catch (e: any) {
      setStep('slides', 'error', e.message?.substring(0, 120));
      addLog(`❌ Slide generation failed: ${e.message}`);
    }

    // Step 5: Generate audio podcast
    setStep('audio', 'running', 'Generating audio podcast (Deep Dive)...');
    addLog('🎙️ Generating audio podcast overview...');
    try {
      const au = await callNlm('generate_audio', { 
        notebookId: activeId, 
        notebookName: name 
      });
      setStep('audio', 'success', 'Audio podcast generated ✓');
      addLog(`✅ Audio podcast: ${au.output?.substring(0, 100)}`);
    } catch (e: any) {
      setStep('audio', 'error', e.message?.substring(0, 120));
      addLog(`❌ Audio generation failed: ${e.message}`);
    }

    // Step 6: Download all artifacts
    setStep('download', 'running', 'Downloading all artifacts to local PC...');
    addLog('📥 Downloading all generated artifacts...');
    try {
      const dl = await callNlm('download_all', {
        notebookId: activeId,
        notebookName: name,
        outputDir: `${vaultRoot}/vaults/${pSlug}/80-generation/${sid}`,
        projectSlug: pSlug
      });
      setStep('download', 'success', `All artifacts saved to 80-generation/${sid}`);
      addLog(`✅ Downloaded: ${dl.output?.substring(0, 120)}`);
    } catch (e: any) {
      setStep('download', 'error', e.message?.substring(0, 120));
      addLog(`⚠️ Download: ${e.message}`);
    }

    setIsRunningAll(false);
    addLog('🏁 NotebookLM pipeline complete!');
  };

  const completedCount = Object.values(steps).filter((s) => s.status === 'success').length;
  const totalCount = Object.keys(steps).length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  const authIsLive = steps.auth.status === 'success';
  const authFailed = steps.auth.status === 'error';

  return (
    <div className="bg-white dark:bg-[#001530]/90 border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm dark:shadow-2xl overflow-hidden transition-colors">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
            <Brain className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              Google NotebookLM Integration
              {activeNotebookId && (
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30">
                  ID: {activeNotebookId.substring(0, 8)}...
                </span>
              )}
              {authIsLive && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" /> LIVE
                </span>
              )}
              {authFailed && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30 flex items-center gap-1">
                  <ShieldX className="w-2.5 h-2.5" /> EXPIRED
                </span>
              )}
              {completedCount === totalCount && completedCount > 0 && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                  COMPLETE
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-white/50">
              Auto-generate slide decks, audio podcasts, quizzes &amp; download material directly
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isRunningAll && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
          {progressPct > 0 && progressPct < 100 && (
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-gold-400">{progressPct}%</span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400 dark:text-white/40" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/40" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-slate-200 dark:border-white/10">
          {/* Pipeline Readiness Banner */}
          {!pipelineComplete && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/30 rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-display font-bold text-amber-800 dark:text-amber-300">
                  Complete 5-Stage Swarm Pipeline First
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400/70 mt-0.5">
                  NotebookLM generation produces the best results when all quality gates have passed. You have completed {completedStages.length}/5 stages.
                </p>
              </div>
            </div>
          )}

          {/* ═══════ Auth Status Banner ═══════ */}
          {authFailed && (
            <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/40 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldX className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-display font-bold text-rose-900 dark:text-rose-200">
                      Google Session Expired — Choose Sign-In Method
                    </p>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400/80 mt-1">
                      Option 1 (Recommended): <strong>Fast Session Import</strong> (bypasses browser automation locks entirely, completes in 1 second).<br/>
                      Option 2: <strong>Edge Browser Window</strong> (opens interactive sign-in helper).
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowManualAuth(!showManualAuth)}
                    className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-display font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>⚡ Fast Session Import</span>
                  </button>
                  <button
                    onClick={handleSignIn}
                    disabled={isLoggingIn}
                    className="px-3 py-2.5 bg-white dark:bg-black/40 border border-rose-300 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-800 dark:text-rose-200 font-display font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <KeyRound className={`w-3.5 h-3.5 ${isLoggingIn ? 'animate-spin' : ''}`} />
                    <span>{isLoggingIn ? 'Launching...' : 'Edge Window'}</span>
                  </button>
                  <button
                    onClick={() => verifyAuthLive()}
                    disabled={isCheckingAuth}
                    className="px-3 py-2.5 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-white font-display font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingAuth ? 'animate-spin' : ''}`} />
                    <span>{isCheckingAuth ? 'Checking...' : 'Verify'}</span>
                  </button>
                </div>
              </div>

              {/* Fast Session Import Drawer */}
              {showManualAuth && (
                <div className="mt-3 p-3.5 bg-white dark:bg-black/60 border border-amber-300 dark:border-amber-500/40 rounded-xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-display font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        10-Second Instant Session Paste
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-white/60 mt-0.5">
                        No browser popups, no headless locks, 100% reliable:
                      </p>
                    </div>
                    <a
                      href="https://notebooklm.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      Open NotebookLM ↗
                    </a>
                  </div>

                  <div className="bg-slate-50 dark:bg-white/[0.03] p-2.5 rounded-lg text-[11px] text-slate-600 dark:text-white/70 space-y-1">
                    <p><strong>Step 1:</strong> In your normal browser, open <a href="https://notebooklm.google.com" target="_blank" className="text-sky-500 underline">notebooklm.google.com</a> where you are logged in.</p>
                    <p><strong>Step 2:</strong> Press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono text-[10px]">F12</kbd> (DevTools) &rarr; Click <strong>Network</strong> tab.</p>
                    <p><strong>Step 3:</strong> Right-click any request (e.g. <code>batchexecute</code>) &rarr; <strong>Copy</strong> &rarr; <strong>Copy as cURL</strong> (or copy the Cookie header).</p>
                    <p><strong>Step 4:</strong> Paste it below and click <strong>Authenticate Now</strong>.</p>
                  </div>

                  <textarea
                    rows={3}
                    value={manualCookieText}
                    onChange={(e) => setManualCookieText(e.target.value)}
                    placeholder="Paste copied cURL command or Cookie string here... (curl 'https://notebooklm.google.com/...' or SID=...)"
                    className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-black/50 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowManualAuth(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImportCookies}
                      disabled={isImportingCookie || !manualCookieText.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-display font-extrabold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                    >
                      {isImportingCookie ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ClipboardPaste className="w-3.5 h-3.5" />
                      )}
                      <span>{isImportingCookie ? 'Authenticating...' : 'Authenticate Now (1s)'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {authIsLive && (
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-500/30 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-display font-bold text-emerald-800 dark:text-emerald-300">
                  Google NotebookLM session is live &amp; authenticated
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDiscoverAndLinkNotebook}
                  disabled={isDiscovering}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-200 transition flex items-center gap-1 disabled:opacity-50"
                  title="Search NotebookLM for existing notebook and link it"
                >
                  <Search className={`w-3 h-3 ${isDiscovering ? 'animate-spin' : ''}`} />
                  <span>Find Notebook</span>
                </button>
                <button
                  onClick={() => verifyAuthLive()}
                  disabled={isCheckingAuth}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-200 transition flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingAuth ? 'animate-spin' : ''}`} />
                  Re-verify
                </button>
              </div>
            </div>
          )}

          {/* ═══════ Notebook Name + Action Bar ═══════ */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5">
              <BookOpen className="w-4 h-4 text-purple-500 shrink-0" />
              <input
                type="text"
                value={notebookName}
                onChange={(e) => setNotebookName(e.target.value)}
                placeholder={defaultNotebookName || 'Notebook name...'}
                className="bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 flex-1 focus:outline-none font-medium"
              />
            </div>

            {/* Direct Download Action Button */}
            <button
              onClick={handleDownloadOnly}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-display font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition whitespace-nowrap"
              title="Download generated slides, audio & artifacts directly to disk without running previous steps"
            >
              <Download className="w-3.5 h-3.5" />
              <span>📥 Download Artifacts</span>
            </button>

            {/* Run Full Pipeline */}
            <button
              onClick={runFullPipeline}
              disabled={isRunningAll}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-rose-500 hover:from-purple-700 hover:to-rose-600 text-white font-display font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isRunningAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Running Pipeline...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  🚀 Run Full Flow
                </>
              )}
            </button>

            {/* Open Web */}
            <button
              onClick={() => window.open('https://notebooklm.google.com', '_blank')}
              className="px-3.5 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-display font-bold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap border border-slate-200 dark:border-white/10"
              title="Open Google NotebookLM in a new browser window"
            >
              <ExternalLink className="w-3.5 h-3.5 text-purple-500" />
              <span>Web ↗</span>
            </button>

            {/* Reset Flow Button */}
            <button
              onClick={handleResetFlow}
              className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition"
              title="Reset flow state checklist"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress Bar */}
          {progressPct > 0 && (
            <div className="w-full h-2 bg-slate-100 dark:bg-black/40 rounded-full overflow-hidden border border-slate-200 dark:border-white/10">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-rose-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* 6-Step Checklist with Direct Step Triggers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(steps).map(([key, step]) => {
              const icons: Record<string, any> = {
                auth: Radio,
                create: Plus,
                upload: FolderUp,
                slides: Presentation,
                audio: Headphones,
                download: Download,
              };
              const Icon = icons[key] || FileText;

              return (
                <div
                  key={key}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all ${
                    step.status === 'running'
                      ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/30 animate-pulse'
                      : step.status === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30'
                      : step.status === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/30'
                      : 'bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      step.status === 'running'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : step.status === 'success'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : step.status === 'error'
                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-white/40'
                    }`}
                  >
                    {step.status === 'running' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : step.status === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : step.status === 'error' ? (
                      <XCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-[11px] font-display font-bold block truncate ${
                        step.status === 'success'
                          ? 'text-emerald-800 dark:text-emerald-300'
                          : step.status === 'error'
                          ? 'text-rose-800 dark:text-rose-300'
                          : step.status === 'running'
                          ? 'text-amber-800 dark:text-amber-300'
                          : 'text-slate-700 dark:text-white/70'
                      }`}
                    >
                      {step.message}
                    </span>
                  </div>

                  {key === 'auth' && step.status !== 'running' && (
                    <button
                      onClick={() => verifyAuthLive()}
                      disabled={isCheckingAuth}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-200 transition shrink-0 disabled:opacity-50"
                    >
                      {isCheckingAuth ? '...' : 'Verify'}
                    </button>
                  )}
                  {key === 'create' && step.status !== 'running' && (
                    <button
                      onClick={handleCreateNotebookOnly}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-200 transition shrink-0"
                    >
                      Create
                    </button>
                  )}
                  {key === 'upload' && step.status !== 'running' && (
                    <button
                      onClick={handleUploadSourceFilesOnly}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold hover:bg-sky-200 transition shrink-0"
                    >
                      Upload All
                    </button>
                  )}
                  {key === 'slides' && step.status !== 'running' && (
                    <button
                      onClick={handleGenerateSlidesOnly}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold hover:bg-amber-200 transition shrink-0"
                    >
                      Slides
                    </button>
                  )}
                  {key === 'audio' && step.status !== 'running' && (
                    <button
                      onClick={handleGenerateAudioOnly}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold hover:bg-rose-200 transition shrink-0"
                    >
                      Podcast
                    </button>
                  )}
                  {key === 'download' && step.status !== 'running' && (
                    <button
                      onClick={handleDownloadOnly}
                      className="text-[10px] px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-200 transition shrink-0 shadow-sm"
                    >
                      Download
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Local Download Target Notice */}
          <div className="p-2.5 bg-slate-50 dark:bg-black/30 rounded-xl border border-slate-200 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
            <div className="flex items-center gap-1.5 font-mono">
              <FolderCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Vault Target: <code className="text-slate-800 dark:text-gold-400">vaults/{project?.slug || 'course'}/80-generation/{sessionCode || 's1'}/</code></span>
            </div>
          </div>

          {/* Live Log Console */}
          {logs.length > 0 && (
            <div className="bg-slate-950 dark:bg-black/60 rounded-2xl border border-slate-800 dark:border-white/10 p-3 max-h-40 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-0.5">
              {logs.map((line, i) => (
                <div key={i} className="leading-relaxed">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
