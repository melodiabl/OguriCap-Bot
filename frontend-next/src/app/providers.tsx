'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
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
                      <Toaster
                        position={toastPosition}
                        containerStyle={{
                          top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                          zIndex: 100000,
                        }}
                        toastOptions={{
                          duration: 4000,
                          style: {
                            background: 'rgb(var(--bg-1) / 0.96)',
                            color: 'rgb(var(--text-primary))',
                            border: '1px solid rgba(var(--border), 0.14)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '16px',
                            padding: '12px 16px',
                            fontSize: '14px',
                            fontWeight: '600',
                            maxWidth: 'min(520px, calc(100vw - 24px))',
                            boxShadow:
                              '0 18px 55px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                          },
                          custom: {
                            // Custom toasts render their own container; keep wrapper invisible.
                            style: {
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              boxShadow: 'none',
                              backdropFilter: 'none',
                            },
                          },
                          success: {
                            iconTheme: {
                              primary: 'rgb(var(--success))',
                              secondary: 'white',
                            },
                            style: {
                              borderLeft: '4px solid rgb(var(--success))',
                            }
                          },
                          error: {
                            iconTheme: {
                              primary: 'rgb(var(--danger))',
                              secondary: 'white',
                            },
                            style: {
                              borderLeft: '4px solid rgb(var(--danger))',
                            }
                          },
                        }}
                      />
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
