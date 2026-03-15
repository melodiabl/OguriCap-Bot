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
    document.documentElement.dataset.page = page;
    document.body.dataset.page = page;
  }, [pathname]);

  return null;
}

function MotionMode({ children }: { children: React.ReactNode }) {
  const { performanceMode } = useDevicePerformance();
  return (
    <MotionConfig
      reducedMotion="user"
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
  const { performanceMode } = useDevicePerformance();
  return performanceMode ? null : <NotificationEffectsListener />;
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
                        position="top-right"
                        toastOptions={{
                          duration: 4000,
                          style: {
                            background: 'rgb(var(--bg-1))',
                            color: 'rgb(var(--text-primary))',
                            border: '1px solid rgba(var(--border), 0.1)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '16px',
                            padding: '12px 16px',
                            fontSize: '14px',
                            fontWeight: '500',
                            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.3)',
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
