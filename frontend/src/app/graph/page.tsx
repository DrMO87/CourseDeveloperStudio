'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Layers, BookOpen, Building2, RefreshCw, FolderArchive, ArrowLeft } from 'lucide-react';
import { CourseProject, CourseSession, Organization, ProjectDossierFile } from '@/lib/types';
import { fetchOrganizations, fetchProjects, fetchSessions, fetchDossierFiles } from '@/lib/supabase';
import ObsidianGraphView from '@/components/ObsidianGraphView';
import { ObsidianFileViewerModal } from '@/components/ObsidianFileViewerModal';
import { useTheme } from '@/components/ThemeProvider';

function GraphPageContent() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('projectId');
  const { setActiveOrg } = useTheme();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<CourseProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<CourseProject | null>(null);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [dossierFiles, setDossierFiles] = useState<ProjectDossierFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewingNote, setPreviewingNote] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const orgs = await fetchOrganizations();
        const safeOrgs = Array.isArray(orgs) ? orgs : [];
        setOrganizations(safeOrgs);

        const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('cds_active_org_id') : null;
        const defaultOrg = (savedOrgId ? safeOrgs.find(o => o.id === savedOrgId) : null) || safeOrgs[0] || null;
        setSelectedOrg(defaultOrg);
        if (defaultOrg) setActiveOrg(defaultOrg);

        const projs = await fetchProjects(defaultOrg ? defaultOrg.id : undefined);
        const safeProjs = Array.isArray(projs) ? projs : [];
        setProjects(safeProjs);

        const activeProj = (queryProjectId ? safeProjs.find(p => p.id === queryProjectId) : null) || safeProjs[0] || null;
        setSelectedProject(activeProj);

        if (activeProj) {
          const sessList = await fetchSessions(activeProj.id);
          setSessions(Array.isArray(sessList) ? sessList : []);
          const dFiles = await fetchDossierFiles(activeProj.id);
          setDossierFiles(Array.isArray(dFiles) ? dFiles : []);
        }
      } catch (err) {
        console.error('Error loading graph workspace data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [queryProjectId, setActiveOrg]);

  const handleOrgChange = async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId) || null;
    setSelectedOrg(org);
    if (org) {
      setActiveOrg(org);
      if (typeof window !== 'undefined') localStorage.setItem('cds_active_org_id', org.id);
      const projs = await fetchProjects(org.id);
      setProjects(projs);
      const activeProj = projs[0] || null;
      setSelectedProject(activeProj);
      if (activeProj) {
        const sessList = await fetchSessions(activeProj.id);
        setSessions(sessList);
        const dFiles = await fetchDossierFiles(activeProj.id);
        setDossierFiles(dFiles);
      } else {
        setSessions([]);
        setDossierFiles([]);
      }
    }
  };

  const handleProjectChange = async (projId: string) => {
    const proj = projects.find(p => p.id === projId) || null;
    setSelectedProject(proj);
    if (proj) {
      const sessList = await fetchSessions(proj.id);
      setSessions(sessList);
      const dFiles = await fetchDossierFiles(proj.id);
      setDossierFiles(dFiles);
    } else {
      setSessions([]);
      setDossierFiles([]);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#070d18] text-white">
      {/* Top Navigation Bar */}
      <div className="border-b border-white/10 bg-[#001530]/80 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition border border-white/10"
            title="Back to Studio Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-display font-extrabold text-white">
                Obsidian Second Brain Knowledge Map
              </h1>
              <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Force-Directed Graph View
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive 2D physics simulation of PARA notes, syllabus milestones, and curriculum links.
            </p>
          </div>
        </div>

        {/* Institution & Project Selectors */}
        <div className="flex items-center gap-3">
          {/* Org Selector */}
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl px-3 py-1.5 text-xs">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedOrg?.id || ''}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="bg-[#001530] text-white">
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl px-3 py-1.5 text-xs">
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer text-xs max-w-[200px] truncate"
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id} className="bg-[#001530] text-white">
                  {proj.slug}: {proj.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Full-Height Graph Workspace */}
      <div className="flex-1 w-full p-4 flex flex-col relative" style={{ height: 'calc(100vh - 73px)' }}>
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-sm font-medium">Constructing Knowledge Graph...</span>
          </div>
        ) : (
          <div className="flex-1 w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            <ObsidianGraphView
              org={selectedOrg}
              project={selectedProject}
              sessions={sessions}
              dossierFiles={dossierFiles}
              onOpenNote={(filePath) => setPreviewingNote(filePath)}
              isModal={true}
            />
          </div>
        )}
      </div>

      {/* Note Reader Modal */}
      <ObsidianFileViewerModal
        fileName={previewingNote}
        isOpen={!!previewingNote}
        onClose={() => setPreviewingNote(null)}
        org={selectedOrg}
        project={selectedProject}
        session={sessions[0]}
      />
    </div>
  );
}

export default function ObsidianGraphPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Obsidian Graph...</div>}>
      <GraphPageContent />
    </Suspense>
  );
}
