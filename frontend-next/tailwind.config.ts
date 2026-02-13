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

        // Paleta temática de Oguri Cap
        oguri: {
          purple: {
            DEFAULT: 'rgb(91 61 173 / <alpha-value>)',
            50: '#f5f3ff',
            100: '#ede9fe',
            200: '#ddd6fe',
            300: '#c4b5fd',
            400: '#a78bfa',
            500: 'rgb(91 61 173 / <alpha-value>)',
            600: '#7c3aed',
            700: '#6d28d9',
            800: '#5b21b6',
            900: '#4c1d95',
            950: '#2e1065',
          },
          lavender: {
            DEFAULT: 'rgb(183 166 230 / <alpha-value>)',
            50: '#faf5ff',
            100: '#f3e8ff',
            200: '#e9d5ff',
            300: 'rgb(183 166 230 / <alpha-value>)',
            400: '#c084fc',
            500: '#a855f7',
            600: '#9333ea',
            700: '#7e22ce',
            800: '#6b21a8',
            900: '#581c87',
          },
          blue: {
            DEFAULT: 'rgb(127 180 255 / <alpha-value>)',
            50: '#eff6ff',
            100: '#dbeafe',
            200: '#bfdbfe',
            300: 'rgb(127 180 255 / <alpha-value>)',
            400: '#60a5fa',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a',
          },
          cyan: {
            DEFAULT: 'rgb(70 195 207 / <alpha-value>)',
            50: '#ecfeff',
            100: '#cffafe',
            200: '#a5f3fc',
            300: 'rgb(70 195 207 / <alpha-value>)',
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
            DEFAULT: 'rgb(71 85 105 / <alpha-value>)',
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: 'rgb(71 85 105 / <alpha-value>)',
            700: 'rgb(51 65 85 / <alpha-value>)',
            800: '#1e293b',
            900: '#0f172a',
            950: '#020617',
          },
        },

        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
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
          cyan: '#06b6d4',
          emerald: '#10b981',
          violet: '#8b5cf6',
          rose: '#f43f5e',
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
          '0%, 100%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.5), 0 0 20px rgba(99, 102, 241, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.8), 0 0 40px rgba(99, 102, 241, 0.5)' },
        },
        pulseGlowOguri: {
          '0%, 100%': { 
            boxShadow: '0 0 8px rgba(91, 61, 173, 0.6), 0 0 25px rgba(183, 166, 230, 0.4), 0 0 40px rgba(127, 180, 255, 0.2)' 
          },
          '50%': { 
            boxShadow: '0 0 15px rgba(91, 61, 173, 0.9), 0 0 35px rgba(183, 166, 230, 0.6), 0 0 55px rgba(127, 180, 255, 0.3)' 
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
            backgroundImage: 'linear-gradient(90deg, transparent, rgba(183, 166, 230, 0.4), rgba(127, 180, 255, 0.3), transparent)'
          },
          '100%': { 
            backgroundPosition: '200% 0',
            backgroundImage: 'linear-gradient(90deg, transparent, rgba(183, 166, 230, 0.4), rgba(127, 180, 255, 0.3), transparent)'
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
            boxShadow: '0 0 0 0 rgba(91, 61, 173, 0.7)',
            transform: 'scale(1)'
          },
          '50%': { 
            boxShadow: '0 0 20px 10px rgba(183, 166, 230, 0.4)',
            transform: 'scale(1.02)'
          },
          '100%': { 
            boxShadow: '0 0 0 0 rgba(91, 61, 173, 0)',
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
      },
      boxShadow: {
        'glow': '0 0 15px rgba(99, 102, 241, 0.5)',
        'glow-lg': '0 0 30px rgba(99, 102, 241, 0.6)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.5)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.5)',
        'inner-glow': 'inset 0 0 20px rgba(99, 102, 241, 0.3)',
        // Oguri Cap themed glows
        'glow-oguri-purple': '0 0 20px rgba(91, 61, 173, 0.6), 0 0 40px rgba(91, 61, 173, 0.3)',
        'glow-oguri-lavender': '0 0 20px rgba(183, 166, 230, 0.6), 0 0 40px rgba(183, 166, 230, 0.3)',
        'glow-oguri-blue': '0 0 20px rgba(127, 180, 255, 0.6), 0 0 40px rgba(127, 180, 255, 0.3)',
        'glow-oguri-cyan': '0 0 20px rgba(70, 195, 207, 0.6), 0 0 40px rgba(70, 195, 207, 0.3)',
        'glow-oguri-mixed': '0 0 15px rgba(91, 61, 173, 0.5), 0 0 30px rgba(183, 166, 230, 0.4), 0 0 45px rgba(127, 180, 255, 0.2)',
      },
      backgroundImage: {
        'gradient-oguri-primary': 'linear-gradient(135deg, rgb(91 61 173) 0%, rgb(183 166 230) 100%)',
        'gradient-oguri-power': 'linear-gradient(135deg, rgb(91 61 173) 0%, rgb(127 180 255) 100%)',
        'gradient-oguri-speed': 'linear-gradient(135deg, rgb(70 195 207) 0%, rgb(127 180 255) 100%)',
        'gradient-oguri-victory': 'linear-gradient(135deg, rgb(245 158 11) 0%, rgb(91 61 173) 100%)',
        'gradient-oguri-phantom': 'linear-gradient(135deg, rgb(51 65 85) 0%, rgb(71 85 105) 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
