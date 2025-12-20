'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { DashboardStats, BotStatus } from '@/types';

export function useDashboardStats(interval = 15000) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Error al cargar estadísticas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, interval);
    return () => clearInterval(timer);
  }, [fetchStats, interval]);

  return { stats, isLoading, error, refetch: fetchStats };
}

export function useBotStatus(interval = 5000) {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
    fetchStatus();
    const timer = setInterval(fetchStatus, interval);
    return () => clearInterval(timer);
  }, [fetchStatus, interval]);

  return { status, isConnected, isConnecting, isLoading, refetch: fetchStatus };
}

export function useSystemStats(interval = 10000) {
  const [memoryUsage, setMemoryUsage] = useState<{ systemPercentage: number } | null>(null);
  const [cpuUsage, setCpuUsage] = useState<number>(0);
  const [diskUsage, setDiskUsage] = useState<{ percentage: number; totalGB: number; freeGB: number } | null>(null);
  const [uptime, setUptime] = useState(0);
  const [systemInfo, setSystemInfo] = useState<any>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getSystemStats();
      setMemoryUsage(data.memory);
      setCpuUsage(data.cpu?.percentage || 0);
      setDiskUsage(data.disk);
      setUptime(data.uptime || 0);
      setSystemInfo(data);
    } catch (err) {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, interval);
    return () => clearInterval(timer);
  }, [fetchStats, interval]);

  return { memoryUsage, cpuUsage, diskUsage, uptime, systemInfo };
}

export function useSubbotsStatus(interval = 10000) {
  const [onlineCount, setOnlineCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getSubbotStatus();
      const subbots = data.subbots || [];
      setTotalCount(subbots.length);
      setOnlineCount(subbots.filter((s: any) => s.connected || s.isConnected).length);
    } catch (err) {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, interval);
    return () => clearInterval(timer);
  }, [fetchStatus, interval]);

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
    const timer = setInterval(measureLatency, 30000);
    return () => clearInterval(timer);
  }, []);

  return { latency };
}

export function useNotifications(interval = 30000) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

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
    const timer = setInterval(fetchNotifications, interval);
    return () => clearInterval(timer);
  }, [fetchNotifications, interval]);

  return { notifications, unreadCount, refetch: fetchNotifications };
}


export function useGlobalBotState(interval = 5000) {
  const [isOn, setIsOn] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

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
    const timer = setInterval(fetchState, interval);
    return () => clearInterval(timer);
  }, [fetchState, interval]);

  return { isOn, isLoading, setGlobalState, refetch: fetchState };
}

export function useQRCode(enabled: boolean, interval = 3000) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);

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
      fetchQR();
      const timer = setInterval(fetchQR, interval);
      return () => clearInterval(timer);
    }
  }, [enabled, fetchQR, interval]);

  return { qrCode, available, refetch: fetchQR };
}
