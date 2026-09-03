'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  CheckCircle2, 
  ArrowRight,
  FolderArchive,
  Save,
  AlertCircle
} from 'lucide-react';
import type { CourseProject, ProjectDossierFile } from '@/lib/types';
import { fetchProjects, fetchDossierFiles, updateDossierFile } from '@/lib/supabase';
import { WorkflowProgressBar } from '@/components/layout/WorkflowProgressBar';

function ValidateContent() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('projectId');

  const [project, setProject] = useState<CourseProject | null>(null);
  const [files, setFiles] = useState<ProjectDossierFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const projs = await fetchProjects();
        const proj = (queryProjectId ? projs.find(p => p.id === queryProjectId) : null) || (projs.length > 0 ? projs[0] : null);
        setProject(proj);

        if (proj) {
          const fetchedFiles = await fetchDossierFiles(proj.id);
          setFiles(fetchedFiles);
          if (fetchedFiles.length > 0) {
            setSelectedFileId(fetchedFiles[0].id);
            setEditContent(fetchedFiles[0].file_content_text || '');
          }
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

  const selectedFile = files.find(f => f.id === selectedFileId);

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

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex flex-col h-[calc(100vh-80px)]">
      <WorkflowProgressBar
        currentStep="DOSSIER"
        projectId={project.id}
        projectName={project.name}
        progressPercent={85}
      />

      {/* Header */}
      <div className="bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm dark:shadow-card backdrop-blur-md flex flex-col md:flex-row md:items-center md:justify-between gap-5 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
              Dossier Validation Hub
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
            Review and correct extracted text from your ingested files before proceeding to Studio Swarm.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/dossier?projectId=${project.id}`}
            className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white font-display font-bold rounded-xl text-xs transition"
          >
            Back to Dossier
          </Link>
          <Link
            href={`/?projectId=${project.id}`}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            <span>Proceed to Step 3: Studio Swarm</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Left Sidebar: File List */}
        <div className="w-full lg:w-80 flex flex-col gap-3 shrink-0">
          <div className="bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl p-4 shadow-sm flex flex-col h-full">
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-sky-500" />
              Ingested Files
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {files.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 dark:text-white/40">
                  No files ingested yet.
                </div>
              ) : (
                files.map(file => (
                  <button
                    key={file.id}
                    onClick={() => handleFileSelect(file)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors border ${
                      selectedFileId === file.id
                        ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300'
                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-white/70'
                    }`}
                  >
                    <div className="font-semibold truncate">{file.file_name}</div>
                    <div className="text-[10px] opacity-70 mt-0.5 truncate">{file.category}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Area: Editor */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm">
          {selectedFile ? (
            <>
              {/* Editor Header */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-black/20">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white truncate">
                      {selectedFile.file_name}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-white/50 truncate">
                      Reviewing raw extracted text content
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 pl-4 shrink-0">
                  {saveSuccess && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || editContent === selectedFile.file_content_text}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-display font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Editor Body */}
              <div className="flex-1 p-5 overflow-hidden flex flex-col">
                <textarea
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    setSaveSuccess(false);
                  }}
                  className="flex-1 w-full p-4 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-sky-500/50 resize-none custom-scrollbar shadow-inner"
                  placeholder="No content extracted for this file..."
                />
                
                <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-800 dark:text-amber-200/90 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    <strong>Why validate?</strong> The text above is what Studio Swarm will read. If OCR missed something from a PDF or formatting is severely broken, fixing it here ensures higher quality Question Banks and Swarm insights.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-white/40 p-8 text-center">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <h3 className="text-base font-display font-bold text-slate-700 dark:text-white/80 mb-2">
                No File Selected
              </h3>
              <p className="text-xs max-w-sm">
                Select a file from the sidebar to view and validate its extracted text content.
              </p>
            </div>
          )}
        </div>
      </div>
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
