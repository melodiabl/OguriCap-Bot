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
                var theme = localStorage.getItem('theme') || 'dark';
                var intensity = localStorage.getItem('oguricap:visual-intensity') || 'vivid';
                var path = (location.pathname || '/').split('?')[0].split('#')[0] || '/';
                var page = 'home';
                if (path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/reset-password')) page = 'auth';
                else if (path.startsWith('/maintenance')) page = 'maintenance';
                else if (path === '/dashboard') page = 'dashboard';
                else {
                  var seg = path.split('/').filter(Boolean)[0] || '';
                  var pageMap = {
                    bot:'bot', usuarios:'usuarios', 'community-users':'community-users',
                    subbots:'subbots', grupos:'grupos', 'grupos-management':'grupos-management',
                    aportes:'aportes', pedidos:'pedidos', proveedores:'proveedores',
                    tareas:'tareas', 'ai-chat':'ai-chat', alertas:'alertas',
                    recursos:'recursos', configuracion:'configuracion', logs:'logs',
                    analytics:'analytics', multimedia:'multimedia', maintenance:'maintenance',
                    broadcast:'broadcast', scheduler:'scheduler'
                  };
                  page = pageMap[seg] || (path === '/' ? 'home' : 'unknown');
                }
                var pagePreset = localStorage.getItem('oguricap:page-visual-preset:' + page) || 'default';
                document.documentElement.setAttribute('data-theme', theme);
                document.documentElement.setAttribute('data-intensity', intensity);
                document.documentElement.setAttribute('data-page-preset', pagePreset);
                document.documentElement.style.colorScheme = theme;
              } catch (e) {
                document.documentElement.setAttribute('data-theme', 'dark');
                document.documentElement.setAttribute('data-intensity', 'vivid');
                document.documentElement.setAttribute('data-page-preset', 'default');
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
