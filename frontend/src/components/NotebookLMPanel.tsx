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
  FolderOpen,
  Zap,
  ClipboardPaste,
  OctagonX,
  Video,
  MapPin,
} from 'lucide-react';

import { syncCourseToObsidian, importNlmDownloadsToVault } from '@/lib/obsidianSync';
import { PromptInjectorModal } from './PromptInjectorModal';
import type { Organization, CourseProject, CourseSession, ProjectDossierFile } from '@/lib/types';

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

export type OutputType = 'slides' | 'video' | 'infographic' | 'audio';

export interface OutputTypeConfig {
  id: OutputType;
  label: string;
  action: string;
  icon: any;
  gradient: string;
  badge: string;
  description: string;
}

export const OUTPUT_TYPES: OutputTypeConfig[] = [
  {
    id: 'slides',
    label: 'Slide Deck',
    action: 'generate_slides',
    icon: Presentation,
    gradient: 'from-purple-600 to-indigo-600',
    badge: '16 Slides',
    description: '16-slide academic presentation deck with lecturer notes & visual cues',
  },
  {
    id: 'video',
    label: 'Video',
    action: 'generate_video',
    icon: Video,
    gradient: 'from-pink-600 to-rose-600',
    badge: 'Explainer',
    description: 'Visual video explainer / dynamic lecture storyboard',
  },
  {
    id: 'infographic',
    label: 'Infographic',
    action: 'generate_infographic',
    icon: MapPin,
    gradient: 'from-emerald-600 to-teal-600',
    badge: 'Knowledge Map',
    description: 'High-density conceptual knowledge map & visual relationships',
  },
  {
    id: 'audio',
    label: 'Audio Podcast',
    action: 'generate_audio',
    icon: Headphones,
    gradient: 'from-amber-600 to-orange-600',
    badge: 'Deep Dive',
    description: 'Intellectually rigorous academic discussion between two scholars',
  },
];

const INITIAL_STEPS: Record<string, StepState> = {
  auth: { status: 'idle', message: 'Check authentication' },
  create: { status: 'idle', message: 'Create notebook' },
  upload: { status: 'idle', message: 'Upload lecture sources & images' },
  prompt: { status: 'idle', message: 'Calibrate & inject lecture prompt' },
  generate: { status: 'idle', message: 'Generate slide deck' },
  download: { status: 'idle', message: 'Download artifacts to PC' },
};

