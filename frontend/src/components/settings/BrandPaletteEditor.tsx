import React, { useState, useRef } from 'react';
import { Plus, Trash2, Palette, CheckCircle2, UploadCloud, Image as ImageIcon, Loader2, Type, Sparkles, Wand2 } from 'lucide-react';
import type { BrandPalette } from '@/lib/types';
import { supabase, MODERN_ARABIC_FONTS, MODERN_LATIN_FONTS, CURATED_COLOR_PALETTES } from '@/lib/supabase';

interface Props {
  palette: BrandPalette;
  onChange: (updated: BrandPalette) => void;
  orgSlug?: string;
  logoUrl?: string | null;
  onLogoChange?: (url: string) => void;
}

export function BrandPaletteEditor({ palette, onChange, orgSlug, logoUrl, onLogoChange }: Props) {
  const [newApproved, setNewApproved] = useState('#10B981');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl || null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fontArabic = palette.font_arabic || 'Cairo';
  const fontLatin = palette.font_latin || 'Inter';

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgSlug) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgSlug', orgSlug);
      formData.append('logoType', 'primary');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setLogoPreview(data.url);
        onLogoChange?.(data.url);
      } else {
        alert('Failed to upload logo: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Logo upload failed.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const addApprovedColor = (hexToAdd?: string) => {
    const target = (hexToAdd || newApproved).trim().toUpperCase();
    if (!/^#[0-9A-Fa-f]{6}$/.test(target)) return;
    if (!palette.approved.includes(target)) {
      onChange({
        ...palette,
        approved: [...palette.approved, target],
        retired: palette.retired || []
      });
      if (!hexToAdd) setNewApproved('#10B981');
    }
  };

  const removeApprovedColor = (hex: string) => {
    onChange({
      ...palette,
      approved: palette.approved.filter(c => c !== hex),
      retired: palette.retired || []
    });
  };

  const handleApplyPreset = (approved: string[], retired: string[], fontAr?: string, fontLa?: string) => {
    onChange({
      ...palette,
      approved: [...approved],
      retired: [...retired],
      font_arabic: fontAr || palette.font_arabic || 'Cairo',
      font_latin: fontLa || palette.font_latin || 'Inter'
    });
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Palette className="w-5 h-5 text-amber-500 dark:text-gold-400" />
          Brand Color Themes &amp; Modern Typography Pairing
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Select a ready-made academic color theme or customize your institutional palette and modern Arabic/English fonts. These brand guidelines automatically format slide decks, syllabus dossiers, and exported student materials.
        </p>
      </div>

      {/* 1. Curated Color Themes to Choose From */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <span className="text-sm font-display font-bold text-slate-900 dark:text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Curated Academic &amp; Creative Color Themes
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">1-Click Apply Theme &amp; Font Pairing</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CURATED_COLOR_PALETTES.map((preset) => {
            const isMatch = preset.approved.length === palette.approved.length && 
              preset.approved.every((c, i) => c.toLowerCase() === palette.approved[i]?.toLowerCase());
            return (
              <div
                key={preset.id}
                onClick={() => handleApplyPreset(preset.approved, preset.retired, preset.recommendedFontArabic, preset.recommendedFontLatin)}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer group ${
                  isMatch
                    ? 'border-amber-500 dark:border-gold-400 bg-amber-50/80 dark:bg-gold-400/10 ring-2 ring-amber-500/30 dark:ring-gold-400/30 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-amber-400 dark:hover:border-slate-700 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-display font-bold text-slate-900 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-gold-400 transition-colors">
                      {preset.name}
                    </span>
                    {isMatch && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white dark:bg-gold-400 dark:text-primary-950 uppercase tracking-wider">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-snug">
                    {preset.description}
                  </span>
                </div>

                {/* Color Swatches */}
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    {preset.approved.map((c) => (
                      <span
                        key={c}
                        className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-800 shadow-2xs shrink-0"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>

                  {preset.recommendedFontArabic && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-between">
                      <span>Font:</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold truncate">
                        {preset.recommendedFontArabic} + {preset.recommendedFontLatin}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Modern Typography & Font Selection */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-display font-bold text-slate-900 dark:text-sky-400 flex items-center gap-2">
            <Type className="w-4 h-4 text-sky-500" />
            Institutional Typography &amp; Modern Font Pairing
          </span>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            {fontArabic} + {fontLatin}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Modern Arabic Font (للغة العربية)
            </label>
            <select
              value={fontArabic}
              onChange={(e) => onChange({ ...palette, font_arabic: e.target.value })}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-400 transition"
            >
              {MODERN_ARABIC_FONTS.map((f) => (
                <option key={f.name} value={f.name} className="bg-white text-slate-900 dark:bg-[#001530] dark:text-white">
                  {f.label} — {f.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Modern English / Latin Font
            </label>
            <select
              value={fontLatin}
              onChange={(e) => onChange({ ...palette, font_latin: e.target.value })}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-400 transition"
            >
              {MODERN_LATIN_FONTS.map((f) => (
                <option key={f.name} value={f.name} className="bg-white text-slate-900 dark:bg-[#001530] dark:text-white">
                  {f.label} — {f.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Font Preview Box */}
        <div 
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 space-y-2.5 shadow-xs"
          style={{ borderLeftColor: palette.approved[0] || '#002147', borderLeftWidth: '4px' }}
        >
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5">
            <span>Live Typography Preview:</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">{fontArabic} • {fontLatin}</span>
          </div>
          <p 
            dir="rtl"
            className="text-base font-bold text-slate-900 dark:text-slate-100 leading-relaxed"
            style={{ fontFamily: `'${fontArabic}', sans-serif` }}
          >
            جامعة المستقبل • تصميم المناهج الأكاديمية والتقييم المعياري المعتمد
          </p>
          <p 
            className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-normal"
            style={{ fontFamily: `'${fontLatin}', sans-serif` }}
          >
            Course Developer Studio — Institutional Quality Gates &amp; Syllabus Specifications
          </p>
        </div>
      </div>

      {/* 3. Active Approved Colors & Custom Palette */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-display font-bold text-slate-900 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Approved Brand Colors ({palette.approved.length})
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Custom Hex Values</span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {palette.approved.map((hex) => (
            <div
              key={hex}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 shadow-2xs"
            >
              <span
                className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shadow-inner"
                style={{ backgroundColor: hex }}
              />
              <span>{hex}</span>
              {palette.approved.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeApprovedColor(hex)}
                  className="text-slate-400 hover:text-rose-500 transition ml-0.5"
                  title="Remove color"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {palette.approved.length === 0 && (
            <span className="text-xs text-slate-500 italic">No approved colors defined yet.</span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
          <input
            type="color"
            value={newApproved.startsWith('#') && newApproved.length === 7 ? newApproved : '#10B981'}
            onChange={(e) => setNewApproved(e.target.value.toUpperCase())}
            className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700 bg-transparent p-0"
            title="Pick custom color"
          />
          <input
            type="text"
            placeholder="#10B981"
            value={newApproved}
            onChange={(e) => setNewApproved(e.target.value)}
            className="w-32 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => addApprovedColor()}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Color
          </button>
        </div>
      </div>

      {/* 4. Institutional Logo Section */}
      {orgSlug && (
        <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-display font-bold text-slate-900 dark:text-amber-400 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-500" />
              Institutional / Faculty Logo &amp; Identity Assets
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Auto-synced to Vault: 02_Areas/{orgSlug}/_assets/
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
            {/* Logo Preview */}
            <div className="w-32 h-32 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2 relative overflow-hidden group shadow-xs">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Institution Logo"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-400">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px]">No Logo Set</span>
                </div>
              )}
            </div>

            {/* Upload Controls */}
            <div className="space-y-2 flex-1">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Upload official University, Faculty, or Academy high-res logos (PNG / SVG). These will be automatically injected into generated presentations and slide templates.
              </p>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
              />

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 dark:bg-gradient-gold text-white dark:text-primary-900 font-display font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading Logo...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{logoPreview ? 'Change Institution Logo' : 'Upload Institution Logo'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

