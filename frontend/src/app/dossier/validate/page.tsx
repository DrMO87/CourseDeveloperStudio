'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  FolderArchive, 
  Save, 
  AlertCircle,
  Image as ImageIcon,
  Columns,
  Maximize2,
  X,
  Download,
  Copy,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  ZoomIn,
  BookOpen,
  ShieldCheck,
  Cpu,
  Layers,
  Check,
  Eye,
  Code,
  Folder,
  Sparkles,
  ChevronRight,
  ListFilter
} from 'lucide-react';
import type { CourseProject, CourseSession, Organization, ProjectDossierFile } from '@/lib/types';
import { fetchProjects, fetchOrganizations, fetchSessions, fetchDossierFiles, updateDossierFile } from '@/lib/supabase';
import { WorkflowProgressBar } from '@/components/layout/WorkflowProgressBar';
import { ObsidianFileViewerModal } from '@/components/ObsidianFileViewerModal';

interface ExtractedAsset {
  name: string;
  size: number;
  ext: string;
  url: string;
  modified: string;
}

interface VaultFileDetail {
  name: string;
  path: string;
  category: string;
  ext: string;
  type: string;
  sessionCode?: string;
  size?: number;
}

function ValidateContent() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('projectId');

  const [project, setProject] = useState<CourseProject | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [files, setFiles] = useState<ProjectDossierFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Editor state for Ingested Text
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Extracted Assets state
  const [assets, setAssets] = useState<ExtractedAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedAssetModal, setSelectedAssetModal] = useState<ExtractedAsset | null>(null);
  const [assetFilter, setAssetFilter] = useState<string>('ALL');
  const [assetSearch, setAssetSearch] = useState<string>('');

  // Primary View Switcher: SPLIT | TEXT | ASSETS | VAULT
  const [activeView, setActiveView] = useState<'SPLIT' | 'TEXT' | 'ASSETS' | 'VAULT'>('SPLIT');
  const [sidebarTab, setSidebarTab] = useState<'INGESTED' | 'VAULT'>('INGESTED');

  // Vault Review state
  const [vaultFiles, setVaultFiles] = useState<VaultFileDetail[]>([]);
  const [loadingVault, setLoadingVault] = useState(false);
  const [selectedVaultPath, setSelectedVaultPath] = useState<string | null>(null);
  const [vaultFileContent, setVaultFileContent] = useState<string>('');
  const [vaultEditContent, setVaultEditContent] = useState<string>('');
  const [loadingVaultContent, setLoadingVaultContent] = useState(false);
  const [vaultViewMode, setVaultViewMode] = useState<'RENDERED' | 'RAW'>('RENDERED');
  const [vaultSaving, setVaultSaving] = useState(false);
  const [vaultSaveSuccess, setVaultSaveSuccess] = useState(false);
  const [syncingVault, setSyncingVault] = useState(false);
  const [vaultCategory, setVaultCategory] = useState<string>('ALL');
  const [vaultTypeFilter, setVaultTypeFilter] = useState<string>('ALL');
  const [vaultSearch, setVaultSearch] = useState<string>('');
  const [modalVaultFile, setModalVaultFile] = useState<string | null>(null);

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAssets = async (projSlug?: string) => {
    setLoadingAssets(true);
    try {
      const slug = projSlug || project?.slug || project?.course_code || 'inst';
      const res = await fetch(`/api/dossier/assets?projectSlug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.assets)) {
        setAssets(data.assets);
      }
    } catch (err) {
      console.error('Failed to load extracted assets:', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  const loadVaultFiles = async (projSlug?: string) => {
    setLoadingVault(true);
    try {
      const slug = projSlug || project?.slug || project?.course_code || 'inst';
      const res = await fetch(`/api/obsidian/files?category=ALL&projectSlug=${encodeURIComponent(slug)}&onlyNotes=true`);
      const data = await res.json();
      if (data.success && Array.isArray(data.detailedFiles)) {
        setVaultFiles(data.detailedFiles);
        if (data.detailedFiles.length > 0 && !selectedVaultPath) {
          handleSelectVaultFile(data.detailedFiles[0].path, slug);
        }
      }
    } catch (err) {
      console.error('Failed to load vault files:', err);
    } finally {
      setLoadingVault(false);
    }
  };

  const handleSelectVaultFile = async (filePath: string, projSlug?: string) => {
    setSelectedVaultPath(filePath);
    setLoadingVaultContent(true);
    setVaultSaveSuccess(false);
    try {
      const slug = projSlug || project?.slug || project?.course_code || 'inst';
      const res = await fetch(`/api/obsidian/read?path=${encodeURIComponent(filePath)}&projectSlug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.success) {
        setVaultFileContent(data.content || '');
        setVaultEditContent(data.content || '');
      } else {
        setVaultFileContent('');
        setVaultEditContent('');
      }
    } catch (err) {
      console.error('Failed to read vault file:', err);
    } finally {
      setLoadingVaultContent(false);
    }
  };

  const handleSaveVaultFile = async () => {
    if (!selectedVaultPath) return;
    setVaultSaving(true);
    try {
      const slug = project?.slug || project?.course_code || 'inst';
      const res = await fetch('/api/obsidian/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedVaultPath,
          projectSlug: slug,
          content: vaultEditContent
        })
      });
      const data = await res.json();
      if (data.success) {
        setVaultFileContent(vaultEditContent);
        setVaultSaveSuccess(true);
        showToast(`💾 Note saved successfully to Obsidian vault on disk!`);
        setTimeout(() => setVaultSaveSuccess(false), 3000);
      } else {
        showToast(`❌ Failed to save: ${data.error}`);
      }
    } catch (err: any) {
      showToast(`❌ Error saving note: ${err.message}`);
    } finally {
      setVaultSaving(false);
    }
  };

  const handleSyncVault = async () => {
    if (!project) return;
    setSyncingVault(true);
    try {
      const sess = sessions.length > 0 ? sessions : await fetchSessions(project.id);
      const res = await fetch('/api/obsidian/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: organization || null,
          project,
          sessions: sess,
          activeSession: sess[0] || null,
          dossierFiles: files
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`⚡ Synchronized ${data.syncedCount || 0} vault files & templates to disk!`);
        await loadVaultFiles(project.slug || project.course_code);
      } else {
        showToast(`❌ Sync error: ${data.error || 'Failed'}`);
      }
    } catch (err: any) {
      showToast(`❌ Sync error: ${err.message}`);
    } finally {
      setSyncingVault(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const projs = await fetchProjects();
        const proj = (queryProjectId ? projs.find(p => p.id === queryProjectId) : null) || (projs.length > 0 ? projs[0] : null);
        setProject(proj);

        if (proj) {
          const orgs = await fetchOrganizations().catch(() => []);
          const activeOrg = orgs.find(o => o.id === proj.organization_id) || (orgs.length > 0 ? orgs[0] : null);
          setOrganization(activeOrg);

          const sessList = await fetchSessions(proj.id).catch(() => []);
          setSessions(sessList);

          const fetchedFiles = await fetchDossierFiles(proj.id);
          setFiles(fetchedFiles);
          if (fetchedFiles.length > 0) {
            setSelectedFileId(fetchedFiles[0].id);
            setEditContent(fetchedFiles[0].file_content_text || '');
          }
          await loadAssets(proj.slug || proj.course_code);
          await loadVaultFiles(proj.slug || proj.course_code);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [queryProjectId]);

  const handleFileSelect = (file: ProjectDossierFile) => {
    setSelectedFileId(file.id);
    setEditContent(file.file_content_text || '');
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!project || !selectedFileId) return;
    setSaving(true);
    try {
      const updated = await updateDossierFile(selectedFileId, project.id, {
        file_content_text: editContent
      });
      if (updated) {
        setFiles(prev => prev.map(f => f.id === selectedFileId ? updated : f));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyMarkdown = (assetName: string) => {
    const md = `![${assetName}](_assets/${assetName})`;
    navigator.clipboard.writeText(md);
    showToast(`📋 Copied embed: ${md}`);
  };

  const handleInsertIntoEditor = (assetName: string) => {
    const md = `\n\n![${assetName}](_assets/${assetName})\n`;
    if (activeView === 'VAULT') {
      setVaultEditContent(prev => prev + md);
      showToast(`✨ Inserted ![${assetName}] into vault note!`);
    } else {
      setEditContent(prev => prev + md);
      showToast(`✨ Inserted ![${assetName}] into document text!`);
    }
  };

  const selectedFile = files.find(f => f.id === selectedFileId);

  // Asset filtering
  const filteredAssets = assets.filter(a => {
    const matchesFilter = 
      assetFilter === 'ALL' ||
      (assetFilter === 'PNG' && a.ext === 'png') ||
      (assetFilter === 'JPEG' && (a.ext === 'jpg' || a.ext === 'jpeg')) ||
      (assetFilter === 'SVG' && a.ext === 'svg') ||
      (assetFilter === 'GIF' && a.ext === 'gif');
    
    const matchesSearch = assetSearch.trim() === '' || a.name.toLowerCase().includes(assetSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Vault file filtering
  const filteredVaultFiles = useMemo(() => {
    return vaultFiles.filter(f => {
      const matchesCat = vaultCategory === 'ALL' || f.category === vaultCategory;
      const matchesSearch = vaultSearch.trim() === '' || 
        f.name.toLowerCase().includes(vaultSearch.toLowerCase()) || 
        f.path.toLowerCase().includes(vaultSearch.toLowerCase()) ||
        f.type.toLowerCase().includes(vaultSearch.toLowerCase());
      
      let matchesType = true;
      if (vaultTypeFilter === 'BLUEPRINTS') matchesType = f.type === 'Session Blueprint';
      else if (vaultTypeFilter === 'SLIDES') matchesType = f.type === 'Slide Deck Source';
      else if (vaultTypeFilter === 'SUMMARIES') matchesType = f.type === 'Student Summary';
      else if (vaultTypeFilter === 'DECISIONS') matchesType = f.type === 'Swarm Decision Receipt';
      else if (vaultTypeFilter === 'CONTRACTS') matchesType = f.type === 'Brand Identity Contract' || f.type === 'Mascot Guide';
      else if (vaultTypeFilter === 'FRAMEWORKS') matchesType = f.type === 'Pedagogical Framework' || f.type === 'Assessment Rubric';

      return matchesCat && matchesSearch && matchesType;
    });
  }, [vaultFiles, vaultCategory, vaultSearch, vaultTypeFilter]);

  // Audit Metrics computation
  const auditMetrics = useMemo(() => {
    const blueprints = vaultFiles.filter(f => f.type === 'Session Blueprint').length;
    const slides = vaultFiles.filter(f => f.type === 'Slide Deck Source').length;
    const summaries = vaultFiles.filter(f => f.type === 'Student Summary').length;
    const decisions = vaultFiles.filter(f => f.type === 'Swarm Decision Receipt').length;
    const contracts = vaultFiles.filter(f => f.type === 'Brand Identity Contract').length;
    const frameworks = vaultFiles.filter(f => f.type === 'Pedagogical Framework' || f.type === 'Assessment Rubric').length;
    const totalNotes = vaultFiles.length;

    return {
      blueprints,
      slides,
      summaries,
      decisions,
      contracts,
      frameworks,
      totalNotes,
      readyForStep5: blueprints > 0 && slides > 0 && contracts > 0
    };
  }, [vaultFiles]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-white/50 animate-pulse">Loading validation hub...</div>;
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl text-white">Project not found.</h2>
        <Link href="/projects" className="text-sky-400 hover:underline mt-4 inline-block">Return to Projects</Link>
      </div>
    );
  }

  const selectedVaultFileObj = vaultFiles.find(f => f.path === selectedVaultPath);

  return (
    <div className="max-w-[1700px] mx-auto px-3 sm:px-5 lg:px-7 py-4 space-y-4 flex flex-col min-h-[calc(100vh-80px)] pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-8 z-50 bg-slate-900 dark:bg-sky-950 text-white font-display font-bold text-xs px-4 py-3 rounded-2xl shadow-2xl border border-sky-500/40 flex items-center gap-2 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Workflow Progress Bar */}
      <WorkflowProgressBar
        currentStep="VALIDATE"
        projectId={project.id}
        projectName={project.name}
        progressPercent={85}
      />

      {/* 2. Top Header & Workspace Mode Switcher */}
      <div className="bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl p-5 shadow-sm dark:shadow-card backdrop-blur-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
              Step 3: Dossier &amp; Obsidian Vault Content Validator
            </h1>
            <span className="text-[10px] uppercase font-display font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Verified Ground-Truth
            </span>
            <span className="text-[10px] uppercase font-display font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-gold-400 border border-amber-500/20">
              PARA Vault: {auditMetrics.totalNotes} Notes
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
            Audit extracted syllabus text, review extracted diagrams &amp; inspect all Obsidian Vault templates and AI agent-generated notes before proceeding through Step 4 to Step 5.
          </p>
        </div>

        {/* View Mode Switcher and Navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented View Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl">
            <button
              onClick={() => setActiveView('SPLIT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 ${
                activeView === 'SPLIT'
                  ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="View text editor and extracted media gallery side by side"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>

            <button
              onClick={() => setActiveView('TEXT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 ${
                activeView === 'TEXT'
                  ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Maximize Extracted Text Editor"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Text Only</span>
            </button>

            <button
              onClick={() => setActiveView('ASSETS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 ${
                activeView === 'ASSETS'
                  ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Maximize Extracted Visual Assets Gallery"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Assets ({assets.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveView('VAULT');
                setSidebarTab('VAULT');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 ${
                activeView === 'VAULT'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md'
                  : 'text-amber-700 dark:text-gold-400 hover:bg-amber-500/10'
              }`}
              title="View all Obsidian Vault notes, templates, blueprints, and agent files"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>📓 Obsidian Vault ({auditMetrics.totalNotes})</span>
            </button>
          </div>

          <Link
            href={`/dossier?projectId=${project.id}`}
            className="px-3 py-1.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white font-display font-bold rounded-xl text-xs transition"
          >
            &larr; Step 2: Dossier
          </Link>
          <Link
            href={`/matrix?projectId=${project.id}&returnTo=/dossier/validate`}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            <span>Proceed to Step 4: LLM Matrix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 3. AI Agent Generation & Template Audit Status Strip */}
      <div className="bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-display font-extrabold uppercase tracking-wider text-slate-700 dark:text-white">
              AI Agent Template &amp; Vault Verification Audit
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
              Disk Target: vaults/{project.slug || 'inst'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncVault}
              disabled={syncingVault}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-gold-400 font-display font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              title="Synchronize and re-generate all PARA structure and templates on disk"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingVault ? 'animate-spin' : ''}`} />
              <span>{syncingVault ? 'Syncing Vault...' : '⚡ Re-Sync Vault to Disk'}</span>
            </button>

            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white text-xs font-bold transition flex items-center gap-1"
              title="Jump ahead to Step 5: Studio Swarm"
            >
              <Layers className="w-3 h-3 text-sky-500" />
              <span>Jump to Step 5 (Studio Swarm) &rarr;</span>
            </Link>
          </div>
        </div>

        {/* Audit Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {/* Card 1: Blueprints */}
          <div 
            onClick={() => {
              setActiveView('VAULT');
              setVaultTypeFilter('BLUEPRINTS');
            }}
            className="p-2.5 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 hover:border-amber-400/50 cursor-pointer transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
              <span>Blueprints</span>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-display font-extrabold text-slate-900 dark:text-white">
                {auditMetrics.blueprints} files
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">100% ILOs</span>
            </div>
          </div>

          {/* Card 2: Slide Decks */}
          <div 
            onClick={() => {
              setActiveView('VAULT');
              setVaultTypeFilter('SLIDES');
            }}
            className="p-2.5 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 hover:border-amber-400/50 cursor-pointer transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
              <span>Slide Decks</span>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-display font-extrabold text-slate-900 dark:text-white">
                {auditMetrics.slides} decks
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">16-Slide</span>
            </div>
          </div>

          {/* Card 3: Student Summaries */}
          <div 
            onClick={() => {
              setActiveView('VAULT');
              setVaultTypeFilter('SUMMARIES');
            }}
            className="p-2.5 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 hover:border-amber-400/50 cursor-pointer transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
              <span>Summaries</span>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-display font-extrabold text-slate-900 dark:text-white">
                {auditMetrics.summaries} files
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Formulas</span>
            </div>
          </div>

          {/* Card 4: Swarm Decisions */}
          <div 
            onClick={() => {
              setActiveView('VAULT');
              setVaultTypeFilter('DECISIONS');
            }}
            className="p-2.5 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 hover:border-amber-400/50 cursor-pointer transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
              <span>QA Receipts</span>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-display font-extrabold text-slate-900 dark:text-white">
                {auditMetrics.decisions} verified
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">4 Gates</span>
            </div>
          </div>

          {/* Card 5: Brand Contract */}
          <div 
            onClick={() => {
              setActiveView('VAULT');
              setVaultTypeFilter('CONTRACTS');
            }}
            className="p-2.5 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 hover:border-amber-400/50 cursor-pointer transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
              <span>Brand Contract</span>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-display font-extrabold text-slate-900 dark:text-white">
                {auditMetrics.contracts > 0 ? 'Active' : 'Pending'}
              </span>
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">#002147</span>
            </div>
          </div>

          {/* Card 6: Pedagogical Frameworks */}
          <div 
            onClick={() => {
              setActiveView('VAULT');
              setVaultTypeFilter('FRAMEWORKS');
            }}
            className="p-2.5 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 hover:border-amber-400/50 cursor-pointer transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
              <span>Pedagogy &amp; MCQ</span>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-display font-extrabold text-slate-900 dark:text-white">
                {auditMetrics.frameworks} rubrics
              </span>
              <span className="text-[10px] text-amber-600 dark:text-gold-400 font-bold">Bloom/Miller</span>
            </div>
          </div>

          {/* Card 7: Total Vault Readiness */}
          <div 
            onClick={() => {
              setActiveView('VAULT');
              setVaultTypeFilter('ALL');
              setVaultCategory('ALL');
            }}
            className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border border-amber-500/30 cursor-pointer transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-gold-400 font-bold">
              <span>Step 5 Ready</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-display font-extrabold text-slate-900 dark:text-white">
                {auditMetrics.totalNotes} Notes
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold">READY</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Main Workspace Container */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch min-h-0">
        
        {/* Left Sidebar: Dual Ingested Documents & Vault Notes Explorer */}
        <div className="w-full lg:w-80 flex flex-col shrink-0 lg:sticky lg:top-4">
          <div className="bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl p-4 shadow-sm flex flex-col lg:h-[calc(100vh-250px)] min-h-[380px]">
            
            {/* Sidebar Tab Switcher */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl mb-3 shrink-0">
              <button
                onClick={() => setSidebarTab('INGESTED')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'INGESTED'
                    ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FolderArchive className="w-3.5 h-3.5" />
                <span>Ingested ({files.length})</span>
              </button>

              <button
                onClick={() => setSidebarTab('VAULT')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'VAULT'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm'
                    : 'text-amber-700 dark:text-gold-400 hover:text-amber-900 dark:hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Vault ({auditMetrics.totalNotes})</span>
              </button>
            </div>

            {/* TAB 1: Ingested Documents List */}
            {sidebarTab === 'INGESTED' ? (
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar min-h-[180px]">
                {files.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 dark:text-white/40">
                    No files ingested yet. Return to Dossier to upload.
                  </div>
                ) : (
                  files.map(file => (
                    <button
                      key={file.id}
                      onClick={() => {
                        handleFileSelect(file);
                        if (activeView === 'VAULT') setActiveView('SPLIT');
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-2xl text-xs transition-all border ${
                        selectedFileId === file.id && activeView !== 'VAULT'
                          ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-300 dark:border-sky-500/40 text-sky-900 dark:text-sky-200 shadow-sm'
                          : 'bg-slate-50/50 dark:bg-black/20 border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 text-slate-700 dark:text-white/70'
                      }`}
                    >
                      <div className="font-semibold truncate">{file.file_name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200/60 dark:bg-white/10 text-slate-600 dark:text-white/60 font-mono">
                          {file.category}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-white/40">
                          {file.file_content_text ? `${file.file_content_text.length.toLocaleString()} chars` : '0 chars'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              /* TAB 2: Obsidian Vault Notes Tree */
              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                {/* Search in sidebar */}
                <div className="relative shrink-0">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search vault notes..."
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Vault Notes Scrollable List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar min-h-[180px]">
                  {loadingVault ? (
                    <div className="text-center py-6 text-xs text-slate-400 dark:text-white/40 animate-pulse">
                      Loading vault notes...
                    </div>
                  ) : filteredVaultFiles.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 dark:text-white/40">
                      No vault notes match filter.
                    </div>
                  ) : (
                    filteredVaultFiles.map(vf => (
                      <button
                        key={vf.path}
                        onClick={() => {
                          handleSelectVaultFile(vf.path);
                          setActiveView('VAULT');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-2xl text-xs transition-all border ${
                          selectedVaultPath === vf.path && activeView === 'VAULT'
                            ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-400 dark:border-amber-500/40 text-amber-900 dark:text-gold-300 shadow-sm'
                            : 'bg-slate-50/50 dark:bg-black/20 border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 text-slate-700 dark:text-white/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold truncate">{vf.name}</span>
                          {vf.sessionCode && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-gold-400 font-mono">
                              {vf.sessionCode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 dark:text-white/40">
                          <span className="truncate">{vf.type}</span>
                          <span className="font-mono text-[9px] opacity-75">{vf.category}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Quick Status in Sidebar Footer */}
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 dark:text-white/50 text-[11px] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                Vault Synced:
              </span>
              <span className="font-display font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
                {auditMetrics.totalNotes} files on disk
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right Area: Displays either Ingested Text/Assets OR Full Vault Review Hub */}
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* ======================================================== */}
          {/* VIEW MODE: VAULT REVIEW & TEMPLATE INSPECTOR              */}
          {/* ======================================================== */}
          {activeView === 'VAULT' ? (
            <div className="flex flex-col bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm lg:h-[calc(100vh-250px)] min-h-[520px]">
              
              {/* Vault Toolbar */}
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-black/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-gold-400 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-display font-extrabold text-slate-900 dark:text-white truncate">
                        {selectedVaultFileObj?.name || selectedVaultPath || 'Obsidian Vault Document'}
                      </h3>
                      {selectedVaultFileObj && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-gold-400 border border-amber-500/20">
                          {selectedVaultFileObj.type}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-white/50 truncate">
                      {selectedVaultPath || 'Select a note from the left or categories below'}
                    </p>
                  </div>
                </div>

                {/* View/Edit Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Rendered vs Raw Toggle */}
                  <div className="flex items-center p-1 bg-white dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/10 text-xs">
                    <button
                      onClick={() => setVaultViewMode('RENDERED')}
                      className={`px-2.5 py-1 rounded-lg font-display font-bold transition flex items-center gap-1.5 ${
                        vaultViewMode === 'RENDERED'
                          ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-sm'
                          : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Rendered</span>
                    </button>
                    <button
                      onClick={() => setVaultViewMode('RAW')}
                      className={`px-2.5 py-1 rounded-lg font-display font-bold transition flex items-center gap-1.5 ${
                        vaultViewMode === 'RAW'
                          ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-sm'
                          : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Edit Source</span>
                    </button>
                  </div>

                  {/* Save Note Button */}
                  {vaultSaveSuccess && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved to Disk
                    </span>
                  )}
                  <button
                    onClick={handleSaveVaultFile}
                    disabled={vaultSaving || vaultEditContent === vaultFileContent}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-display font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{vaultSaving ? 'Saving...' : 'Save Note'}</span>
                  </button>

                  {/* Open in Fullscreen Modal */}
                  {selectedVaultPath && (
                    <button
                      onClick={() => setModalVaultFile(selectedVaultPath)}
                      className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white transition"
                      title="Open in Fullscreen Reader Modal"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="px-5 py-2 border-b border-slate-200/70 dark:border-white/5 flex items-center gap-1.5 overflow-x-auto bg-slate-50/40 dark:bg-black/10 text-xs shrink-0">
                <span className="text-[11px] font-bold text-slate-500 dark:text-white/50 mr-1 flex items-center gap-1">
                  <ListFilter className="w-3 h-3" /> Tier:
                </span>
                {[
                  { id: 'ALL', label: 'All Categories' },
                  { id: '01_Projects', label: '01_Projects (Blueprints & Slides)' },
                  { id: '02_Areas', label: '02_Areas (Brand Contracts)' },
                  { id: '03_Resources', label: '03_Resources (Pedagogy & Rubrics)' },
                  { id: '04_Archive', label: '04_Archive' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setVaultCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-semibold transition whitespace-nowrap ${
                      vaultCategory === cat.id
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'text-slate-600 dark:text-white/60 hover:bg-slate-200/50 dark:hover:bg-white/5'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Vault File Viewer / Editor Body */}
              <div className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
                {loadingVaultContent ? (
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-white/40 text-xs animate-pulse">
                    Reading note from Obsidian vault...
                  </div>
                ) : !selectedVaultPath ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-white/40 p-8 text-center">
                    <BookOpen className="w-12 h-12 mb-3 opacity-30 text-amber-500" />
                    <h4 className="text-sm font-display font-bold text-slate-700 dark:text-white/80 mb-1">
                      Select an Obsidian Note to Review
                    </h4>
                    <p className="text-xs max-w-sm">
                      Choose any session blueprint, slide deck outline, brand contract, or pedagogical framework from the left sidebar to audit its contents.
                    </p>
                  </div>
                ) : vaultViewMode === 'RAW' ? (
                  /* RAW EDITOR */
                  <div className="flex-1 flex flex-col min-h-0">
                    <textarea
                      value={vaultEditContent}
                      onChange={(e) => {
                        setVaultEditContent(e.target.value);
                        setVaultSaveSuccess(false);
                      }}
                      className="flex-1 w-full p-4 bg-slate-50/70 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 resize-none overflow-y-auto custom-scrollbar leading-relaxed"
                      placeholder="Note content..."
                    />
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-white/40">
                      <span>{vaultEditContent.length.toLocaleString()} characters &bull; Markdown source</span>
                      <span>Target: {selectedVaultPath}</span>
                    </div>
                  </div>
                ) : (
                  /* RENDERED PREVIEW */
                  <div className="flex-1 p-6 bg-slate-50/50 dark:bg-black/30 border border-slate-200/70 dark:border-white/10 rounded-2xl overflow-y-auto custom-scrollbar text-slate-800 dark:text-slate-200 text-xs leading-relaxed space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2 mb-4">
                      <span className="font-mono text-[11px] text-amber-600 dark:text-gold-400 font-bold">
                        {selectedVaultPath}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(vaultEditContent);
                            showToast('📋 Copied markdown note to clipboard!');
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-white/10 hover:bg-slate-300 text-slate-700 dark:text-white text-[10px] font-semibold flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>

                    {/* Simple Markdown Parser / Visual Presentation */}
                    <div className="prose dark:prose-invert max-w-none text-xs space-y-2">
                      {vaultEditContent.split('\n\n').map((block, idx) => {
                        const trimmed = block.trim();
                        if (!trimmed) return null;

                        // YAML Frontmatter block
                        if (trimmed.startsWith('---')) {
                          return (
                            <div key={idx} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 font-mono text-[11px] text-slate-600 dark:text-white/70 whitespace-pre-wrap">
                              {trimmed}
                            </div>
                          );
                        }

                        // Heading 1
                        if (trimmed.startsWith('# ')) {
                          return (
                            <h2 key={idx} className="text-base font-display font-extrabold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-1 mt-3">
                              {trimmed.replace(/^#\s+/, '')}
                            </h2>
                          );
                        }

                        // Heading 2
                        if (trimmed.startsWith('## ')) {
                          return (
                            <h3 key={idx} className="text-sm font-display font-bold text-amber-600 dark:text-gold-400 mt-2">
                              {trimmed.replace(/^##\s+/, '')}
                            </h3>
                          );
                        }

                        // Heading 3
                        if (trimmed.startsWith('### ')) {
                          return (
                            <h4 key={idx} className="text-xs font-display font-bold text-slate-800 dark:text-slate-200 mt-1">
                              {trimmed.replace(/^###\s+/, '')}
                            </h4>
                          );
                        }

                        // Bullet list
                        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                          return (
                            <ul key={idx} className="list-disc pl-5 space-y-1">
                              {trimmed.split('\n').map((line, lIdx) => (
                                <li key={lIdx} className="text-slate-700 dark:text-slate-300">
                                  {line.replace(/^[-*]\s+/, '')}
                                </li>
                              ))}
                            </ul>
                          );
                        }

                        // Numbered list
                        if (/^\d+\.\s+/.test(trimmed)) {
                          return (
                            <ol key={idx} className="list-decimal pl-5 space-y-1">
                              {trimmed.split('\n').map((line, lIdx) => (
                                <li key={lIdx} className="text-slate-700 dark:text-slate-300">
                                  {line.replace(/^\d+\.\s+/, '')}
                                </li>
                              ))}
                            </ol>
                          );
                        }

                        // Code block / formula block
                        if (trimmed.startsWith('```') || trimmed.startsWith('$$')) {
                          return (
                            <pre key={idx} className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-700">
                              {trimmed.replace(/^```[a-z]*\n?|^```$|^\$\$$/gm, '')}
                            </pre>
                          );
                        }

                        // Standard paragraph with inline styling
                        return (
                          <p key={idx} className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            {trimmed}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* VIEW MODE: SPLIT / TEXT / ASSETS (Ingested Files & Media) */
            /* ======================================================== */
            <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch min-h-0">
              
              {/* Panel 1: Extracted Text Editor */}
              {(activeView === 'SPLIT' || activeView === 'TEXT') && (
                <div className={`flex flex-col bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm lg:h-[calc(100vh-250px)] min-h-[480px] ${
                  activeView === 'SPLIT' ? 'flex-1 min-w-[320px]' : 'w-full flex-1'
                }`}>
                  {selectedFile ? (
                    <>
                      {/* Editor Header */}
                      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-black/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                          <div className="min-w-0">
                            <h3 className="text-xs font-display font-bold text-slate-900 dark:text-white truncate">
                              {selectedFile.file_name}
                            </h3>
                            <p className="text-[10px] text-slate-500 dark:text-white/50 truncate">
                              Extracted text ground-truth ({editContent.length.toLocaleString()} characters)
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pl-4 shrink-0">
                          {saveSuccess && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                            </span>
                          )}
                          <button
                            onClick={handleSave}
                            disabled={saving || editContent === selectedFile.file_content_text}
                            className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-display font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? 'Saving...' : 'Save Text'}
                          </button>
                        </div>
                      </div>

                      {/* Editor Body */}
                      <div className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
                        <textarea
                          value={editContent}
                          onChange={(e) => {
                            setEditContent(e.target.value);
                            setSaveSuccess(false);
                          }}
                          className="flex-1 w-full p-4 bg-slate-50/70 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-sky-500/50 resize-y overflow-y-auto custom-scrollbar leading-relaxed min-h-[260px]"
                          placeholder="No text content extracted for this file..."
                        />
                        
                        <div className="mt-3 flex items-start gap-2 p-2.5 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-500/20 rounded-xl text-sky-800 dark:text-sky-200/90 text-[11px] shrink-0">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-500" />
                          <p>
                            <strong>Ground-Truth Ingest:</strong> This text directly seeds the Obsidian Vault and provides the deterministic boundaries for <strong>SYLLABUS_ARCHITECT</strong>. Insert diagrams from the visual assets panel on the right using the <strong>Insert</strong> button.
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-white/40 p-8 text-center">
                      <FileText className="w-10 h-10 mb-3 opacity-40" />
                      <h3 className="text-sm font-display font-bold text-slate-700 dark:text-white/80 mb-1">
                        No Document Selected
                      </h3>
                      <p className="text-xs max-w-sm">
                        Select a document from the left sidebar to inspect and edit its extracted text.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Panel 2: Extracted Visual Assets Gallery */}
              {(activeView === 'SPLIT' || activeView === 'ASSETS') && (
                <div className={`flex flex-col bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm lg:h-[calc(100vh-250px)] min-h-[480px] ${
                  activeView === 'SPLIT' ? 'flex-1 min-w-[340px]' : 'w-full flex-1'
                }`}>
                  {/* Assets Header */}
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 bg-slate-50/70 dark:bg-black/30">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-display font-extrabold text-slate-900 dark:text-white">
                            Extracted Visual Assets &amp; Figures
                          </h3>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/70">
                            {filteredAssets.length} / {assets.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-white/50">
                          Diagrams, molecular structures, and graphs parsed from slides
                        </p>
                      </div>
                    </div>

                    {/* Search & Refresh */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search assets..."
                          value={assetSearch}
                          onChange={(e) => setAssetSearch(e.target.value)}
                          className="pl-8 pr-3 py-1 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 w-32 sm:w-36"
                        />
                      </div>
                      <button
                        onClick={() => loadAssets(project.slug || project.course_code)}
                        disabled={loadingAssets}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-600 dark:text-white/70 transition"
                        title="Refresh extracted assets on disk"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingAssets ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Format Filter Bar */}
                  <div className="px-5 py-2 border-b border-slate-200/70 dark:border-white/5 flex items-center gap-1.5 overflow-x-auto bg-slate-50/40 dark:bg-black/10 text-xs shrink-0">
                    {['ALL', 'PNG', 'JPEG', 'SVG', 'GIF'].map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setAssetFilter(fmt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-semibold transition ${
                          assetFilter === fmt
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                            : 'text-slate-600 dark:text-white/60 hover:bg-slate-200/50 dark:hover:bg-white/5'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>

                  {/* Assets Gallery Grid */}
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                    {loadingAssets ? (
                      <div className="h-full flex items-center justify-center text-slate-400 dark:text-white/40 text-xs animate-pulse">
                        Scanning project Dossier/_assets on disk...
                      </div>
                    ) : filteredAssets.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-white/40">
                        <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
                        <h4 className="text-sm font-display font-bold text-slate-700 dark:text-white/80 mb-1">
                          No Extracted Assets Found
                        </h4>
                        <p className="text-xs max-w-xs mb-3">
                          Visual media and diagrams are automatically extracted when presentation (.pptx) or Word (.docx) files are ingested into the course dossier.
                        </p>
                        <button
                          onClick={() => loadAssets(project.slug || project.course_code)}
                          className="px-3.5 py-1.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Re-Scan Dossier Directory</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-3.5">
                        {filteredAssets.map(asset => (
                          <div
                            key={asset.name}
                            className="group relative flex flex-col bg-slate-50/80 dark:bg-black/40 border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden hover:border-amber-500/50 dark:hover:border-gold-400/50 transition-all shadow-sm hover:shadow-md"
                          >
                            {/* Image Thumbnail */}
                            <div 
                              onClick={() => setSelectedAssetModal(asset)}
                              className="relative aspect-video w-full bg-white dark:bg-black/60 flex items-center justify-center overflow-hidden cursor-pointer p-2 select-none"
                            >
                              <img
                                src={asset.url}
                                alt={asset.name}
                                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <span className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition">
                                  <ZoomIn className="w-4 h-4" />
                                </span>
                              </div>
                            </div>

                            {/* Card Info & Action Buttons */}
                            <div className="p-2.5 flex flex-col gap-1.5 bg-white dark:bg-[#001838]">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-white/90 truncate" title={asset.name}>
                                  {asset.name}
                                </span>
                                <span className="uppercase text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50">
                                  {asset.ext}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-white/40">
                                <span>{Math.round(asset.size / 1024)} KB</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleInsertIntoEditor(asset.name)}
                                    className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-gold-400 font-display font-bold text-[10px] transition flex items-center gap-0.5"
                                    title="Insert Markdown link directly into editor"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Insert</span>
                                  </button>
                                  <button
                                    onClick={() => handleCopyMarkdown(asset.name)}
                                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                                    title="Copy Markdown embed snippet"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Workflow Transition Guidance Card */}
      <div className="bg-gradient-to-r from-sky-500/10 via-amber-500/10 to-emerald-500/10 border border-slate-200 dark:border-white/10 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Curriculum Engineering Pipeline Next Step
          </h4>
          <p className="text-xs text-slate-600 dark:text-white/70 max-w-3xl">
            You are in <strong>Step 3: Validate Content</strong>. You have reviewed both the raw ingested documents and the <strong>Obsidian Vault PARA structure</strong> generated by the AI agents. Proceed to <strong>Step 4: LLM Model Matrix</strong> to assign and mount local LM Studio / Cloud models, then unleash autonomous synthesis in <strong>Step 5: Studio Swarm</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/dossier?projectId=${project.id}`}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white font-display font-bold text-xs transition"
          >
            &larr; Re-visit Step 2: Dossier
          </Link>
          <Link
            href={`/matrix?projectId=${project.id}&returnTo=/dossier/validate`}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 font-display font-extrabold text-xs shadow-md transition flex items-center gap-1.5"
          >
            <span>Proceed to Step 4: LLM Matrix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 6. Fullscreen Asset Image Modal Viewer */}
      {selectedAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/15 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-black/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-gold-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                    {selectedAssetModal.name}
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-white/50">
                    {Math.round(selectedAssetModal.size / 1024)} KB &bull; Extracted into Dossier/_assets
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleInsertIntoEditor(selectedAssetModal.name)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-display font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Insert into Text</span>
                </button>
                <a
                  href={selectedAssetModal.url}
                  download={selectedAssetModal.name}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-600 dark:text-white transition"
                  title="Download image"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setSelectedAssetModal(null)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image View */}
            <div className="flex-1 p-6 bg-slate-900 flex items-center justify-center overflow-auto min-h-[300px]">
              <img
                src={selectedAssetModal.url}
                alt={selectedAssetModal.name}
                className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 flex items-center justify-between text-xs text-slate-500 dark:text-white/50">
              <span className="font-mono text-[11px]">
                Markdown embed code: <code className="bg-slate-200 dark:bg-white/10 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200">![{selectedAssetModal.name}](_assets/{selectedAssetModal.name})</code>
              </span>
              <button
                onClick={() => handleCopyMarkdown(selectedAssetModal.name)}
                className="px-2.5 py-1 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-lg font-semibold flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Code</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Fullscreen Obsidian Note Viewer Modal */}
      {modalVaultFile && (
        <ObsidianFileViewerModal
          fileName={modalVaultFile}
          isOpen={!!modalVaultFile}
          onClose={() => setModalVaultFile(null)}
          project={project}
          org={organization}
        />
      )}
    </div>
  );
}

export default function ValidatePage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-white/50 animate-pulse">Loading validation workspace...</div>}>
      <ValidateContent />
    </Suspense>
  );
}
