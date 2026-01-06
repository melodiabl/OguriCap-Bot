'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useSocketConnection, SOCKET_EVENTS } from './SocketContext';
import { usePreferences } from './PreferencesContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export interface Notification {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'success' | 'warning' | 'error' | 'system';
  categoria: string;
  leida: boolean;
  fecha_creacion: string;
  data?: any;
}

export interface NotificationSettings {
  enabled: boolean;
  general: boolean;
  botEvents: boolean;
  users: boolean;
  tasks: boolean;
  critical: boolean;
  push: boolean;
}

interface NotificationContextValue {
  notifications: Notification[];

  unreadCount: number;
  settings: NotificationSettings;
  isLoading: boolean;
  isOpen: boolean;
  hasMore: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  loadMore: () => Promise<void>;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = 'oguricap:notification-settings';
const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  general: true,
  botEvents: true,
  users: true,
  tasks: true,
  critical: true,
  push: false,
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  const toggleOpen = useCallback(() => { const next = !isOpenRef.current; setIsOpen(next); if (typeof window !== 'undefined') console.debug('Notificaciones: toggleOpen', next); }, []);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { socket } = useSocketConnection();
  const { preferences } = usePreferences();
  const router = useRouter();
  const loadingRef = useRef(false);
  const seenNotificationsRef = useRef<Set<number>>(new Set());

  // Load settings from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const shouldShowNotification = useCallback((notification: Notification): boolean => {
    if (!settings.enabled) return false;

    const categoryMap: Record<string, keyof NotificationSettings> = {
      sistema: 'general',
      bot: 'botEvents',
      usuarios: 'users',
      tareas: 'tasks',
      error: 'critical',
    };

    const settingKey = categoryMap[notification.categoria] || 'general';
    return settings[settingKey] ?? true;
  }, [settings]);

  const loadNotifications = useCallback(async (pageNum = 1, append = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);

    try {
      const data = await api.getNotificaciones(pageNum, 20);
      const list = data?.notificaciones || data?.data || [];

      if (append) {
        setNotifications(prev => [...prev, ...list]);
      } else {
        setNotifications(list);
      }

      // Recalculate unread count
      if (!append) {
        const unread = list.filter((n: Notification) => !n.leida).length;
        setUnreadCount(unread);
      } else {
        const unread = list.filter((n: Notification) => !n.leida).length;
        setUnreadCount(prev => prev + unread);
      }

      setHasMore(data?.pagination?.totalPages > pageNum);
      setPage(pageNum);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadNotifications(1, false);
  }, [loadNotifications]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await loadNotifications(page + 1, true);
  }, [hasMore, isLoading, page, loadNotifications]);

  // Register Service Worker for push notifications
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrado:', registration.scope);
        })
        .catch((err) => {
          console.error('Error registrando Service Worker:', err);
        });
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification: Notification) => {
      if (!notification || seenNotificationsRef.current.has(notification.id)) return;
      seenNotificationsRef.current.add(notification.id);

      if (!shouldShowNotification(notification)) return;

      // Add to list
      setNotifications(prev => [notification, ...prev].slice(0, 100));
      if (!notification.leida) {
        setUnreadCount(prev => prev + 1);
      }

      // Show toast if enabled
      if (settings.enabled) {
        const toastOptions: any = {
          duration: 5000,
          icon: getNotificationIcon(notification.tipo),
        };

        if (notification.tipo === 'error') {
          toast.error(notification.titulo || notification.mensaje, toastOptions);
        } else if (notification.tipo === 'success') {
          toast.success(notification.titulo || notification.mensaje, toastOptions);
        } else if (notification.tipo === 'warning') {
          toast(notification.titulo || notification.mensaje, {
            ...toastOptions,
            icon: '⚠️',
          });
        } else {
          toast(notification.titulo || notification.mensaje, toastOptions);
        }
      }

      // Play sound if enabled
      if (preferences.soundEnabled && notification.tipo !== 'info') {
        try {
          const audio = new Audio('/sounds/notification.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => { });
        } catch {
        }
      }

      // Vibrate if enabled
      if (preferences.hapticsEnabled && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40, 30, 90]);
        } catch {
        }
      }

      // Show browser notification if push enabled
      if (settings.push && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(notification.titulo || 'Oguri Bot', {
            body: notification.mensaje,
            icon: '/bot-icon.svg',
            tag: `notification-${notification.id}`,
            requireInteraction: notification.tipo === 'error',
          });
        } catch {
        }
      }
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION, handleNotification);
    socket.on('notification:created', handleNotification);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION, handleNotification);
      socket.off('notification:created', handleNotification);
    };
  }, [socket, shouldShowNotification, settings, preferences]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await api.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, leida: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
      setUnreadCount(0);
      toast.success('Todas las notificaciones marcadas como leídas');
    } catch (err) {
      toast.error('Error al marcar como leídas');
    }
  }, []);

  const deleteNotification = useCallback(async (id: number) => {
    try {
      await api.deleteNotification(id);
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id);
        if (removed && !removed.leida) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.filter(n => n.id !== id);
      });
    } catch (err) {
      toast.error('Error al eliminar notificación');
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));

    // If push is enabled, request permission
    if (newSettings.push && 'Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setSettings(prev => ({ ...prev, push: false }));
        }
      } catch {
        setSettings(prev => ({ ...prev, push: false }));
      }
    }
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    settings,
    isLoading,
    isOpen,
    hasMore,
    setIsOpen,
    toggleOpen,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    updateSettings,
    refresh,
  }), [notifications, unreadCount, settings, isLoading, isOpen, hasMore, setIsOpen, toggleOpen, markAsRead, markAllAsRead, deleteNotification, loadMore, updateSettings, refresh]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications debe ser usado dentro de NotificationProvider');
  return ctx;
}

function getNotificationIcon(tipo: string): string {
  const icons: Record<string, string> = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    system: '🔔',
  };
  return icons[tipo] || '🔔';
}
