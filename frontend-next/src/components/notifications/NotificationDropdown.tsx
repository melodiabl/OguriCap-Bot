'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNotifications, Notification } from '@/contexts/NotificationContext';
import { Bell, Check, CheckCheck, Trash2, AlertCircle, CheckCircle, Info, AlertTriangle, Loader2, Zap } from 'lucide-react';
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
  };

  const getTypeIcon = (tipo: string) => {
    switch (tipo) {
      case 'success': return <CheckCircle className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'system': return <Zap className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
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
  );
}
