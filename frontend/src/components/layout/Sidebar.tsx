'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

const navGroups = [
  {
    label: 'Curriculum Lifecycle',
    items: [
      { href: '/projects', label: '1. Curriculum Projects', icon: BookOpen },
      { href: '/dossier', label: '2. Course Dossier Hub', icon: FolderArchive },
      { href: '/dossier/validate', label: '3. Validate Content', icon: FileCheck2 },
      { href: '/', label: '4. Studio Swarm Dashboard', icon: Layers },
      { href: '/graph', label: '5. Obsidian Knowledge Map', icon: Share2 },
    ],
  },
  {
    label: 'Governance & Rules',
    items: [
      { href: '/organizations', label: 'Institutions & Profiles', icon: Building2 },
    ],
  },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

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
          onClick={() => setIsOpen(!isOpen)}
          className="text-white p-2 focus:outline-none bg-white/10 rounded-xl"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 w-64 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out border-r border-white/10 bg-gradient-to-b from-[#002147] via-[#001530] to-[#000d1f]",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Full-Size Prominent Logo & Branding Area with Hard Constraints */}
        <div className="px-5 pt-6 pb-4 border-b border-white/10 space-y-2">
          <Link href="/" className="block group">
            <div className="w-full flex items-center justify-center p-1" style={{ maxWidth: '220px', minHeight: '80px' }}>
              <Image
                src="/images/logo-session-master-transparent.png"
                alt="Session Master Logo"
                width={220}
                height={120}
                style={{ width: '100%', height: 'auto', maxWidth: '210px', maxHeight: '110px', objectFit: 'contain' }}
                className="group-hover:scale-[1.03] transition-transform duration-300"
                priority
              />
            </div>
          </Link>
          <div className="text-center pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-display font-extrabold uppercase tracking-widest bg-gradient-gold text-primary-900 shadow-glow-gold">
              Course Developer Studio
            </span>
          </div>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] font-display font-bold text-white/35 uppercase tracking-widest">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : item.href === '/dossier'
                      ? pathname === '/dossier'
                      : pathname.startsWith(item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-display font-semibold transition-all duration-150',
                          isActive
                            ? 'bg-white/15 text-white shadow-sm'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        {/* Active Gold Bar */}
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full shadow-glow-gold bg-gradient-gold"
                          />
                        )}
                        <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-gold-400' : 'text-white/50')} />
                        <span className="flex-1">{item.label}</span>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom Section with HUE Version & Attribution */}
        <div className="px-5 py-4 border-t border-white/10 space-y-3 bg-black/20">
          {/* Version Badge */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-gold text-primary-900 flex items-center justify-center font-display font-black text-[10px] shadow-glow-gold flex-shrink-0">
              HUE
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white/90 text-xs font-display font-bold leading-tight truncate">Horus University — Egypt</p>
              <p className="text-white/40 text-[10px] font-mono mt-0.5">Session Master · v2.5</p>
            </div>
          </div>

          {/* Designed & Executed By */}
          <div className="pt-2 border-t border-white/5">
            <p className="text-white/35 text-[9px] leading-relaxed">
              Designed &amp; Executed by<br />
              <span className="text-gold-400 font-display font-bold text-[10px]">Prof. Mahmoud Elkhoudary</span>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
