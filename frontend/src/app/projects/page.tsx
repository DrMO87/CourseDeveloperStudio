'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  BookOpen, 
  Plus, 
  Layers, 
  Building2, 
  ArrowRight,
  Pencil,
  Trash2,
  GraduationCap,
  Sparkles,
  Link2,
  Clock,
  Calendar,
  Tag
} from 'lucide-react';
import type { CourseProject, Organization } from '@/lib/types';
import { fetchProjects, fetchOrganizations, createProject, updateProject, deleteProject } from '@/lib/supabase';
import { WorkflowProgressBar } from '@/components/layout/WorkflowProgressBar';

function ProjectsContent() {
  const searchParams = useSearchParams();
  const initialOrgId = searchParams.get('orgId') || '';

  const [projects, setProjects] = useState<CourseProject[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // New Project Form State
  const [formOrgId, setFormOrgId] = useState(initialOrgId);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [creditHours, setCreditHours] = useState(3);
  const [prerequisites, setPrerequisites] = useState('');
  const [academicTerm, setAcademicTerm] = useState('');
  const [targetAgeBand, setTargetAgeBand] = useState('Undergraduate (18+)');
  const [totalSessions, setTotalSessions] = useState(12);
  const [levelsInput, setLevelsInput] = useState('1');
  const [sessionsPerLevel, setSessionsPerLevel] = useState(8);
  const [creating, setCreating] = useState(false);

  // Edit Project Form State
  const [editingProject, setEditingProject] = useState<CourseProject | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCreditHours, setEditCreditHours] = useState(3);
  const [editPrerequisites, setEditPrerequisites] = useState('');
  const [editAcademicTerm, setEditAcademicTerm] = useState('');
  const [editAgeBand, setEditAgeBand] = useState('');
  const [editTotalSessions, setEditTotalSessions] = useState(12);
  const [editSessionsPerLevel, setEditSessionsPerLevel] = useState(8);

  const selectedFormOrg = organizations.find((o) => o.id === formOrgId) || organizations[0];
  const isUniversity = selectedFormOrg?.institution_type === 'university';
  const isSchool = selectedFormOrg?.institution_type === 'school' || selectedFormOrg?.institution_type === 'nursery';

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [orgList, projList] = await Promise.all([
        fetchOrganizations(),
        fetchProjects(selectedOrgId || undefined)
      ]);
      setOrganizations(orgList);
      setProjects(projList);
      if (!formOrgId && orgList.length > 0) {
        setFormOrgId(orgList[0].id);
      }
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleStorageUpdate = () => loadData();
    window.addEventListener('cds_storage_updated', handleStorageUpdate);
    return () => window.removeEventListener('cds_storage_updated', handleStorageUpdate);
  }, [selectedOrgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setCreating(true);

    try {
      const isUni = selectedFormOrg?.institution_type === 'university';

      await createProject({
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
        organization_id: formOrgId || null,
        course_code: courseCode.trim() || undefined,
        credit_hours: isUni ? creditHours : 0,
        prerequisites: prerequisites.trim() || undefined,
        academic_term: academicTerm.trim() || undefined,
        target_age_band: targetAgeBand.trim() || (isUni ? 'Undergraduate (18+)' : 'Standard'),
        total_sessions: isUni ? totalSessions : sessionsPerLevel,
        levels: isUni ? undefined : [1],
        sessions_per_level: isUni ? totalSessions : sessionsPerLevel,
        obsidian_vault_project_path: `01_Projects/${slug.trim()}`
      });

      setShowModal(false);
      setName('');
      setSlug('');
      setCourseCode('');
      setPrerequisites('');
      setAcademicTerm('');
      await loadData();
    } catch (err) {
      console.error('Error creating project:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to create course.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProject(id);
      await loadData();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to delete course.');
    }
  };

  const handleEditProject = (proj: CourseProject) => {
    setEditingProject(proj);
    setEditName(proj.name);
    setEditSlug(proj.slug);
    setEditCourseCode(proj.course_code || '');
    setEditCreditHours(proj.credit_hours || 3);
    setEditPrerequisites(proj.prerequisites || '');
    setEditAcademicTerm(proj.academic_term || '');
    setEditAgeBand(proj.target_age_band || 'Undergraduate (18+)');
    setEditTotalSessions(proj.total_sessions || proj.sessions_per_level || 12);
    setEditSessionsPerLevel(proj.sessions_per_level || 8);
  };

  const handleSaveEdit = async () => {
    if (!editingProject) return;
    try {
      await updateProject(editingProject.id, {
        name: editName,
        slug: editSlug,
        course_code: editCourseCode.trim() || undefined,
        credit_hours: editCreditHours,
        prerequisites: editPrerequisites.trim() || undefined,
        academic_term: editAcademicTerm.trim() || undefined,
        target_age_band: editAgeBand,
        total_sessions: editTotalSessions,
        sessions_per_level: editTotalSessions,
      });
      setEditingProject(null);
      await loadData();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to save course.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {loadError && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl p-4 text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>Couldn't load courses: {loadError}</span>
          <button onClick={loadData} className="font-display font-bold underline shrink-0">Retry</button>
        </div>
      )}
      {/* 1. Chronological Lifecycle Workflow Progress Bar */}
      <WorkflowProgressBar
        currentStep="PROJECTS"
        projectId={projects[0]?.id}
        projectName={projects[0]?.name}
        progressPercent={33}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-sky-500 dark:text-sky-400" />
            Step 1: Curriculum Projects &amp; Scope
          </h1>
          <p className="text-sm text-slate-500 dark:text-white/60 mt-1">
            Define academic courses, prerequisites, credit hours, and lecture schedules before ingesting source documents.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-sm transition-all select-none"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create New Course</span>
        </button>
      </div>

      {/* Filter by Institution */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedOrgId('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition ${
            selectedOrgId === ''
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 text-slate-600 dark:bg-black/30 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          All Institutions ({projects.length})
        </button>
        {organizations.map((org) => (
          <button
            key={org.id}
            onClick={() => setSelectedOrgId(org.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center gap-1.5 ${
              selectedOrgId === org.id
                ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 shadow-sm'
                : 'bg-slate-100 text-slate-600 dark:bg-black/30 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{org.name}</span>
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 dark:text-white/50 text-sm animate-pulse">
          Loading courses from database &amp; synced store...
        </div>
      ) : projects.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-[#001530]/60 rounded-3xl border border-slate-200 dark:border-white/10 p-8 space-y-4 shadow-sm">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-white/20 mx-auto" />
          <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">No curriculum courses found</h3>
          <p className="text-sm text-slate-500 dark:text-white/60 max-w-md mx-auto">
            Create your first academic course or syllabus track to begin multi-agent generation.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Course Track
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => {
            const org = organizations.find((o) => o.id === proj.organization_id);
            const orgIsUni = org?.institution_type === 'university' || (!org && proj.credit_hours !== undefined && proj.credit_hours > 0);
            const orgIsSchool = org?.institution_type === 'school' || org?.institution_type === 'nursery';

            return (
              <div
                key={proj.id}
                className="bg-white dark:bg-[#001530]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-amber-400 dark:hover:border-gold-400/40 transition-all shadow-sm dark:shadow-2xl group"
              >
                <div className="space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center font-display font-black text-lg shrink-0">
                      {orgIsUni ? <GraduationCap className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {org && (
                        <span className="text-[10px] font-display font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 border border-slate-200 dark:border-white/10 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {org.name.split('—')[0].trim()}
                        </span>
                      )}
                      {proj.course_code && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30">
                          {proj.course_code}
                        </span>
                      )}
                      {orgIsUni && proj.credit_hours !== undefined && proj.credit_hours > 0 && (
                        <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-gold-300 border border-amber-300 dark:border-amber-500/30">
                          {proj.credit_hours} Cr.
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-gold-400 transition-colors">
                      {proj.name}
                    </h3>
                    <span className="text-xs font-mono text-slate-400 dark:text-white/40">{proj.slug}</span>
                  </div>

                  {/* Context-Aware Academic Metadata Chips */}
                  <div className="pt-3 border-t border-slate-200 dark:border-white/10 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-white/70">
                    <div className="p-2.5 bg-slate-50 dark:bg-black/30 rounded-xl">
                      <span className="text-[10px] text-slate-400 dark:text-white/40 block">
                        {orgIsUni ? 'Academic Level:' : 'Target Audience:'}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-white truncate block">
                        {proj.target_age_band || (orgIsUni ? 'Undergraduate' : 'Standard')}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 dark:bg-black/30 rounded-xl">
                      <span className="text-[10px] text-slate-400 dark:text-white/40 block">
                        {orgIsUni ? 'Course Scope:' : orgIsSchool ? 'Lessons:' : 'Structure:'}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-white block">
                        {orgIsUni
                          ? `${proj.total_sessions || proj.sessions_per_level || 12} Lectures / Sessions`
                          : orgIsSchool
                          ? `${proj.total_sessions || proj.sessions_per_level || 10} Lessons`
                          : `${proj.levels?.length || 1} Levels · ${proj.sessions_per_level || 8} Sessions`}
                      </span>
                    </div>
                  </div>

                  {/* Prerequisites Banner for Academic Courses */}
                  {proj.prerequisites && (
                    <div className="p-2.5 bg-sky-50 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-500/20 text-xs flex items-start gap-2">
                      <Link2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-display font-bold text-sky-800 dark:text-sky-300 block">
                          Prerequisites:
                        </span>
                        <span className="text-[11px] text-sky-900 dark:text-sky-200/90 font-medium">
                          {proj.prerequisites}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions: Guided Progression to Step 2 Dossier */}
                <div className="pt-5 mt-4 border-t border-slate-200 dark:border-white/10 flex items-center gap-2">
                  <Link
                    href={`/dossier?projectId=${proj.id}`}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white dark:text-primary-900 rounded-xl text-xs font-display font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <span>Proceed to Step 2: Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href={`/?projectId=${proj.id}`}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition"
                    title="Jump directly to Step 3: Studio Swarm"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                  </Link>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditProject(proj); }}
                    className="p-2.5 bg-slate-100 hover:bg-sky-100 dark:bg-white/5 dark:hover:bg-sky-500/20 text-slate-500 hover:text-sky-600 dark:text-white/50 dark:hover:text-sky-400 rounded-xl transition"
                    title="Edit course metadata"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.id, proj.name); }}
                    className="p-2.5 bg-slate-100 hover:bg-rose-100 dark:bg-white/5 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:text-white/50 dark:hover:text-rose-400 rounded-xl transition"
                    title="Delete course"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {isUniversity ? (
                  <GraduationCap className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                ) : (
                  <BookOpen className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                )}
                {isUniversity ? 'Register University Course' : 'Register New Curriculum Track'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                  Belongs to Institution
                </label>
                <select
                  value={formOrgId}
                  onChange={(e) => setFormOrgId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id} className="bg-white dark:bg-[#001530] text-slate-900 dark:text-white">
                      {org.name} ({org.institution_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  required
                  placeholder={isUniversity ? 'e.g. Instrumental Analysis (Pharmaceutical)' : 'e.g. Robotics & Embedded Systems'}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                    Course Slug
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. instrumental-analysis"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {isUniversity ? (
                  <div>
                    <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                      Course Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PHAR-301"
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                      Target Age / Band
                    </label>
                    <input
                      type="text"
                      value={targetAgeBand}
                      onChange={(e) => setTargetAgeBand(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* University Specific Fields */}
              {isUniversity ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                        Credit Hours
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={creditHours}
                        onChange={(e) => setCreditHours(parseInt(e.target.value, 10) || 3)}
                        className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                        Total Lectures / Sessions
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={totalSessions}
                        onChange={(e) => setTotalSessions(parseInt(e.target.value, 10) || 12)}
                        className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                      Academic Prerequisites
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Organic Chemistry II, Analytical Chemistry"
                      value={prerequisites}
                      onChange={(e) => setPrerequisites(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                        Academic Term / Semester
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Semester 5 (Spring)"
                        value={academicTerm}
                        onChange={(e) => setAcademicTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                        Student Level
                      </label>
                      <input
                        type="text"
                        value={targetAgeBand}
                        onChange={(e) => setTargetAgeBand(e.target.value)}
                        placeholder="e.g. Undergraduate (Year 3)"
                        className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                      Levels (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={levelsInput}
                      onChange={(e) => setLevelsInput(e.target.value)}
                      placeholder="1, 2"
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                      Sessions per Level
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={sessionsPerLevel}
                      onChange={(e) => setSessionsPerLevel(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : isUniversity ? 'Create Academic Course' : 'Create Course Track'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditingProject(null)}>
          <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Pencil className="w-5 h-5 text-sky-500" />
              Edit Course Metadata
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">Course Name</label>
                <input
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '')); }}
                  className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">Slug</label>
                  <input
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">Course Code</label>
                  <input
                    value={editCourseCode}
                    placeholder="e.g. PHAR-301"
                    onChange={(e) => setEditCourseCode(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">Credit Hours</label>
                  <input
                    type="number"
                    value={editCreditHours}
                    onChange={(e) => setEditCreditHours(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">Total Lectures / Sessions</label>
                  <input
                    type="number"
                    value={editTotalSessions}
                    onChange={(e) => setEditTotalSessions(parseInt(e.target.value, 10) || 12)}
                    className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">Prerequisites</label>
                <input
                  value={editPrerequisites}
                  placeholder="e.g. Organic Chemistry II, Analytical Chemistry"
                  onChange={(e) => setEditPrerequisites(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">Target Audience / Level</label>
                  <input
                    value={editAgeBand}
                    onChange={(e) => setEditAgeBand(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-bold text-slate-600 dark:text-white/60 mb-1.5">Academic Term</label>
                  <input
                    value={editAcademicTerm}
                    placeholder="e.g. Semester 5"
                    onChange={(e) => setEditAcademicTerm(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingProject(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 rounded-xl text-xs font-display font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl text-xs font-display font-extrabold shadow-sm transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400 animate-pulse">Loading curriculum tracks...</div>}>
      <ProjectsContent />
    </Suspense>
  );
}
