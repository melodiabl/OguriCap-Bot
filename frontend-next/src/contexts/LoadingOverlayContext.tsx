'use client';

import React from 'react';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

type OverlayConfig = {
  message?: string;
  details?: string;
};

type LoadingOverlayApi = {
  show: (config?: OverlayConfig) => void;
  hide: () => void;
  withLoading: <T>(fn: () => Promise<T>, config?: OverlayConfig) => Promise<T>;
};

const LoadingOverlayContext = React.createContext<LoadingOverlayApi | null>(null);

export function LoadingOverlayProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [config, setConfig] = React.useState<OverlayConfig>({});

  const api = React.useMemo<LoadingOverlayApi>(() => {
    return {
      show(nextConfig) {
        setConfig(nextConfig || {});
        setOpen(true);
      },
      hide() {
        setOpen(false);
      },
      async withLoading(fn, nextConfig) {
        setConfig(nextConfig || {});
        setOpen(true);
        try {
          return await fn();
        } finally {
          setOpen(false);
        }
      },
    };
  }, []);

  return (
    <LoadingOverlayContext.Provider value={api}>
      {children}
      <LoadingOverlay open={open} message={config.message} details={config.details} />
    </LoadingOverlayContext.Provider>
  );
}

export function useLoadingOverlay() {
  const ctx = React.useContext(LoadingOverlayContext);
  if (!ctx) throw new Error('useLoadingOverlay must be used within LoadingOverlayProvider');
  return ctx;
}

