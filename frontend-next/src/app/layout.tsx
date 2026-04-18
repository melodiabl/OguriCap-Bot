import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import 'xterm/css/xterm.css';
import { Providers } from './providers';
import { RouteProgress } from '@/components/ui/RouteProgress';

export const metadata: Metadata = {
  title: 'OguriCap-Bot',
  description: 'Bot de WhatsApp para comunidad, comandos, subbots, aportes, herramientas y panel en tiempo real.',
  icons: {
    icon: '/bot-icon.svg',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-mono' });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme') || 'dark';
                const intensity = localStorage.getItem('oguricap:visual-intensity') || 'vivid';
                const path = (location.pathname || '/').split('?')[0].split('#')[0] || '/';
                let page = 'home';
                if (path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/reset-password')) page = 'auth';
                else if (path.startsWith('/maintenance')) page = 'maintenance';
                else if (path === '/dashboard') page = 'dashboard';
                else {
                  const seg = path.split('/').filter(Boolean)[0] || '';
                  switch (seg) {
                    case 'bot': page = 'bot'; break;
                    case 'usuarios': page = 'usuarios'; break;
                    case 'community-users': page = 'community-users'; break;
                    case 'subbots': page = 'subbots'; break;
                    case 'grupos': page = 'grupos'; break;
                    case 'grupos-management': page = 'grupos-management'; break;
                    case 'aportes': page = 'aportes'; break;
                    case 'pedidos': page = 'pedidos'; break;
                    case 'proveedores': page = 'proveedores'; break;
                    case 'tareas': page = 'tareas'; break;
                    case 'ai-chat': page = 'ai-chat'; break;
                    case 'alertas': page = 'alertas'; break;
                    case 'recursos': page = 'recursos'; break;
                    case 'configuracion': page = 'configuracion'; break;
                    case 'logs': page = 'logs'; break;
                    case 'analytics': page = 'analytics'; break;
                    case 'multimedia': page = 'multimedia'; break;
                    case 'maintenance': page = 'maintenance'; break;
                    default: page = path === '/' ? 'home' : 'unknown';
                  }
                }
                const pagePreset = localStorage.getItem('oguricap:page-visual-preset:' + page) || 'default';
                document.documentElement.dataset.theme = theme;
                document.documentElement.dataset.intensity = intensity;
                document.documentElement.dataset.pagePreset = pagePreset;
                document.documentElement.style.colorScheme = theme;

                // Load color palette
                const savedPalette = localStorage.getItem('oguricap:color-palette');
                if (savedPalette) {
                  const palettes = {
                    'default': { p: '#6366f1', s: '#8b5cf6', a: '#06b6d4' },
                    'emerald': { p: '#10b981', s: '#06b6d4', a: '#6366f1' },
                    'rose': { p: '#f43f5e', s: '#ec4899', a: '#f59e0b' },
                    'purple': { p: '#a855f7', s: '#d946ef', a: '#8b5cf6' },
                    'blue': { p: '#3b82f6', s: '#0ea5e9', a: '#06b6d4' },
                    'amber': { p: '#f59e0b', s: '#f97316', a: '#eab308' },
                    'teal': { p: '#14b8a6', s: '#06b6d4', a: '#10b981' },
                    'violet': { p: '#7c3aed', s: '#a855f7', a: '#c026d3' }
                  };
                  const palette = palettes[savedPalette];
                  if (palette) {
                    const hexToRgb = (hex) => {
                      const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
                      return result ? parseInt(result[1], 16) + ' ' + parseInt(result[2], 16) + ' ' + parseInt(result[3], 16) : '99 102 241';
                    };
                    document.documentElement.style.setProperty('--page-a', hexToRgb(palette.p));
                    document.documentElement.style.setProperty('--page-b', hexToRgb(palette.s));
                    document.documentElement.style.setProperty('--page-c', hexToRgb(palette.a));
                    document.documentElement.style.setProperty('--primary', hexToRgb(palette.p));
                    document.documentElement.style.setProperty('--secondary', hexToRgb(palette.s));
                    document.documentElement.style.setProperty('--accent', hexToRgb(palette.a));
                  }
                }
              } catch (e) {
                document.documentElement.dataset.theme = 'dark';
                document.documentElement.dataset.intensity = 'vivid';
                document.documentElement.dataset.pagePreset = 'default';
                document.documentElement.style.colorScheme = 'dark';
              }
            `,
          }}
        />
        <link rel="icon" href="/favicon.ico?v=2" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico?v=2" />
        <link rel="icon" href="/bot-icon.svg?v=2" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="rgb(99 102 241)" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          <Suspense fallback={null}>
            <RouteProgress />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
