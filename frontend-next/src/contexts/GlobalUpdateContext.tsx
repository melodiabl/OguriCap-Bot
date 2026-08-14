'use client';

import React from 'react';
import { useSocketConnection } from './SocketContext';
import { useBotGlobalState } from './BotGlobalStateContext';
import { useAuth } from './AuthContext';
import api from '@/services/api';

interface GlobalUpdateContextType {
  dashboardStats: any;
  botStatus: any;
  systemStats: any;
  notifications: any[];
  activeAlertCount: number;

  refreshAll: () => void;
  refreshDashboard: () => Promise<any>;
  refreshBotStatus: () => Promise<any>;
  refreshSystemStats: () => Promise<any>;
  refreshNotifications: () => Promise<any>;

  isRefreshing: boolean;
  lastUpdate: Date | null;
}

const GlobalUpdateContext = React.createContext<GlobalUpdateContextType | undefined>(undefined);

function emitGlobalDataUpdated() {
  window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: { timestamp: Date.now() } }));
}

const shallowEqual = (a: any, b: any) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

function useStableRefresh(fn: () => Promise<any>, deps: any[]) {
  const ref = React.useRef({ inFlight: false, pending: false, fn, mounted: true });
  ref.current.fn = fn;

  const throttled = React.useCallback(() => {
    if (ref.current.inFlight) { ref.current.pending = true; return; }
    ref.current.inFlight = true;
    ref.current.fn().finally(() => {
      if (!ref.current.mounted) return;
      ref.current.inFlight = false;
      if (ref.current.pending) {
        ref.current.pending = false;
        window.setTimeout(() => throttled(), 100);
      }
    });
  }, deps);

  React.useEffect(() => () => { ref.current.mounted = false; }, []);

  return throttled;
}

