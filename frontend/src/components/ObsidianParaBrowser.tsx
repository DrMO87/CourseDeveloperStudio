'use client';

import React, { useState, useEffect } from 'react';
import { Folder, FileText, RefreshCw, Share2, Sparkles, Maximize2, ListFilter } from 'lucide-react';
import { CourseProject, CourseSession, Organization } from '@/lib/types';
import ObsidianGraphView from './ObsidianGraphView';

interface Props {
  apiBaseUrl?: string;
  projectSlug?: string;
  orgSlug?: string;
  onOpenFile?: (fileName: string) => void;
  onOpenGraphModal?: () => void;
  onSyncVault?: () => void;
  org?: Organization | null;
  project?: CourseProject | null;
  sessions?: CourseSession[];
}

export default function ObsidianParaBrowser({
  apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000',
  projectSlug,
  orgSlug,
  onOpenFile,
  onOpenGraphModal,
  onSyncVault,
  org,
  project,
  sessions = []
}: Props) {
  const [viewMode, setViewMode] = useState<'LIST' | 'GRAPH'>('LIST');
  const [selectedFolder, setSelectedFolder] = useState<string>('01_Projects');
  const [files, setFiles] = useState<{ name: string; type: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadParaFiles() {
      setLoading(true);
      try {
        // First try local Next.js API route reading directly from disk
        const slugQuery = projectSlug ? `&projectSlug=${encodeURIComponent(projectSlug)}` : '';
        const localRes = await fetch(`/api/obsidian/files?category=${selectedFolder}${slugQuery}`);
        if (localRes.ok) {
          const data = await localRes.json();
          if (isMounted && data.success && Array.isArray(data.files) && data.files.length > 0) {
            setFiles(data.files.map((f: string) => ({
              name: f,
              type: f.endsWith('blueprint.md') ? 'Blueprint' :
                    f.endsWith('slides-source.md') ? 'Slides Source' :
                    f.endsWith('home-summary.md') ? 'Summary' :
                    f.endsWith('decisions.md') ? 'Decisions' :
                    f.includes('Brand') ? 'Brand Contract' :
                    f.includes('Mascot') ? 'Mascot Guide' :
                    f.includes('Specification') || f.includes('Spec') ? 'Course Spec' :
                    f.includes('Blueprint') ? 'Exam Blueprint' :
                    f.includes('Question_Bank') ? 'Question Bank' :
                    f.includes('Catalog') ? 'Hardware Catalog' : 'Markdown Note'
            })));
            setLoading(false);
            return;
          }
        }

        // Fallback to backend API if available
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${apiBaseUrl}/api/ObsidianSync/para-files?category=${selectedFolder}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const list: string[] = await res.json();
          if (isMounted && Array.isArray(list) && list.length > 0) {
            setFiles(list.map(f => ({
              name: f,
              type: f.endsWith('blueprint.md') ? 'Blueprint' :
                    f.endsWith('slides-source.md') ? 'Slides Source' :
                    f.endsWith('home-summary.md') ? 'Summary' :
                    f.endsWith('decisions.md') ? 'Decisions' :
                    f.includes('Branding') ? 'Brand Contract' :
                    f.includes('Mascot') ? 'Mascot Guide' :
                    f.includes('Catalog') ? 'Hardware Catalog' : 'Markdown Note'
            })));
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to default mock files
      }
      if (isMounted) {
        setFiles(getDefaultCategoryFiles(selectedFolder, projectSlug, orgSlug));
        setLoading(false);
      }
    }

    loadParaFiles();
    return () => { isMounted = false; };
  }, [selectedFolder, apiBaseUrl, projectSlug, orgSlug]);

  return (
    <div className="bg-white dark:bg-[#001530]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm dark:shadow-2xl backdrop-blur-xl transition-colors">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-amber-500 dark:text-gold-400">📓</span> Obsidian Second Brain (PARA Structure)
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Bidirectional Sync
          </span>
        </div>

        {/* View Mode Toggle & Fullscreen Graph Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/5 text-xs">
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-2.5 py-1 rounded-lg font-display font-bold transition flex items-center gap-1.5 ${
                viewMode === 'LIST'
                  ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
            <button
              onClick={() => setViewMode('GRAPH')}
              className={`px-2.5 py-1 rounded-lg font-display font-bold transition flex items-center gap-1.5 ${
                viewMode === 'GRAPH'
                  ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-sm'
                  : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Graph View</span>
            </button>
          </div>

          {onSyncVault && (
            <button
              onClick={onSyncVault}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 transition text-xs font-bold flex items-center gap-1"
              title="Synchronize all files to Obsidian Vault on disk"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Sync Disk</span>
            </button>
          )}

          {onOpenGraphModal && (
            <button
              onClick={onOpenGraphModal}
              className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-gold-400 hover:text-amber-700 transition"
              title="Open Fullscreen Interactive Graph Canvas"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {viewMode === 'LIST' ? (
        <>
          {/* PARA Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {(['01_Projects', '02_Areas', '03_Resources', '04_Archive'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedFolder(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 ${
                  selectedFolder === cat
                    ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-black/30 text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>{cat}</span>
              </button>
            ))}
          </div>

          {/* Note List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-6 text-xs text-slate-400 dark:text-white/40">Loading vault structure...</div>
            ) : files.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 dark:text-white/40 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                No notes generated in this PARA tier yet.
              </div>
            ) : (
              files.map((file, idx) => (
                <div
                  key={idx}
                  onClick={() => onOpenFile?.(`${selectedFolder}/${file.name}`)}
                  className="p-3 bg-slate-50 dark:bg-black/40 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs hover:border-amber-400/40 dark:hover:border-gold-400/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-gold-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="font-mono text-slate-800 dark:text-slate-200 truncate group-hover:text-amber-600 dark:group-hover:text-gold-300">
                      {file.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-display font-semibold text-slate-500 dark:text-white/40 px-2 py-0.5 bg-slate-200 dark:bg-white/5 rounded-lg shrink-0">
                    {file.type}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Inline Interactive Force-Directed Graph */
        <div className="space-y-2">
          <div className="h-[380px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10">
            <ObsidianGraphView
              org={org}
              project={project}
              sessions={sessions}
              onOpenNote={onOpenFile}
              height={380}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-white/40 px-1">
            <span>Drag nodes to simulate physics · Click any node to read note</span>
            {onOpenGraphModal && (
              <button
                onClick={onOpenGraphModal}
                className="text-amber-500 hover:text-amber-400 font-display font-bold flex items-center gap-1"
              >
                <span>Open Fullscreen Map</span>
                <Maximize2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultCategoryFiles(cat: string, projectSlug?: string, orgSlug?: string): { name: string; type: string }[] {
  const pSlug = projectSlug || 'Course_EV3_Studio';
  const oSlug = orgSlug || 'Horus_University';

  switch (cat) {
    case '01_Projects':
      return [
        { name: `${pSlug}/L1-s1/blueprint.md`, type: 'Blueprint' },
        { name: `${pSlug}/L1-s1/slides-source.md`, type: 'Slides Source' },
        { name: `${pSlug}/L1-s1/home-summary.md`, type: 'Summary' },
        { name: `${pSlug}/L1-s1/decisions.md`, type: 'Decisions' },
      ];
    case '02_Areas':
      return [
        { name: `${oSlug}/Branding_Rule.md`, type: 'Brand Contract' },
        { name: `${oSlug}/Mascot_Usage_Guide.md`, type: 'Mascot Guide' },
      ];
    case '03_Resources':
      return [
        { name: `Catalogs/Source_Material_Catalog.md`, type: 'Catalog' },
        { name: `Pedagogy/Bloom_Taxonomy_Rubric.md`, type: 'Rubric' },
      ];
    case '04_Archive':
      return [
        { name: `Legacy/Semester_Old_Slides.pptx`, type: 'Prior Slide Deck' },
      ];
    default:
      return [];
  }
}
