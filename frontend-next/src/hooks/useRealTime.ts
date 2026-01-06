'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { DashboardStats, BotStatus } from '@/types';
import { SOCKET_EVENTS, useSocketBotStatus, useSocketConnection } from '@/contexts/SocketContext';

export function useDashboardStats(_interval = 10000) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket, isConnected } = useSocketConnection();

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Error al cargar estadísticas');
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!socket) return;

    const handleStats = (data: any) => {
      if (!data || typeof data !== 'object') return;
      setStats(prev => ({ ...(prev || ({} as any)), ...(data as any) }));
      setIsLoading(false);
      setError(null);
    };

    socket.on('stats:updated', handleStats);
    socket.on(SOCKET_EVENTS.STATS_UPDATE, handleStats);

    return () => {
      socket.off('stats:updated', handleStats);
      socket.off(SOCKET_EVENTS.STATS_UPDATE, handleStats);
    };
  }, [socket]);

  useEffect(() => {
    const onFocus = () => {
      if (!isConnected) fetchStats();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchStats, isConnected]);

  return { stats, isLoading, error, refetch: fetchStats };
}

export function useBotStatus(_interval = 5000) {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isConnected: socketConnected } = useSocketConnection();
  const socketBotStatus = useSocketBotStatus();

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getBotStatus();
      setStatus(data);
      setIsConnected(data.connected || data.isConnected || false);
      setIsConnecting(data.connecting || false);
    } catch (err) {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (socketBotStatus) {
      const data = socketBotStatus as any;
      setStatus(data);
      setIsConnected(Boolean(data?.connected ?? data?.isConnected));
      setIsConnecting(Boolean(data?.connecting));
      setIsLoading(false);
      return;
    }

    fetchStatus();
  }, [fetchStatus, socketBotStatus]);

  useEffect(() => {
    const onFocus = () => {
      if (!socketConnected) fetchStatus();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchStatus, socketConnected]);

  return { status, isConnected, isConnecting, isLoading, refetch: fetchStatus };
}

export function useSystemStats(_interval = 10000) {
  const [memoryUsage, setMemoryUsage] = useState<{ systemPercentage: number } | null>(null);
  const [cpuUsage, setCpuUsage] = useState<number>(0);
  const [diskUsage, setDiskUsage] = useState<{ percentage: number; totalGB: number; freeGB: number } | null>(null);
  const [uptime, setUptime] = useState(0);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const { socket } = useSocketConnection();

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getSystemStats();
      setMemoryUsage(data.memory);
      setCpuUsage(data.cpu?.percentage || 0);
      setDiskUsage(data.disk);
      setUptime(data.uptime || 0);
      
      // Asegurar que systemInfo tenga la estructura correcta
      const safeSystemInfo = {
        platform: data.platform || 'N/A',
        arch: data.arch || 'N/A',
        node: data.node || 'N/A',
        cpu: {
          model: data.cpu?.model || 'N/A',
          cores: data.cpu?.cores || 0,
          percentage: data.cpu?.percentage || 0
        },
        memory: {
          totalGB: data.memory?.totalGB || 0,
          freeGB: data.memory?.freeGB || 0
        }
      };
      
      setSystemInfo(safeSystemInfo);
    } catch (err) {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!socket) return;

    const handleMetrics = (metrics: any) => {
      const cpu = Number(metrics?.cpu?.usage);
      const mem = Number(metrics?.memory?.usage);
      const disk = Number(metrics?.disk?.usage);
      const up = Number(metrics?.process?.uptime);

      if (Number.isFinite(cpu)) setCpuUsage(cpu);
      if (Number.isFinite(mem)) setMemoryUsage({ systemPercentage: mem });
      if (Number.isFinite(disk)) {
        setDiskUsage(prev => (prev ? { ...prev, percentage: disk } : { percentage: disk, totalGB: 0, freeGB: 0 }));
      }
      if (Number.isFinite(up)) setUptime(up);
    };

    socket.on('resource:metrics', handleMetrics);
    return () => {
      socket.off('resource:metrics', handleMetrics);
    };
  }, [socket]);

  useEffect(() => {
    const onFocus = () => fetchStats();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchStats]);

  return { memoryUsage, cpuUsage, diskUsage, uptime, systemInfo };
}

