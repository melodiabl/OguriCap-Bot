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
    loadMore,
    hasMore,
  } = useNotifications();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
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
        setCoords({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
        });
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

  const getTypeIcon = (tipo: string) => {
<<<<<<< HEAD
    const icons = {
      info: <Info className="w-5 h-5 text-accent" />,
      success: <CheckCircle className="w-5 h-5 text-success" />,
      warning: <AlertTriangle className="w-5 h-5 text-warning" />,
      error: <AlertCircle className="w-5 h-5 text-danger" />,
      system: <Bell className="w-5 h-5 text-primary" />,
    };
    return icons[tipo as keyof typeof icons] || icons.info;
=======
    switch (tipo) {
      case 'success': return <CheckCircle className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'system': return <Zap className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
>>>>>>> 4f37e52130327d4550d0ae49bfd68dbd08db8a62
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

<<<<<<< HEAD
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
              className="fixed inset-0 z-[9998]"
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
                right: `${coords.right}px`,
              }}
              className="w-96 max-w-[calc(100vw-2rem)] z-[9999] rounded-2xl glass-dark border border-white/10 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-primary/10 to-secondary/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-white">Notificaciones</h3>
                  </div>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="px-2 py-0.5 text-xs font-bold bg-danger text-white rounded-full"
                    >
                      {unreadCount} nuevas
                    </motion.span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
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
                            !notification.leida && 'bg-primary/5'
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          {/* Unread indicator */}
                          {!notification.leida && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                          )}

                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={cn(
                              'p-2 rounded-lg flex-shrink-0',
                              notification.tipo === 'error' && 'bg-danger/10',
                              notification.tipo === 'warning' && 'bg-warning/10',
                              notification.tipo === 'success' && 'bg-success/10',
                              notification.tipo === 'info' && 'bg-accent/10',
                              notification.tipo === 'system' && 'bg-primary/10',
                            )}>
                              {getTypeIcon(notification.tipo)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className={cn(
                                  'font-medium text-sm leading-tight',
                                  !notification.leida ? 'text-white' : 'text-foreground/70'
                                )}>
                                  {notification.titulo}
                                </h4>
                                {!notification.leida && (
                                  <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1"
                                  />
                                )}
                              </div>
                              <p className="text-xs text-muted line-clamp-2 mb-2">
                                {notification.mensaje}
                              </p>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted/60">
                                  {formatDate(notification.fecha_creacion)}
                                </span>
                                {notification.categoria && (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-muted/80 border border-white/10">
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
                  <div className="p-4 border-t border-white/10">
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
=======
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full mt-4 w-96 max-w-[calc(100vw-2rem)] z-50 rounded-3xl bg-[#0a0a0f]/98 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden md:left-auto md:right-0"
          >
            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-glow-sm">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-black text-white text-sm uppercase tracking-[0.1em]">Notificaciones</h3>
                </div>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[9px] font-black bg-primary text-white rounded-md uppercase tracking-widest animate-pulse">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center mt-5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Actividad reciente</p>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] font-black text-primary hover:text-white transition-colors uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Marcar todo
                  </button>
                )}
              </div>
            </div>

            <div
              ref={scrollRef}
              className="max-h-[32rem] overflow-y-auto custom-scrollbar"
            >
              {isLoading && notifications.length === 0 ? (
                <div className="p-16 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sincronizando...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-16 flex flex-col items-center justify-center gap-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                    <Bell className="w-10 h-10 text-gray-800" />
                  </div>
                  <div>
                    <p className="text-white font-black uppercase tracking-widest text-sm">Bandeja limpia</p>
                    <p className="text-[10px] text-gray-600 mt-2 uppercase tracking-widest leading-relaxed">No hay novedades por ahora.<br/>Todo está bajo control.</p>
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  <AnimatePresence mode="popLayout">
                    {notifications.map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        layout="position"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className={cn(
                          'notif-item group',
                          !notification.leida && 'unread'
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className={cn(
                          'notif-item-icon',
                          notification.tipo === 'success' && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]',
                          notification.tipo === 'warning' && 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_15px_rgba(251,191,36,0.1)]',
                          notification.tipo === 'error' && 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_15px_rgba(248,113,113,0.1)]',
                          notification.tipo === 'system' && 'bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-[0_0_15px_rgba(167,139,250,0.1)]',
                          (!notification.tipo || notification.tipo === 'info') && 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(56,189,248,0.1)]'
                        )}>
                          {getTypeIcon(notification.tipo)}
                        </div>

                        <div className="notif-item-content">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="notif-item-title">{notification.titulo}</h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="notif-item-message">{notification.mensaje}</p>
                          <div className="flex items-center justify-between mt-3">
                            <span className="notif-item-time">{formatDate(notification.fecha_creacion)}</span>
                            {notification.categoria && (
                              <span className="px-2 py-0.5 rounded-md bg-white/5 text-[8px] font-black uppercase tracking-[0.1em] text-gray-500 border border-white/5">
                                {notification.categoria}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/5 bg-white/[0.02] text-center">
               <button 
                onClick={onClose}
                className="text-[9px] font-black text-gray-600 hover:text-white uppercase tracking-[0.3em] transition-colors"
               >
                 Cerrar Panel
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
>>>>>>> 4f37e52130327d4550d0ae49bfd68dbd08db8a62
  );
}