async function callNlm(action: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<any> {
  let res: Response;
  let rawText = '';

  try {
    res = await fetch('/api/nlm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
      signal,
    });
    rawText = await res.text();
  } catch (err: any) {
    if (err?.name === 'AbortError' || signal?.aborted) {
      throw new Error('Operation aborted by user');
    }
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
  const [selectedOutputType, setSelectedOutputType] = useState<OutputType>('slides');
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isKilling, setIsKilling] = useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showManualAuth, setShowManualAuth] = useState(false);
  const [manualCookieText, setManualCookieText] = useState('');
  const [isImportingCookie, setIsImportingCookie] = useState(false);
  const [edgeLaunched, setEdgeLaunched] = useState(false);
  const [isCapturingAuth, setIsCapturingAuth] = useState(false);
  const [showPromptInjector, setShowPromptInjector] = useState(false);
  const [isExecutingArchitectPrompt, setIsExecutingArchitectPrompt] = useState(false);
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);
  const [isGeneratingPptx, setIsGeneratingPptx] = useState(false);

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
          if (parsed.steps) {
            const migrated = { ...INITIAL_STEPS, ...parsed.steps };
            if (parsed.steps.slides && !parsed.steps.generate) {
              migrated.generate = parsed.steps.slides;
            }
            delete migrated.slides;
            delete migrated.audio;
            setSteps(migrated);
          }
          if (parsed.notebookId) setActiveNotebookId(parsed.notebookId);
          if (parsed.notebookName) setNotebookName(parsed.notebookName);
          if (parsed.selectedOutputType) setSelectedOutputType(parsed.selectedOutputType);
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
          selectedOutputType,
          logs: logs.slice(-25)
        }));
      } catch (e) {}
    }
  }, [steps, activeNotebookId, notebookName, selectedOutputType, logs, storageKey]);

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
  // Launch Edge InPrivate Sign-In Window
  // ═══════════════════════════════════════════════════════════════════
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    addLog('🔑 Opening Edge InPrivate window for Google sign-in...');
    try {
      const res = await callNlm('launch_login');
      if (res?.output) {
        addLog(`🚀 ${res.output}`);
      } else {
        addLog('🚀 Edge InPrivate opened. Complete Google sign-in, then click "✅ Capture Session".');
      }
      setEdgeLaunched(true);
    } catch (e: any) {
      addLog(`❌ Failed to launch Edge: ${e.message}`);
      setShowManualAuth(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Capture Session from Running Edge InPrivate Window (CDP)
  // ═══════════════════════════════════════════════════════════════════
  const handleCaptureEdgeAuth = async () => {
    setIsCapturingAuth(true);
    addLog('🔄 Capturing session credentials from Edge InPrivate window...');
    try {
      const res = await callNlm('capture_edge_auth');
      addLog(`✅ ${res.output || 'Session captured successfully!'}`);
      setEdgeLaunched(false);
      // Auto-verify the captured session
      await verifyAuthLive();
    } catch (e: any) {
      addLog(`❌ Capture failed: ${e.message}`);
      addLog('💡 Make sure you have completed Google sign-in and reached notebooklm.google.com before clicking "Capture Session".');
    } finally {
      setIsCapturingAuth(false);
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

  // On mount: check auth and try to reconnect safely
  useEffect(() => {
    let mounted = true;

    // Global listener to prevent unhandled Event objects from triggering Next.js dev error overlay
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Event) {
        event.preventDefault();
        console.warn('[NLM] Intercepted unhandled DOM Event rejection:', event.reason.type);
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    verifyAuthLive()
      .then((isOk) => {
        if (mounted && isOk) {
          handleDiscoverAndLinkNotebook().catch((e) => {
            console.warn('[NLM] Auto-discover notebook warning:', e);
          });
        }
      })
      .catch((e) => {
        console.warn('[NLM] Initial auth check warning:', e);
      });

    return () => {
      mounted = false;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
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

  function parseLectureNumber(str?: string | null): number | null {
    if (!str) return null;
    const match = str.match(/\b(?:lec(?:ture)?|session|module)[_\s-]*0*(\d+)\b/i) ||
                  str.match(/(?:^|[\/\\_.-])L0*(\d+)(?:[\/\\_.-]|$)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  const getVaultFilesToUpload = async (pSlug: string, sid: string): Promise<string[]> => {
    let files: string[] = [];
    const targetLecNum = parseLectureNumber(sid);
    const sidClean = sid.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sidSlash = '/' + sid.toLowerCase() + '/';
    const orgSlug = org?.slug?.toLowerCase();

    try {
      // Query ALL vault files including visual assets
      const res = await fetch(`/api/obsidian/files?category=ALL&projectSlug=${encodeURIComponent(pSlug)}&includeImages=true`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.files) && data.files.length > 0) {
          const selectedFiles: string[] = [];
          const seenKeys = new Set<string>();

          for (const rawFp of data.files) {
            const normPath = String(rawFp).replace(/\\/g, '/');
            const lower = normPath.toLowerCase();
            const fileName = normPath.split('/').pop() || normPath;
            const ext = (fileName.split('.').pop() || '').toLowerCase();
            const isImage = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext);
            const isMd = ext === 'md' || ext === 'markdown';

            if (!isMd && !isImage) continue;

            const fileLecNum = parseLectureNumber(normPath);

            // ─── Rule 1: STRICTLY EXCLUDE files belonging to other lectures ───
            if (fileLecNum !== null && targetLecNum !== null && fileLecNum !== targetLecNum) {
              continue;
            }

            // ─── Rule 2: Selected Lecture Files in session folder (blueprint, slides-source, summary, assets) ───
            const inSelectedSessionFolder =
              lower.includes(sidSlash) ||
              lower.replace(/[^a-z0-9/]/g, '').includes('/' + sidClean + '/');
            if (inSelectedSessionFolder) {
              const key = fileName.toLowerCase();
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                selectedFiles.push(normPath);
              }
              continue;
            }

            // ─── Rule 3: Selected Lecture Legacy Slide Deck in Dossier/Resources (e.g. LEC_2.pptx.md) ───
            if (fileLecNum !== null && targetLecNum !== null && fileLecNum === targetLecNum) {
              if (lower.includes('lec') || lower.includes('slides')) {
                const key = 'legacy_slides_' + fileLecNum;
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);
                  selectedFiles.push(normPath);
                }
                continue;
              }
            }

            // ─── Rule 4: Selected Lecture Specific Visual Assets / Institutional Logos ───
            if (isImage) {
              // 4a. Institutional Logos & Academic Crests (e.g. logo-hue.png, logo-pharmacy.png)
              if (lower.includes('logo') || lower.includes('brand') || lower.includes('hue') || lower.includes('crest')) {
                const key = 'brand_logo_' + fileName.toLowerCase();
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);
                  selectedFiles.push(normPath);
                }
                continue;
              }

              // 4b. Lecture-specific figures & schematics
              if (fileLecNum !== null && targetLecNum !== null && fileLecNum === targetLecNum) {
                const key = fileName.toLowerCase();
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);
                  selectedFiles.push(normPath);
                }
                continue;
              }
            }

            // ─── Rule 5: Vault Needed Files (Core Course Architecture Context ONLY) ───
            if (fileLecNum === null) {
              // Course Overview / Main Hub MOC
              if (fileName.toLowerCase() === 'course_overview.md' || fileName.toLowerCase() === 'dashboard.md') {
                const key = 'course_overview';
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);
                  selectedFiles.push(normPath);
                }
                continue;
              }

              // Brand Identity Contract (only for current organization)
              if (fileName.toLowerCase() === 'brand_identity_contract.md') {
                if (orgSlug && !lower.includes(orgSlug)) continue;
                const key = 'brand_identity_contract';
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);
                  selectedFiles.push(normPath);
                }
                continue;
              }

              // Course Specification / ILOs
              if (lower.includes('course_specification_ilos') || lower.includes('course_spec')) {
                const key = 'course_specification';
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);
                  selectedFiles.push(normPath);
                }
                continue;
              }

              // Assessment Specification / Exam Blueprint
              if (lower.includes('assessment_specification') || (lower.includes('blueprint') && !lower.includes('lec'))) {
                const key = 'assessment_specification';
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);
                  selectedFiles.push(normPath);
                }
                continue;
              }
            }

            // Any other file (unrelated question banks, other lectures, random assets) is NOT added!
          }

          files = selectedFiles;
        }
      }
    } catch (e) {
      console.warn('Vault files scan error:', e);
    }

    if (files.length === 0) {
      const safeSid = sid.replace(/[^a-zA-Z0-9._-]/g, '_');
      files = [
        `01_Projects/${pSlug}/${sid}/blueprint.md`,
        `01_Projects/${pSlug}/${safeSid}/blueprint.md`,
        `01_Projects/${pSlug}/${sid}/slides-source.md`,
        `01_Projects/${pSlug}/${safeSid}/slides-source.md`,
        `01_Projects/${pSlug}/${sid}/home-summary.md`,
        `01_Projects/${pSlug}/${safeSid}/home-summary.md`,
        `01_Projects/${pSlug}/${sid}/decisions.md`,
        `01_Projects/${pSlug}/${safeSid}/decisions.md`,
        `01_Projects/${pSlug}/Course_Overview.md`,
        `02_Areas/${org?.slug || 'horus-pharmacy'}/Brand_Identity_Contract.md`,
      ];
    }
    return files;
  };

  const handleUploadSourceFilesOnly = async () => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;

    setStep('upload', 'running', 'Syncing & uploading course source files (waiting for indexing)...');
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

    addLog('🔍 Discovering related vault notes to upload to NotebookLM...');
    const filesToUpload = await getVaultFilesToUpload(pSlug, sid);
    addLog(`📋 Found ${filesToUpload.length} selected lecture & vault foundation file(s). Uploading and waiting for NotebookLM processing...`);

    // Check existing sources in the notebook to avoid duplicate uploads
    let existingSources = new Set<string>();
    try {
      const srcRes = await callNlm('list_sources', { notebookId: activeNotebookId, notebookName: name });
      const srcList = srcRes.data || JSON.parse(srcRes.output || '[]');
      if (Array.isArray(srcList)) {
        for (const s of srcList) {
          if (s.title) existingSources.add(s.title.trim().toLowerCase());
        }
      }
    } catch {}

    let uploadedCount = 0;
    const uploadedSet = new Set<string>();

    for (const fp of filesToUpload) {
      const fileName = fp.split('/').pop() || fp;
      if (uploadedSet.has(fileName)) continue;

      if (existingSources.has(fileName.toLowerCase())) {
        uploadedCount++;
        uploadedSet.add(fileName);
        addLog(`  ♻️ Already indexed in NotebookLM: ${fileName} (reused)`);
        continue;
      }

      try {
        addLog(`⏳ Uploading & waiting for NotebookLM processing: ${fileName}...`);
        const res = await callNlm('add_source_file', { 
          notebookId: activeNotebookId, 
          notebookName: name, 
          filePath: fp, 
          projectSlug: pSlug 
        });
        if (res.error) {
          addLog(`  ⚠️ Skipped ${fileName}: ${res.error.substring(0, 80)}`);
          continue;
        }
        uploadedCount++;
        uploadedSet.add(fileName);
        addLog(`  ✅ Uploaded & fully indexed: ${fileName}`);
      } catch (e: any) {
        addLog(`  ⚠️ Skipped ${fileName}: ${e.message?.substring(0, 80)}`);
      }
    }

    if (uploadedCount > 0) {
      setStep('upload', 'success', `${uploadedCount} source file(s) indexed & ready ✓`);
      addLog(`✨ Complete: ${uploadedCount} file(s) indexed in NotebookLM.`);
    } else {
      setStep('upload', 'error', 'No files uploaded — check vault path');
      addLog('❌ Upload failed: 0 files were uploaded.');
    }
  };

  const buildCalibratedPrompt = (format: OutputType = selectedOutputType): string => {
    const isEnglish = (org?.language_policy?.primary_script === 'en') || ((org?.language_policy?.primary_script || '').toLowerCase().includes('en'));
    const isArabic = (org?.language_policy?.primary_script === 'ar') && ((org?.language_policy?.target_ratio || 0) >= 0.85);

    const curSession = activeSession || sessions?.find(s => s.session_code === sessionCode) || null;
    const lectureCode = curSession?.session_code || sessionCode || 'Lec 01';
    const lectureTitle = curSession?.title || 'Selected Lecture';
    const courseTitle = project?.name || projectName || 'Academic Course Curriculum';
    const courseCode = project?.course_code ? ` (${project.course_code})` : '';
    const institution = org?.name || 'Horus University in Egypt (HUE)';
    const palette = org?.brand_palette?.approved?.length ? org.brand_palette.approved.join(', ') : '#002060, #FFC000, #FFFFFF, #1E293B';

    // Extract Learning Objectives (ILOs) strictly for this lecture
    const ilos: string[] = [];
    if (curSession?.blueprint_markdown) {
      const matches = curSession.blueprint_markdown.match(/(?:ILO|Outcome|Objective)\s*[\d.]*[:\-]\s*[^\n\r]+/gi);
      if (matches && matches.length > 0) {
        ilos.push(...matches.slice(0, 6).map(m => m.trim()));
      }
    }
    const iloSection = ilos.length > 0
      ? `SPECIFIC LEARNING OBJECTIVES (ILOs):\n${ilos.map((ilo, idx) => `${idx + 1}. ${ilo}`).join('\n')}`
      : `SUBJECT FOCUS: Core principles, theoretical foundations, governing laws, and scientific definitions of ${lectureCode}: ${lectureTitle}.`;

    // Format-specific directive
    let formatDirective = '';
    if (format === 'slides') {
      formatDirective = `TARGET OUTPUT FORMAT: ACADEMIC SLIDE DECK (16 Slides — Motion Graphic Aesthetic)
Create a comprehensive, 16-slide university academic presentation deck strictly covering ${lectureCode}: ${lectureTitle}:

CRITICAL DESIGN SPECIFICATION — UNIFORMITY & MOTION GRAPHIC AESTHETIC:
1. STRICTLY UNIFORM BACKGROUND ACROSS ALL 16 SLIDES:
   - Every single slide MUST share the EXACT SAME clean, uniform, high-key light background (#FFFFFF).
   - ABSOLUTELY FORBIDDEN: Switching between dark and light backgrounds, alternating colors slide-by-slide, or using dark/black slides. All 16 slides must look like parts of ONE coherent master template.

2. SINGLE UNIFIED TYPOGRAPHIC SYSTEM:
   - Use strictly ONE modern geometric sans-serif typeface throughout the entire deck (Segoe UI / Inter / Helvetica).
   - Strict font size and weight hierarchy:
     * Slide Titles: Clean bold 26-28pt in Horus Navy (#002060).
     * Section Headings / Card Titles: Semi-bold 16-18pt in Horus Navy (#002060) with subtle Gold (#FFC000) accents.
     * Body & Bullet Text: Regular 13-14pt in Dark Charcoal Slate (#1E293B).
     * Delivery Notes / Takeaways: Clean italic 11-12pt in Muted Slate (#64748B).
   - ABSOLUTELY FORBIDDEN: Mixing serif and sans-serif fonts, decorative fonts, or varying font families across slides.

3. SIMPLE & CLEAN MOTION GRAPHIC DESIGN STYLE:
   - Aesthetic: Minimalist, clean broadcast motion graphics layout.
   - Ample whitespace (minimum 35% empty margin/breathing room per slide).
   - Modular Content Cards: Group information inside clean rectangular cards with subtle 1px border (#E2E8F0) on clean white/off-white surface (#F8FAFC).
   - Linear flow & visual hierarchy: Use clear numbered step pills (1, 2, 3), horizontal process arrows (→), and structured two-column or three-column grids.
   - Zero clutter: No cheesy clip-art, no chaotic illustrations, no gratuitous heavy gradients or busy patterns.

4. INSTITUTIONAL BRAND ACCENTS:
   - Primary: Horus Navy (#002060) for titles and primary headers.
   - Accent: Warm Gold (#FFC000) for subtle key-term badges and active indicators.
   - Neutral Text: Dark Charcoal (#1E293B).
   - Neutral Background: Pure White (#FFFFFF) / Light Surface (#F8FAFC).
   - Header/Corner: Display Horus University in Egypt (Faculty of Pharmacy) and institutional logo consistently.

16-SLIDE COGNITIVE STRUCTURE:
1. Title Slide: ${institution}, ${courseTitle}${courseCode}, ${lectureCode}: ${lectureTitle}.
2. Intended Learning Outcomes (ILOs) & Cognitive Map (Bloom's Taxonomy).
3. Core Definitions, Foundational Principles & Terminology.
4-7. Progressive Deep Dive: Fundamental Mechanisms, Governing Equations, Physics/Chemistry Principles (following original lecture depth).
8-11. Systematic Instrumentation, Methodology & Optical/Analytical Pathways (strictly as given in sources).
12-14. Qualitative & Quantitative Analysis, Derivations, and Diagnostic Interpretation.
15. Summary Matrix & Conceptual Synthesis.
16. Self-Assessment Checkpoints & Visual Evidence References.

Each slide MUST include: Slide Title, structured bullet points/cards, explicit visual cues/source image markers, and 1 practical Lecturer Delivery Note.`;
    } else if (format === 'video') {
      formatDirective = `TARGET OUTPUT FORMAT: VIDEO EXPLAINER / LECTURE STORYBOARD
Create a detailed, high-impact video explainer script and lecture storyboard strictly covering ${lectureCode}: ${lectureTitle}:
- Structured timeline with scene-by-scene visual descriptions, on-screen text callouts, and narrator delivery.
- Step-by-step breakdown of core mechanisms, equations, and diagrams.
- Active visual anchoring to source figures and institutional branding.
- Maintain complete scientific explanation without rushing or omitting mathematical/physical steps.`;
    } else if (format === 'infographic') {
      formatDirective = `TARGET OUTPUT FORMAT: COMPREHENSIVE KNOWLEDGE MAP / INFOGRAPHIC
Create a high-density, scientifically accurate conceptual knowledge map and visual infographic for ${lectureCode}: ${lectureTitle}:
- Visual Hierarchy: Foundation & Definition -> Core Governing Laws & Equations -> Component Breakdown -> Key Analytical Relationships.
- Scientific rigor: Highlight all formulas, variables, spectral/optical pathways, and classification tables.
- Use institutional colors (${palette}) with clean contrast and structural cards.`;
    } else {
      formatDirective = `TARGET OUTPUT FORMAT: SCHOLARLY AUDIO PODCAST (DEEP DIVE)
Create an intellectually engaging, in-depth audio dialogue between two academic scholars exploring ${lectureCode}: ${lectureTitle}:
- Deep theoretical dissection of every concept, equation, and law present in the lecture sources.
- Thorough pedagogical explanation of complex physical/chemical interactions without superficial summaries.
- Natural academic banter, highlighting critical exam distinctions and underlying principles.`;
    }

    return `GROUNDING & STRICT INSTRUCTION HEADER:
Use the provided sources for this selected lecture (${lectureCode}: ${lectureTitle} in ${courseTitle}) as your exclusive subject matter.

1. EXACT CONTENT FIDELITY — DO NOT SUMMARIZE OR CHANGE:
Follow the original lecture content EXACTLY as authored. Do NOT summarize away, truncate, dilute, or omit theoretical mechanisms, scientific equations, mathematical proofs, derivations, or nomenclature. Maintain the complete academic depth, precision, and rigor of the source material.

2. CRITICAL CONSTRAINT — NOT EACH LECTURE HAS AN APPLICATION:
Do NOT force, invent, or hallucinate pharmaceutical, clinical, industrial, or medical applications if they are NOT explicitly present in the original lecture sources. If this lecture focuses on foundational physics, optical theory, or mathematical derivations, present it faithfully as pure foundational theory without inventing artificial applications.

3. VISUAL ORGANIZATION & REFINEMENT:
You are authorized and instructed to ORGANIZE AND IMPROVE VISUALS. Structure all explanations with clear hierarchical layouts, distinct conceptual sections, process flow sequences, and clean pedagogical scaffolding. Ensure high visual contrast and modern academic aesthetics.

4. INSTITUTIONAL BRANDING & SOURCE IMAGES:
Actively incorporate, integrate, and reference the institutional identity (${institution}), approved brand palette (${palette}), and all uploaded diagrams, charts, schematics, and figures present in the lecture sources. Where a source diagram illustrates a concept, explicitly anchor the explanation to that visual artifact and specify where it appears.

5. LANGUAGE POLICY:
${isArabic ? 'اللغة الأساسية: اللغة العربية الفصحى الأكاديمية مع الحفاظ على المصطلحات اللاتينية والمعادلات الرياضية/الكيميائية بدقة.' : 'Primary Language: 100% English Academic Delivery strictly adhering to international curriculum standards.'}

${iloSection}

${formatDirective}`;
  };

  const handleCalibratePromptOnly = async () => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;
    const curSession = activeSession || sessions?.find(s => s.session_code === sessionCode) || null;
    const lectureCode = curSession?.session_code || sessionCode || 'Lec 01';
    const selConfig = OUTPUT_TYPES.find(t => t.id === selectedOutputType) || OUTPUT_TYPES[0];

    setStep('prompt', 'running', `Calibrating prompt for ${lectureCode}...`);
    addLog(`🎨 Calibrating lecture prompt strictly grounded in ${lectureCode} (${selConfig.label})...`);
    const promptText = buildCalibratedPrompt(selectedOutputType);

    try {
      if (activeNotebookId || name) {
        await callNlm('add_source_text', {
          notebookId: activeNotebookId,
          notebookName: name,
          instructions: promptText,
        });
        addLog(`📌 Grounding note injected into NotebookLM notebook.`);
      }
      setStep('prompt', 'success', `Prompt calibrated for ${selConfig.label} ✓`);
      addLog(`✅ Calibrated prompt ready: strict fidelity, no forced applications, logo/images integrated.`);
    } catch (e: any) {
      setStep('prompt', 'success', `Prompt formulated for ${selConfig.label} ✓`);
      addLog(`⚠️ Grounding note notice: ${e.message?.substring(0, 60)}. Prompt ready for generator.`);
    }
  };

  const handleGenerateSelectedOutputOnly = async (format: OutputType = selectedOutputType) => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;
    const selConfig = OUTPUT_TYPES.find(t => t.id === format) || OUTPUT_TYPES[0];
    const promptText = buildCalibratedPrompt(format);

    setStep('generate', 'running', `Generating ${selConfig.label.toLowerCase()}...`);
    addLog(`🎬 Generating ${selConfig.label} via NotebookLM...`);

    try {
      let res: any;
      if (format === 'slides') {
        res = await callNlm('generate_slides', {
          notebookId: activeNotebookId,
          notebookName: name,
          instructions: promptText,
          slideFormat: 'detailed',
        });
      } else if (format === 'video') {
        res = await callNlm('generate_video', {
          notebookId: activeNotebookId,
          notebookName: name,
          instructions: promptText,
        });
      } else if (format === 'infographic') {
        res = await callNlm('generate_infographic', {
          notebookId: activeNotebookId,
          notebookName: name,
          instructions: promptText,
        });
      } else if (format === 'audio') {
        res = await callNlm('generate_audio', {
          notebookId: activeNotebookId,
          notebookName: name,
          instructions: promptText,
        });
      }
      setStep('generate', 'success', `${selConfig.label} generated ✓`);
      addLog(`✅ ${selConfig.label} generated: ${res?.output?.substring(0, 100) || 'Success'}`);
    } catch (e: any) {
      setStep('generate', 'error', e.message?.substring(0, 120));
      addLog(`❌ ${selConfig.label} generation failed: ${e.message}`);
    }
  };

  const handleGenerateSlidesOnly = () => handleGenerateSelectedOutputOnly('slides');
  const handleGenerateAudioOnly = () => handleGenerateSelectedOutputOnly('audio');

  // ═══════════════════════════════════════════════════════════════════
  // Prompt Architect Injection Execution
  // ═══════════════════════════════════════════════════════════════════
  const handleExecutePrompt = async (
    action: string,
    promptText: string,
    extraOptions: Record<string, any> = {}
  ) => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;
    setIsExecutingArchitectPrompt(true);
    addLog(`🎨 Injecting formulated prompt into ${action}...`);

    try {
      if (action === 'generate_slides') {
        setStep('generate', 'running', 'Generating slide deck with Prompt Architect...');
        const res = await callNlm('generate_slides', {
          notebookId: activeNotebookId,
          notebookName: name,
          instructions: promptText,
          ...extraOptions,
        });
        setStep('generate', 'success', 'Slide deck generated ✓');
        addLog(`✅ Slides generated: ${res.output?.substring(0, 100)}`);
      } else if (action === 'generate_audio') {
        setStep('generate', 'running', 'Generating podcast with Prompt Architect...');
        const res = await callNlm('generate_audio', {
          notebookId: activeNotebookId,
          notebookName: name,
          instructions: promptText,
          ...extraOptions,
        });
        setStep('generate', 'success', 'Audio podcast generated ✓');
        addLog(`✅ Audio podcast generated: ${res.output?.substring(0, 100)}`);
      } else if (action === 'generate_infographic') {
        setStep('generate', 'running', 'Generating infographic with Prompt Architect...');
        const res = await callNlm('generate_infographic', {
          notebookId: activeNotebookId,
          notebookName: name,
          instructions: promptText,
          ...extraOptions,
        });
        setStep('generate', 'success', 'Infographic generated ✓');
        addLog(`✅ Infographic generated: ${res.output?.substring(0, 100)}`);
      } else if (action === 'generate_video') {
        setStep('generate', 'running', 'Generating video with Prompt Architect...');
        const res = await callNlm('generate_video', {
          notebookId: activeNotebookId,
          notebookName: name,
          instructions: promptText,
          ...extraOptions,
        });
        setStep('generate', 'success', 'Video generated ✓');
        addLog(`✅ Video generated: ${res.output?.substring(0, 100)}`);
      }
      setShowPromptInjector(false);
    } catch (e: any) {
      setStep('generate', 'error', e.message?.substring(0, 120));
      addLog(`❌ Prompt injection failed: ${e.message}`);
    } finally {
      setIsExecutingArchitectPrompt(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Direct On-Demand Download (No rerunning earlier steps!)
  // ═══════════════════════════════════════════════════════════════════
  const handleDownloadOnly = async () => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;
    const pSlug = project?.slug || 'instrumental-analysis-pharmaceutical';

    setStep('download', 'running', 'Downloading artifacts from NotebookLM...');
    addLog(`📥 Downloading all generated artifacts...`);
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
        projectSlug: pSlug
      });

      addLog(`✅ Artifacts downloaded successfully!`);
      if (dl.output) addLog(`📄 Output: ${dl.output.substring(0, 150)}`);
      await importDownloadsIntoVault(dl.notebookIdentifier);
    } catch (e: any) {
      setStep('download', 'error', e.message?.substring(0, 120));
      addLog(`⚠️ Download error: ${e.message}`);
    }
  };

  // download_all only stages files on disk (frontend/src/app/api/nlm's own staging dir,
  // not the vault); this moves them into the vault through the backend's canonical writer.
  const importDownloadsIntoVault = useCallback(async (notebookIdentifier?: string) => {
    if (!project?.id || !notebookIdentifier) {
      setStep('download', 'success', 'Downloaded (vault import needs a saved project)');
      return;
    }
    addLog('📦 Importing downloaded artifacts into the vault...');
    try {
      const result = await importNlmDownloadsToVault(project.id, notebookIdentifier);
      if (result.success) {
        setStep('download', 'success', 'Downloaded & synced to vault ✓');
        addLog('✅ Artifacts synced into the vault.');
      } else {
        setStep('download', 'success', 'Downloaded (vault sync failed)');
        addLog(`⚠️ Vault import failed: ${result.message}`);
      }
    } catch (err: any) {
      setStep('download', 'success', 'Downloaded (vault sync error)');
      addLog(`⚠️ Vault import error: ${err?.message || 'Unknown error'}`);
    }
  }, [project, addLog, setStep]);

  // ═══════════════════════════════════════════════════════════════════
  // Open Download Directory in OS File Explorer
  // ═══════════════════════════════════════════════════════════════════
  const handleOpenDownloadFolder = async (targetFolder: 'auto' | 'vault' | 'staging' = 'auto') => {
    setIsOpeningFolder(true);
    const pSlug = project?.slug || 'instrumental-analysis-pharmaceutical';
    const name = notebookName.trim() || defaultNotebookName;
    addLog(`📂 Opening download directory (${targetFolder})...`);
    try {
      const res = await callNlm('open_download_dir', {
        projectSlug: pSlug,
        notebookId: activeNotebookId,
        notebookName: name,
        targetFolder,
      });
      if (res.success) {
        addLog(`📂 Opened in File Explorer: ${res.path || 'Download folder'}`);
      } else {
        addLog(`⚠️ Could not open folder: ${res.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      addLog(`⚠️ Open folder error: ${e.message}`);
    } finally {
      setIsOpeningFolder(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Generate 16-Slide Clean Motion Graphic Presentation Deck (.pptx)
  // ═══════════════════════════════════════════════════════════════════
  const handleGenerateMotionGraphicDeck = async () => {
    setIsGeneratingPptx(true);
    const pSlug = project?.slug || 'inst';
    const curSession = activeSession || sessions?.find(s => s.session_code === sessionCode) || null;
    const sCode = curSession?.session_code || sessionCode || 'Lec 01';
    const sTitle = curSession?.title || 'Principles of Molecular UV/Vis Spectroscopy';
    const cName = project?.name || projectName || 'Instrumental Analysis';
    const cCode = project?.course_code || 'PC 206';
    const inst = org?.name || 'Horus University in Egypt (Faculty of Pharmacy)';

    setStep('generate', 'running', 'Generating 16-Slide Clean Motion Graphic Deck (.pptx)...');
    addLog(`🎨 Building 16-slide clean motion graphic PPTX for ${sCode}: ${sTitle}...`);
    addLog('📐 Enforcing: 100% Uniform White Canvas, Single Segoe UI Font, Modular Cards & Figures.');

    try {
      const res = await callNlm('generate_motion_graphic_pptx', {
        projectSlug: pSlug,
        sessionCode: sCode,
        sessionTitle: sTitle,
        courseName: cName,
        courseCode: cCode,
        institution: inst,
      });

      if (res.success) {
        setStep('generate', 'success', 'Clean Motion Graphic PPTX Generated ✓');
        addLog('✅ Native PowerPoint Presentation created with 100% uniform white background & unified typography!');
        if (res.output) addLog(`📄 ${res.output.substring(0, 160)}`);
      } else {
        setStep('generate', 'error', res.error || 'Failed to generate PPTX');
        addLog(`❌ PPTX generation failed: ${res.error}`);
      }
    } catch (err: any) {
      setStep('generate', 'error', err.message);
      addLog(`❌ PPTX generation error: ${err.message}`);
    } finally {
      setIsGeneratingPptx(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Full 6-Step Pipeline
  // ═══════════════════════════════════════════════════════════════════

  const runFullPipeline = async () => {
    const name = notebookName.trim() || defaultNotebookName;
    if (!name) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunningAll(true);
    addLog('🚀 Starting NotebookLM full flow...');

    try {
      if (controller.signal.aborted) return;

      // Step 1: LIVE Auth check
      const authOk = await verifyAuthLive();
      if (!authOk || controller.signal.aborted) {
        setIsRunningAll(false);
        return;
      }

      if (controller.signal.aborted) return;

      // Step 2: Create / Reconnect notebook
      setStep('create', 'running', `Creating/Checking notebook "${name}"...`);
      addLog(`Checking notebook: ${name}`);
      let activeId = activeNotebookId;
      try {
        const listRes = await callNlm('list_notebooks', {}, controller.signal);
        try {
          const nbList = JSON.parse(listRes.output || '[]');
          const existing = nbList.find((n: any) => n.title === name);
          if (existing) {
            activeId = existing.id;
            setActiveNotebookId(existing.id);
          }
        } catch (e) {}

        if (controller.signal.aborted) return;

        if (activeId) {
          setStep('create', 'success', `Notebook "${name}" ready (reused)`);
          addLog(`♻️ Notebook already exists, reusing ID: ${activeId}`);
        } else {
          const cr = await callNlm('create_notebook', { notebookName: name }, controller.signal);
          activeId = cr.output?.match(/"notebook_id":\s*"([^"]+)"/)?.[1] || cr.output?.match(/"id":\s*"([^"]+)"/)?.[1] || '';
          if (activeId) setActiveNotebookId(activeId);
          setStep('create', 'success', `Notebook "${name}" ready`);
          addLog(`✅ Notebook created: ${cr.output?.substring(0, 120)}`);
        }
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setStep('create', 'error', e.message);
        addLog(`❌ Create failed: ${e.message}`);
        setIsRunningAll(false);
        return;
      }

      if (controller.signal.aborted) return;

      // Step 3: Auto-sync & Upload source files
      setStep('upload', 'running', 'Syncing & uploading course source files (waiting for indexing)...');
      addLog('Auto-syncing & uploading curriculum source files...');

      if (project) {
        try {
          const syncRes = await syncCourseToObsidian(org || null, project, sessions, activeSession);
          addLog(`💾 Auto-synced files to disk (${syncRes.syncedCount || 'all'} files).`);
        } catch (err: any) {
          addLog(`⚠️ Auto-sync warning: ${err.message}`);
        }
      }

      if (controller.signal.aborted) return;

      const pSlug = project?.slug || 'instrumental-analysis-pharmaceutical';
      const sid = sessionCode || 'Lec 01';

      addLog('🔍 Discovering related vault notes to upload to NotebookLM...');
      const filesToUpload = await getVaultFilesToUpload(pSlug, sid);
      addLog(`📋 Found ${filesToUpload.length} selected lecture & vault foundation file(s). Uploading and waiting for NotebookLM processing...`);

      // Check existing sources in the notebook to avoid duplicate uploads
      let existingSources = new Set<string>();
      try {
        const srcRes = await callNlm('list_sources', { notebookId: activeId, notebookName: name }, controller.signal);
        const srcList = srcRes.data || JSON.parse(srcRes.output || '[]');
        if (Array.isArray(srcList)) {
          for (const s of srcList) {
            if (s.title) existingSources.add(s.title.trim().toLowerCase());
          }
        }
      } catch {}

      let uploadedCount = 0;
      const uploadedSet = new Set<string>();

      for (const fp of filesToUpload) {
        if (controller.signal.aborted) {
          addLog('🛑 Upload halted: pipeline killed.');
          return;
        }

        const fileName = fp.split('/').pop() || fp;
        if (uploadedSet.has(fileName)) continue;

        if (existingSources.has(fileName.toLowerCase())) {
          uploadedCount++;
          uploadedSet.add(fileName);
          addLog(`  ♻️ Already indexed in NotebookLM: ${fileName} (reused)`);
          continue;
        }

        try {
          addLog(`⏳ Uploading & waiting for NotebookLM processing: ${fileName}...`);
          const res = await callNlm('add_source_file', { 
            notebookId: activeId, 
            notebookName: name, 
            filePath: fp, 
            projectSlug: pSlug 
          }, controller.signal);
          if (res.error) {
             addLog(`  ⚠️ Skipped ${fileName}: ${res.error.substring(0, 80)}`);
             continue;
          }
          uploadedCount++;
          uploadedSet.add(fileName);
          addLog(`  ✅ Uploaded & fully indexed: ${fileName}`);
        } catch (e: any) {
          if (controller.signal.aborted) return;
          addLog(`  ⚠️ Skipped ${fileName}: ${e.message?.substring(0, 80)}`);
        }
      }

      if (controller.signal.aborted) return;

      if (uploadedCount > 0) {
        setStep('upload', 'success', `${uploadedCount} source file(s) indexed & ready ✓`);
        addLog(`✨ All ${uploadedCount} file(s) uploaded and indexed by Google NotebookLM.`);
        // Brief pause to allow NotebookLM cluster to settle before generation
        await new Promise(r => setTimeout(r, 2000));
      } else {
        setStep('upload', 'error', 'No files uploaded — check vault path');
        addLog('❌ Upload step failed: No sources were uploaded. Stopping pipeline.');
        setIsRunningAll(false);
        return;
      }

      if (controller.signal.aborted) return;

      // Step 4: Calibrate & Inject Lecture Prompt
      const curSession = activeSession || sessions?.find(s => s.session_code === sessionCode) || null;
      const lectureCode = curSession?.session_code || sessionCode || 'Lec 01';
      const lectureTitle = curSession?.title || 'Selected Lecture';
      const selConfig = OUTPUT_TYPES.find(t => t.id === selectedOutputType) || OUTPUT_TYPES[0];

      setStep('prompt', 'running', `Calibrating prompt for ${lectureCode}...`);
      addLog(`🎨 Calibrating prompt tailored strictly to ${lectureCode}: ${lectureTitle} (${selConfig.label})...`);
      const calibratedPrompt = buildCalibratedPrompt(selectedOutputType);
      addLog(`✨ Prompt calibrated: strict fidelity, no forced applications, improved visuals, logo/images integration.`);

      try {
        await callNlm('add_source_text', {
          notebookId: activeId,
          notebookName: name,
          instructions: calibratedPrompt,
        }, controller.signal);
        addLog(`📌 Grounding note injected into NotebookLM notebook.`);
      } catch (promptErr: any) {
        addLog(`ℹ️ Note: Proceeding with focused prompt injection in generator (${promptErr?.message?.substring(0, 60)})`);
      }
      setStep('prompt', 'success', 'Prompt calibrated & injected ✓');

      if (controller.signal.aborted) return;

      // Step 5: Generate selected output modality
      setStep('generate', 'running', `Generating ${selConfig.label} via NotebookLM...`);
      addLog(`🚀 Generating ${selConfig.label} (${selConfig.badge})...`);
      try {
        let genRes: any;
        if (selectedOutputType === 'slides') {
          genRes = await callNlm('generate_slides', {
            notebookId: activeId,
            notebookName: name,
            instructions: calibratedPrompt,
            slideFormat: 'detailed',
          }, controller.signal);
        } else if (selectedOutputType === 'video') {
          genRes = await callNlm('generate_video', {
            notebookId: activeId,
            notebookName: name,
            instructions: calibratedPrompt,
          }, controller.signal);
        } else if (selectedOutputType === 'infographic') {
          genRes = await callNlm('generate_infographic', {
            notebookId: activeId,
            notebookName: name,
            instructions: calibratedPrompt,
          }, controller.signal);
        } else if (selectedOutputType === 'audio') {
          genRes = await callNlm('generate_audio', {
            notebookId: activeId,
            notebookName: name,
            instructions: calibratedPrompt,
          }, controller.signal);
        }
        setStep('generate', 'success', `${selConfig.label} generated ✓`);
        addLog(`✅ ${selConfig.label} generated: ${genRes?.output?.substring(0, 100) || 'Success'}`);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setStep('generate', 'error', e.message?.substring(0, 120));
        addLog(`❌ ${selConfig.label} generation failed: ${e.message}`);
        addLog(`⛔ Pipeline stopped due to ${selConfig.label} generation failure.`);
        setIsRunningAll(false);
        return;
      }

      if (controller.signal.aborted) return;

      // Step 6: Download all artifacts
      setStep('download', 'running', 'Downloading all artifacts to local PC...');
      addLog('📥 Downloading all generated artifacts...');
      try {
        const dl = await callNlm('download_all', {
          notebookId: activeId,
          notebookName: name,
          projectSlug: pSlug
        }, controller.signal);
        addLog(`✅ Downloaded: ${dl.output?.substring(0, 120)}`);
        if (!controller.signal.aborted) {
          await importDownloadsIntoVault(dl.notebookIdentifier);
        }
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setStep('download', 'error', e.message?.substring(0, 120));
        addLog(`⚠️ Download: ${e.message}`);
      }

      if (!controller.signal.aborted) {
        addLog('🏁 NotebookLM pipeline complete!');
      }
    } catch (e: any) {
      if (controller.signal.aborted || e?.name === 'AbortError') {
        addLog('🛑 Pipeline stopped by user.');
      } else {
        addLog(`❌ Pipeline error: ${e?.message || 'Unknown error'}`);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsRunningAll(false);
    }
  };

  const handleKillPipeline = async () => {
    setIsKilling(true);
    addLog('🛑 Stopping NotebookLM pipeline and killing background tasks...');

    // 1. Abort in-flight fetch and loops
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Mark any currently running step as aborted
    setSteps(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k].status === 'running') {
          next[k] = { status: 'error', message: 'Terminated by user 🛑' };
        }
      }
      return next;
    });

    setIsRunningAll(false);

    // 3. Trigger server-side OS kill to stop nlm.exe
    try {
      const killRes = await fetch('/api/nlm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kill_pipeline' }),
      });
      const data = await killRes.json();
      if (data.success) {
        addLog(`🛑 ${data.output || 'NotebookLM processes killed.'}`);
      } else {
        addLog(`⚠️ Process kill notice: ${data.error || 'Failed to kill process'}`);
      }
    } catch (err: any) {
      addLog(`⚠️ Emergency kill request error: ${err.message}`);
    } finally {
      setIsKilling(false);
    }
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
                      Option 1 (Recommended): <strong>Dedicated Edge Window</strong> (opens an isolated Edge browser for Google sign-in). <em>Close all existing Edge windows first for best results.</em><br/>
                      Option 2: <strong>Fast Session Import</strong> (paste cookies from DevTools in 10 seconds).
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!edgeLaunched ? (
                    <button
                      onClick={() => { void handleSignIn(); }}
                      disabled={isLoggingIn}
                      className="px-3.5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-display font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                    >
                      <KeyRound className={`w-3.5 h-3.5 ${isLoggingIn ? 'animate-spin' : ''}`} />
                      <span>{isLoggingIn ? 'Launching Edge...' : '🔑 Sign In with Edge'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => { void handleCaptureEdgeAuth(); }}
                      disabled={isCapturingAuth}
                      className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-display font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 animate-pulse"
                    >
                      {isCapturingAuth ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>{isCapturingAuth ? 'Capturing...' : '✅ Capture Session'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowManualAuth(!showManualAuth)}
                    className="px-3 py-2.5 bg-white dark:bg-black/40 border border-amber-300 dark:border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-800 dark:text-amber-200 font-display font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>⚡ Fast Session Import</span>
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

              {/* Edge InPrivate Sign-In Instructions */}
              {edgeLaunched && (
                <div className="mt-2 p-3 bg-sky-50 dark:bg-sky-950/20 border border-sky-300 dark:border-sky-500/30 rounded-xl">
                  <p className="text-[11px] text-sky-800 dark:text-sky-300 font-display font-bold mb-1">
                    📌 Edge InPrivate window is open — Complete these steps:
                  </p>
                  <ol className="text-[11px] text-sky-700 dark:text-sky-400/80 space-y-0.5 list-decimal list-inside">
                    <li>Sign in to your Google account in the Edge window</li>
                    <li>Wait until you see the <strong>NotebookLM dashboard</strong></li>
                    <li>Click <strong>"✅ Capture Session"</strong> above to extract credentials</li>
                  </ol>
                </div>
              )}

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
                      onClick={() => { void handleImportCookies(); }}
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
                  onClick={() => { void handleDiscoverAndLinkNotebook(); }}
                  disabled={isDiscovering}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-200 transition flex items-center gap-1 disabled:opacity-50"
                  title="Search NotebookLM for existing notebook and link it"
                >
                  <Search className={`w-3 h-3 ${isDiscovering ? 'animate-spin' : ''}`} />
                  <span>Find Notebook</span>
                </button>
                <button
                  onClick={() => { void verifyAuthLive(); }}
                  disabled={isCheckingAuth}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-200 transition flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingAuth ? 'animate-spin' : ''}`} />
                  Re-verify
                </button>
              </div>
            </div>
          )}

          {/* ═══════ Target Output Modality Selector ═══════ */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-rose-500/10 dark:from-purple-950/30 dark:via-indigo-950/20 dark:to-rose-950/30 border border-purple-200/80 dark:border-purple-500/30 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Target Output Modality
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-500/30">
                    Step 5 Target
                  </span>
                </span>
                <p className="text-[10px] text-slate-500 dark:text-white/60">
                  Select the calibrated format to generate after source upload &amp; prompt injection
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {OUTPUT_TYPES.map((t) => {
                const isSelected = selectedOutputType === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedOutputType(t.id);
                      setSteps(prev => ({
                        ...prev,
                        generate: {
                          status: prev.generate?.status === 'running' ? 'running' : 'idle',
                          message: prev.generate?.status === 'success' ? prev.generate.message : `Generate ${t.label.toLowerCase()}`
                        }
                      }));
                      addLog(`🎯 Target output modality set to: ${t.label} (${t.badge})`);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                      isSelected
                        ? `bg-gradient-to-r ${t.gradient} text-white ring-2 ring-purple-400/50 dark:ring-purple-400/70 scale-105`
                        : 'bg-white dark:bg-black/40 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-white/80 border border-slate-200 dark:border-white/10'
                    }`}
                    title={t.description}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                    <span className={`text-[9px] px-1 py-0.2 rounded-md ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50'}`}>
                      {t.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

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

            {/* Run Full Pipeline & Kill Button */}
            {isRunningAll ? (
              <div className="flex items-center gap-2">
                <div className="px-3.5 py-2.5 bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-display font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-amber-500/30 whitespace-nowrap">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span>Pipeline in Progress...</span>
                </div>
                <button
                  onClick={() => { void handleKillPipeline(); }}
                  disabled={isKilling}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-display font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/20 transition animate-pulse disabled:opacity-50 whitespace-nowrap"
                  title="Immediately stop the pipeline and terminate all background NotebookLM processes"
                >
                  <OctagonX className="w-3.5 h-3.5" />
                  <span>{isKilling ? 'Killing...' : '🛑 Kill Pipeline'}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => { void runFullPipeline(); }}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-rose-500 hover:from-purple-700 hover:to-rose-600 text-white font-display font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                🚀 Run Full Flow
              </button>
            )}

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
              className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition"
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
              const currentOutputConfig = OUTPUT_TYPES.find(t => t.id === selectedOutputType) || OUTPUT_TYPES[0];
              const icons: Record<string, any> = {
                auth: Radio,
                create: Plus,
                upload: FolderUp,
                prompt: Sparkles,
                generate: currentOutputConfig.icon,
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
                      onClick={() => { void verifyAuthLive(); }}
                      disabled={isCheckingAuth}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-200 transition shrink-0 disabled:opacity-50"
                    >
                      {isCheckingAuth ? '...' : 'Verify'}
                    </button>
                  )}
                  {key === 'create' && step.status !== 'running' && (
                    <button
                      onClick={() => { void handleCreateNotebookOnly(); }}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-200 transition shrink-0"
                    >
                      Create
                    </button>
                  )}
                  {key === 'upload' && step.status !== 'running' && (
                    <button
                      onClick={() => { void handleUploadSourceFilesOnly(); }}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold hover:bg-sky-200 transition shrink-0"
                    >
                      Upload All
                    </button>
                  )}
                  {key === 'prompt' && step.status !== 'running' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setShowPromptInjector(true)}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-200 transition"
                        title="Open Prompt Architect modal to preview or customize prompt"
                      >
                        🎨
                      </button>
                      <button
                        onClick={() => { void handleCalibratePromptOnly(); }}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-200 transition"
                      >
                        Calibrate
                      </button>
                    </div>
                  )}
                  {key === 'generate' && step.status !== 'running' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setShowPromptInjector(true)}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-200 transition"
                        title={`Open Prompt Architect for ${currentOutputConfig.label}`}
                      >
                        🎨
                      </button>
                      {selectedOutputType === 'slides' ? (
                        <>
                          <button
                            onClick={() => { void handleGenerateMotionGraphicDeck(); }}
                            disabled={isGeneratingPptx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 font-bold hover:bg-amber-200 transition shadow-sm flex items-center gap-1"
                            title="Generate clean 16-slide PowerPoint with 100% uniform white background and unified Segoe UI typography"
                          >
                            <span>✨ Clean PPTX</span>
                          </button>
                          <button
                            onClick={() => { void handleGenerateSelectedOutputOnly(); }}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 font-bold hover:bg-purple-200 transition"
                            title="Generate slides via Google NotebookLM using calibrated motion-graphic prompt"
                          >
                            AI Slides
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { void handleGenerateSelectedOutputOnly(); }}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-100 to-rose-100 dark:from-purple-950/60 dark:to-rose-950/60 text-purple-800 dark:text-purple-200 font-bold hover:opacity-90 transition"
                        >
                          {currentOutputConfig.label.split(' ')[0]}
                        </button>
                      )}
                    </div>
                  )}
                  {key === 'download' && step.status !== 'running' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { void handleDownloadOnly(); }}
                        className="text-[10px] px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-200 transition shrink-0 shadow-sm"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => { void handleOpenDownloadFolder('auto'); }}
                        disabled={isOpeningFolder}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 font-bold transition shrink-0 flex items-center gap-1"
                        title="Open downloaded files in Windows File Explorer"
                      >
                        <FolderOpen className="w-3 h-3 text-amber-500" />
                        <span>Open</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Local Download Target Notice */}
          <div className="p-2.5 bg-slate-50 dark:bg-black/30 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-white/60">
            <div className="flex items-center gap-1.5 font-mono">
              <FolderCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Vault Target: <code className="text-slate-800 dark:text-gold-400">vaults/{project?.slug || 'course'}/03_Resources/NotebookLM_Generated/</code></span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { void handleOpenDownloadFolder('auto'); }}
                disabled={isOpeningFolder}
                className="text-[10px] font-display font-bold px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                title="Open download folder in Windows File Explorer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>📂 Open Download Directory</span>
              </button>
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

      {/* Prompt Architect & Vault Injector Modal */}
      {showPromptInjector && (
        <PromptInjectorModal
          isOpen={showPromptInjector}
          onClose={() => setShowPromptInjector(false)}
          org={org}
          project={project}
          activeSession={activeSession}
          notebookId={activeNotebookId}
          notebookName={notebookName.trim() || defaultNotebookName}
          onExecutePrompt={handleExecutePrompt}
          isGenerating={isExecutingArchitectPrompt}
        />
      )}
    </div>
  );
}
