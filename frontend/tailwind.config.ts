import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        // HUE Royal Navy — brand primary
        primary: {
          50:  '#eef2ff',
          100: '#dde5ff',
          200: '#bfcbff',
          300: '#94a8ff',
          400: '#6680ff',
          500: '#4361ff',
          600: '#2640f5',
          700: '#1d32e0',
          800: '#1929b5',
          900: '#002147', // HUE official navy
          950: '#000d2b',
          DEFAULT: '#002147',
        },
        // HUE Radiant Gold — brand accent
        gold: {
          50:  '#fffceb',
          100: '#fff6c6',
          200: '#ffed88',
          300: '#ffe04a',
          400: '#FFD31A',
          500: '#FFB81C', // HUE official gold
          600: '#d98f00',
          700: '#b36900',
          800: '#8f4f00',
          900: '#6b3800',
          DEFAULT: '#FFB81C',
        },
        // Surface & Glass tokens
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        brand: {
          navy: '#002147',
          gold: '#FFB81C',
          dark: 'var(--brand-dark, #001530)',
          yellow: 'var(--brand-yellow, #FFB81C)',
          gray: 'var(--brand-gray, #64748b)',
          light: 'var(--brand-light, #FFFFFF)',
          primary: 'var(--brand-primary, #002147)',
          accent: 'var(--brand-accent, #FFB81C)',
        },
      },
      backgroundImage: {
        'gradient-sidebar': 'linear-gradient(180deg, #002147 0%, #001530 60%, #000d1f 100%)',
        'gradient-gold':    'linear-gradient(135deg, #FFB81C 0%, #FFE04A 100%)',
        'gradient-hero':    'linear-gradient(135deg, #002147 0%, #1929b5 60%, #4361ff 100%)',
        'gradient-glass':   'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
      },
      boxShadow: {
        'glow-gold':    '0 0 24px rgba(255,184,28,0.35)',
        'glow-primary': '0 0 24px rgba(67,97,255,0.30)',
        'card':         '0 1px 3px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.2)',
        'card-hover':   '0 4px 8px rgba(0,0,0,0.15), 0 12px 32px rgba(0,0,0,0.3)',
        'sidebar':      '4px 0 24px rgba(0,0,0,0.35)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
export default config;
