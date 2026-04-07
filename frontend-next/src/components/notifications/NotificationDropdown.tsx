'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useNotifications, Notification } from '@/contexts/NotificationContext';
import { Bell, Check, CheckCheck, Trash2, AlertCircle, CheckCircle, Info, AlertTriangle, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

export function NotificationDropdown({ isOpen, onClose, buttonRef }: NotificationDropdownProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    loadMore,
    hasMore,
  } = useNotifications();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 8 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const gap = 8;
      const width = Math.min(28 * 16, Math.max(0, window.innerWidth - 16)); // max-w-md(28rem) vs w-[calc(100vw-1rem)]
      const desiredLeft = rect.right - width;
      const maxLeft = Math.max(gap, window.innerWidth - width - gap);
      const left = Math.min(Math.max(gap, desiredLeft), maxLeft);
      setCoords({ top: rect.bottom + gap, left });
    }
  }, [isOpen, buttonRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        // Only close if we didn't click the button that toggles it
        if (buttonRef?.current && buttonRef.current.contains(e.target as Node)) {
          return;
        }
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleResize = () => {
      if (buttonRef?.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const gap = 8;
        const width = Math.min(28 * 16, Math.max(0, window.innerWidth - 16));
        const desiredLeft = rect.right - width;
        const maxLeft = Math.max(gap, window.innerWidth - width - gap);
        const left = Math.min(Math.max(gap, desiredLeft), maxLeft);
        setCoords({ top: rect.bottom + gap, left });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, onClose, buttonRef]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.leida) {
      await markAsRead(notification.id);
    }
  };

  const handleDeleteAll = async () => {
    if (notifications.length === 0) return;
    const ok = window.confirm('¿Eliminar todas las notificaciones? Esta acción no se puede deshacer.');
    if (!ok) return;
    await deleteAllNotifications('all');
  };

  const getTypeIcon = (tipo: string) => {
    const icons = {
      info: <Info className="w-5 h-5 text-[rgb(var(--accent))]" />,
      success: <CheckCircle className="w-5 h-5 text-[rgb(var(--success))]" />,
      warning: <AlertTriangle className="w-5 h-5 text-[rgb(var(--warning))]" />,
      error: <AlertCircle className="w-5 h-5 text-[rgb(var(--danger))]" />,
      system: <Bell className="w-5 h-5 text-[rgb(var(--primary))]" />,
    };
    return icons[tipo as keyof typeof icons] || icons.info;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'AHORA';
    if (minutes < 60) return `HACE ${minutes}M`;
    if (hours < 24) return `HACE ${hours}H`;
    if (days < 7) return `HACE ${days}D`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();
  };

  if (!mounted) return null;

  return createPortal(
    <div data-theme={theme} data-page="dashboard" className="contents">
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/25 backdrop-blur-sm md:bg-transparent md:backdrop-blur-0"
              onClick={onClose}
            />
            
            {/* Dropdown */}
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
              }}
              className="z-[9999] flex w-[calc(100vw-1rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-border/15 bg-card/92 shadow-glow-oguri-mixed backdrop-blur-2xl"
            >
              {/* Header */}
              <div className="border-b border-border/15 bg-gradient-oguri-phantom p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-oguri-lavender animate-pulse" />
                    <h3 className="font-bold tracking-tight text-foreground">Notificaciones</h3>
                  </div>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[rgb(var(--primary))] text-white rounded-full shadow-[0_0_18px_rgb(var(--primary)/0.35)]"
                    >
                      {unreadCount} nuevas
                    </motion.span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="group flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--text-secondary))] transition-colors hover:text-primary"
                    >
                      <CheckCheck className="w-3 h-3 group-hover:animate-oguri-sparkle" />
                      Sincronizar Aura (Leídas)
                    </button>
                  )}

                  {notifications.length > 0 && (
                    <button
                      onClick={handleDeleteAll}
                      className="group flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-400/80 transition-colors hover:text-red-400"
                      title="Eliminar todas"
                    >
                      <Trash2 className="w-3 h-3" />
                      Vaciar
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
                <div
                  ref={scrollRef}
                  className="max-h-[calc(100vh-12rem)] md:max-h-[32rem] overflow-y-auto overscroll-contain scroll-smooth"
                  style={{ scrollbarWidth: 'thin' }}
                >
                {isLoading && notifications.length === 0 ? (
                  <div className="p-8 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 text-muted animate-spin" />
                    <p className="text-sm text-muted">Cargando notificaciones...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 flex flex-col items-center justify-center gap-3">
                    <Bell className="w-10 h-10 text-muted/40 opacity-50" />
                    <p className="text-sm text-muted text-center">No hay notificaciones</p>
                    <p className="text-xs text-muted/60 text-center">Las notificaciones nuevas aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/10">
                    <AnimatePresence mode="popLayout">
                      {notifications.map((notification, index) => (
                        <motion.div
                          key={notification.id}
                          layout="position"
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.2,
                            delay: reduceMotion ? 0 : index * 0.02,
                          }}
                          className={cn(
                            'relative p-4 hover:bg-oguri-purple/10 transition-all cursor-pointer group',
                            !notification.leida && 'bg-oguri-purple/5'
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          {/* Unread indicator */}
                          {!notification.leida && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-oguri-purple shadow-glow-oguri-purple" />
                          )}

                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={cn(
                              'p-2 rounded-lg flex-shrink-0 transition-transform group-hover:scale-110',
                              notification.tipo === 'error' && 'bg-[rgb(var(--danger)/0.12)]',
                              notification.tipo === 'warning' && 'bg-[rgb(var(--warning)/0.12)]',
                              notification.tipo === 'success' && 'bg-[rgb(var(--success)/0.12)]',
                              notification.tipo === 'info' && 'bg-[rgb(var(--accent)/0.12)]',
                              notification.tipo === 'system' && 'bg-[rgb(var(--primary)/0.12)]',
                            )}>
                              {getTypeIcon(notification.tipo)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className={cn(
                                  'font-semibold text-sm leading-tight',
                                  !notification.leida ? 'text-[rgb(var(--text-primary))]' : 'text-[rgb(var(--text-secondary))]'
                                )}>
                                  {notification.titulo}
                                </h4>
                                {!notification.leida && (
                                  <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-2 h-2 rounded-full bg-[rgb(var(--primary))] flex-shrink-0 mt-1"
                                  />
                                )}
                              </div>
                              <p className={cn(
                                "text-xs line-clamp-2 mb-2",
                                !notification.leida ? "text-[rgb(var(--text-primary)/0.9)]" : "text-[rgb(var(--text-muted))]"
                              )}>
                                {notification.mensaje}
                              </p>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-medium text-[rgb(var(--text-muted)/0.7)]">
                                  {formatDate(notification.fecha_creacion)}
                                </span>
                                {notification.categoria && (
                                  <span className="rounded-full border border-border/15 bg-card/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                                    {notification.categoria}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              {!notification.leida && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                  className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors"
                                  title="Marcar como leída"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                                className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Load More */}
                {hasMore && notifications.length > 0 && (
                  <div className="border-t border-border/15 p-4">
                    <button
                      onClick={loadMore}
                      disabled={isLoading}
                      className="w-full py-2 text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Cargando...
                        </>
                      ) : (
                        'Cargar más'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
