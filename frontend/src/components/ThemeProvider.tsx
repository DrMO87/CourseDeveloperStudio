'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sun, Moon, Laptop, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { Organization } from '@/lib/types';
import { fetchOrganizations } from '@/lib/supabase';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  activeOrg: Organization | null;
  setActiveOrg: (org: Organization | null) => void;
  zoom: number;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
  activeOrg: null,
  setActiveOrg: () => {},
  zoom: 100,
  setZoom: () => {},
  zoomIn: () => {},
  zoomOut: () => {},
  resetZoom: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to 'light' (white background) as requested
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [zoom, setZoomState] = useState<number>(100);

  useEffect(() => {
    // Load persisted theme preference (defaults to 'light')
    const savedTheme = (localStorage.getItem('cds_theme_mode') as ThemeMode) || 'light';
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto') {
      setThemeState(savedTheme);
    }

    // Load persisted zoom level (defaults to 100%)
    const savedZoom = localStorage.getItem('cds_app_zoom');
    if (savedZoom) {
      const parsed = parseInt(savedZoom, 10);
      if (!isNaN(parsed) && parsed >= 70 && parsed <= 150) {
        setZoomState(parsed);
      }
    }

    // Initial Active Org
    fetchOrganizations().then((orgs) => {
      if (Array.isArray(orgs) && orgs.length > 0) {
        const savedOrgId = localStorage.getItem('cds_active_org_id');
        const found = (savedOrgId ? orgs.find(o => o?.id === savedOrgId) : null) || orgs[0];
        if (found) setActiveOrg(found);
      }
    }).catch(err => {
      console.warn('ThemeProvider fetchOrganizations error:', err);
    });

    // Listen for org updates
    const handleOrgUpdate = () => {
      fetchOrganizations().then((orgs) => {
        if (Array.isArray(orgs) && orgs.length > 0) {
          const savedOrgId = localStorage.getItem('cds_active_org_id');
          const found = (savedOrgId ? orgs.find(o => o?.id === savedOrgId) : null) || orgs[0];
          if (found) setActiveOrg(found);
        }
      }).catch(err => {
        console.warn('ThemeProvider handleOrgUpdate error:', err);
      });
    };
    window.addEventListener('cds_storage_updated', handleOrgUpdate);
    return () => window.removeEventListener('cds_storage_updated', handleOrgUpdate);
  }, []);

  // Apply Theme & Dynamic Brand Colors
  useEffect(() => {
    const updateTheme = () => {
      if (typeof window === 'undefined') return;
      let isDark = false;
      if (theme === 'auto') {
        isDark = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
      } else {
        isDark = theme === 'dark';
      }

      setResolvedTheme(isDark ? 'dark' : 'light');

      // Update HTML class
      const root = document.documentElement;
      if (root) {
        if (isDark) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }

        // Apply dynamic brand colors from active organization to the main window
        if (activeOrg && activeOrg.brand_palette?.approved && Array.isArray(activeOrg.brand_palette.approved)) {
          const primaryColor = activeOrg.brand_palette.approved[0] || '#002147';
          const accentColor = activeOrg.brand_palette.approved[1] || '#FFB81C';
          const secondaryColor = activeOrg.brand_palette.approved[2] || '#1929B5';

          root.style.setProperty('--brand-primary-dyn', primaryColor);
          root.style.setProperty('--brand-accent-dyn', accentColor);
          root.style.setProperty('--brand-secondary-dyn', secondaryColor);
        }
      }
    };

    updateTheme();

    if (theme === 'auto' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', updateTheme);
      return () => media.removeEventListener('change', updateTheme);
    }
  }, [theme, activeOrg]);

  // Apply Global Canvas Zoom (both Window and Sidebar scale smoothly)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const scaleFactor = (zoom || 100) / 100;
    const root = document.documentElement;
    if (root) {
      try {
        (root.style as any).zoom = `${scaleFactor}`;
        localStorage.setItem('cds_app_zoom', (zoom || 100).toString());
      } catch (e) {}
    }
  }, [zoom]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('cds_theme_mode', newTheme);
  };

  const zoomIn = () => {
    setZoomState(prev => Math.min(150, prev + 10));
  };

  const zoomOut = () => {
    setZoomState(prev => Math.max(70, prev - 10));
  };

  const resetZoom = () => {
    setZoomState(100);
  };

  const setZoom = (val: number | ((prev: number) => number)) => {
    setZoomState(val);
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      resolvedTheme, 
      setTheme, 
      activeOrg, 
      setActiveOrg, 
      zoom, 
      setZoom, 
      zoomIn, 
      zoomOut, 
      resetZoom 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl">
      <button
        onClick={() => setTheme('light')}
        className={`p-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1 transition-all ${
          theme === 'light'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Day Mode (Light / White Background)"
      >
        <Sun className="w-3.5 h-3.5 text-amber-500" />
        <span className="hidden xl:inline text-[11px]">Day</span>
      </button>

      <button
        onClick={() => setTheme('dark')}
        className={`p-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1 transition-all ${
          theme === 'dark'
            ? 'bg-slate-800 text-white shadow-sm'
            : 'text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Night Mode (Dark Blue Background)"
      >
        <Moon className="w-3.5 h-3.5 text-sky-400" />
        <span className="hidden xl:inline text-[11px]">Night</span>
      </button>

      <button
        onClick={() => setTheme('auto')}
        className={`p-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1 transition-all ${
          theme === 'auto'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Automatic (System Preference)"
      >
        <Laptop className="w-3.5 h-3.5 text-slate-400" />
        <span className="hidden xl:inline text-[11px]">Auto</span>
      </button>
    </div>
  );
}

export function ZoomController() {
  const { zoom, zoomIn, zoomOut, resetZoom } = useTheme();

  return (
    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl select-none">
      {/* Zoom Out Button */}
      <button
        onClick={zoomOut}
        disabled={zoom <= 70}
        className="p-1.5 rounded-lg text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition disabled:opacity-30"
        title="Zoom Out (Ctrl -)"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      {/* Current Zoom Level / Reset on Click */}
      <button
        onClick={resetZoom}
        className="px-2 py-1 text-[11px] font-mono font-bold text-slate-800 dark:text-white/90 hover:text-amber-600 dark:hover:text-gold-400 transition"
        title="Click to reset zoom to 100%"
      >
        {zoom}%
      </button>

      {/* Zoom In Button */}
      <button
        onClick={zoomIn}
        disabled={zoom >= 150}
        className="p-1.5 rounded-lg text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition disabled:opacity-30"
        title="Zoom In (Ctrl +)"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
