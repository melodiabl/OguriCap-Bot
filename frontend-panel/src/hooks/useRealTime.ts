import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import api from '../config/api';

// ===== TIPOS =====
export interface BotStatus {
  connected: boolean;
  isConnected: boolean;
  connecting: boolean;
  status: string;
  connectionStatus: string;
  phone: string | null;
  qrCode: string | null;
  uptime: string;
  lastSeen: string | null;
  timestamp: string;
}

export interface SystemStats {
  uptime: number;
  platform: string;
  node: string;
  cpu: string | null;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    total: number;
    free: number;
  };
  timestamp: string;
}

export interface DashboardStats {
  totalUsuarios: number;
  totalGrupos: number;
  totalAportes: number;
  totalPedidos: number;
  totalSubbots: number;
  totalMensajes: number;
  totalComandos: number;
  mensajesHoy: number;
  comandosHoy: number;
  usuariosActivos: number;
  gruposActivos: number;
  aportesHoy: number;
  pedidosHoy: number;
}

export interface GlobalState {
  isOn: boolean;
  lastUpdated: string | null;
}

// ===== HOOK: Bot Status en Tiempo Real =====
export function useBotStatus(refreshInterval = 5000) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<BotStatus>(
    'botStatus',
    async () => {
      const response = await api.get('/api/bot/status');
      return response.data;
    },
    {
      refetchInterval: refreshInterval,
      refetchIntervalInBackground: true,
      staleTime: 2000,
      retry: 2,
      onError: (err) => {
        console.error('Error fetching bot status:', err);
      },
    }
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries('botStatus');
  }, [queryClient]);

  return {
    status: data,
    isLoading,
    error,
    refetch,
    invalidate,
    isConnected: data?.connected || data?.isConnected || false,
    isConnecting: data?.connecting || false,
  };
}

// ===== HOOK: System Stats en Tiempo Real =====
export function useSystemStats(refreshInterval = 10000) {
  const { data, isLoading, error, refetch } = useQuery<SystemStats>(
    'systemStats',
    async () => {
      const response = await api.get('/api/system/stats');
      return response.data;
    },
    {
      refetchInterval: refreshInterval,
      refetchIntervalInBackground: true,
      staleTime: 5000,
      retry: 2,
    }
  );

  const memoryUsage = data?.memory
    ? {
        used: data.memory.heapUsed,
        total: data.memory.heapTotal,
        percentage: Math.round((data.memory.heapUsed / data.memory.heapTotal) * 100),
        systemUsed: data.memory.total - data.memory.free,
        systemTotal: data.memory.total,
        systemPercentage: Math.round(((data.memory.total - data.memory.free) / data.memory.total) * 100),
      }
    : null;

  return {
    stats: data,
    isLoading,
    error,
    refetch,
    memoryUsage,
    uptime: data?.uptime || 0,
    platform: data?.platform || 'unknown',
  };
}

// ===== HOOK: Dashboard Stats en Tiempo Real =====
export function useDashboardStats(refreshInterval = 15000) {
  const { data, isLoading, error, refetch } = useQuery<DashboardStats>(
    'dashboardStats',
    async () => {
      const response = await api.get('/api/dashboard/stats');
      return response.data;
    },
    {
      refetchInterval: refreshInterval,
      refetchIntervalInBackground: true,
      staleTime: 10000,
      retry: 2,
    }
  );

  return {
    stats: data,
    isLoading,
    error,
    refetch,
  };
}

// ===== HOOK: Global Bot State =====
export function useGlobalBotState(refreshInterval = 5000) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<GlobalState>(
    'globalBotState',
    async () => {
      const response = await api.get('/api/bot/global-state');
      return response.data;
    },
    {
      refetchInterval: refreshInterval,
      staleTime: 2000,
      retry: 2,
    }
  );

  const setGlobalState = useCallback(async (isOn: boolean) => {
    try {
      await api.post('/api/bot/global-state', { isOn });
      queryClient.invalidateQueries('globalBotState');
    } catch (err) {
      console.error('Error setting global state:', err);
      throw err;
    }
  }, [queryClient]);

  return {
    globalState: data,
    isLoading,
    error,
    refetch,
    setGlobalState,
    isOn: data?.isOn ?? true,
  };
}

