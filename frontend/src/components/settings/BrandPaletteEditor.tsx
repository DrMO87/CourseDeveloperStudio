import React, { useState, useRef } from 'react';
import { Plus, Trash2, Palette, CheckCircle2, UploadCloud, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { BrandPalette } from '@/lib/types';

interface Props {
  palette: BrandPalette;
  onChange: (updated: BrandPalette) => void;
  orgSlug?: string;
  logoUrl?: string | null;
  onLogoChange?: (url: string) => void;
}

export function BrandPaletteEditor({ palette, onChange, orgSlug, logoUrl, onLogoChange }: Props) {
  const [newApproved, setNewApproved] = useState('#');
  const [newRetired, setNewRetired] = useState('#');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl || null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgSlug) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgSlug', orgSlug);
      formData.append('logoType', 'primary');

      const res = await fetch('/api/upload-logo', {
        method: 'POST',
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

  const addApprovedColor = () => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(newApproved)) return;
    if (!palette.approved.includes(newApproved.toUpperCase())) {
      onChange({
        ...palette,
        approved: [...palette.approved, newApproved.toUpperCase()]
      });
      setNewApproved('#');
    }
  };

  const removeApprovedColor = (hex: string) => {
    onChange({
      ...palette,
      approved: palette.approved.filter(c => c !== hex)
    });
  };

  const addRetiredColor = () => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(newRetired)) return;
    if (!palette.retired.includes(newRetired.toUpperCase())) {
      onChange({
        ...palette,
        retired: [...palette.retired, newRetired.toUpperCase()]
      });
      setNewRetired('#');
    }
  };

  const removeRetiredColor = (hex: string) => {
    onChange({
      ...palette,
      retired: palette.retired.filter(c => c !== hex)
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Palette className="w-5 h-5 text-amber-400" />
          Brand Color Palette Gate Rules
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Define approved and deprecated hex color codes. The Brand Palette Gate will automatically pass compliant colors and reject retired colors in slides and student materials.
        </p>
      </div>

      {/* Institutional Logo Section */}
      {orgSlug && (
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-400 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Institutional / Faculty Logo &amp; Identity Assets
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Auto-synced to Vault: 02_Areas/{orgSlug}/_assets/
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
            {/* Logo Preview */}
            <div className="w-32 h-32 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center p-2 relative overflow-hidden group">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Institution Logo"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-500">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px]">No Logo Set</span>
                </div>
              )}
            </div>

            {/* Upload Controls */}
            <div className="space-y-2 flex-1">
              <p className="text-xs text-slate-300">
                Upload official University, Faculty, or Academy high-res logos (PNG / SVG). These will be automatically injected into generated NotebookLM presentations and slide templates.
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
                  className="px-4 py-2 bg-gradient-gold text-primary-900 font-display font-extrabold rounded-lg text-xs flex items-center gap-1.5 shadow-sm hover:opacity-90 transition disabled:opacity-50"
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

      {/* Approved Colors */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Approved Brand Colors ({palette.approved.length})
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {palette.approved.map((hex) => (
            <div
              key={hex}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-mono text-slate-200 shadow-sm"
            >
              <span
                className="w-4 h-4 rounded-full border border-slate-600 shadow-inner"
                style={{ backgroundColor: hex }}
              />
              <span>{hex}</span>
              <button
                type="button"
                onClick={() => removeApprovedColor(hex)}
                className="text-slate-400 hover:text-rose-400 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {palette.approved.length === 0 && (
            <span className="text-xs text-slate-500 italic">No approved colors defined yet.</span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            placeholder="#FFED10"
            value={newApproved}
            onChange={(e) => setNewApproved(e.target.value)}
            className="w-36 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={addApprovedColor}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Approved
          </button>
        </div>
      </div>

      {/* Retired Colors */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-rose-400 flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" />
            Retired / Deprecated Colors ({palette.retired.length})
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {palette.retired.map((hex) => (
            <div
              key={hex}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rose-900/40 bg-rose-950/20 text-xs font-mono text-rose-200 shadow-sm"
            >
              <span
                className="w-4 h-4 rounded-full border border-rose-700 shadow-inner"
                style={{ backgroundColor: hex }}
              />
              <span>{hex}</span>
              <button
                type="button"
                onClick={() => removeRetiredColor(hex)}
                className="text-rose-400 hover:text-rose-300 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {palette.retired.length === 0 && (
            <span className="text-xs text-slate-500 italic">No retired colors defined.</span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            placeholder="#F5B301"
            value={newRetired}
            onChange={(e) => setNewRetired(e.target.value)}
            className="w-36 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-400"
          />
          <button
            type="button"
            onClick={addRetiredColor}
            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Retired
          </button>
        </div>
      </div>
    </div>
  );
}
