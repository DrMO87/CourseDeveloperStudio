'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  FolderArchive, 
  Building2, 
  BookOpen, 
  Layers, 
  Sparkles, 
  UploadCloud,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
import type { CourseProject, Organization } from '@/lib/types';
import { fetchProjects, fetchOrganizations } from '@/lib/supabase';
import { CourseDossierHub } from '@/components/dossier/CourseDossierHub';
import { WorkflowProgressBar } from '@/components/layout/WorkflowProgressBar';

function DossierPageContent() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('projectId');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<CourseProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<CourseProject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [orgList, projList] = await Promise.all([
          fetchOrganizations(),
          fetchProjects()
        ]);
        setOrganizations(orgList);
        setProjects(projList);

        if (orgList.length > 0) {
          setSelectedOrg(orgList[0]);
        }

        const targetProj = projList.find(p => p.id === queryProjectId) || (projList.length > 0 ? projList[0] : null);
        setSelectedProject(targetProj);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [queryProjectId]);

  const handleOrgChange = async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId) || null;
    setSelectedOrg(org);
    const projs = await fetchProjects(orgId || undefined);
    setProjects(projs);
    setSelectedProject(projs.length > 0 ? projs[0] : null);
  };

  const handleProjectChange = (projId: string) => {
    const proj = projects.find(p => p.id === projId) || null;
    setSelectedProject(proj);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Chronological Lifecycle Workflow Progress Bar */}
      <WorkflowProgressBar
        currentStep="DOSSIER"
        projectId={selectedProject?.id}
        projectName={selectedProject?.name}
        progressPercent={66}
      />

      {/* Header Bar with Project Selector */}
      <div className="bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm dark:shadow-card backdrop-blur-md flex flex-col md:flex-row md:items-center md:justify-between gap-5 transition-colors">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <FolderArchive className="w-7 h-7 text-amber-500 dark:text-gold-400" />
              Step 2: Course Source Dossier Hub
            </h1>
            <span className="text-[10px] uppercase font-display font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gold-400 border border-slate-200 dark:border-gold-500/30">
              Interactive Ingestion
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
            Upload course specs, legacy decks, question pools, and rubrics directly from the browser to build verified ground-truth.
          </p>
        </div>

        {/* Selectors and Proceed CTA */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Org Selector */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200">
            <Building2 className="w-4 h-4 text-amber-500 dark:text-gold-400" />
            <select
              value={selectedOrg?.id || ''}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-medium focus:outline-none cursor-pointer"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="bg-white dark:bg-[#001530] text-slate-900 dark:text-white">
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200">
            <BookOpen className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-medium focus:outline-none cursor-pointer"
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id} className="bg-white dark:bg-[#001530] text-slate-900 dark:text-white">
                  {proj.name}
                </option>
              ))}
              {projects.length === 0 && (
                <option value="">No Projects Registered</option>
              )}
            </select>
          </div>

          {/* Proceed to Step 3 Button */}
          {selectedProject && (
            <Link
              href={`/dossier/validate?projectId=${selectedProject.id}`}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <span>Validate Content &rarr; Studio Swarm</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Main Dossier Hub Component */}
      {selectedProject ? (
        <CourseDossierHub project={selectedProject} />
      ) : (
        <div className="py-16 text-center bg-[#001530]/60 rounded-3xl border border-white/10 p-8 space-y-4">
          <BookOpen className="w-12 h-12 text-gold-400/40 mx-auto" />
          <h3 className="text-base font-display font-bold text-white">No course project selected</h3>
          <p className="text-xs text-white/50 max-w-sm mx-auto">
            Create or select a curriculum project to start uploading and categorizing course materials.
          </p>
          <Link
            href="/projects"
            className="px-5 py-2 bg-gradient-gold text-primary-900 font-display font-extrabold rounded-xl text-xs inline-flex items-center gap-2 shadow-glow-gold"
          >
            Go to Projects
          </Link>
        </div>
      )}
    </div>
  );
}

export default function DossierPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-white/50 animate-pulse">Loading course dossier hub...</div>}>
      <DossierPageContent />
    </Suspense>
  );
}
