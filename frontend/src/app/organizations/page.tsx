'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  ArrowRight,
  Bot,
  Zap,
  Pencil,
  AlertCircle,
  Type
} from 'lucide-react';
import type { Organization, InstitutionType } from '@/lib/types';
import { useTheme } from '@/components/ThemeProvider';
import { 
  fetchOrganizations, 
  createOrganization, 
  updateOrganization,
  deleteOrganization,
  DEFAULT_CREATED_ORGANIZATIONS,
  DEFAULT_ACTIVE_ORGANIZATIONS,
  DEFAULT_INSTITUTION_TEMPLATES,
  MODERN_ARABIC_FONTS,
  MODERN_LATIN_FONTS,
  CURATED_COLOR_PALETTES
} from '@/lib/supabase';
import { WorkflowProgressBar } from '@/components/layout/WorkflowProgressBar';

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

function OrganizationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setActiveOrg } = useTheme();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // LLM Matrix Step State
  const [selectedOrgForMatrix, setSelectedOrgForMatrix] = useState<string | undefined>(undefined);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [llmVerified, setLlmVerified] = useState(false);
  const [verifiedModelName, setVerifiedModelName] = useState('');

  // New Org Form State
  const [templateInUse, setTemplateInUse] = useState<Organization | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType>('university');
  const [primaryScript, setPrimaryScript] = useState('latin');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Palette and Typography State for Registration Modal
  const [paletteColors, setPaletteColors] = useState<string[]>(['#002147', '#FFB81C', '#1929B5', '#0F766E']);
  const [retiredColors, setRetiredColors] = useState<string[]>(['#FF0000', '#990000']);
  const [selectedFontArabic, setSelectedFontArabic] = useState<string>('Cairo');
  const [selectedFontLatin, setSelectedFontLatin] = useState<string>('Inter');
  const [newColorInput, setNewColorInput] = useState<string>('#10B981');

  // Quick Edit State
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editType, setEditType] = useState<InstitutionType>('university');
  const [editScript, setEditScript] = useState('arabic');
  const [editFontArabic, setEditFontArabic] = useState('Cairo');
  const [editFontLatin, setEditFontLatin] = useState('Inter');
  const [editPaletteColors, setEditPaletteColors] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const orgs = await fetchOrganizations();
      setOrganizations(orgs);
      if (typeof window !== 'undefined') {
        const savedOrgId = localStorage.getItem('cds_active_org_id');
        // Ensure activeOrgId points to an existing made organization
        const activeExists = orgs.some(o => o.id === savedOrgId);
        const resolvedOrgId = (activeExists && savedOrgId) ? savedOrgId : (orgs.length > 0 ? orgs[0]?.id : null);
        setActiveOrgId(resolvedOrgId);
        if (resolvedOrgId) {
          localStorage.setItem('cds_active_org_id', resolvedOrgId);
          const activeObj = orgs.find(o => o.id === resolvedOrgId);
          if (activeObj) setActiveOrg(activeObj);
        } else {
          localStorage.removeItem('cds_active_org_id');
          setActiveOrg(null as any);
        }
        setLlmVerified(localStorage.getItem('cds_llm_verified') === 'true');
        setVerifiedModelName(localStorage.getItem('cds_verified_model') || '');
      }
    } catch (err) {
      console.error(err);
      setOrganizations(DEFAULT_ACTIVE_ORGANIZATIONS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (searchParams.get('openMatrix') === 'true') {
      router.push(`/matrix?orgId=${activeOrgId || ''}&returnTo=/organizations`);
    }

    const handleOpenMatrix = () => router.push(`/matrix?orgId=${activeOrgId || ''}&returnTo=/organizations`);
    window.addEventListener('cds_open_llm_matrix', handleOpenMatrix);

    const handleStorageUpdate = () => {
      loadData();
      if (typeof window !== 'undefined') {
        setLlmVerified(localStorage.getItem('cds_llm_verified') === 'true');
        setVerifiedModelName(localStorage.getItem('cds_verified_model') || '');
      }
    };
    window.addEventListener('cds_storage_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('cds_storage_updated', handleStorageUpdate);
      window.removeEventListener('cds_open_llm_matrix', handleOpenMatrix);
    };
  }, [searchParams, activeOrgId, router]);

  const handleUseTemplate = (template: Organization) => {
    setTemplateInUse(template);
    setInstitutionType(template.institution_type);
    setName(template.name.replace(/Blueprint|Template/g, '').trim());
    setSlug(template.slug.replace(/-blueprint|-template/g, ''));
    setPrimaryScript(template.language_policy?.primary_script || 'arabic');
    setPaletteColors(template.brand_palette?.approved?.length ? [...template.brand_palette.approved] : ['#002147', '#FFB81C']);
    setRetiredColors(template.brand_palette?.retired?.length ? [...template.brand_palette.retired] : []);
    setSelectedFontArabic(template.brand_palette?.font_arabic || 'Cairo');
    setSelectedFontLatin(template.brand_palette?.font_latin || 'Inter');
    setCreateError(null);
    setShowModal(true);
  };

  const handleSelectActiveOrg = (org: Organization, navigateToMatrix = false) => {
    setActiveOrg(org);
    setActiveOrgId(org.id);
    setSelectedOrgForMatrix(org.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cds_active_org_id', org.id);
      window.dispatchEvent(new Event('cds_storage_updated'));
    }
    if (navigateToMatrix) {
      router.push(`/matrix?orgId=${org.id}&returnTo=/organizations`);
    }
  };

  const handleOpenEdit = (org: Organization) => {
    setEditingOrg(org);
    setEditName(org.name);
    setEditSlug(org.slug);
    setEditType(org.institution_type);
    setEditScript(org.language_policy?.primary_script || 'arabic');
    setEditFontArabic(org.brand_palette?.font_arabic || 'Cairo');
    setEditFontLatin(org.brand_palette?.font_latin || 'Inter');
    setEditPaletteColors(org.brand_palette?.approved?.length ? [...org.brand_palette.approved] : ['#002147', '#FFB81C']);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg || !editName.trim()) return;
    setUpdating(true);
    setEditError(null);
    try {
      const updated = await updateOrganization(editingOrg.id, {
        name: editName.trim(),
        slug: editSlug.trim().toLowerCase().replace(/\s+/g, '-'),
        institution_type: editType,
        brand_palette: {
          ...editingOrg.brand_palette,
          approved: editPaletteColors.length > 0 ? editPaletteColors : editingOrg.brand_palette.approved,
          font_arabic: editFontArabic,
          font_latin: editFontLatin
        },
        typography: {
          font_arabic: editFontArabic,
          font_latin: editFontLatin
        },
        language_policy: {
          ...editingOrg.language_policy,
          primary_script: editScript
        }
      });
      if (activeOrgId === editingOrg.id) {
        setActiveOrg(updated);
      }
      setEditingOrg(null);
      await loadData();
    } catch (err) {
      console.error('Failed to update organization:', err);
      setEditError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove institution "${name}"? This action cannot be undone.`)) {
      try {
        await deleteOrganization(id);
        if (activeOrgId === id) {
          localStorage.removeItem('cds_active_org_id');
          setActiveOrgId(null);
        }
        await loadData();
      } catch (err) {
        console.error('Error deleting organization:', err);
        alert('Failed to delete institution: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  const handleApplyPreset = (type: InstitutionType) => {
    setInstitutionType(type);
    if (type === 'academy') {
      setName('Techno Square STEM Academy');
      setSlug('techno-square');
      setPrimaryScript('arabic');
      setPaletteColors(['#231F20', '#FFED10', '#585858', '#FFFFFF']);
      setRetiredColors(['#F5B301']);
      setSelectedFontArabic('Readex Pro');
      setSelectedFontLatin('Outfit');
    } else if (type === 'nursery') {
      setName('Little Explorers Nursery & KG');
      setSlug('little-explorers-kg');
      setPrimaryScript('arabic');
      setPaletteColors(['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C']);
      setRetiredColors(['#000000']);
      setSelectedFontArabic('Tajawal');
      setSelectedFontLatin('Poppins');
    } else if (type === 'university') {
      setName('Horus University — Egypt');
      setSlug('horus-university-egypt');
      setPrimaryScript('latin');
      setPaletteColors(['#002147', '#FFB81C', '#1929B5', '#0F766E']);
      setRetiredColors(['#FF0000', '#990000']);
      setSelectedFontArabic('Cairo');
      setSelectedFontLatin('Inter');
    } else if (type === 'school') {
      setName('Future Leaders International School');
      setSlug('future-leaders-school');
      setPrimaryScript('arabic');
      setPaletteColors(['#1E3A8A', '#10B981', '#F59E0B', '#FFFFFF']);
      setRetiredColors([]);
      setSelectedFontArabic('Almarai');
      setSelectedFontLatin('Plus Jakarta Sans');
    } else if (type === 'training_center') {
      setName('Executive Professional Training Institute');
      setSlug('executive-training-inst');
      setPrimaryScript('latin');
      setPaletteColors(['#0F172A', '#0284C7', '#38BDF8', '#F8FAFC']);
      setRetiredColors([]);
      setSelectedFontArabic('IBM Plex Sans Arabic');
      setSelectedFontLatin('Montserrat');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setCreating(true);
    setCreateError(null);

    try {
      const palette = {
        approved: paletteColors.length > 0 ? paletteColors : ['#002147', '#FFB81C'],
        retired: retiredColors,
        font_arabic: selectedFontArabic,
        font_latin: selectedFontLatin
      };

      const langPolicy = templateInUse?.language_policy || (
        institutionType === 'nursery' ? { primary_script: 'arabic', target_ratio: 0.95, tolerance: 0.05, secondary_script: 'latin' } :
        institutionType === 'academy' ? { primary_script: 'arabic', target_ratio: 0.70, tolerance: 0.10, secondary_script: 'latin' } :
        institutionType === 'university' ? { primary_script: primaryScript, target_ratio: primaryScript === 'latin' ? 1.0 : 0.70, tolerance: 0.10, secondary_script: 'arabic' } :
        institutionType === 'training_center' ? { primary_script: primaryScript, target_ratio: 0.80, tolerance: 0.10, secondary_script: 'arabic' } :
        { primary_script: primaryScript, target_ratio: 0.75, tolerance: 0.10, secondary_script: 'latin' }
      );

      const mascot = templateInUse?.mascot_config || (
        institutionType === 'nursery' ? { character_name: 'Mimi the Owl', poses: [{ pose_name: 'welcoming', asset_file: 'mimi-welcome.png', slide_context: 'Intro / Storytelling' }] } :
        institutionType === 'academy' ? { character_name: 'Tata', poses: [{ pose_name: 'curious', asset_file: 'tata-curious.png', slide_context: 'Hands-on Build Challenge' }] } :
        { character_name: null, poses: [] }
      );

      const guidelines = templateInUse?.quality_guidelines || {
        authority_name: institutionType === 'university' ? 'NQAAA / ABET' : institutionType === 'school' ? 'Cognia' : institutionType === 'training_center' ? 'CPD Standards Office' : 'Accreditation Board',
        core_guidelines: 'Institutional quality assurance guidelines and learning outcomes alignment.',
        reference_url: ''
      };

      const created = await createOrganization({
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
        institution_type: institutionType,
        logo_url: templateInUse?.logo_url || (slug.includes('horus') || institutionType === 'university' ? '/images/logo-hue.png' : null),
        brand_palette: palette,
        typography: {
          font_arabic: selectedFontArabic,
          font_latin: selectedFontLatin
        },
        language_policy: langPolicy,
        boundary_terms: templateInUse?.boundary_terms || {
          forbidden_strings: institutionType === 'nursery' 
            ? ['teacher note', 'parent guide', 'grading sheet', 'ملاحظة للمربية']
            : ['lecturer note', 'model answer', 'ملاحظة للمدرب', 'إجابة متوقعة']
        },
        mascot_config: mascot,
        quality_guidelines: guidelines
      });

      setActiveOrg(created);
      setActiveOrgId(created.id);
      setSelectedOrgForMatrix(created.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cds_active_org_id', created.id);
        window.dispatchEvent(new Event('cds_storage_updated'));
      }

      setShowModal(false);
      setName('');
      setSlug('');
      setTemplateInUse(null);
      await loadData();
    } catch (err: any) {
      console.error('Error creating organization:', err);
      setCreateError(err?.message || 'Failed to create organization profile.');
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
      {/* Chronological Workflow Step 1 */}
      <WorkflowProgressBar
        currentStep="ORGANIZATIONS"
        progressPercent={16}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-amber-500 dark:text-gold-400" />
            Institutions &amp; Organization Profiles
          </h1>
          <p className="text-sm text-slate-500 dark:text-white/60 mt-1">
            Manage institutional branding, language policies, boundary enforcement, and quality guidelines, or instantiate a new profile from archetype templates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/matrix?returnTo=/organizations"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-display font-bold rounded-2xl text-xs flex items-center gap-2 shadow-xs transition"
            title="Configure and verify multi-agent LLM model matrix"
          >
            <Zap className="w-4 h-4 text-amber-500 dark:text-gold-400" />
            <span>LLM Model Matrix</span>
            {llmVerified && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow-emerald" title="Model Verified" />
            )}
          </Link>

          <button
            onClick={() => {
              setTemplateInUse(null);
              handleApplyPreset('university');
              setShowModal(true);
            }}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-sm transition-all select-none"
          >
            <Plus className="w-4 h-4" />
            + Add New Institution Profile
          </button>
        </div>
      </div>

      {/* SECTION 1: Active Connected Institutions (Only Made Organizations) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Active Connected Institutions ({organizations.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">
              The only made institution(s) currently registered in your environment. Click to set active, verify AI readiness, or view course projects.
            </p>
          </div>
          <span className="text-xs text-slate-400 dark:text-white/50 hidden sm:inline">Click any card to select &amp; configure</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 dark:text-white/50 text-sm animate-pulse">
            Loading institutions from database &amp; local store...
          </div>
        ) : organizations.length === 0 ? (
          <div className="bg-slate-50/80 dark:bg-[#001530]/40 border-2 border-dashed border-slate-200 dark:border-white/15 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 dark:bg-gold-400/10 text-amber-600 dark:text-gold-400 flex items-center justify-center shadow-inner">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                No Active Connected Institutions
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/60 max-w-lg mx-auto leading-relaxed">
                All previously active institutions have been removed. Instantiate a fresh institution below from one of our pre-calibrated archetype templates (University, STEM Academy, Nursery, K-12 School, Corporate Center) or create a custom profile.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setTemplateInUse(null);
                  handleApplyPreset('university');
                  setShowModal(true);
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-sm transition select-none"
              >
                <Plus className="w-4 h-4" />
                + Create Custom Profile
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => {
              const cfg = INSTITUTION_CONFIG[org.institution_type] || INSTITUTION_CONFIG.university;
              const primaryColor = org.brand_palette?.approved[0] || '#002147';
              const isSelected = activeOrgId === org.id;

              return (
                <div
                  key={org.id}
                  onClick={() => handleSelectActiveOrg(org, false)}
                  className={`bg-white dark:bg-[#001530]/90 border rounded-3xl p-6 flex flex-col justify-between transition-all shadow-sm dark:shadow-2xl group cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 dark:border-gold-400 ring-2 ring-amber-500/20 dark:ring-gold-400/20'
                      : 'border-slate-200 dark:border-white/10 hover:border-amber-400 dark:hover:border-gold-400/50'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      {org.logo_url ? (
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 dark:border-white/10 p-1 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                          <img 
                            src={org.logo_url} 
                            alt={org.name} 
                            className="max-w-full max-h-full object-contain" 
                          />
                        </div>
                      ) : (
                        <div 
                          className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-display font-black text-lg shadow-sm shrink-0"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {org.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        {isSelected && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-gold-300 border border-amber-500/30">
                            Active
                          </span>
                        )}
                        {getBadge(org.institution_type)}
                      </div>
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
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 dark:text-white/50">Typography:</span>
                        <span className="font-semibold text-sky-600 dark:text-sky-400 font-mono text-[11px] truncate max-w-[160px]" title={`${org.brand_palette?.font_arabic || 'Cairo'} / ${org.brand_palette?.font_latin || 'Inter'}`}>
                          🔤 {org.brand_palette?.font_arabic || 'Cairo'} • {org.brand_palette?.font_latin || 'Inter'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-5 mt-4 border-t border-slate-200 dark:border-white/10 flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectActiveOrg(org, true);
                      }}
                      className="flex-1 min-w-[90px] px-3 py-2 bg-amber-500/15 hover:bg-amber-500 hover:text-white dark:bg-gold-400/15 dark:hover:bg-gradient-gold dark:hover:text-primary-900 text-amber-800 dark:text-gold-300 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                      title="Verify LLM Model Matrix for this institution"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-gold-400" />
                      Verify AI
                    </button>
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(org);
                      }}
                      className="p-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-800 dark:text-white rounded-xl transition"
                      title="Quick Edit Profile"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <Link
                      href={`/organizations/${org.id}/settings`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-800 dark:text-white rounded-xl transition"
                      title="Edit Brand, Palette & Quality Gates"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href={`/projects?orgId=${org.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-white/80 rounded-xl transition"
                      title="View Projects"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </Link>
                    {org.id.startsWith('org-') && org.id !== 'org-template-hue' && (
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

      {/* SECTION 2: Templates For Different Organization Types */}
      <div className="pt-8 border-t border-slate-200 dark:border-white/10 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-gold-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
              Step 1: Choose an Archetype
            </span>
            <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 dark:text-gold-400" />
              Templates For Different Organization Types
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
            Select an archetype template below to instantiate a new institution with pre-calibrated language ratios, brand palettes, mascots, and accreditation guidelines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {DEFAULT_INSTITUTION_TEMPLATES.map((tmpl) => {
            const cfg = INSTITUTION_CONFIG[tmpl.institution_type] || INSTITUTION_CONFIG.university;
            const Icon = cfg.icon;

            return (
              <div
                key={tmpl.id}
                className="bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 hover:border-amber-400 dark:hover:border-gold-400/50 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all group shadow-sm hover:shadow-md"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {tmpl.logo_url ? (
                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 dark:border-white/10 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                          <img src={tmpl.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : null}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold border ${cfg.badge}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {cfg.label.split('/')[0]}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-gold-400 uppercase bg-amber-500/10 dark:bg-gold-400/10 px-1.5 py-0.5 rounded">
                      Template
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-display font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-gold-400 transition-colors">
                      {tmpl.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-white/60 leading-snug mt-1 line-clamp-2">
                      {cfg.subtitle}
                    </p>
                  </div>

                  {/* Archetype Specs Preview */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600 dark:text-white/70">
                      <span className="text-slate-400 dark:text-white/40">Script Policy:</span>
                      <span className="font-semibold text-sky-600 dark:text-sky-400 font-mono">
                        {Math.round((tmpl.language_policy?.target_ratio || 0.7) * 100)}% {tmpl.language_policy?.primary_script}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-white/70">
                      <span className="text-slate-400 dark:text-white/40">Mascot / Persona:</span>
                      <span className="font-semibold text-amber-700 dark:text-gold-300">
                        {tmpl.mascot_config?.character_name ? `🦁 ${tmpl.mascot_config.character_name}` : 'Formal / None'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-white/70">
                      <span className="text-slate-400 dark:text-white/40">Palette:</span>
                      <div className="flex items-center gap-1">
                        {tmpl.brand_palette.approved.slice(0, 4).map((c) => (
                          <span key={c} className="w-3 h-3 rounded-full border border-slate-300 dark:border-white/20 shadow-xs" style={{ backgroundColor: c }} title={c} />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-white/70">
                      <span className="text-slate-400 dark:text-white/40">Typography:</span>
                      <span className="font-semibold text-amber-700 dark:text-gold-300 font-mono text-[10px] truncate max-w-[140px]" title={`${tmpl.brand_palette?.font_arabic || 'Cairo'} + ${tmpl.brand_palette?.font_latin || 'Inter'}`}>
                        {tmpl.brand_palette?.font_arabic || 'Cairo'} + {tmpl.brand_palette?.font_latin || 'Inter'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUseTemplate(tmpl)}
                  className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500 hover:text-white dark:bg-gold-400/10 dark:hover:bg-gradient-gold dark:hover:text-primary-900 text-amber-800 dark:text-gold-300 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-1.5 transition shadow-xs border border-amber-500/30 dark:border-gold-400/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Use This Template</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Org Modal with Quick Presets */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/15 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div>
                <h3 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-500 dark:text-gold-400" />
                  {templateInUse ? `Instantiate From Template` : `Register New Institution Profile`}
                </h3>
                {templateInUse && (
                  <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">
                    Archetype: <span className="font-semibold text-amber-600 dark:text-gold-400">{templateInUse.name}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setTemplateInUse(null);
                }}
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

            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {/* Color Palette Section */}
              <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-display font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-500 dark:text-gold-400" />
                    Approved Brand Color Palette ({paletteColors.length})
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-white/50">Custom &amp; Curated Presets</span>
                </div>

                {/* Quick Curated Palette Swatches */}
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-white/50 block">Curated Schemes:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {CURATED_COLOR_PALETTES.map((preset) => {
                      const isSelected = preset.approved.length === paletteColors.length && preset.approved.every((c, i) => c.toLowerCase() === paletteColors[i]?.toLowerCase());
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setPaletteColors([...preset.approved]);
                            setRetiredColors([...preset.retired]);
                            if (preset.recommendedFontArabic) setSelectedFontArabic(preset.recommendedFontArabic);
                            if (preset.recommendedFontLatin) setSelectedFontLatin(preset.recommendedFontLatin);
                          }}
                          className={`p-2 rounded-xl border text-left flex items-center justify-between gap-1.5 transition-all ${
                            isSelected
                              ? 'border-amber-500 dark:border-gold-400 bg-amber-500/10 dark:bg-gold-400/10 ring-1 ring-amber-500/30 dark:ring-gold-400/30'
                              : 'border-slate-200 dark:border-white/10 hover:border-amber-400 dark:hover:border-gold-400/40 bg-slate-50/50 dark:bg-black/20'
                          }`}
                        >
                          <span className="text-[10px] font-display font-bold text-slate-800 dark:text-white truncate">
                            {preset.name.split('&')[0]}
                          </span>
                          <div className="flex items-center -space-x-1 shrink-0">
                            {preset.approved.slice(0, 3).map((c) => (
                              <span key={c} className="w-3 h-3 rounded-full border border-white dark:border-slate-900 shadow-2xs" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Selected Colors & Custom Color Adder */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {paletteColors.map((hex, idx) => (
                      <span
                        key={`${hex}-${idx}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-[#002147] border border-slate-200 dark:border-white/20 text-xs font-mono text-slate-800 dark:text-white shadow-2xs"
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-white/40 shadow-inner" style={{ backgroundColor: hex }} />
                        <span>{hex}</span>
                        {paletteColors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPaletteColors(paletteColors.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-500 text-xs ml-0.5"
                            title="Remove color"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* Add Custom Color */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-white/5">
                    <input
                      type="color"
                      value={newColorInput.startsWith('#') && newColorInput.length === 7 ? newColorInput : '#10B981'}
                      onChange={(e) => setNewColorInput(e.target.value.toUpperCase())}
                      className="w-7 h-7 rounded-lg cursor-pointer border border-slate-300 dark:border-white/20 bg-transparent p-0"
                      title="Click to pick custom color"
                    />
                    <input
                      type="text"
                      placeholder="#10B981"
                      value={newColorInput}
                      onChange={(e) => setNewColorInput(e.target.value)}
                      className="w-24 bg-white dark:bg-black/50 border border-slate-200 dark:border-white/15 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (/^#[0-9A-Fa-f]{6}$/.test(newColorInput) && !paletteColors.includes(newColorInput.toUpperCase())) {
                          setPaletteColors([...paletteColors, newColorInput.toUpperCase()]);
                        }
                      }}
                      className="px-3 py-1 bg-amber-500/15 hover:bg-amber-500 hover:text-white dark:bg-gold-400/15 dark:hover:bg-gradient-gold dark:hover:text-primary-900 text-amber-800 dark:text-gold-300 rounded-lg text-xs font-display font-bold transition"
                    >
                      + Add Color
                    </button>
                  </div>
                </div>
              </div>

              {/* Modern Typography & Font Pairing Section */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-display font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                    Institutional Typography &amp; Modern Font Pairing
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-white/50">Arabic + English</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Modern Arabic Font */}
                  <div>
                    <label className="block text-[11px] font-display font-semibold text-slate-600 dark:text-white/70 mb-1">
                      Modern Arabic Font (للغة العربية)
                    </label>
                    <select
                      value={selectedFontArabic}
                      onChange={(e) => setSelectedFontArabic(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                    >
                      {MODERN_ARABIC_FONTS.map((f) => (
                        <option key={f.name} value={f.name} className="bg-white dark:bg-[#001530]">
                          {f.label} — {f.description.split('—')[0]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Modern English / Latin Font */}
                  <div>
                    <label className="block text-[11px] font-display font-semibold text-slate-600 dark:text-white/70 mb-1">
                      Modern English / Latin Font
                    </label>
                    <select
                      value={selectedFontLatin}
                      onChange={(e) => setSelectedFontLatin(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                    >
                      {MODERN_LATIN_FONTS.map((f) => (
                        <option key={f.name} value={f.name} className="bg-white dark:bg-[#001530]">
                          {f.label} — {f.description.split('—')[0]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Typography Preview Box */}
                <div 
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/40 space-y-2 transition-all shadow-inner"
                  style={{ borderLeftColor: paletteColors[0] || '#002147', borderLeftWidth: '4px' }}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-white/50 border-b border-slate-200/60 dark:border-white/5 pb-1">
                    <span>Live Typography Preview:</span>
                    <span className="font-mono text-amber-700 dark:text-gold-300 font-semibold">
                      {selectedFontArabic} + {selectedFontLatin}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p 
                      dir="rtl"
                      className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed"
                      style={{ fontFamily: `'${selectedFontArabic}', sans-serif` }}
                    >
                      جامعة المستقبل • تصميم المناهج الأكاديمية والتقييم المعياري
                    </p>
                    <p 
                      className="text-xs font-medium text-slate-600 dark:text-white/70 leading-normal"
                      style={{ fontFamily: `'${selectedFontLatin}', sans-serif` }}
                    >
                      Course Developer Studio — Institutional Quality Gates &amp; Syllabus Specifications
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setTemplateInUse(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 bg-gradient-gold text-primary-900 font-display font-extrabold rounded-xl text-xs hover:opacity-90 transition disabled:opacity-50 shadow-glow-gold"
                >
                  {creating ? 'Creating...' : 'Create Institution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Edit Modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-[#001530] border border-slate-200 dark:border-white/15 rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div>
                <h3 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-amber-500 dark:text-gold-400" />
                  Edit Institution Profile
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">
                  Update institution naming, archetype classification, primary script, or typography fonts.
                </p>
              </div>
              <button
                onClick={() => setEditingOrg(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                    Institution Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                    Archetype Classification
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as InstitutionType)}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                  >
                    <option value="university">University / Higher Education Faculty</option>
                    <option value="academy">Coding &amp; STEM Academy</option>
                    <option value="nursery">Nursery &amp; Early Childhood</option>
                    <option value="school">K-12 School</option>
                    <option value="training_center">Corporate Training Center</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                    Primary Instructional Script
                  </label>
                  <select
                    value={editScript}
                    onChange={(e) => setEditScript(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                  >
                    <option value="arabic">Arabic (العربية)</option>
                    <option value="latin">English / Latin</option>
                    <option value="cyrillic">Cyrillic</option>
                    <option value="cjk">CJK (Chinese / Japanese / Korean)</option>
                    <option value="devanagari">Devanagari</option>
                  </select>
                </div>
              </div>

              {/* Typography Selection for Quick Edit */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <label className="text-xs font-display font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                  Institutional Typography Fonts
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-display font-semibold text-slate-600 dark:text-white/70 mb-1">
                      Modern Arabic Font
                    </label>
                    <select
                      value={editFontArabic}
                      onChange={(e) => setEditFontArabic(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                    >
                      {MODERN_ARABIC_FONTS.map((f) => (
                        <option key={f.name} value={f.name} className="bg-white dark:bg-[#001530]">
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-display font-semibold text-slate-600 dark:text-white/70 mb-1">
                      Modern English / Latin Font
                    </label>
                    <select
                      value={editFontLatin}
                      onChange={(e) => setEditFontLatin(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
                    >
                      {MODERN_LATIN_FONTS.map((f) => (
                        <option key={f.name} value={f.name} className="bg-white dark:bg-[#001530]">
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div 
                  className="p-3 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/40 space-y-1 shadow-inner"
                  style={{ borderLeftColor: editingOrg.brand_palette?.approved[0] || '#002147', borderLeftWidth: '3px' }}
                >
                  <p 
                    dir="rtl"
                    className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed"
                    style={{ fontFamily: `'${editFontArabic}', sans-serif` }}
                  >
                    نموذج الخط العربي: {editFontArabic}
                  </p>
                  <p 
                    className="text-[11px] font-medium text-slate-600 dark:text-white/70"
                    style={{ fontFamily: `'${editFontLatin}', sans-serif` }}
                  >
                    English Font Sample: {editFontLatin}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Link
                  href={`/organizations/${editingOrg.id}/settings`}
                  className="text-xs font-display font-bold text-amber-600 dark:text-gold-400 hover:underline flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Detailed Brand &amp; Quality Gates Editor →
                </Link>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-6 py-2 bg-gradient-gold text-primary-900 font-display font-extrabold rounded-xl text-xs hover:opacity-90 transition disabled:opacity-50 shadow-glow-gold"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrganizationsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-white/50 animate-pulse">Loading institutions...</div>}>
      <OrganizationsPageContent />
    </Suspense>
  );
}

