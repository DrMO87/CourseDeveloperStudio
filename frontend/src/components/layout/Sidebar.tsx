'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Layers,
  Building2,
  BookOpen,
  FolderArchive,
  Menu,
  X,
  ChevronRight,
  Share2,
  FileCheck2,
  Cpu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSidebar } from './SidebarContext';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

const navGroups = [
  {
    label: 'Curriculum Lifecycle',
    items: [
      { href: '/projects', label: '1. Curriculum Projects', shortLabel: 'Projects', step: '1', icon: BookOpen },
      { href: '/dossier', label: '2. Course Dossier Hub', shortLabel: 'Dossier', step: '2', icon: FolderArchive },
      { href: '/dossier/validate', label: '3. Validate Content', shortLabel: 'Validate', step: '3', icon: FileCheck2 },
      { href: '/matrix', label: '4. LLM Model Matrix', shortLabel: 'Matrix', step: '4', icon: Cpu },
      { href: '/', label: '5. Studio Swarm Dashboard', shortLabel: 'Swarm', step: '5', icon: Layers },
      { href: '/graph', label: '6. Obsidian Knowledge Map', shortLabel: 'Graph', step: '6', icon: Share2 },
    ],
  },
  {
    label: 'Governance & Rules',
    items: [
      { href: '/organizations', label: 'Institutions & Profiles', shortLabel: 'Institutions', step: 'Gov', icon: Building2 },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse, isMobileOpen, setIsMobileOpen, toggleMobile } = useSidebar();

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-gradient-to-r from-[#002147] to-[#001530] z-40 flex items-center justify-between px-4 border-b border-white/10 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 relative" style={{ maxWidth: '32px', maxHeight: '32px' }}>
            <Image
              src="/images/logo-session-master-transparent.png"
              alt="Session Master Logo"
              width={32}
              height={32}
              style={{ objectFit: 'contain', width: '100%', height: '100%' }}
            />
          </div>
          <div>
            <span className="text-white font-display font-bold text-xs tracking-wide block leading-none">Session Master</span>
            <span className="text-[9px] text-gold-400 font-medium">Course Developer Studio</span>
          </div>
        </div>
        <button
          onClick={toggleMobile}
          className="text-white p-2 focus:outline-none bg-white/10 rounded-xl"
          aria-label="Toggle mobile menu"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 h-screen min-h-screen shadow-2xl z-50 flex flex-col transition-all duration-300 ease-in-out border-r border-white/10 bg-gradient-to-b from-[#002147] via-[#001530] to-[#000d1f]",
          isMobileOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0",
          !isMobileOpen && (isCollapsed ? "md:w-20" : "md:w-64")
        )}
      >
        {/* Top Header / Branding Area */}
        {isCollapsed && !isMobileOpen ? (
          /* Retracted Mode Header */
          <div className="pt-4 pb-3 flex flex-col items-center border-b border-white/10 gap-2">
            <Link href="/" className="block group p-1" title="Session Master Home">
              <div className="w-10 h-10 relative flex items-center justify-center rounded-xl bg-white/5 group-hover:bg-white/10 transition border border-white/10">
                <Image
                  src="/images/logo-session-master-transparent.png"
                  alt="Session Master Logo"
                  width={32}
                  height={32}
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>
            </Link>

            <button
              onClick={toggleCollapse}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gold-400 hover:text-white hover:bg-white/10 transition border border-gold-500/20 shadow-sm"
              title="Expand Sidebar (Ctrl+B)"
              aria-label="Expand Sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Expanded Mode Header */
          <div className="px-5 pt-4 pb-4 border-b border-white/10 space-y-2 relative">
            <div className="hidden md:flex justify-end">
              <button
                onClick={toggleCollapse}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition border border-transparent hover:border-white/10"
                title="Retract Sidebar (Ctrl+B)"
                aria-label="Retract Sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            <Link href="/" className="block group">
              <div className="w-full flex items-center justify-center p-1" style={{ maxWidth: '220px', minHeight: '65px' }}>
                <Image
                  src="/images/logo-session-master-transparent.png"
                  alt="Session Master Logo"
                  width={220}
                  height={120}
                  style={{ width: '100%', height: 'auto', maxWidth: '210px', maxHeight: '95px', objectFit: 'contain' }}
                  className="group-hover:scale-[1.03] transition-transform duration-300"
                  priority
                />
              </div>
            </Link>
            <div className="text-center pt-0.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-display font-extrabold uppercase tracking-widest bg-gradient-gold text-primary-900 shadow-glow-gold">
                Course Developer Studio
              </span>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className={cn("flex-1 overflow-y-auto no-scrollbar py-4 space-y-5", isCollapsed && !isMobileOpen ? "px-2" : "px-3")}>
          {navGroups.map((group, groupIdx) => (
            <div key={group.label}>
              {isCollapsed && !isMobileOpen ? (
                groupIdx > 0 && <div className="border-t border-white/10 my-3 mx-2" />
              ) : (
                <p className="px-3 mb-2 text-[10px] font-display font-bold text-white/35 uppercase tracking-widest">
                  {group.label}
                </p>
              )}

              <ul className="space-y-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : item.href === '/dossier'
                      ? pathname === '/dossier'
                      : pathname.startsWith(item.href);

                  if (isCollapsed && !isMobileOpen) {
                    return (
                      <li key={item.href} className="relative group">
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileOpen(false)}
                          className={cn(
                            'w-12 h-12 mx-auto flex items-center justify-center rounded-xl transition-all duration-200 relative',
                            isActive
                              ? 'bg-white/15 text-gold-400 border border-gold-500/40 shadow-glow-gold'
                              : 'text-white/60 hover:bg-white/10 hover:text-white border border-transparent'
                          )}
                          aria-label={item.label}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-gold shadow-glow-gold" />
                          )}
                          <Icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-gold-400' : 'text-white/60 group-hover:text-white')} />
                        </Link>

                        {/* Floating Tooltip */}
                        <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#001b3a]/95 backdrop-blur-md border border-gold-500/40 text-white text-xs font-display font-semibold rounded-xl shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all duration-150 z-50 whitespace-nowrap flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-gradient-gold text-primary-900 font-extrabold text-[10px] flex items-center justify-center flex-shrink-0 shadow-sm">
                            {item.step}
                          </span>
                          <span>{item.label}</span>
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />}
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-display font-semibold transition-all duration-150',
                          isActive
                            ? 'bg-white/15 text-white shadow-sm'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full shadow-glow-gold bg-gradient-gold"
                          />
                        )}
                        <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-gold-400' : 'text-white/50')} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom Section: HUE Attribution */}
        {isCollapsed && !isMobileOpen ? (
          <div className="py-4 border-t border-white/10 bg-black/20 flex flex-col items-center group relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-gold text-primary-900 flex items-center justify-center font-display font-black text-xs shadow-glow-gold cursor-default">
              HUE
            </div>
            <div className="absolute left-[calc(100%+10px)] bottom-3 px-3.5 py-2 bg-[#001b3a]/95 backdrop-blur-md border border-gold-500/40 text-white rounded-xl shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all duration-150 z-50 whitespace-nowrap">
              <p className="text-white/90 text-xs font-display font-bold">Horus University — Egypt</p>
              <p className="text-gold-400 text-[10px] font-mono">Session Master • v2.5</p>
              <p className="text-white/40 text-[9px] mt-1 border-t border-white/10 pt-1">Prof. Mahmoud Elkhoudary</p>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 border-t border-white/10 space-y-3 bg-black/20">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-gold text-primary-900 flex items-center justify-center font-display font-black text-[10px] shadow-glow-gold flex-shrink-0">
                HUE
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white/90 text-xs font-display font-bold leading-tight truncate">Horus University — Egypt</p>
                <p className="text-white/40 text-[10px] font-mono mt-0.5">Session Master • v2.5</p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <p className="text-white/35 text-[9px] leading-relaxed">
                Designed &amp; Executed by<br />
                <span className="text-gold-400 font-display font-bold text-[10px]">Prof. Mahmoud Elkhoudary</span>
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