export function useSubbotsStatus(_interval = 10000) {
  const [onlineCount, setOnlineCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { socket } = useSocketConnection();

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getSubbotStatus();
      const subbots = data.subbots || [];
      setTotalCount(subbots.length);
      setOnlineCount(subbots.filter((s: any) => s?.isOnline || s?.connected || s?.isConnected).length);
    } catch (err) {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!socket) return;

    const handleSubbotStatus = (data: any) => {
      const subbots = Array.isArray(data?.subbots) ? data.subbots : [];
      setTotalCount(subbots.length);
      setOnlineCount(subbots.filter((s: any) => s?.isOnline || s?.connected || s?.isConnected).length);
    };

    socket.on(SOCKET_EVENTS.SUBBOT_STATUS, handleSubbotStatus);
    socket.on(SOCKET_EVENTS.SUBBOT_CONNECTED, fetchStatus);
    socket.on(SOCKET_EVENTS.SUBBOT_DISCONNECTED, fetchStatus);
    socket.on(SOCKET_EVENTS.SUBBOT_CREATED, fetchStatus);
    socket.on(SOCKET_EVENTS.SUBBOT_DELETED, fetchStatus);

    return () => {
      socket.off(SOCKET_EVENTS.SUBBOT_STATUS, handleSubbotStatus);
      socket.off(SOCKET_EVENTS.SUBBOT_CONNECTED, fetchStatus);
      socket.off(SOCKET_EVENTS.SUBBOT_DISCONNECTED, fetchStatus);
      socket.off(SOCKET_EVENTS.SUBBOT_CREATED, fetchStatus);
      socket.off(SOCKET_EVENTS.SUBBOT_DELETED, fetchStatus);
    };
  }, [socket, fetchStatus]);

  useEffect(() => {
    const onFocus = () => fetchStatus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchStatus]);

  return { onlineCount, totalCount, refetch: fetchStatus };
}

export function useConnectionHealth() {
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    const measureLatency = async () => {
      const start = Date.now();
      try {
        await api.getBotStatus();
        setLatency(Date.now() - start);
      } catch {
        setLatency(-1);
      }
    };

    measureLatency();
    const onFocus = () => measureLatency();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  return { latency };
}

export function useNotifications(_interval = 30000) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket } = useSocketConnection();

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotificaciones(1, 10);
      setNotifications(data.data || []);
      setUnreadCount(data.data?.filter((n: any) => !n.leida).length || 0);
    } catch (err) {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (n: any) => {
      if (!n) return;
      setNotifications(prev => [n, ...prev].slice(0, 50));
      if (n?.leida === false) setUnreadCount(c => c + 1);
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION, handleNotification);
    socket.on('notification:created', handleNotification);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION, handleNotification);
      socket.off('notification:created', handleNotification);
    };
  }, [socket]);

  useEffect(() => {
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchNotifications]);

  return { notifications, unreadCount, refetch: fetchNotifications };
}


export function useRecentActivity(_interval = 15000) {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { socket } = useSocketConnection();

  const fetchActivities = useCallback(async () => {
    try {
      const response = await api.getRecentActivity(5);
      setActivities(response.data || []);
    } catch (err) {
      console.error('Error fetching recent activity:', err);
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    if (!socket) return;

    const handleLog = (entry: any) => {
      if (!entry) return;
      setActivities(prev => [entry, ...prev].slice(0, 20));
    };

    socket.on('log:new', handleLog);
    socket.on(SOCKET_EVENTS.LOG_ENTRY, handleLog);

    return () => {
      socket.off('log:new', handleLog);
      socket.off(SOCKET_EVENTS.LOG_ENTRY, handleLog);
    };
  }, [socket]);

  useEffect(() => {
    const onFocus = () => fetchActivities();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchActivities]);

  return { activities, isLoading, refetch: fetchActivities };
}

export function useBotGlobalState(_interval = 30000) {
  const [isOn, setIsOn] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const { socket } = useSocketConnection();

  const fetchState = useCallback(async () => {
    try {
      const data = await api.getBotGlobalState();
      setIsOn(data.isOn ?? data.enabled ?? true);
    } catch (err) {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setGlobalState = useCallback(async (newState: boolean) => {
    try {
      await api.setBotGlobalState(newState);
      setIsOn(newState);
    } catch (err) {
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (!socket) return;
    const handle = (data: any) => {
      if (data && typeof data === 'object') {
        const next = data?.isOn ?? data?.enabled ?? data?.state;
        if (typeof next === 'boolean') setIsOn(next);
      }
    };
    socket.on(SOCKET_EVENTS.BOT_GLOBAL_STATE_CHANGED, handle);
    return () => {
      socket.off(SOCKET_EVENTS.BOT_GLOBAL_STATE_CHANGED, handle);
    };
  }, [socket]);

  useEffect(() => {
    const onFocus = () => fetchState();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchState]);

  return { isOn, isLoading, setGlobalState, refetch: fetchState };
}

export function useQRCode(enabled: boolean, _interval = 3000) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const { socket } = useSocketConnection();
  const botStatus = useSocketBotStatus();

  const fetchQR = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await api.getMainBotQR();
      setQrCode(data.qr || data.qrCode || null);
      setAvailable(!!data.qr || !!data.qrCode);
    } catch (err) {
      setAvailable(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      if (botStatus?.qrCode) {
        setQrCode(botStatus.qrCode);
        setAvailable(true);
      } else {
        fetchQR();
      }
    }
  }, [enabled, fetchQR, botStatus?.qrCode]);

  useEffect(() => {
    if (!socket) return;

    const handleQr = (data: any) => {
      const next = data?.qr ?? data?.qrCode;
      if (typeof next === 'string' && next) {
        setQrCode(next);
        setAvailable(true);
      }
    };

    socket.on(SOCKET_EVENTS.BOT_QR, handleQr);
    return () => {
      socket.off(SOCKET_EVENTS.BOT_QR, handleQr);
    };
  }, [socket]);

  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => fetchQR();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [enabled, fetchQR]);

  return { qrCode, available, refetch: fetchQR };
}