export const GlobalUpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dashboardStats, setDashboardStats] = React.useState<any>(null);
  const [botStatus, setBotStatus] = React.useState<any>(null);
  const [systemStats, setSystemStats] = React.useState<any>(null);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [activeAlertCount, setActiveAlertCount] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  const { socket, isConnected } = useSocketConnection();
  const { isGloballyOn } = useBotGlobalState();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const refreshDashboard = React.useCallback(async () => {
    try {
      const [stats, alertsRes] = await Promise.allSettled([api.getStats(), api.getAlerts()]);

      if (stats.status === 'fulfilled') {
        setDashboardStats(prev => shallowEqual(prev, stats.value) ? prev : stats.value);
      }

      if (alertsRes.status === 'fulfilled') {
        const alertList: any[] = (alertsRes.value as any)?.alerts ?? alertsRes.value ?? [];
        const activeCount = Array.isArray(alertList)
          ? alertList.filter((a: any) => a.state === 'active').length : 0;
        setActiveAlertCount(activeCount);
      }

      return stats.status === 'fulfilled' ? stats.value : null;
    } catch {
      return null;
    }
  }, []);

  const refreshBotStatus = React.useCallback(async () => {
    try {
      const status = await api.getMainBotStatus();
      setBotStatus(prev => shallowEqual(prev, status) ? prev : status);
      return status;
    } catch {
      return null;
    }
  }, []);

  const refreshSystemStats = React.useCallback(async () => {
    try {
      const stats = await api.getSystemStats();
      setSystemStats(prev => shallowEqual(prev, stats) ? prev : stats);
      return stats;
    } catch {
      return null;
    }
  }, []);

  const refreshNotifications = React.useCallback(async () => {
    try {
      const response = await api.getNotificaciones(1, 10);
      const newNotifications = response?.notificaciones || [];
      setNotifications(prev => shallowEqual(prev, newNotifications) ? prev : newNotifications);
      return response;
    } catch {
      return null;
    }
  }, []);

  const doRefreshAll = React.useCallback(async () => {
    if (authLoading || !isAuthenticated) {
      setIsRefreshing(false); setLastUpdate(null);
      setDashboardStats(null); setBotStatus(null); setSystemStats(null); setNotifications([]);
      return;
    }

    setIsRefreshing(true);
    try {
      await Promise.all([refreshDashboard(), refreshBotStatus(), refreshSystemStats(), refreshNotifications()]);
      setLastUpdate(new Date());
      emitGlobalDataUpdated();
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  }, [authLoading, isAuthenticated, refreshBotStatus, refreshDashboard, refreshNotifications, refreshSystemStats]);

  const refreshAll = useStableRefresh(doRefreshAll, [doRefreshAll]);

  React.useEffect(() => { refreshAll(); }, []);

  const prevGloballyOn = React.useRef(isGloballyOn);
  React.useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (isGloballyOn === prevGloballyOn.current) return;
    prevGloballyOn.current = isGloballyOn;
    refreshAll();
  }, [isGloballyOn, authLoading, isAuthenticated, refreshAll]);

  const prevConnected = React.useRef(isConnected);
  React.useEffect(() => {
    if (!isConnected || authLoading || !isAuthenticated) return;
    if (isConnected === prevConnected.current) return;
    prevConnected.current = isConnected;
    refreshAll();
  }, [isConnected, authLoading, isAuthenticated, refreshAll]);

  React.useEffect(() => {
    if (!socket) return;

    let raf = 0;
    let pendingStats: any = null;
    const scheduledFullRef = { id: 0 as any };

    const cooldownTimers = { group: 0, subbot: 0 };
    const idCache = { notification: null as string | null, log: null as string | null };

    const flushStats = () => {
      if (!pendingStats) return;
      const next = pendingStats;
      pendingStats = null;
      setDashboardStats(prev => {
        const merged = { ...(prev || {}), ...next };
        return shallowEqual(prev, merged) ? prev : merged;
      });
      setLastUpdate(new Date());
      emitGlobalDataUpdated();
    };

    const handleStatsUpdate = (data: any) => {
      if (!data || typeof data !== 'object') return;
      pendingStats = { ...(pendingStats || {}), ...data };
      if (!raf) {
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          flushStats();
        });
      }
    };

    const handleBotStatusChange = (data: any) => {
      if (!data || typeof data !== 'object') return;
      setBotStatus(prev => {
        const next = { ...(prev || {}), ...data };
        return shallowEqual(prev, next) ? prev : next;
      });
      setLastUpdate(new Date());
    };

    const handleNotificationUpdate = (data: any) => {
      const id = String((data as any)?.id || '').trim();
      if (!id || id === idCache.notification) return;
      idCache.notification = id;
      setNotifications(prev => [data, ...prev.slice(0, 9)]);
      setLastUpdate(new Date());
    };

    const handleCooldown = (key: 'group' | 'subbot') => {
      const now = Date.now();
      if (now - cooldownTimers[key] < 5_000) return;
      cooldownTimers[key] = now;
      refreshDashboard();
      setLastUpdate(new Date());
    };

    const handleLogEntry = (data: any) => {
      const id = String((data as any)?.id || '').trim();
      if (!id || id === idCache.log) return;
      idCache.log = id;
      window.dispatchEvent(new CustomEvent('newLogEntry', { detail: { log: data, timestamp: Date.now() } }));
    };

    socket.on('bot:statusChanged', handleBotStatusChange);
    socket.on('bot:connected', handleBotStatusChange);
    socket.on('bot:disconnected', handleBotStatusChange);
    socket.on('bot:globalStateChanged', () => {
      if (scheduledFullRef.id) window.clearTimeout(scheduledFullRef.id);
      scheduledFullRef.id = window.setTimeout(() => refreshAll(), 500);
    });

    socket.on('stats:updated', handleStatsUpdate);
    socket.on('stats:update', handleStatsUpdate);

    socket.on('group:updated', () => handleCooldown('group'));
    socket.on('subbot:created', () => handleCooldown('subbot'));
    socket.on('subbot:connected', () => handleCooldown('subbot'));
    socket.on('subbot:disconnected', () => handleCooldown('subbot'));
    socket.on('subbot:deleted', () => handleCooldown('subbot'));

    socket.on('log:entry', handleLogEntry);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (scheduledFullRef.id) window.clearTimeout(scheduledFullRef.id);
      socket.off('bot:statusChanged', handleBotStatusChange);
      socket.off('bot:connected', handleBotStatusChange);
      socket.off('bot:disconnected', handleBotStatusChange);
      socket.off('bot:globalStateChanged', refreshAll);
      socket.off('stats:updated', handleStatsUpdate);
      socket.off('stats:update', handleStatsUpdate);
      socket.off('group:updated', () => handleCooldown('group'));
      socket.off('subbot:created', () => handleCooldown('subbot'));
      socket.off('subbot:connected', () => handleCooldown('subbot'));
      socket.off('subbot:disconnected', () => handleCooldown('subbot'));
      socket.off('subbot:deleted', () => handleCooldown('subbot'));
      socket.off('log:entry', handleLogEntry);
    };
  }, [socket, refreshAll, refreshDashboard]);

  return (
    <GlobalUpdateContext.Provider value={{
      dashboardStats, botStatus, systemStats, notifications, activeAlertCount,
      refreshAll, refreshDashboard, refreshBotStatus, refreshSystemStats, refreshNotifications,
      isRefreshing, lastUpdate,
    }}>
      {children}
    </GlobalUpdateContext.Provider>
  );
};

export const useGlobalUpdate = () => {
  const context = React.useContext(GlobalUpdateContext);
  if (!context) throw new Error('useGlobalUpdate must be used within a GlobalUpdateProvider');
  return context;
};
