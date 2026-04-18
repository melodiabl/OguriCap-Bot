import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--bg) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        foreground: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',

        // Paleta temática OguriCap: misma familia visual que la landing pública
        oguri: {
          purple: {
            DEFAULT: 'rgb(var(--oguri-purple) / <alpha-value>)',
            50: '#ecfdf3',
            100: '#d2fbe1',
            200: '#a8f4c5',
            300: '#72e9a4',
            400: '#3bda7e',
            500: 'rgb(var(--oguri-purple) / <alpha-value>)',
            600: '#16a34a',
            700: '#15803d',
            800: '#166534',
            900: '#14532d',
            950: '#052e16',
          },
          lavender: {
            DEFAULT: 'rgb(var(--oguri-lavender) / <alpha-value>)',
            50: '#f0fdf4',
            100: '#dcfce7',
            200: '#bbf7d0',
            300: 'rgb(var(--oguri-lavender) / <alpha-value>)',
            400: '#86efac',
            500: '#4ade80',
            600: '#22c55e',
            700: '#16a34a',
            800: '#166534',
            900: '#14532d',
          },
          blue: {
            DEFAULT: 'rgb(var(--oguri-blue) / <alpha-value>)',
            50: '#f0fdfa',
            100: '#ccfbf1',
            200: '#99f6e4',
            300: 'rgb(var(--oguri-blue) / <alpha-value>)',
            400: '#2dd4bf',
            500: '#14b8a6',
            600: '#0d9488',
            700: '#0f766e',
            800: '#115e59',
            900: '#134e4a',
          },
          cyan: {
            DEFAULT: 'rgb(var(--oguri-cyan) / <alpha-value>)',
            50: '#ecfeff',
            100: '#cffafe',
            200: '#a5f3fc',
            300: 'rgb(var(--oguri-cyan) / <alpha-value>)',
            400: '#22d3ee',
            500: '#06b6d4',
            600: '#0891b2',
            700: '#0e7490',
            800: '#155e75',
            900: '#164e63',
          },
          gold: {
            DEFAULT: 'rgb(245 158 11 / <alpha-value>)',
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            300: '#fcd34d',
            400: 'rgb(245 158 11 / <alpha-value>)',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309',
            800: '#92400e',
            900: '#78350f',
          },
          phantom: {
            DEFAULT: 'rgb(var(--oguri-phantom-light) / <alpha-value>)',
            50: '#f3f7f4',
            100: '#dce9df',
            200: '#b8d0bf',
            300: '#8eac99',
            400: '#6d8d7b',
            500: '#536f5f',
            600: 'rgb(var(--oguri-phantom-light) / <alpha-value>)',
            700: 'rgb(var(--oguri-phantom-dark) / <alpha-value>)',
            800: '#111713',
            900: '#0d0f0e',
            950: '#060807',
          },
        },

        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          50: '#ecfdf3',
          100: '#d2fbe1',
          200: '#a8f4c5',
          300: '#72e9a4',
          400: '#3bda7e',
          500: '#25d366',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          cyan: '#2dd4bf',
          emerald: '#25d366',
          violet: '#ff4d8d',
          rose: '#ff4d8d',
          amber: '#f59e0b',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'slide-in-left': 'slideInLeft 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'bounce-in': 'bounceIn 0.6s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'pulse-glow-oguri': 'pulseGlowOguri 2.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'shimmer-oguri': 'shimmerOguri 3s linear infinite',
        'blob': 'blob 7s infinite',
        'glow-expand': 'glowExpand 0.6s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'prism-pan': 'prismPan 8s linear infinite',
        'orbital-float': 'orbitalFloat 9s ease-in-out infinite',
        'signal-wave': 'signalWave 2.6s ease-out infinite',
        'scanline': 'scanline 3.2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(45, 212, 191, 0.5), 0 0 20px rgba(45, 212, 191, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(45, 212, 191, 0.8), 0 0 40px rgba(45, 212, 191, 0.5)' },
        },
        pulseGlowOguri: {
          '0%, 100%': { 
            boxShadow: '0 0 8px rgba(37, 211, 102, 0.6), 0 0 25px rgba(45, 212, 191, 0.38), 0 0 40px rgba(255, 77, 141, 0.18)' 
          },
          '50%': { 
            boxShadow: '0 0 15px rgba(37, 211, 102, 0.88), 0 0 35px rgba(45, 212, 191, 0.55), 0 0 55px rgba(255, 77, 141, 0.24)' 
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        shimmerOguri: {
          '0%': { 
            backgroundPosition: '-200% 0',
            backgroundImage: 'linear-gradient(90deg, transparent, rgba(37, 211, 102, 0.35), rgba(45, 212, 191, 0.32), transparent)'
          },
          '100%': { 
            backgroundPosition: '200% 0',
            backgroundImage: 'linear-gradient(90deg, transparent, rgba(37, 211, 102, 0.35), rgba(45, 212, 191, 0.32), transparent)'
          },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        glowExpand: {
          '0%': { 
            boxShadow: '0 0 0 0 rgba(37, 211, 102, 0.65)',
            transform: 'scale(1)'
          },
          '50%': { 
            boxShadow: '0 0 20px 10px rgba(45, 212, 191, 0.34)',
            transform: 'scale(1.02)'
          },
          '100%': { 
            boxShadow: '0 0 0 0 rgba(37, 211, 102, 0)',
            transform: 'scale(1)'
          },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        prismPan: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        orbitalFloat: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '25%': { transform: 'translate3d(8px, -10px, 0) scale(1.04)' },
          '50%': { transform: 'translate3d(-6px, -18px, 0) scale(0.98)' },
          '75%': { transform: 'translate3d(10px, -8px, 0) scale(1.02)' },
        },
        signalWave: {
          '0%': { transform: 'scale(0.85)', opacity: '0.65' },
          '70%': { transform: 'scale(1.45)', opacity: '0' },
          '100%': { transform: 'scale(1.45)', opacity: '0' },
        },
        scanline: {
          '0%': { transform: 'translateY(-120%)' },
          '100%': { transform: 'translateY(220%)' },
        },
      },
      boxShadow: {
        'glow': '0 0 15px rgba(45, 212, 191, 0.5)',
        'glow-lg': '0 0 30px rgba(45, 212, 191, 0.6)',
        'glow-cyan': '0 0 20px rgba(45, 212, 191, 0.5)',
        'glow-emerald': '0 0 20px rgba(37, 211, 102, 0.5)',
        'inner-glow': 'inset 0 0 20px rgba(45, 212, 191, 0.3)',
        // Oguri Cap themed glows
        'glow-oguri-purple': '0 0 20px rgba(37, 211, 102, 0.55), 0 0 40px rgba(37, 211, 102, 0.26)',
        'glow-oguri-lavender': '0 0 20px rgba(167, 243, 199, 0.45), 0 0 40px rgba(37, 211, 102, 0.2)',
        'glow-oguri-blue': '0 0 20px rgba(45, 212, 191, 0.55), 0 0 40px rgba(45, 212, 191, 0.26)',
        'glow-oguri-cyan': '0 0 20px rgba(45, 212, 191, 0.55), 0 0 40px rgba(37, 211, 102, 0.2)',
        'glow-oguri-mixed': '0 0 15px rgba(37, 211, 102, 0.46), 0 0 30px rgba(45, 212, 191, 0.34), 0 0 45px rgba(255, 77, 141, 0.16)',
        'glow-oguri-cosmic': '0 0 24px rgba(37, 211, 102, 0.38), 0 0 54px rgba(45, 212, 191, 0.22), 0 0 96px rgba(255, 77, 141, 0.14)',
      },
      backgroundImage: {
        'gradient-oguri-primary': 'linear-gradient(135deg, rgb(37 211 102) 0%, rgb(45 212 191) 100%)',
        'gradient-oguri-power': 'linear-gradient(135deg, rgb(37 211 102) 0%, rgb(255 77 141) 100%)',
        'gradient-oguri-speed': 'linear-gradient(135deg, rgb(45 212 191) 0%, rgb(37 211 102) 100%)',
        'gradient-oguri-victory': 'linear-gradient(135deg, rgb(245 158 11) 0%, rgb(37 211 102) 100%)',
        'gradient-oguri-phantom': 'linear-gradient(135deg, rgb(13 15 14) 0%, rgb(17 23 19) 100%)',
        'gradient-oguri-spectrum': 'linear-gradient(135deg, rgb(37 211 102) 0%, rgb(45 212 191) 34%, rgb(255 77 141) 68%, rgb(245 158 11) 100%)',
        'gradient-oguri-signal': 'linear-gradient(135deg, rgb(37 211 102) 0%, rgb(45 212 191) 55%, rgb(255 77 141) 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
