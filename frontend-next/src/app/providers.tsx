'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { LoadingOverlayProvider } from '@/contexts/LoadingOverlayContext';
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
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        refetchOnWindowFocus: true,
        staleTime: 5000,
      },
    },
  }));

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem enableColorScheme>
      <QueryClientProvider client={queryClient}>
        <PageThemeSync />
        <DevicePerformanceProvider>
          <MotionMode>
            <AuthProvider>
              <SocketProvider>
                <PreferencesProvider>
                <LoadingOverlayProvider>
                    <EffectsGate />
                  {children}
                  <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        className: 'toast-custom',
                        success: { className: 'toast-custom toast-success' },
                        error: { className: 'toast-custom toast-error' },
                      }}
                    />
                  </LoadingOverlayProvider>
                </PreferencesProvider>
              </SocketProvider>
            </AuthProvider>
          </MotionMode>
        </DevicePerformanceProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
