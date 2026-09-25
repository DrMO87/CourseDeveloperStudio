'use client';

import { useState, useEffect } from 'react';
import type { DeviceMode } from './device-detection';

/**
 * Client-side hook to determine if the user is running on Mobile (Phone/Tablet)
 * or PC/Desktop, and whether running as an installed PWA.
 */
export function useDeviceMode(): DeviceMode {
  const [device, setDevice] = useState<DeviceMode>({
    isMobile: false,
    isDesktop: true,
    isPwa: false,
    platform: 'desktop',
  });

  useEffect(() => {
    const checkDevice = () => {
      if (typeof window === 'undefined') return;

      const ua = navigator.userAgent || '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
      const isTouchScreen = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const isNarrowWidth = window.innerWidth <= 768;

      // Classify as mobile if mobile UA or touch+narrow screen
      const isMobile = isMobileUA || (isTouchScreen && isNarrowWidth);
      const isPwa =
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        Boolean((navigator as any).standalone);

      setDevice({
        isMobile,
        isDesktop: !isMobile,
        isPwa,
        platform: isMobile ? 'mobile' : 'desktop',
      });
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return device;
}
