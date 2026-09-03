'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  GraduationCap, 
  School, 
  Plus, 
  Settings, 
  ChevronRight, 
  BookOpen,
  Sparkles,
  Layers,
  Baby,
  Briefcase,
  Cpu,
  Palette,
  Sliders,
  Smile,
  Copy,
  Trash2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import type { Organization, InstitutionType } from '@/lib/types';
import { useTheme } from '@/components/ThemeProvider';
import { 
  fetchOrganizations, 
  createOrganization, 
  deleteOrganization,
  DEFAULT_INSTITUTION_TEMPLATES 
} from '@/lib/supabase';

const INSTITUTION_CONFIG: Record<InstitutionType, { label: string; icon: any; color: string; badge: string; subtitle: string }> = {
  university: {
    label: 'University / Faculty',
    icon: GraduationCap,
    color: 'text-amber-600 dark:text-gold-400',
    badge: 'bg-amber-50 dark:bg-primary-950 text-amber-800 dark:text-gold-400 border-amber-300 dark:border-gold-500/40 shadow-sm',
    subtitle: 'Higher education, faculties of Medicine, Pharmacy, Engineering, Sciences & ABET/NARS ILOs.'
  },
  academy: {
    label: 'Coding & STEM Academy',
    icon: Cpu,
    color: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 shadow-sm',
    subtitle: 'Robotics clubs, coding bootcamps (like Techno Square, LEGO EV3, Scratch, Python, IoT).'
  },
  nursery: {
    label: 'Nursery & Early Childhood',
    icon: Baby,
    color: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 shadow-sm',
    subtitle: 'Ages 3–6, play-based learning, character mascots, storytelling, phonics & fine motor skills.'
  },
  school: {
    label: 'K-12 School',
    icon: School,
    color: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 shadow-sm',
    subtitle: 'Primary, middle & high school curricula aligned with national ministry standards.'
  },
  training_center: {
    label: 'Corporate Training Center',
    icon: Briefcase,
    color: 'text-sky-600 dark:text-sky-400',
    badge: 'bg-sky-50 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 shadow-sm',
    subtitle: 'Professional executive education, vocational certificates & corporate workshops.'
  }
};

