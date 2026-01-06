'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNotifications, Notification } from '@/contexts/NotificationContext';
import { Bell, Check, CheckCheck, Trash2, X, AlertCircle, CheckCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    hasMore,
  } = useNotifications();
  const reduceMotion = useReducedMotion();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.leida) {
      await markAsRead(notification.id);
    }
    onClose();
  };

  const getTypeIcon = (tipo: string) => {
    const icons = {
      info: <Info className="w-5 h-5 text-cyan-400" />,
      success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
      warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      error: <AlertCircle className="w-5 h-5 text-red-400" />,
      system: <Bell className="w-5 h-5 text-primary-400" />,
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
    
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          
          {/* Dropdown */}
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="absolute left-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] z-60 rounded-2xl glass-dark border border-white/10 shadow-2xl overflow-hidden md:left-auto md:right-0"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-primary-500/10 to-violet-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary-400" />
                  <h3 className="font-semibold text-white">Notificaciones</h3>
                </div>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full"
                  >
                    {unreadCount} nuevas
                  </motion.span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {/* List */}
            <div
              ref={scrollRef}
              className="max-h-[32rem] overflow-y-auto overscroll-contain scroll-smooth"
              style={{ scrollbarWidth: 'thin' }}
            >
              {isLoading && notifications.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  <p className="text-sm text-gray-400">Cargando notificaciones...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center gap-3">
                  <Bell className="w-10 h-10 text-gray-500 opacity-50" />
                  <p className="text-sm text-gray-400 text-center">No hay notificaciones</p>
                  <p className="text-xs text-gray-500 text-center">Las notificaciones nuevas aparecerán aquí</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
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
                          'relative p-4 hover:bg-white/5 transition-colors cursor-pointer group',
                          !notification.leida && 'bg-primary-500/5'
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {/* Unread indicator */}
                        {!notification.leida && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500" />
                        )}

                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={cn(
                            'p-2 rounded-lg flex-shrink-0',
                            notification.tipo === 'error' && 'bg-red-500/10',
                            notification.tipo === 'warning' && 'bg-amber-500/10',
                            notification.tipo === 'success' && 'bg-emerald-500/10',
                            notification.tipo === 'info' && 'bg-cyan-500/10',
                            notification.tipo === 'system' && 'bg-primary-500/10',
                          )}>
                            {getTypeIcon(notification.tipo)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className={cn(
                                'font-medium text-sm leading-tight',
                                !notification.leida ? 'text-white' : 'text-gray-300'
                              )}>
                                {notification.titulo}
                              </h4>
                              {!notification.leida && (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1"
                                />
                              )}
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                              {notification.mensaje}
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-gray-500">
                                {formatDate(notification.fecha_creacion)}
                              </span>
                              {notification.categoria && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-gray-400 border border-white/10">
                                  {notification.categoria}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notification.leida && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
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
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
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
                <div className="p-4 border-t border-white/10">
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="w-full py-2 text-sm text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
  );
}

