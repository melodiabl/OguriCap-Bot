'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';
import { DashboardStats, BotStatus } from '@/types';
import { SOCKET_EVENTS, useSocketBotStatus, useSocketConnection } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';

import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useDashboardStats() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocketConnection();

  const query = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.getStats(),
    refetchInterval: 30000, // Background refresh every 30s as fallback
    staleTime: 5000,
  });

  useEffect(() => {
    if (!socket) return;

    const handleStats = (data: any) => {
      if (!data || typeof data !== 'object') return;
      queryClient.setQueryData(['dashboard-stats'], (prev: any) => ({
        ...(prev || {}),
        ...(data || {}),
      }));
    };

    socket.on('stats:updated', handleStats);
    socket.on(SOCKET_EVENTS.STATS_UPDATE, handleStats);

    return () => {
      socket.off('stats:updated', handleStats);
      socket.off(SOCKET_EVENTS.STATS_UPDATE, handleStats);
    };
  }, [socket, queryClient]);

  // Request fresh stats on connect
  useEffect(() => {
    if (isConnected && socket) {
      socket.emit('request:stats');
    }
  }, [isConnected, socket]);

  return { 
    stats: query.data || null, 
    isLoading: query.isLoading, 
    error: query.isError ? 'Error al cargar estadísticas' : null, 
    refetch: query.refetch 
  };
}


export function useBotStatus() {
  const queryClient = useQueryClient();
  const { socket, isConnected: socketConnected } = useSocketConnection();
  const socketBotStatus = useSocketBotStatus();

  const query = useQuery<BotStatus>({
    queryKey: ['bot-status'],
    queryFn: () => api.getBotStatus(),
    refetchInterval: 10000,
    staleTime: 2000,
  });

  useEffect(() => {
    if (socketBotStatus) {
      queryClient.setQueryData(['bot-status'], socketBotStatus);
    }
  }, [socketBotStatus, queryClient]);

  const currentStatus = query.data || null;
  const isConnected = Boolean(currentStatus?.connected ?? currentStatus?.isConnected);
  const isConnecting = Boolean(currentStatus?.connecting);

  return { 
    status: currentStatus, 
    isConnected, 
    isConnecting, 
    isLoading: query.isLoading, 
    refetch: query.refetch 
  };
}


export function useSystemStats() {
  const queryClient = useQueryClient();
  const { socket } = useSocketConnection();

  const query = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => api.getSystemStats(),
    refetchInterval: 15000,
    staleTime: 5000,
  });

  useEffect(() => {
    if (!socket) return;

    const handleMetrics = (metrics: any) => {
      queryClient.setQueryData(['system-stats'], (prev: any) => {
        if (!prev) return metrics;
        return {
          ...prev,
          cpu: { ...prev.cpu, percentage: metrics?.cpu?.usage ?? prev.cpu?.percentage },
          memory: { ...prev.memory, systemPercentage: metrics?.memory?.usage ?? prev.memory?.systemPercentage },
          disk: { ...prev.disk, percentage: metrics?.disk?.usage ?? prev.disk?.percentage },
          process: { ...prev.process, uptime: metrics?.process?.uptime ?? prev.process?.uptime },
          uptime: metrics?.process?.uptime ?? metrics?.uptime ?? prev.uptime,
        };
      });
    };

    socket.on('resource:metrics', handleMetrics);
    return () => {
      socket.off('resource:metrics', handleMetrics);
    };
  }, [socket, queryClient]);

  const data = query.data;
  return {
    memoryUsage: data?.memory || null,
    cpuUsage: data?.cpu?.percentage || 0,
    diskUsage: data?.disk || null,
    uptime: data?.process?.uptime || data?.uptime || 0,
    systemInfo: data ? {
      platform: data.platform || 'N/A',
      arch: data.arch || 'N/A',
      node: data.node || 'N/A',
      cpu: data.cpu || { model: 'N/A', cores: 0 },
      memory: data.memory || { totalGB: 0, freeGB: 0 }
    } : null,
    refetch: query.refetch
  };
}


