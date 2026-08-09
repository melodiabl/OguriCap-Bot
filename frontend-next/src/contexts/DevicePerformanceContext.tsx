'use client';

import * as React from 'react';

export type ViewportTier = 'mobile' | 'tablet' | 'desktop';

export type EffectsMode = 'auto' | 'full' | 'eco';
export type VisualIntensity = 'normal' | 'vivid' | 'ultra';

const EFFECTS_KEY = 'oguricap:effects-mode';
const VISUAL_INTENSITY_KEY = 'oguricap:visual-intensity';

export type DevicePerformanceSnapshot = {
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

  // UI effects quality (persisted)
  effectsMode: EffectsMode;
  visualIntensity: VisualIntensity;
};

export type DevicePerformance = DevicePerformanceSnapshot & {
  setEffectsMode: (mode: EffectsMode) => void;
  cycleEffectsMode: () => void;
  setVisualIntensity: (mode: VisualIntensity) => void;
  cycleVisualIntensity: () => void;
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

function isEffectsMode(v: unknown): v is EffectsMode {
  return v === 'auto' || v === 'full' || v === 'eco';
}

function isVisualIntensity(v: unknown): v is VisualIntensity {
  return v === 'normal' || v === 'vivid' || v === 'ultra';
}

function computePerformanceMode(opts: {
  isLowEnd: boolean;
  effectsMode: EffectsMode;
}): boolean {
  const { isLowEnd, effectsMode } = opts;
  if (effectsMode === 'eco') return true;
  if (effectsMode === 'full') return false;
  return isLowEnd;
}

function computeIsLowEnd(opts: {
  viewport: ViewportTier;
  deviceMemoryGB: number | null;
  hardwareConcurrency: number | null;
  saveData: boolean;
}): boolean {
  const { viewport, deviceMemoryGB, hardwareConcurrency, saveData } = opts;
  const isMobile = viewport === 'mobile';
  const isTablet = viewport === 'tablet';
  const hasMemory = deviceMemoryGB !== null;
  const hasCores = hardwareConcurrency !== null;

  // Menos agresivo en desktop; mas conservador en mobile/tablet para evitar trabas.
  const lowMemory = hasMemory ? deviceMemoryGB! <= (viewport === 'desktop' ? 4 : 4) : false;
  const lowCores = hasCores ? hardwareConcurrency! <= (viewport === 'desktop' ? 2 : 4) : false;

  // Desktop machines with 4 cores are common; avoid forcing "low" mode unless clearly constrained.
  if (viewport === 'desktop') return Boolean(saveData || (lowMemory && lowCores));

  // Mobile: prioritize smoothness, but allow full mode on clearly capable devices.
  if (isMobile) {
    if (saveData) return true;
    if (!hasMemory && !hasCores) return true;

    const mem = hasMemory ? deviceMemoryGB! : 0;
    const cores = hasCores ? hardwareConcurrency! : 0;
    const highEnd = (hasMemory && mem >= 6) || (hasCores && cores >= 8);
    if (highEnd) return false;
    return Boolean(lowMemory || lowCores);
  }

  // Tablet: be conservative but not too aggressive.
  if (isTablet) {
    if (saveData) return true;
    if (!hasMemory && !hasCores) return true;

    const mem = hasMemory ? deviceMemoryGB! : 0;
    const cores = hasCores ? hardwareConcurrency! : 0;
    const highEnd = (hasMemory && mem >= 6) || (hasCores && cores >= 8);
    if (highEnd) return false;
    return Boolean(lowMemory || lowCores);
  }

  return Boolean(saveData || lowMemory || lowCores);
}

export function DevicePerformanceProvider({ children }: { children: React.ReactNode }) {
  const effectsModeRef = React.useRef<EffectsMode>('auto');
  const visualIntensityRef = React.useRef<VisualIntensity>('vivid');

  // IMPORTANT: Initial state must be identical on server and client to avoid hydration errors.
  // We compute real device metrics after mount (useEffect).
  const [state, setState] = React.useState<DevicePerformanceSnapshot>(() => ({
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

    effectsMode: 'auto',
    visualIntensity: 'vivid',
  }));

  const setEffectsMode = React.useCallback((mode: EffectsMode) => {
    effectsModeRef.current = mode;
    try {
      window.localStorage.setItem(EFFECTS_KEY, mode);
    } catch {
      // ignore
    }

    setState((prev) => ({
      ...prev,
      effectsMode: mode,
      performanceMode: computePerformanceMode({
        isLowEnd: prev.isLowEnd,
        effectsMode: mode,
      }),
    }));
  }, []);

  const cycleEffectsMode = React.useCallback(() => {
    const current = effectsModeRef.current;
    const next: EffectsMode = current === 'auto' ? 'full' : current === 'full' ? 'eco' : 'auto';
    setEffectsMode(next);
  }, [setEffectsMode]);

  const setVisualIntensity = React.useCallback((mode: VisualIntensity) => {
    visualIntensityRef.current = mode;
    try {
      window.localStorage.setItem(VISUAL_INTENSITY_KEY, mode);
    } catch {
      // ignore
    }

    setState((prev) => ({
      ...prev,
      visualIntensity: mode,
    }));
  }, []);

  const cycleVisualIntensity = React.useCallback(() => {
    const current = visualIntensityRef.current;
    const next: VisualIntensity = current === 'normal' ? 'vivid' : current === 'vivid' ? 'ultra' : 'normal';
    setVisualIntensity(next);
  }, [setVisualIntensity]);

  React.useEffect(() => {
    // Load saved effects mode (once, after mount)
    try {
      const raw = window.localStorage.getItem(EFFECTS_KEY);
      if (raw && isEffectsMode(raw)) {
        effectsModeRef.current = raw;
        setState((prev) => ({
          ...prev,
          effectsMode: raw,
          performanceMode: computePerformanceMode({
            isLowEnd: prev.isLowEnd,
            effectsMode: raw,
          }),
        }));
      }

      const savedIntensity = window.localStorage.getItem(VISUAL_INTENSITY_KEY);
      if (savedIntensity && isVisualIntensity(savedIntensity)) {
        visualIntensityRef.current = savedIntensity;
        setState((prev) => ({
          ...prev,
          visualIntensity: savedIntensity,
        }));
      }
    } catch {
      // ignore
    }

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

        const performanceMode = computePerformanceMode({
          isLowEnd,
          effectsMode: effectsModeRef.current,
        });

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

          effectsMode: effectsModeRef.current,
          visualIntensity: visualIntensityRef.current,
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
    root.dataset.intensity = state.visualIntensity;
  }, [state.performanceMode, state.reduceMotion, state.viewport, state.visualIntensity]);

  const value = React.useMemo<DevicePerformance>(() => {
    return {
      ...state,
      setEffectsMode,
      cycleEffectsMode,
      setVisualIntensity,
      cycleVisualIntensity,
    };
  }, [cycleEffectsMode, cycleVisualIntensity, setEffectsMode, setVisualIntensity, state]);

  return <DevicePerformanceContext.Provider value={value}>{children}</DevicePerformanceContext.Provider>;
}

export function useDevicePerformance() {
  const ctx = React.useContext(DevicePerformanceContext);
  if (!ctx) throw new Error('useDevicePerformance must be used within DevicePerformanceProvider');
  return ctx;
}
