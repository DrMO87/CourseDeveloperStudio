'use client';

import React from 'react';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { Sidebar } from './Sidebar';
import { ThemeSwitcher, ZoomController } from '@/components/ThemeProvider';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggleCollapse } = useSidebar();

  return (
    <div
      className={cn(
        'flex-1 flex flex-col min-w-0 pt-14 md:pt-0 transition-[padding] duration-300 ease-in-out',
        isCollapsed ? 'md:pl-20' : 'md:pl-64'
      )}
    >
      {/* Top Info Bar */}
      <header className="h-14 border-b border-theme bg-white/85 dark:bg-[#001530]/75 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
        <div className="flex items-center gap-3">
          {/* Desktop Retractable Toggle Button */}
          <button
            onClick={toggleCollapse}
            className="hidden md:inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition border border-transparent hover:border-slate-200 dark:hover:border-white/10"
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-amber-600 dark:text-gold-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          <span className="text-xs font-display font-bold text-slate-900 dark:text-white/90 hidden sm:inline">
            Session Master
          </span>
          <span className="text-slate-400 dark:text-white/30 hidden sm:inline">•</span>
          <span className="text-xs font-display font-semibold text-amber-600 dark:text-gold-400">
            Course Developer Studio
          </span>
        </div>

          {/* Dynamic Device Mode Badge & PWA Install */}
          <PwaInstallPrompt />

          {/* Zoom Controller: Zoom In (+) / Zoom Out (-) / Reset (100%) */}
          <ZoomController />

          {/* Theme Switcher: Day (Default White) | Night (Dark Blue) | Auto */}
          <ThemeSwitcher />

          <span className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-bold bg-amber-50 dark:bg-primary-950 text-amber-800 dark:text-gold-400 border border-amber-300 dark:border-gold-500/30 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Supabase Online</span>
          </span>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-slate-50/60 dark:bg-gradient-to-b dark:from-[#001530]/40 dark:via-[#020617] dark:to-[#020617] transition-colors duration-200">
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar />
      <MainLayoutContent>{children}</MainLayoutContent>
    </SidebarProvider>
  );
}