export function useSubbotsStatus() {
  const queryClient = useQueryClient();
  const { socket } = useSocketConnection();

  const query = useQuery({
    queryKey: ['subbots-status'],
    queryFn: () => api.getSubbotStatus(),
    refetchInterval: 20000,
    staleTime: 5000,
  });

  useEffect(() => {
    if (!socket) return;

    const handleSubbotStatus = (data: any) => {
      queryClient.setQueryData(['subbots-status'], data);
    };

    socket.on(SOCKET_EVENTS.SUBBOT_STATUS, handleSubbotStatus);
    socket.on(SOCKET_EVENTS.SUBBOT_CONNECTED, () => query.refetch());
    socket.on(SOCKET_EVENTS.SUBBOT_DISCONNECTED, () => query.refetch());
    socket.on(SOCKET_EVENTS.SUBBOT_CREATED, () => query.refetch());
    socket.on(SOCKET_EVENTS.SUBBOT_DELETED, () => query.refetch());

    return () => {
      socket.off(SOCKET_EVENTS.SUBBOT_STATUS, handleSubbotStatus);
    };
  }, [socket, queryClient, query]);

  const subbots = query.data?.subbots || [];
  return {
    onlineCount: subbots.filter((s: any) => s?.isOnline || s?.connected || s?.isConnected).length,
    totalCount: subbots.length,
    refetch: query.refetch
  };
}


export function useConnectionHealth(interval = 15000) {
  const [latency, setLatency] = useState(0);

  const measureLatency = useCallback(async () => {
    const start = Date.now();
    try {
      await api.getBotStatus();
      setLatency(Date.now() - start);
    } catch {
      setLatency(-1);
    }
  }, []);

  useEffect(() => {
    measureLatency();
    const timer = window.setInterval(measureLatency, interval);
    const onFocus = () => measureLatency();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [interval, measureLatency]);

  return { latency, refetch: measureLatency };
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { socket } = useSocketConnection();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotificaciones(1, 10),
    enabled: !authLoading && isAuthenticated,
    refetchInterval: 60000,
    staleTime: 10000,
  });

  useEffect(() => {
    if (!socket || authLoading || !isAuthenticated) return;

    const handleNotification = (n: any) => {
      if (!n) return;
      queryClient.setQueryData(['notifications'], (prev: any) => {
        if (!prev) return { data: [n] };
        return {
          ...prev,
          data: [n, ...(prev.data || [])].slice(0, 50)
        };
      });
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION, handleNotification);
    socket.on('notification:created', handleNotification);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION, handleNotification);
      socket.off('notification:created', handleNotification);
    };
  }, [socket, authLoading, isAuthenticated, queryClient]);

  const notifications = query.data?.data || [];
  const unreadCount = notifications.filter((n: any) => !n.leida).length;

  return { notifications, unreadCount, isLoading: query.isLoading, refetch: query.refetch };
}

export function useRecentActivity() {
  const queryClient = useQueryClient();
  const { socket } = useSocketConnection();

  const query = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => api.getRecentActivity(10),
    refetchInterval: 30000,
    staleTime: 5000,
  });

  useEffect(() => {
    if (!socket) return;

    const handleLog = (entry: any) => {
      if (!entry) return;
      queryClient.setQueryData(['recent-activity'], (prev: any) => {
        if (!prev) return { data: [entry] };
        return {
          ...prev,
          data: [entry, ...(prev.data || [])].slice(0, 20)
        };
      });
    };

    socket.on('log:new', handleLog);
    socket.on(SOCKET_EVENTS.LOG_ENTRY, handleLog);

    return () => {
      socket.off('log:new', handleLog);
      socket.off(SOCKET_EVENTS.LOG_ENTRY, handleLog);
    };
  }, [socket, queryClient]);

  return { 
    activities: query.data?.data || [], 
    isLoading: query.isLoading, 
    refetch: query.refetch 
  };
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