// ===== HOOK: QR Code Polling =====
export function useQRCode(enabled = true, refreshInterval = 3000) {
  const { data, isLoading, error, refetch } = useQuery(
    'botQR',
    async () => {
      const response = await api.get('/api/bot/qr');
      return response.data;
    },
    {
      enabled,
      refetchInterval: enabled ? refreshInterval : false,
      staleTime: 1000,
      retry: 1,
    }
  );

  return {
    qrData: data,
    qrCode: data?.qr || data?.qrCode || null,
    available: data?.available || false,
    isLoading,
    error,
    refetch,
  };
}

// ===== HOOK: Subbots Status =====
export function useSubbotsStatus(refreshInterval = 10000) {
  const { data, isLoading, error, refetch } = useQuery(
    'subbotsStatus',
    async () => {
      const response = await api.get('/api/subbot/status');
      return response.data;
    },
    {
      refetchInterval: refreshInterval,
      staleTime: 5000,
      retry: 2,
    }
  );

  const onlineCount = data?.subbots?.filter((s: any) => s.isOnline).length || 0;
  const totalCount = data?.subbots?.length || 0;

  return {
    subbots: data?.subbots || [],
    isLoading,
    error,
    refetch,
    onlineCount,
    totalCount,
  };
}

// ===== HOOK: Notifications Polling =====
export function useNotifications(refreshInterval = 30000) {
  const { data, isLoading, error, refetch } = useQuery(
    'notifications',
    async () => {
      const response = await api.get('/api/notificaciones?limit=10');
      return response.data;
    },
    {
      refetchInterval: refreshInterval,
      staleTime: 15000,
      retry: 2,
    }
  );

  const unreadCount = data?.notificaciones?.filter((n: any) => !n.leida).length || 0;

  return {
    notifications: data?.notificaciones || [],
    pagination: data?.pagination,
    isLoading,
    error,
    refetch,
    unreadCount,
  };
}

// ===== HOOK: Connection Health =====
export function useConnectionHealth() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const pingServer = async () => {
      if (!isOnline) return;

      const start = Date.now();
      try {
        await api.get('/api/health');
        setLatency(Date.now() - start);
        setLastPing(new Date());
      } catch {
        setLatency(null);
      }
    };

    pingServer();
    const interval = setInterval(pingServer, 30000);

    return () => clearInterval(interval);
  }, [isOnline]);

  return {
    isOnline,
    lastPing,
    latency,
    connectionQuality: latency
      ? latency < 100
        ? 'excellent'
        : latency < 300
        ? 'good'
        : latency < 500
        ? 'fair'
        : 'poor'
      : 'unknown',
  };
}

// ===== HOOK: Auto Refresh Manager =====
export function useAutoRefresh(callback: () => void, interval: number, enabled = true) {
  const savedCallback = useRef(callback);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || isPaused) return;

    const tick = () => savedCallback.current();
    const id = setInterval(tick, interval);

    return () => clearInterval(id);
  }, [interval, enabled, isPaused]);

  return {
    isPaused,
    pause: () => setIsPaused(true),
    resume: () => setIsPaused(false),
    toggle: () => setIsPaused((p) => !p),
  };
}

// ===== HOOK: Real-Time Updates Combined =====
export function useRealTimeUpdates() {
  const botStatus = useBotStatus(5000);
  const systemStats = useSystemStats(10000);
  const dashboardStats = useDashboardStats(15000);
  const globalState = useGlobalBotState(5000);
  const connectionHealth = useConnectionHealth();

  const refreshAll = useCallback(() => {
    botStatus.refetch();
    systemStats.refetch();
    dashboardStats.refetch();
    globalState.refetch();
  }, [botStatus, systemStats, dashboardStats, globalState]);

  return {
    bot: botStatus,
    system: systemStats,
    dashboard: dashboardStats,
    global: globalState,
    connection: connectionHealth,
    refreshAll,
    isLoading: botStatus.isLoading || systemStats.isLoading || dashboardStats.isLoading,
  };
}

export default useRealTimeUpdates;
