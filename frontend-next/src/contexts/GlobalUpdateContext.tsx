'use client';

import React from 'react';
import { useSocketConnection } from './SocketContext';
import { useBotGlobalState } from './BotGlobalStateContext';
import api from '@/services/api';

interface GlobalUpdateContextType {
  dashboardStats: any;
  botStatus: any;
  systemStats: any;
  notifications: any[];

  refreshAll: () => Promise<void>;
  refreshDashboard: () => Promise<any>;
  refreshBotStatus: () => Promise<any>;
  refreshSystemStats: () => Promise<any>;
  refreshNotifications: () => Promise<any>;

  isRefreshing: boolean;
  lastUpdate: Date | null;
}

const GlobalUpdateContext = React.createContext<GlobalUpdateContextType | undefined>(undefined);

function emitGlobalDataUpdated() {
  window.dispatchEvent(
    new CustomEvent('globalDataUpdated', {
      detail: { timestamp: Date.now() },
    })
  );
}

export const GlobalUpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dashboardStats, setDashboardStats] = React.useState<any>(null);
  const [botStatus, setBotStatus] = React.useState<any>(null);
  const [systemStats, setSystemStats] = React.useState<any>(null);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  const { socket, isConnected } = useSocketConnection();
  const { isGloballyOn } = useBotGlobalState();

  const refreshDashboard = React.useCallback(async () => {
    try {
      const stats = await api.getStats();
      setDashboardStats(stats);
      return stats;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error refreshing dashboard stats:', error);
      }
      return null;
    }
  }, []);

  const refreshBotStatus = React.useCallback(async () => {
    try {
      const status = await api.getMainBotStatus();
      setBotStatus(status);
      return status;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error refreshing bot status:', error);
      }
      return null;
    }
  }, []);

  const refreshSystemStats = React.useCallback(async () => {
    try {
      const stats = await api.getSystemStats();
      setSystemStats(stats);
      return stats;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error refreshing system stats:', error);
      }
      return null;
    }
  }, []);

  const refreshNotifications = React.useCallback(async () => {
    try {
      const response = await api.getNotificaciones(1, 10);
      setNotifications(response?.notificaciones || []);
      return response;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error refreshing notifications:', error);
      }
      return null;
    }
  }, []);

  // Cola simple para evitar overlap de refreshAll (crítico en móvil)
  const inFlightRef = React.useRef(false);
  const pendingRef = React.useRef(false);

  const refreshAll = React.useCallback(async () => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }

    inFlightRef.current = true;
    setIsRefreshing(true);

    try {
      await Promise.all([refreshDashboard(), refreshBotStatus(), refreshSystemStats(), refreshNotifications()]);
      setLastUpdate(new Date());
      emitGlobalDataUpdated();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error in refreshAll:', error);
      }
    } finally {
      setIsRefreshing(false);
      inFlightRef.current = false;

      if (pendingRef.current) {
        pendingRef.current = false;
        queueMicrotask(() => refreshAll());
      }
    }
  }, [refreshBotStatus, refreshDashboard, refreshNotifications, refreshSystemStats]);

  // Inicial: 1 refresh fuerte
  React.useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Estado global del bot: refrescar (pero sin polling duplicado)
  React.useEffect(() => {
    refreshAll();
  }, [isGloballyOn, refreshAll]);

  // Socket reconnect: refrescar
  React.useEffect(() => {
    if (!isConnected) return;
    refreshAll();
  }, [isConnected, refreshAll]);

  // Realtime: listeners con throttling + updates parciales (no full refresh por evento)
  React.useEffect(() => {
    if (!socket) return;

    const scheduledFullRef = { id: 0 as any };
    const scheduleFullRefresh = (delayMs = 650) => {
      if (scheduledFullRef.id) window.clearTimeout(scheduledFullRef.id);
      scheduledFullRef.id = window.setTimeout(() => refreshAll(), delayMs);
    };

    const lastBotRef = { v: null as any };
    const lastNotificationIdRef = { v: null as string | null };
    const lastLogIdRef = { v: null as string | null };
    const lastGroupRefreshAtRef = { v: 0 };
    const lastSubbotRefreshAtRef = { v: 0 };

    let raf = 0;
    let pendingStats: any = null;

    const flushStats = () => {
      if (!pendingStats) return;
      const next = pendingStats;
      pendingStats = null;
      setDashboardStats((prev: any) => ({ ...(prev || {}), ...(next as any) }));
      setLastUpdate(new Date());
      emitGlobalDataUpdated();
    };

    const handleStatsUpdate = (data: any) => {
      if (!data || typeof data !== 'object') return;
      pendingStats = { ...(pendingStats || {}), ...(data as any) };
      if (!raf) {
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          flushStats();
        });
      }
    };

    const handleBotStatusChange = (data: any) => {
      if (!data || typeof data !== 'object') return;
      const prev = lastBotRef.v;
      const hasChanges =
        !prev ||
        prev.connected !== data.connected ||
        prev.isConnected !== data.isConnected ||
        prev.connecting !== data.connecting ||
        prev.status !== data.status ||
        prev.phone !== data.phone ||
        prev.qrCode !== data.qrCode ||
        prev.pairingCode !== data.pairingCode;

      if (!hasChanges) return;

      lastBotRef.v = { ...(data as any) };
      setBotStatus((p: any) => ({ ...(p || {}), ...(data as any) }));
      setLastUpdate(new Date());
      emitGlobalDataUpdated();
    };

    const handleNotificationUpdate = (data: any) => {
      const id = String((data as any)?.id || '').trim();
      if (!id) return;
      if (id === lastNotificationIdRef.v) return;
      lastNotificationIdRef.v = id;
      setNotifications((prev) => [data, ...prev.slice(0, 9)]);
      setLastUpdate(new Date());
      emitGlobalDataUpdated();
    };

    const handleGlobalStateChange = () => {
      // Cambio global: refresco fuerte, pero debounce para evitar tormenta
      scheduleFullRefresh(500);
    };

    const handleGroupUpdate = () => {
      const now = Date.now();
      if (now - lastGroupRefreshAtRef.v < 5_000) return;
      lastGroupRefreshAtRef.v = now;
      // Dashboard suele reflejar recuentos relevantes
      refreshDashboard();
      setLastUpdate(new Date());
    };

    const handleSubbotUpdate = () => {
      const now = Date.now();
      if (now - lastSubbotRefreshAtRef.v < 5_000) return;
      lastSubbotRefreshAtRef.v = now;
      refreshDashboard();
      setLastUpdate(new Date());
    };

    const handleLogEntry = (data: any) => {
      const id = String((data as any)?.id || '').trim();
      if (!id) return;
      if (id === lastLogIdRef.v) return;
      lastLogIdRef.v = id;
      window.dispatchEvent(
        new CustomEvent('newLogEntry', {
          detail: { log: data, timestamp: Date.now() },
        })
      );
    };

    socket.on('bot:statusChanged', handleBotStatusChange);
    socket.on('bot:connected', handleBotStatusChange);
    socket.on('bot:disconnected', handleBotStatusChange);
    socket.on('bot:globalStateChanged', handleGlobalStateChange);

    socket.on('stats:updated', handleStatsUpdate);
    socket.on('stats:update', handleStatsUpdate);

    socket.on('notification:created', handleNotificationUpdate);

    socket.on('group:updated', handleGroupUpdate);

    socket.on('subbot:created', handleSubbotUpdate);
    socket.on('subbot:connected', handleSubbotUpdate);
    socket.on('subbot:disconnected', handleSubbotUpdate);
    socket.on('subbot:deleted', handleSubbotUpdate);

    socket.on('log:entry', handleLogEntry);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (scheduledFullRef.id) window.clearTimeout(scheduledFullRef.id);

      socket.off('bot:statusChanged', handleBotStatusChange);
      socket.off('bot:connected', handleBotStatusChange);
      socket.off('bot:disconnected', handleBotStatusChange);
      socket.off('bot:globalStateChanged', handleGlobalStateChange);

      socket.off('stats:updated', handleStatsUpdate);
      socket.off('stats:update', handleStatsUpdate);

      socket.off('notification:created', handleNotificationUpdate);

      socket.off('group:updated', handleGroupUpdate);

      socket.off('subbot:created', handleSubbotUpdate);
      socket.off('subbot:connected', handleSubbotUpdate);
      socket.off('subbot:disconnected', handleSubbotUpdate);
      socket.off('subbot:deleted', handleSubbotUpdate);

      socket.off('log:entry', handleLogEntry);
    };
  }, [socket, refreshAll, refreshDashboard]);

  // Fallback: focus/online solo si NO hay Socket.IO
  React.useEffect(() => {
    if (isConnected) return;

    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      refreshAll();
    };
    const onOnline = () => {
      if (document.visibilityState !== 'visible') return;
      refreshAll();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [isConnected, refreshAll]);

  // Evento manual: forzar refresh
  React.useEffect(() => {
    const handleCustomUpdate = () => refreshAll();
    window.addEventListener('forceGlobalUpdate', handleCustomUpdate);
    return () => window.removeEventListener('forceGlobalUpdate', handleCustomUpdate);
  }, [refreshAll]);

  return (
    <GlobalUpdateContext.Provider
      value={{
        dashboardStats,
        botStatus,
        systemStats,
        notifications,
        refreshAll,
        refreshDashboard,
        refreshBotStatus,
        refreshSystemStats,
        refreshNotifications,
        isRefreshing,
        lastUpdate,
      }}
    >
      {children}
    </GlobalUpdateContext.Provider>
  );
};

export const useGlobalUpdate = () => {
  const context = React.useContext(GlobalUpdateContext);
  if (!context) throw new Error('useGlobalUpdate must be used within a GlobalUpdateProvider');
  return context;
};
