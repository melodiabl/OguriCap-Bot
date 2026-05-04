'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { LoadingOverlayProvider } from '@/contexts/LoadingOverlayContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { OguriThemeProvider } from '@/contexts/OguriThemeContext';
import { useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { getPageKeyFromPathname } from '@/lib/pageTheme';
import { DEFAULT_PAGE_VISUAL_PRESET, getPageVisualPresetStorageKey, isPageVisualPreset } from '@/lib/pageVisualPreset';
import { DevicePerformanceProvider, useDevicePerformance } from '@/contexts/DevicePerformanceContext';
import dynamic from 'next/dynamic';

const NotificationEffectsListener = dynamic(
  () => import('@/components/effects/NotificationEffectsListener').then((m) => m.NotificationEffectsListener),
  { ssr: false }
);

function PageThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    const page = getPageKeyFromPathname(pathname);
    let pagePreset = DEFAULT_PAGE_VISUAL_PRESET;

    try {
      const raw = window.localStorage.getItem(getPageVisualPresetStorageKey(page));
      if (raw && isPageVisualPreset(raw)) pagePreset = raw;
    } catch {
      // ignore
    }

    document.documentElement.dataset.page = page;
    document.documentElement.dataset.pagePreset = pagePreset;
    document.body.dataset.page = page;
    document.body.dataset.pagePreset = pagePreset;
  }, [pathname]);

  return null;
}

function MotionMode({ children }: { children: React.ReactNode }) {
  const { performanceMode, reduceMotion } = useDevicePerformance();
  return (
    <MotionConfig
      reducedMotion={performanceMode || reduceMotion ? 'always' : 'user'}
      transition={
        performanceMode
          ? { duration: 0.18, ease: 'easeOut' }
          : { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }
      }
    >
      {children}
    </MotionConfig>
  );
}

function EffectsGate() {
  const { performanceMode, reduceMotion } = useDevicePerformance();
  return performanceMode || reduceMotion ? null : <NotificationEffectsListener />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            refetchOnWindowFocus: true,
            staleTime: 5000,
          },
        },
      })
  );

  const [toastPosition, setToastPosition] = useState<'top-right' | 'top-center'>('top-right');

  useEffect(() => {
    const update = () => {
      setToastPosition(window.innerWidth < 640 ? 'top-center' : 'top-right');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem enableColorScheme>
      <QueryClientProvider client={queryClient}>
        <PageThemeSync />
        <DevicePerformanceProvider>
          <MotionMode>
            {/* Auth / sesión */}
            <AuthProvider>
              {/* Conexión en tiempo real (Socket.IO) */}
              <SocketProvider>
                {/* Preferencias de usuario (sonido, etc.) */}
                <PreferencesProvider>
                  {/* Sistema de notificaciones en memoria */}
                  <NotificationProvider>
                    {/* Overlay global de loading */}
                    <LoadingOverlayProvider>
                      <OguriThemeProvider>
                        {/* Efectos visuales ligados a notificaciones (desactivables por performanceMode) */}
                        <EffectsGate />
                        {children}
                      </OguriThemeProvider>
                    </LoadingOverlayProvider>
                  </NotificationProvider>
                </PreferencesProvider>
              </SocketProvider>
            </AuthProvider>
          </MotionMode>
        </DevicePerformanceProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
