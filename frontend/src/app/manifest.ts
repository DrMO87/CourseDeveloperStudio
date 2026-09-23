import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Session Master — Course Developer Studio',
    short_name: 'SessionMaster',
    description: 'Autonomous Multi-Agent Curriculum Engineering & Second Brain Platform for Horus University in Egypt',
    start_url: '/',
    display: 'standalone',
    background_color: '#001530',
    theme_color: '#002147',
    orientation: 'any',
    categories: ['education', 'productivity', 'academic'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