export default function OrganizationsPage() {
  const { setActiveOrg } = useTheme();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New Org Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType>('university');
  const [primaryScript, setPrimaryScript] = useState('arabic');
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const orgs = await fetchOrganizations();
      setOrganizations(orgs);
    } catch (err) {
      console.error(err);
      setOrganizations(DEFAULT_INSTITUTION_TEMPLATES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleStorageUpdate = () => loadData();
    window.addEventListener('cds_storage_updated', handleStorageUpdate);
    return () => window.removeEventListener('cds_storage_updated', handleStorageUpdate);
  }, []);

  const handleUseTemplate = async (template: Organization) => {
    const customName = `${template.name} (Custom Copy)`;
    const customSlug = `${template.slug}-${Date.now().toString().slice(-4)}`;

    const created = await createOrganization({
      ...template,
      id: `org-${Date.now()}`,
      name: customName,
      slug: customSlug
    });
    setActiveOrg(created);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cds_active_org_id', created.id);
    }
    await loadData();
  };

  const handleSelectActiveOrg = (org: Organization) => {
    setActiveOrg(org);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cds_active_org_id', org.id);
      window.dispatchEvent(new Event('cds_storage_updated'));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove "${name}"?`)) {
      await deleteOrganization(id);
      await loadData();
    }
  };

  const handleApplyPreset = (type: InstitutionType) => {
    setInstitutionType(type);
    if (type === 'academy') {
      setName('Techno Square STEM Academy');
      setSlug('techno-square');
      setPrimaryScript('arabic');
    } else if (type === 'nursery') {
      setName('Little Explorers Nursery & KG');
      setSlug('little-explorers-kg');
      setPrimaryScript('arabic');
    } else if (type === 'university') {
      setName('Horus University — Egypt');
      setSlug('horus-university-egypt');
      setPrimaryScript('latin');
    } else if (type === 'school') {
      setName('Future Leaders International School');
      setSlug('future-leaders-school');
      setPrimaryScript('arabic');
    } else if (type === 'training_center') {
      setName('Executive Professional Training Institute');
      setSlug('executive-training-inst');
      setPrimaryScript('latin');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setCreating(true);

    try {
      const palette = 
        institutionType === 'academy' ? { approved: ['#231F20', '#FFED10', '#585858', '#FFFFFF'], retired: ['#F5B301'] } :
        institutionType === 'nursery' ? { approved: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C'], retired: ['#000000'] } :
        institutionType === 'university' ? { approved: ['#002147', '#FFB81C', '#1929B5', '#FFFFFF'], retired: ['#F5B301', '#1A1A1A'] } :
        { approved: ['#1E3A8A', '#10B981', '#F59E0B', '#FFFFFF'], retired: ['#000000'] };

      const langPolicy =
        institutionType === 'nursery' ? { primary_script: 'arabic', target_ratio: 0.90, tolerance: 0.10, secondary_script: 'latin' } :
        institutionType === 'academy' ? { primary_script: 'arabic', target_ratio: 0.70, tolerance: 0.10, secondary_script: 'latin' } :
        institutionType === 'university' ? { primary_script: primaryScript, target_ratio: primaryScript === 'latin' ? 0.95 : 0.70, tolerance: 0.10, secondary_script: 'arabic' } :
        { primary_script: primaryScript, target_ratio: 0.80, tolerance: 0.10, secondary_script: 'latin' };

      const mascot =
        institutionType === 'nursery' ? { character_name: 'Mimi the Owl', poses: [{ pose_name: 'welcoming', asset_file: 'mimi-welcome.png', slide_context: 'Intro / Storytelling' }] } :
        institutionType === 'academy' ? { character_name: 'Tata', poses: [{ pose_name: 'curious', asset_file: 'tata-curious.png', slide_context: 'Hands-on Build Challenge' }] } :
        { character_name: null, poses: [] };

      const created = await createOrganization({
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
        institution_type: institutionType,
        brand_palette: palette,
        language_policy: langPolicy,
        boundary_terms: {
          forbidden_strings: institutionType === 'nursery' 
            ? ['teacher note', 'parent guide', 'grading sheet', 'ملاحظة للمربية']
            : ['lecturer note', 'model answer', 'ملاحظة للمدرب', 'إجابة متوقعة']
        },
        mascot_config: mascot
      });

      setActiveOrg(created);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cds_active_org_id', created.id);
      }

      setShowModal(false);
      setName('');
      setSlug('');
      await loadData();
    } catch (err) {
      console.error('Error creating organization:', err);
    } finally {
      setCreating(false);
    }
  };

  const getBadge = (type: InstitutionType) => {
    const cfg = INSTITUTION_CONFIG[type] || INSTITUTION_CONFIG.university;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-bold border ${cfg.badge}`}>
        <Icon className="w-3.5 h-3.5" />
        {cfg.label.split('/')[0]}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-amber-500 dark:text-gold-400" />
            Institutions &amp; Multi-Tier Archetypes
          </h1>
          <p className="text-sm text-slate-500 dark:text-white/60 mt-1">
            Configure branding, language rules, and quality gates for Universities, Coding Academies, Schools, and Nurseries.
          </p>
        </div>

        <button
          onClick={() => {
            handleApplyPreset('university');
            setShowModal(true);
          }}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-sm transition-all select-none"
        >
          <Plus className="w-4 h-4" />
          + Add New Institution Profile
        </button>
      </div>

      {/* SECTION 1: Active Connected Institutions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Active Connected Institutions ({organizations.length})
          </h2>
          <span className="text-xs text-slate-400 dark:text-white/50">Click any card to apply its branding to the workspace</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 dark:text-white/50 text-sm animate-pulse">
            Loading institutions from database &amp; local store...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => {
              const cfg = INSTITUTION_CONFIG[org.institution_type] || INSTITUTION_CONFIG.university;
              const primaryColor = org.brand_palette?.approved[0] || '#002147';

              return (
                <div
                  key={org.id}
                  onClick={() => handleSelectActiveOrg(org)}
                  className="bg-white dark:bg-[#001530]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-amber-400 dark:hover:border-gold-400/50 transition-all shadow-sm dark:shadow-2xl group cursor-pointer"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div 
                        className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-display font-black text-lg shadow-sm"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {org.name.substring(0, 2).toUpperCase()}
                      </div>
                      {getBadge(org.institution_type)}
                    </div>

                    <div>
                      <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-gold-400 transition-colors">
                        {org.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-white/50 mt-0.5 line-clamp-1">{cfg.subtitle}</p>
                      <span className="text-xs font-mono text-slate-400 dark:text-white/40">{org.slug}</span>
                    </div>

                    {/* Rules Summary Badges */}
                    <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2 text-xs text-slate-700 dark:text-white/80">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 dark:text-white/50">Language Policy:</span>
                        <span className="font-semibold text-sky-600 dark:text-sky-400">
                          {Math.round((org.language_policy?.target_ratio || 0.7) * 100)}% {org.language_policy?.primary_script || 'Arabic'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 dark:text-white/50">Brand Palette:</span>
                        <div className="flex gap-1">
                          {(org.brand_palette?.approved || []).slice(0, 4).map((c) => (
                            <span
                              key={c}
                              className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-white/30 shadow-sm"
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 dark:text-white/50">Mascot / Persona:</span>
                        <span className="font-semibold text-amber-700 dark:text-gold-300">
                          {org.mascot_config?.character_name ? `🦁 ${org.mascot_config.character_name}` : 'None'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-5 mt-4 border-t border-slate-200 dark:border-white/10 flex items-center gap-2">
                    <Link
                      href={`/organizations/${org.id}/settings`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 px-3 py-2 bg-slate-100 dark:bg-white/10 hover:bg-amber-500 hover:text-white dark:hover:bg-gradient-gold dark:hover:text-primary-900 text-slate-800 dark:text-white rounded-xl text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Edit Rules &amp; Gates
                    </Link>
                    <Link
                      href={`/projects?orgId=${org.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-3.5 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-white/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition"
                      title="View Projects"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </Link>
                    {org.id.startsWith('org-') && !org.id.startsWith('org-template-') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(org.id, org.name);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-500 transition"
                        title="Delete institution"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Reusable Archetype Templates */}
      <div className="pt-6 border-t border-slate-200 dark:border-white/10 space-y-4">
        <div>
          <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 dark:text-gold-400" />
            Reusable Archetype Templates (Click &apos;Use Template&apos; to instantiate)
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">
            Pre-configured blueprints with deterministic brand rules, mascots, and language policies ready for 1-click duplication.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEFAULT_INSTITUTION_TEMPLATES.map((tmpl) => {
            const cfg = INSTITUTION_CONFIG[tmpl.institution_type] || INSTITUTION_CONFIG.university;
            const Icon = cfg.icon;

            return (
              <div
                key={tmpl.id}
                className="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 hover:border-amber-400 dark:hover:border-gold-400/50 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all group shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-extrabold text-amber-700 dark:text-gold-400 flex items-center gap-1.5">
                      <Icon className="w-4 h-4" />
                      {cfg.label.split('/')[0]}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-white/40 uppercase">Template</span>
                  </div>

                  <h4 className="text-sm font-display font-bold text-slate-900 dark:text-white">{tmpl.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-white/60 leading-snug">{cfg.subtitle}</p>

                  <div className="flex items-center gap-1 pt-1">
                    {tmpl.brand_palette.approved.map(c => (
                      <span key={c} className="w-3 h-3 rounded-full border border-slate-300 dark:border-white/20 shadow-sm" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleUseTemplate(tmpl)}
                  className="w-full py-2 bg-slate-100 dark:bg-white/10 hover:bg-amber-500 hover:text-white dark:hover:bg-gradient-gold dark:hover:text-primary-900 text-slate-800 dark:text-white rounded-xl text-xs font-display font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Use This Template
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Org Modal with Quick Presets */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500 dark:text-gold-400" />
                Register New Institution Profile
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <label className="block text-xs font-display font-semibold text-slate-500 dark:text-white/60 mb-2">
                Quick Start Archetype Presets:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(INSTITUTION_CONFIG) as InstitutionType[]).map((type) => {
                  const cfg = INSTITUTION_CONFIG[type];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleApplyPreset(type)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        institutionType === type
                          ? 'bg-amber-500 dark:bg-gradient-gold text-white dark:text-primary-900 border-amber-500 dark:border-gold-400 shadow-sm'
                          : 'bg-slate-50 dark:bg-black/30 text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10 hover:border-amber-400 dark:hover:border-gold-400/30'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1" />
                      <span className="text-[11px] font-display font-bold leading-tight truncate">
                        {cfg.label.split('/')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Techno Square Robotics Academy"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                  Identifier Slug
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. techno-square"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                  Primary Instructional Script
                </label>
                <select
                  value={primaryScript}
                  onChange={(e) => setPrimaryScript(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                >
                  <option value="arabic" className="bg-white dark:bg-[#001530]">Arabic (العربية)</option>
                  <option value="latin" className="bg-white dark:bg-[#001530]">English / Latin</option>
                  <option value="cyrillic" className="bg-white dark:bg-[#001530]">Cyrillic</option>
                  <option value="cjk" className="bg-white dark:bg-[#001530]">CJK (Chinese / Japanese / Korean)</option>
                  <option value="devanagari" className="bg-white dark:bg-[#001530]">Devanagari</option>
                </select>
              </div>

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
                  {creating ? 'Creating...' : 'Create Institution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

