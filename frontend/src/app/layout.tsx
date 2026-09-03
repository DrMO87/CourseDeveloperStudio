import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { ThemeProvider, ThemeSwitcher, ZoomController } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Session Master — Course Developer Studio | Horus University-Egypt',
  description: 'Session Master: Course Developer Studio — Autonomous Multi-Agent Curriculum Engineering & Second Brain Synchronization Platform for Horus University-Egypt.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className="antialiased min-h-screen font-sans flex bg-canvas text-theme-primary transition-colors duration-200 overflow-x-hidden">
        <ThemeProvider>
          {/* Left Sidebar (fixed Session Master HUE branding) */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 md:pl-64 pt-14 md:pt-0">
            {/* Top Info Bar */}
            <header className="h-14 border-b border-theme bg-white/85 dark:bg-[#001530]/75 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xs font-display font-bold text-slate-900 dark:text-white/90 hidden sm:inline">
                  Session Master
                </span>
                <span className="text-slate-400 dark:text-white/30 hidden sm:inline">•</span>
                <span className="text-xs font-display font-semibold text-amber-600 dark:text-gold-400">
                  Course Developer Studio
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Zoom Controller: Zoom In (+) / Zoom Out (-) / Reset (100%) */}
                <ZoomController />

                {/* Theme Switcher: Day (Default White) | Night (Dark Blue) | Auto */}
                <ThemeSwitcher />

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-bold bg-amber-50 dark:bg-primary-950 text-amber-800 dark:text-gold-400 border border-amber-300 dark:border-gold-500/30 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline">Supabase Online</span>
                </span>
              </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-slate-50/60 dark:bg-gradient-to-b dark:from-[#001530]/40 dark:via-[#020617] dark:to-[#020617] transition-colors duration-200 overflow-y-auto">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
