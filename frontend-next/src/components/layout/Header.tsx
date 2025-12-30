'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useSocket } from '@/contexts/SocketContext';
import { useBotStatus, useNotifications } from '@/hooks/useRealTime';
import { Bell, Search, Moon, Sun, RefreshCw, Menu, X, Radio } from 'lucide-react';

const menuItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/bot', label: 'Estado del Bot' },
  { path: '/usuarios', label: 'Usuarios' },
  { path: '/subbots', label: 'SubBots' },
  { path: '/grupos', label: 'Grupos' },
  { path: '/grupos-management', label: 'Gestión Global' },
  { path: '/aportes', label: 'Aportes' },
  { path: '/pedidos', label: 'Pedidos' },
  { path: '/proveedores', label: 'Proveedores' },
  { path: '/ai-chat', label: 'AI Chat' },
  { path: '/alertas', label: 'Alertas' },
  { path: '/tareas', label: 'Tareas' },
  { path: '/logs', label: 'Logs' },
  { path: '/notificaciones', label: 'Notificaciones' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/multimedia', label: 'Multimedia' },
  { path: '/configuracion', label: 'Configuración' },
];

interface HeaderProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarOpen }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { isConnected: isSocketConnected } = useSocket();
  const { isConnected: pollingConnected, isConnecting } = useBotStatus(5000);
  const { notifications, unreadCount } = useNotifications(30000);
  const reduceMotion = useReducedMotion();

  const currentPage = menuItems.find(item => item.path === pathname);
  const isConnected = pollingConnected;

  return (
    <header className="sticky top-0 z-30 glass-dark border-b border-white/10">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </motion.button>

          <div className="hidden sm:block">
            <h2 className="text-xl font-bold text-white">
              {currentPage?.label || 'Panel'}
            </h2>
          </div>
        </div>

        {/* Center - Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="input-search w-full"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Socket.IO status */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            isSocketConnected 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <Radio className={`w-3 h-3 ${isSocketConnected ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`} />
            <span className={`text-xs ${isSocketConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              {isSocketConnected ? 'Real-Time' : 'Offline'}
            </span>
          </div>

          {/* Bot status */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">
              {isConnected ? 'Bot Online' : 'Bot Offline'}
            </span>
          </div>

          {/* Notifications */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <motion.div
                animate={
                  !reduceMotion && unreadCount > 0
                    ? { rotate: [0, -10, 10, -6, 6, 0] }
                    : { rotate: 0 }
                }
                transition={
                  !reduceMotion && unreadCount > 0
                    ? { duration: 0.6, ease: 'easeOut', repeat: Infinity, repeatDelay: 4 }
                    : undefined
                }
              >
                <Bell className="w-5 h-5" />
              </motion.div>
              {unreadCount > 0 && (
                <span className="notification-dot">{unreadCount}</span>
              )}
            </motion.button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-80 glass-card rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="font-semibold text-white">Notificaciones</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                        {unreadCount} nuevas
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications && notifications.length > 0 ? (
                      notifications.slice(0, 5).map((notif: any, index: number) => (
                        <motion.div
                          key={notif.id || index}
                          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                          transition={reduceMotion ? undefined : { duration: 0.2, delay: index * 0.03 }}
                          className={`p-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                            !notif.leida ? 'bg-primary-500/5' : ''
                          }`}
                        >
                          <p className="text-sm text-white font-medium truncate">
                            {notif.titulo || notif.title || 'Notificación'}
                          </p>
                          <p className="text-xs text-gray-400 truncate mt-1">
                            {notif.mensaje || notif.message || ''}
                          </p>
                        </motion.div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-gray-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay notificaciones</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-white/10">
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        router.push('/notificaciones');
                      }}
                      className="w-full py-2 text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors"
                    >
                      Ver todas las notificaciones
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </motion.button>

          {/* Refresh */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => window.location.reload()}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </header>
  );
};
