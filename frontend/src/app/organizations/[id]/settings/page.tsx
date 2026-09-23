'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
  Palette, 
  Languages, 
  ShieldAlert, 
  Smile, 
  ShieldCheck, 
  Save, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  BookOpen
} from 'lucide-react';
import type { Organization, QualityGateDefinition } from '@/lib/types';
import { 
  fetchOrganizationById, 
  updateOrganization, 
  fetchGateDefinitions, 
  toggleGateDefinition, 
  upsertGateDefinition 
} from '@/lib/supabase';
import { BrandPaletteEditor } from '@/components/settings/BrandPaletteEditor';
import { LanguagePolicyEditor } from '@/components/settings/LanguagePolicyEditor';
import { BoundaryTermsEditor } from '@/components/settings/BoundaryTermsEditor';
import { MascotConfigEditor } from '@/components/settings/MascotConfigEditor';
import { GateConfigPanel } from '@/components/settings/GateConfigPanel';
import { QualityGuidelinesEditor } from '@/components/settings/QualityGuidelinesEditor';

type Tab = 'palette' | 'language' | 'boundary' | 'mascot' | 'gates' | 'guidelines' | 'general';

function SettingsContent({ orgId: propOrgId }: { orgId?: string }) {
  const router = useRouter();
  const params = useParams();
  const orgId = propOrgId || (typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '');

  const [org, setOrg] = useState<Organization | null>(null);
  const [gateDefinitions, setGateDefinitions] = useState<QualityGateDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('palette');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!orgId) return;
      setLoading(true);
      try {
        const data = await fetchOrganizationById(orgId);
        if (data) {
          setOrg(data);
          let gates = await fetchGateDefinitions(orgId);
          if (gates.length === 0) {
            const defaults = [
              { organization_id: orgId, gate_code: 'language_ratio', display_name: 'Language Ratio & Script Balance', is_enabled: true, sort_order: 1, gate_config: {} },
              { organization_id: orgId, gate_code: 'brand_palette', display_name: 'Brand Color Palette Compliance', is_enabled: true, sort_order: 2, gate_config: {} },
              { organization_id: orgId, gate_code: 'boundary_check', display_name: 'Lecturer Boundary Isolation', is_enabled: true, sort_order: 3, gate_config: {} },
              { organization_id: orgId, gate_code: 'asset_reconciliation', display_name: 'Disk Asset Reconciliation & Checksum', is_enabled: true, sort_order: 4, gate_config: {} }
            ];
            for (const d of defaults) {
              await upsertGateDefinition(d);
            }
            gates = await fetchGateDefinitions(orgId);
          }
          setGateDefinitions(gates);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [orgId]);

  const handleSave = async () => {
    if (!org) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateOrganization(org.id, {
        name: org.name,
        slug: org.slug,
        institution_type: org.institution_type,
        logo_url: org.logo_url,
        brand_palette: org.brand_palette,
        language_policy: org.language_policy,
        boundary_terms: org.boundary_terms,
        mascot_config: org.mascot_config,
        quality_guidelines: org.quality_guidelines,
        asset_citation_pattern: org.asset_citation_pattern,
        evidence_marker_pattern: org.evidence_marker_pattern
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save settings. Check console.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGate = async (id: string, is_enabled: boolean) => {
    const gate = gateDefinitions.find(g => g.id === id);
    if (!gate || !orgId) return;
    try {
      await toggleGateDefinition(orgId, gate.gate_code, is_enabled);
      setGateDefinitions(prev =>
        prev.map(g => (g.id === id ? { ...g, is_enabled } : g))
      );
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to toggle gate.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500 dark:text-white/50 text-sm animate-pulse">
        Loading institution profile &amp; quality gate rules...
      </div>
    );
  }

  if (!org) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500 dark:text-slate-400">
        <AlertCircle className="w-12 h-12 text-rose-500 dark:text-rose-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Institution not found</h2>
        <Link href="/organizations" className="text-amber-600 dark:text-gold-400 hover:underline text-sm mt-2 inline-block">
          Return to Institutions list
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'palette', label: 'Brand Palette', icon: Palette },
    { id: 'language', label: 'Language Policy', icon: Languages },
    { id: 'boundary', label: 'Boundary Terms', icon: ShieldAlert },
    { id: 'mascot', label: 'Mascot & Persona', icon: Smile },
    { id: 'guidelines', label: 'Quality Guidelines', icon: BookOpen },
    { id: 'gates', label: 'Deterministic Gates', icon: ShieldCheck },
    { id: 'general', label: 'General Info', icon: Building2 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/organizations"
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/15 text-slate-700 hover:text-slate-900 dark:text-white/70 dark:hover:text-white rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-extrabold text-slate-900 dark:text-white">
                {org.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-display font-bold bg-amber-500/10 dark:bg-primary-950 text-amber-800 dark:text-gold-400 border border-amber-500/20 dark:border-gold-500/30">
                {org.institution_type}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5">
              Configure deterministic quality gates and identity parameters for this institution
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold active:scale-95 text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-sm dark:shadow-glow-gold transition-all disabled:opacity-50 select-none cursor-pointer"
        >
          {saveSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-950" />
              <span>Saved Successfully!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save All Settings'}</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-display font-bold flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-amber-500 text-white dark:bg-gradient-gold dark:text-primary-900 shadow-sm dark:shadow-glow-gold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-white dark:bg-[#001530]/80 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-card backdrop-blur-md">
        {activeTab === 'palette' && (
          <BrandPaletteEditor
            palette={org.brand_palette}
            orgSlug={org.slug}
            logoUrl={org.logo_url}
            onLogoChange={(url) => setOrg({ ...org, logo_url: url })}
            onChange={(updated) => setOrg({ ...org, brand_palette: updated })}
          />
        )}

        {activeTab === 'language' && (
          <LanguagePolicyEditor
            policy={org.language_policy}
            onChange={(updated) => setOrg({ ...org, language_policy: updated })}
          />
        )}

        {activeTab === 'boundary' && (
          <BoundaryTermsEditor
            boundaryTerms={org.boundary_terms}
            onChange={(updated) => setOrg({ ...org, boundary_terms: updated })}
          />
        )}

        {activeTab === 'mascot' && (
          <MascotConfigEditor
            mascot={org.mascot_config}
            onChange={(updated) => setOrg({ ...org, mascot_config: updated })}
          />
        )}

        {activeTab === 'guidelines' && (
          <QualityGuidelinesEditor
            guidelines={org.quality_guidelines || { authority_name: '', core_guidelines: '', reference_url: '' }}
            onChange={(updated) => setOrg({ ...org, quality_guidelines: updated })}
          />
        )}

        {activeTab === 'gates' && (
          <GateConfigPanel
            gateDefinitions={gateDefinitions}
            onToggle={handleToggleGate}
          />
        )}

        {activeTab === 'general' && (
          <div className="space-y-4 max-w-lg">
            <h3 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500 dark:text-gold-400" />
              General Metadata
            </h3>

            <div>
              <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                Institution Name
              </label>
              <input
                type="text"
                value={org.name}
                onChange={(e) => setOrg({ ...org, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
              />
            </div>

            <div>
              <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                Identifier Slug
              </label>
              <input
                type="text"
                value={org.slug}
                onChange={(e) => setOrg({ ...org, slug: e.target.value })}
                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
              />
            </div>

            <div>
              <label className="block text-xs font-display font-semibold text-slate-700 dark:text-white/80 mb-1">
                Archetype Classification
              </label>
              <select
                value={org.institution_type}
                onChange={(e) => setOrg({ ...org, institution_type: e.target.value as any })}
                className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-400"
              >
                <option value="university" className="bg-white text-slate-900 dark:bg-[#001530] dark:text-white">University / Higher Education Faculty</option>
                <option value="academy" className="bg-white text-slate-900 dark:bg-[#001530] dark:text-white">Coding &amp; STEM Academy</option>
                <option value="nursery" className="bg-white text-slate-900 dark:bg-[#001530] dark:text-white">Nursery &amp; Early Childhood</option>
                <option value="school" className="bg-white text-slate-900 dark:bg-[#001530] dark:text-white">K-12 School</option>
                <option value="training_center" className="bg-white text-slate-900 dark:bg-[#001530] dark:text-white">Corporate Training Center</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrganizationSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-white/50 text-sm animate-pulse">Loading settings...</div>}>
      <SettingsContent orgId={resolvedParams?.id} />
    </Suspense>
  );
}
