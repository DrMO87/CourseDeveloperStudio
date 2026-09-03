'use client';

import React from 'react';
import { X, Sparkles, Folder, Layers, BookOpen, ExternalLink, RefreshCw } from 'lucide-react';
import { CourseProject, CourseSession, Organization, ProjectDossierFile } from '@/lib/types';
import ObsidianGraphView from './ObsidianGraphView';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  org?: Organization | null;
  project?: CourseProject | null;
  sessions?: CourseSession[];
  dossierFiles?: ProjectDossierFile[];
  onOpenNote?: (filePath: string) => void;
}

export function ObsidianGraphViewModal({
  isOpen,
  onClose,
  org,
  project,
  sessions,
  dossierFiles,
  onOpenNote
}: Props) {
  if (!isOpen) return null;

  const orgName = org?.name || 'Horus University — Egypt';
  const courseName = project?.name || 'Instrumental Analysis';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#070d18] border border-slate-700/60 dark:border-white/10 rounded-3xl w-full max-w-7xl h-[92vh] shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#001530]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-display font-bold text-white tracking-wide">
                  Obsidian Knowledge Graph View
                </h3>
                <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Force-Directed Physics
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {orgName} · <span className="text-amber-400 font-medium">{courseName}</span> · Second Brain Network
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400 pr-3 border-r border-white/10">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" /> 01_Projects
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" /> 02_Areas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> 03_Resources
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" /> 04_Archive
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition border border-white/10"
              title="Close Graph View"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Full Modal Graph Content Area */}
        <div className="flex-1 w-full h-full relative overflow-hidden">
          <ObsidianGraphView
            org={org}
            project={project}
            sessions={sessions}
            dossierFiles={dossierFiles}
            onOpenNote={onOpenNote}
            isModal={true}
          />
        </div>
      </div>
    </div>
  );
}
export default ObsidianGraphViewModal;
