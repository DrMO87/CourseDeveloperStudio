'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor, CheckCircle2, Sparkles } from 'lucide-react';
import { useDeviceMode } from '@/lib/use-device-mode';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallPrompt() {
  const { isMobile, isPwa } = useDeviceMode();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] ServiceWorker registration failed:', err);
        });
    }

    // 2. Check if already running standalone
    if (isPwa) {
      setIsInstalled(true);
    }

    // 3. Capture beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowToast(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowToast(false);
      console.log('[PWA] App was successfully installed!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isPwa]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowToast(false);
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Dynamic Device Mode Badge */}
      <div
        className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-display font-bold border transition-colors shadow-xs ${
          isMobile
            ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700/50'
            : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700/50'
        }`}
        title={
          isMobile
            ? 'Operating in Mobile Mode: Local models disabled. High-speed Cloud models (Groq, Gemini, Claude, OpenAI) active.'
            : 'Operating in PC Desktop Mode: Both Local LM Studio / Ollama servers and Cloud models available.'
        }
      >
        {isMobile ? (
          <>
            <Smartphone className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            <span>Mobile (Cloud Only)</span>
          </>
        ) : (
          <>
            <Monitor className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            <span className="hidden sm:inline">PC Mode (Local &amp; Cloud)</span>
            <span className="sm:hidden">PC Mode</span>
          </>
        )}
      </div>

      {/* 1-Tap Install Button (shows when browser fires install prompt) */}
      {deferredPrompt && !isInstalled && (
        <button
          onClick={handleInstallClick}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xs transition animate-pulse"
          title="Install Course Developer Studio as a Progressive Web App on your device"
        >
          <Download className="w-3 h-3" />
          <span>Install App</span>
        </button>
      )}

      {/* Installed PWA indicator */}
      {isPwa && (
        <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-2.5 h-2.5" /> PWA
        </span>
      )}
    </div>
  );
}
