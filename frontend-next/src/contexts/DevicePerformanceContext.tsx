'use client';

import * as React from 'react';

export type ViewportTier = 'mobile' | 'tablet' | 'desktop';

export type DevicePerformance = {
  viewport: ViewportTier;
  width: number;
  height: number;
  dpr: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceMemoryGB: number | null;
  hardwareConcurrency: number | null;
  saveData: boolean;
  reduceMotion: boolean;
  isLowEnd: boolean;
  performanceMode: boolean;
};

const DevicePerformanceContext = React.createContext<DevicePerformance | null>(null);

function getTier(width: number): ViewportTier {
  if (width <= 767) return 'mobile';
  if (width <= 1023) return 'tablet';
  return 'desktop';
}

function readNavigatorNumber(getter: () => unknown): number | null {
  try {
    const v = getter();
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  } catch {}
  return null;
}

function readSaveData(): boolean {
  try {
    const conn = (navigator as any)?.connection;
    return Boolean(conn?.saveData);
  } catch {
    return false;
  }
}

function readReduceMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function computeIsLowEnd(opts: {
  viewport: ViewportTier;
  deviceMemoryGB: number | null;
  hardwareConcurrency: number | null;
  saveData: boolean;
}): boolean {
  const { viewport, deviceMemoryGB, hardwareConcurrency, saveData } = opts;
  const lowViewport = viewport === 'mobile';

  const lowMemory = deviceMemoryGB !== null ? deviceMemoryGB <= 4 : false;
  const lowCores =
    hardwareConcurrency !== null
      ? hardwareConcurrency <= (viewport === 'desktop' ? 2 : 4)
      : false;

  // Desktop machines with 4 cores are common; avoid forcing "low" mode unless clearly constrained.
  if (viewport === 'desktop') return Boolean(saveData || (lowMemory && lowCores));

  // Mobile: always prioritize smoothness.
  if (lowViewport) return true;

  // Tablet: be conservative but not too aggressive.
  return Boolean(saveData || lowMemory || lowCores);
}

export function DevicePerformanceProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: Initial state must be identical on server and client to avoid hydration errors.
  // We compute real device metrics after mount (useEffect).
  const [state, setState] = React.useState<DevicePerformance>(() => ({
    viewport: 'desktop',
    width: 1024,
    height: 768,
    dpr: 1,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    deviceMemoryGB: null,
    hardwareConcurrency: null,
    saveData: false,
    reduceMotion: false,
    isLowEnd: false,
    performanceMode: false,
  }));

  React.useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        const viewport = getTier(width);
        const deviceMemoryGB = readNavigatorNumber(() => (navigator as any).deviceMemory);
        const hardwareConcurrency = readNavigatorNumber(() => (navigator as any).hardwareConcurrency);
        const saveData = readSaveData();
        const reduceMotion = readReduceMotion();
        const isLowEnd = computeIsLowEnd({ viewport, deviceMemoryGB, hardwareConcurrency, saveData });
        const performanceMode = reduceMotion || isLowEnd;

        setState({
          viewport,
          width,
          height,
          dpr,
          isMobile: viewport === 'mobile',
          isTablet: viewport === 'tablet',
          isDesktop: viewport === 'desktop',
          deviceMemoryGB,
          hardwareConcurrency,
          saveData,
          reduceMotion,
          isLowEnd,
          performanceMode,
        });
      });
    };

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => onResize();

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true } as any);
    mq.addEventListener?.('change', onMotion);

    // Compute real device metrics after mount.
    onResize();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize as any);
      mq.removeEventListener?.('change', onMotion);
    };
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.viewport = state.viewport;
    root.dataset.perf = state.performanceMode ? 'low' : 'full';
    root.dataset.reduceMotion = state.reduceMotion ? 'true' : 'false';
  }, [state.performanceMode, state.reduceMotion, state.viewport]);

  return <DevicePerformanceContext.Provider value={state}>{children}</DevicePerformanceContext.Provider>;
}

export function useDevicePerformance() {
  const ctx = React.useContext(DevicePerformanceContext);
  if (!ctx) throw new Error('useDevicePerformance must be used within DevicePerformanceProvider');
  return ctx;
}
