import { useEffect, useRef, useState, useCallback } from 'react';
import { useGlobalUpdate } from '@/contexts/GlobalUpdateContext';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useSocketConnection } from '@/contexts/SocketContext';

interface UseAutoRefreshOptions {
  interval?: number; // Intervalo en milisegundos (fallback sin Socket.IO)
  dependencies?: any[]; // Dependencias que disparan refresh
  enabled?: boolean; // Si está habilitado el auto-refresh
}

export const useAutoRefresh = (
  refreshFunction: () => Promise<void> | void,
  options: UseAutoRefreshOptions = {}
) => {
  const { interval = 30_000, dependencies = [], enabled = true } = options;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const { isGloballyOn } = useBotGlobalState();
  const { isConnected } = useSocketConnection();
  const { lastUpdate } = useGlobalUpdate();

  const refreshFnRef = useRef(refreshFunction);
  useEffect(() => {
    refreshFnRef.current = refreshFunction;
  }, [refreshFunction]);

  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }

    inFlightRef.current = true;
    setIsRefreshing(true);

    try {
      await refreshFnRef.current();
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error in auto-refresh:', error);
    } finally {
      setIsRefreshing(false);
      inFlightRef.current = false;

      if (pendingRef.current) {
        pendingRef.current = false;
        queueMicrotask(() => refresh());
      }
    }
  }, [enabled]);

  // Auto-refresh cuando cambian las dependencias (sin spread en deps array)
  const prevDepsRef = useRef<any[]>(dependencies);
  useEffect(() => {
    if (!enabled) {
      prevDepsRef.current = dependencies;
      return;
    }

    const prev = prevDepsRef.current;
    const next = dependencies;
    const changed = prev.length !== next.length || prev.some((v, i) => !Object.is(v, next[i]));
    if (changed) refresh();
    prevDepsRef.current = next;
  }, [dependencies, enabled, refresh]);

  // Auto-refresh por señales globales relevantes
  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, isGloballyOn, isConnected, refresh]);

  // Fallback con intervalo SOLO si no hay Socket.IO (evitar polling duplicado)
  useEffect(() => {
    if (!enabled || !interval) return;
    if (isConnected) return;

    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refresh();
    }, interval);

    return () => window.clearInterval(id);
  }, [enabled, interval, isConnected, refresh]);

  // Fallback por focus/online SOLO si no hay Socket.IO
  useEffect(() => {
    if (!enabled) return;

    const onFocus = () => {
      if (!isConnected) refresh();
    };
    const onOnline = () => {
      if (!isConnected) refresh();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, isConnected, refresh]);

  // Auto-refresh cuando se actualiza el contexto global
  useEffect(() => {
    if (!enabled || !lastUpdate) return;
    refresh();
  }, [lastUpdate, enabled, refresh]);

  // Escuchar eventos personalizados
  useEffect(() => {
    if (!enabled) return;

    const handleForceRefresh = () => refresh();
    const handleGlobalUpdate = () => refresh();

    window.addEventListener('forceGlobalUpdate', handleForceRefresh);
    window.addEventListener('globalDataUpdated', handleGlobalUpdate);

    return () => {
      window.removeEventListener('forceGlobalUpdate', handleForceRefresh);
      window.removeEventListener('globalDataUpdated', handleGlobalUpdate);
    };
  }, [refresh, enabled]);

  return {
    refresh,
    isRefreshing,
    lastRefresh,
  };
};

export const useStatsAutoRefresh = (refreshFunction: () => Promise<void> | void, interval: number = 15_000) => {
  return useAutoRefresh(refreshFunction, {
    interval,
    dependencies: [],
  });
};

export const useListAutoRefresh = (
  refreshFunction: () => Promise<void> | void,
  dependencies: any[] = [],
  interval: number = 30_000
) => {
  return useAutoRefresh(refreshFunction, {
    interval,
    dependencies,
  });
};

export const useForceGlobalUpdate = () => {
  const forceUpdate = useCallback(() => {
    window.dispatchEvent(new CustomEvent('forceGlobalUpdate'));
  }, []);

  return { forceUpdate };
};
