'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Zap } from 'lucide-react';
import { useSocketConnection, SOCKET_EVENTS } from './SocketContext';
import { usePreferences } from './PreferencesContext';
import { useAuth } from './AuthContext';
import api from '@/services/api';
import { notify } from '@/lib/notify';

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
  deleteAllNotifications: (scope?: 'all' | 'read' | 'unread') => Promise<void>;
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

const BROWSER_PUSH_LOCK_PREFIX = 'oguricap:push-lock:';
const BROWSER_PUSH_LOCK_TTL_MS = 15000;

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

function clampNotificationText(input: string, max = 220) {
  const s = String(input || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function formatNotificationTitle(notification: Notification) {
  const genericTitles = [
    'notificación',
    'notificación general',
    'general notification',
    'notification',
    'aviso',
    'alerta'
  ];

  const isGeneric = !notification.titulo || 
    genericTitles.includes(notification.titulo.trim().toLowerCase());

  if (!isGeneric) {
    return clampNotificationText(notification.titulo, 80);
  }
  
  // Si el título es genérico, intentar generar uno basado en la categoría
  const categoryTitles: Record<string, string> = {
    sistema: 'Sistema',
    bot: 'Bot',
    usuarios: 'Usuario',
    tareas: 'Tarea',
    error: 'Error',
    seguridad: 'Seguridad',
    comando: 'Comando',
    multimedia: 'Multimedia',
    pago: 'Pago',
    grupo: 'Grupo'
  };
  
  return categoryTitles[notification.categoria] || 'Notificación';
}

function formatNotificationBody(notification: Notification) {
  return clampNotificationText(notification.mensaje || '', 180);
}

function NotificationToastContent({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick?: () => void;
}) {
  const title = formatNotificationTitle(notification);
  const body = formatNotificationBody(notification);
  const meta = clampNotificationText(notification.categoria || 'general', 36);

  return (
    <button
      type="button"
      onClick={onClick}
      className="toast-content"
      aria-label="Abrir notificación"
    >
      <div className="toast-text">
        <div className="toast-title">{title}</div>
        {body ? <div className="toast-message">{body}</div> : null}
        <div className="toast-meta">{meta}</div>
      </div>
    </button>
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const { socket } = useSocketConnection();
  const { preferences } = usePreferences();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const loadingRef = useRef(false);
  const seenNotificationsRef = useRef<Set<number>>(new Set());
  const recentContentHashesRef = useRef<Map<string, number>>(new Map());
  const browserPushesRef = useRef<Map<string, globalThis.Notification>>(new Map());
  const browserPushTimeoutsRef = useRef<Map<string, number>>(new Map());
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

  const generateContentHash = useCallback((n: Notification) => {
    // Normalizar texto para evitar duplicados por espacios o mayúsculas
    const t = (n.titulo || '').trim().toLowerCase();
    const m = (n.mensaje || '').trim().toLowerCase();
    return `${t}|${m}|${n.categoria}`;
  }, []);

  const cleanupRecentHashes = useCallback(() => {
    const now = Date.now();
    for (const [hash, timestamp] of recentContentHashesRef.current.entries()) {
      if (now - timestamp > 30000) { // 30 segundos de ventana
        recentContentHashesRef.current.delete(hash);
      }
    }
  }, []);

  const shouldShowBrowserPush = useCallback((contentHash: string) => {
    if (typeof window === 'undefined') return false;
    if (document.visibilityState === 'visible') return false;

    try {
      const key = `${BROWSER_PUSH_LOCK_PREFIX}${contentHash.slice(0, 32)}`;
      const now = Date.now();
      const last = Number(window.localStorage.getItem(key) || '0');

      if (Number.isFinite(last) && now - last < BROWSER_PUSH_LOCK_TTL_MS) {
        return false;
      }

      window.localStorage.setItem(key, String(now));
      return true;
    } catch {
      return true;
    }
  }, []);

  const clearBrowserPushTimeout = useCallback((tag: string) => {
    if (typeof window === 'undefined') return;
    const timeoutId = browserPushTimeoutsRef.current.get(tag);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      browserPushTimeoutsRef.current.delete(tag);
    }
  }, []);

  const closeBrowserPush = useCallback(async (tag: string) => {
    clearBrowserPushTimeout(tag);

    const active = browserPushesRef.current.get(tag);
    if (active) {
      try {
        active.close();
      } catch {
        // ignore
      }
      browserPushesRef.current.delete(tag);
    }

    const registration = serviceWorkerRegistrationRef.current;
    if (registration) {
      try {
        const notifications = await registration.getNotifications({ tag });
        notifications.forEach((notification) => notification.close());
      } catch {
        // ignore
      }
    }
  }, [clearBrowserPushTimeout]);

  const closeAllBrowserPushes = useCallback(() => {
    const tags = new Set<string>([
      ...browserPushesRef.current.keys(),
      ...browserPushTimeoutsRef.current.keys(),
    ]);

    tags.forEach((tag) => {
      void closeBrowserPush(tag);
    });
  }, [closeBrowserPush]);

  const getBrowserPushDuration = useCallback((tipo: Notification['tipo']) => {
    if (tipo === 'error') return 12000;
    if (tipo === 'warning') return 9000;
    if (tipo === 'success') return 6500;
    return 5500;
  }, []);

  const openNotificationTarget = useCallback((notification: Notification) => {
    const url = notification?.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) {
      router.push(url);
      return;
    }
    toggleOpen();
  }, [router, toggleOpen]);

  const showBrowserPushNotification = useCallback(async (notification: Notification, contentHash: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const title = formatNotificationTitle(notification);
    const body = formatNotificationBody(notification);
    const tag = `oguri-notif-${contentHash.substring(0, 16)}`;
    const duration = getBrowserPushDuration(notification.tipo);

    await closeBrowserPush(tag);

    try {
      const registration = serviceWorkerRegistrationRef.current;
      
      // Siempre priorizar el Service Worker para notificaciones consistentes y background-ready
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, {
          body,
          icon: '/bot-icon.svg',
          badge: '/bot-icon.svg',
          tag,
          renotify: false,
          requireInteraction: false,
          silent: !preferences.soundEnabled,
          data: { url: notification?.data?.url || '/' },
        });
      } else {
        // Fallback seguro solo si no hay service worker
        const push = new window.Notification(title, {
          body,
          icon: '/bot-icon.svg',
          badge: '/bot-icon.svg',
          tag,
          renotify: false,
          requireInteraction: false,
          silent: !preferences.soundEnabled,
          data: { url: notification?.data?.url || '/' },
        });

        browserPushesRef.current.set(tag, push);

        push.onclick = () => {
          try {
            window.focus();
          } catch {
            // ignore
          }
          openNotificationTarget(notification);
          void closeBrowserPush(tag);
        };

        push.onclose = () => {
          clearBrowserPushTimeout(tag);
          browserPushesRef.current.delete(tag);
        };
      }

      if (duration > 0) {
        const timeoutId = window.setTimeout(() => {
          void closeBrowserPush(tag);
        }, duration);
        browserPushTimeoutsRef.current.set(tag, timeoutId);
      }
    } catch (err) {
      console.error('Error showing push notification:', err);
    }
  }, [clearBrowserPushTimeout, closeBrowserPush, getBrowserPushDuration, openNotificationTarget, preferences.soundEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        serviceWorkerRegistrationRef.current = registration;
      })
      .catch(() => {
        serviceWorkerRegistrationRef.current = null;
      });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') closeAllBrowserPushes();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [closeAllBrowserPushes]);

  useEffect(() => {
    if (settings.push) return;
    closeAllBrowserPushes();
  }, [closeAllBrowserPushes, settings.push]);

  useEffect(() => () => closeAllBrowserPushes(), [closeAllBrowserPushes]);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore */ }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* ignore */ }
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
    if (authLoading || !isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);

    try {
      const data = await api.getNotificaciones(pageNum, 20);
      const list = data?.notifications || data?.notificaciones || data?.data || [];

      // Agregar IDs al Set de vistos para evitar duplicados
      list.forEach((n: Notification) => {
        seenNotificationsRef.current.add(n.id);
      });

      if (append) {
        setNotifications(prev => [...prev, ...list]);
      } else {
        setNotifications(list);
      }

      const unread = list.filter((n: Notification) => !n.leida).length;
      if (!append) {
        setUnreadCount(unread);
      } else {
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
  }, [authLoading, isAuthenticated]);

  const refresh = useCallback(async () => {
    await loadNotifications(1, false);
  }, [loadNotifications]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await loadNotifications(page + 1, true);
  }, [hasMore, isLoading, page, loadNotifications]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      loadingRef.current = false;
      setIsLoading(false);
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      setPage(1);
      return;
    }
    refresh();
  }, [authLoading, isAuthenticated, refresh]);

  useEffect(() => {
    if (!socket || authLoading || !isAuthenticated) return;

    const handleNotification = (notification: Notification) => {
      if (!notification || seenNotificationsRef.current.has(notification.id)) return;
      
      // Filtrar por roles objetivo: verificar targetRoles y para
      const notificationTargetRoles = (notification as any).targetRoles as string[] | null;
      const notificationPara = (notification as any).para as string | null;
      
      // Si la notificación tiene targetRoles específicos, verificar el rol del usuario
      if (notificationTargetRoles && notificationTargetRoles.length > 0) {
        const userRole = user?.rol?.toLowerCase() || '';
        const matchesRole = notificationTargetRoles.some(r => r.toLowerCase() === userRole);
        if (!matchesRole) {
          console.log(`🔒 Notificación filtrada por rol: requiere [${notificationTargetRoles.join(', ')}], usuario es [${userRole}]`);
          return;
        }
      }
      
      // Si la notificación tiene "para" específico, verificar
      if (notificationPara) {
        const userRole = user?.rol?.toLowerCase() || '';
        const paraLower = notificationPara.toLowerCase();
        const matchesPara = 
          paraLower === 'all' || 
          paraLower === 'todos' ||
          paraLower === userRole ||
          paraLower === user?.username?.toLowerCase();
        if (!matchesPara) {
          console.log(`🔒 Notificación filtrada: para [${notificationPara}], usuario es [${user?.username}](${userRole})`);
          return;
        }
      }
      
      // Deduplicación por contenido en el frontend (evita spam visual idéntico)
      const contentHash = generateContentHash(notification);
      const now = Date.now();
      const lastSeen = recentContentHashesRef.current.get(contentHash);
      
      if (lastSeen && now - lastSeen < 20000) { // Aumentado a 20 segundos para mayor seguridad
        console.log(`♻️ Notificación visual duplicada omitida en frontend (Hash: ${contentHash})`);
        return;
      }
      
      recentContentHashesRef.current.set(contentHash, now);
      seenNotificationsRef.current.add(notification.id);
      cleanupRecentHashes();

      if (!shouldShowNotification(notification)) return;

      setNotifications(prev => [notification, ...prev].slice(0, 100));
      if (!notification.leida) {
        setUnreadCount(prev => prev + 1);
      }

      if (settings.enabled) {
        const toastClass =
          notification.tipo === 'error'
            ? 'toast-custom toast-error'
            : notification.tipo === 'success'
              ? 'toast-custom toast-success'
              : notification.tipo === 'warning'
                ? 'toast-custom toast-warning'
                : 'toast-custom toast-info';

        const toastOptions: any = {
          id: `socket-toast-${contentHash.slice(0, 24)}`,
          duration: notification.tipo === 'error' ? 7000 : 5000,
          icon: getNotificationIcon(notification.tipo),
          className: toastClass,
        };

        const onClick = () => {
          openNotificationTarget(notification);
        };

        const content = <NotificationToastContent notification={notification} onClick={onClick} />;

        if (notification.tipo === 'error') toast.error(content, toastOptions);
        else if (notification.tipo === 'success') toast.success(content, toastOptions);
        else toast(content, toastOptions);
      }

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
      // Las notificaciones push ahora comparten la misma lógica de deduplicación que los toasts
      if (
        settings.push &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        shouldShowBrowserPush(contentHash)
      ) {
        void showBrowserPushNotification(notification, contentHash);
      }
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION, handleNotification);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION, handleNotification);
    };
  }, [socket, authLoading, isAuthenticated, shouldShowNotification, settings, preferences, cleanupRecentHashes, generateContentHash, shouldShowBrowserPush, openNotificationTarget, showBrowserPushNotification]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await api.markNotificationRead(id);
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
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
      setUnreadCount(0);
      notify.success('Todas las notificaciones marcadas como leídas');
    } catch (err) {
      notify.error('Error al marcar como leídas');
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
      notify.error('Error al eliminar notificación');
    }
  }, []);

  const deleteAllNotifications = useCallback(async (scope: 'all' | 'read' | 'unread' = 'all') => {
    try {
      await api.deleteAllNotifications(scope);

      if (scope === 'all') {
        setNotifications([]);
        setUnreadCount(0);
        setHasMore(false);
        setPage(1);

        seenNotificationsRef.current.clear();
        recentContentHashesRef.current.clear();
      } else {
        // For partial clears, refresh state from server.
        await loadNotifications(1, false);
      }

      notify.success(
        scope === 'all'
          ? 'Todas las notificaciones fueron eliminadas'
          : scope === 'read'
            ? 'Notificaciones leídas eliminadas'
            : 'Notificaciones no leídas eliminadas'
      );
    } catch (err) {
      notify.error('Error al eliminar notificaciones');
    }
  }, [loadNotifications]);

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    let nextSettings = { ...newSettings };

    if (Object.prototype.hasOwnProperty.call(newSettings, 'push')) {
      const wantsPush = Boolean(newSettings.push);

      if (wantsPush) {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          nextSettings.push = false;
          notify.warning('Tu navegador no soporta notificaciones push');
        } else {
          if ('serviceWorker' in navigator) {
            try {
              serviceWorkerRegistrationRef.current = await navigator.serviceWorker.register('/sw.js');
            } catch {
              serviceWorkerRegistrationRef.current = null;
            }
          }

          if (Notification.permission === 'default') {
            try {
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') {
                nextSettings.push = false;
                notify.warning(permission === 'denied' ? 'Permiso de notificaciones bloqueado' : 'Permiso de notificaciones no concedido');
              }
            } catch {
              nextSettings.push = false;
              notify.error('No se pudo solicitar permiso para las notificaciones');
            }
          } else if (Notification.permission !== 'granted') {
            nextSettings.push = false;
            notify.warning('Activa las notificaciones del navegador para usar Push');
          }
        }
      } else {
        closeAllBrowserPushes();
      }
    }

    setSettings(prev => ({ ...prev, ...nextSettings }));
  }, [closeAllBrowserPushes]);

  const value = useMemo(() => ({
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
    deleteAllNotifications,
    loadMore,
    updateSettings,
    refresh,
  }), [notifications, unreadCount, settings, isLoading, isOpen, hasMore, toggleOpen, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications, loadMore, updateSettings, refresh]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications debe ser usado dentro de NotificationProvider');
  return ctx;
}

function getNotificationIcon(tipo: string): React.ReactNode {
  const icon =
    tipo === 'error'
      ? AlertCircle
      : tipo === 'success'
        ? CheckCircle
        : tipo === 'warning'
          ? AlertTriangle
          : tipo === 'system'
            ? Zap
            : Info;

  const Icon = icon;

  return (
    <span className="toast-icon" aria-hidden="true">
      <Icon className="w-5 h-5" />
    </span>
  );
}
