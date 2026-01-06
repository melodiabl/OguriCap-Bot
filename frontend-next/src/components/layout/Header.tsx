'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useBotStatus } from '@/hooks/useRealTime';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { Bell, Search, Moon, Sun, RefreshCw, Menu, X, Volume2, VolumeX, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { cn } from '@/lib/utils';

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
  { path: '/analytics', label: 'Analytics' },
  { path: '/multimedia', label: 'Multimedia' },
  { path: '/configuracion', label: 'Configuración' },
];

interface HeaderProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarOpen }) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { isConnected: isSocketConnected } = useSocketConnection();
  const { isConnected: pollingConnected, isConnecting } = useBotStatus(5000);
  const { unreadCount, isOpen, setIsOpen, toggleOpen, notifications } = useNotifications();
  const reduceMotion = useReducedMotion();
  const [preferences, setPreferences] = React.useState({ soundEnabled: true, hapticsEnabled: true });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const position = {
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      };
      setDropdownPosition(position);
    }
  }, [isOpen]);

  const togglePreference = (key: 'soundEnabled' | 'hapticsEnabled') => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const currentPage = menuItems.find(item => item.path === pathname);
  const isConnected = pollingConnected;

  return (
    <header className="sticky top-0 z-50 glass-dark border-b border-white/10 header-chrome">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <div className="lg:hidden">
            <Tooltip content={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'} side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={onMenuClick}
                aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
                className="hover-glass-bright"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </Tooltip>
          </div>

          <div className="hidden sm:block">
            <h2 className="text-2xl font-extrabold gradient-text-animated tracking-tight">
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
              className="input-search w-full hover-glass-bright focus-ring-animated"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Socket.IO status */}
          <LiveIndicator
            className="hidden sm:inline-flex"
            state={isSocketConnected ? 'live' : 'danger'}
            label={isSocketConnected ? 'Real-Time' : 'Offline'}
          />

          {/* Bot status */}
          <LiveIndicator
            className="hidden sm:inline-flex"
            state={isConnecting ? 'warning' : isConnected ? 'live' : 'danger'}
            label={isConnecting ? 'Bot Connecting' : isConnected ? 'Bot Online' : 'Bot Offline'}
          />

          {/* Notifications */}
          <div className="relative">
            <Tooltip content="Notificaciones" side="bottom">
              <Button
                ref={buttonRef}
                variant="ghost"
                size="icon"
                onClick={toggleOpen}
                aria-label="Abrir notificaciones"
                className={cn('relative hover-glass-bright', unreadCount > 0 && 'pulse-on-alert')}
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
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center text-xs font-bold bg-red-500 text-white rounded-full border-2 border-background"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.span>
                )}
              </Button>
            </Tooltip>

            {/* Portal para el dropdown */}
            {mounted && createPortal(
              <AnimatePresence>
                {isOpen && (
                  <>
                    {/* Overlay */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[9998]"
                      onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <motion.div
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        position: 'fixed',
                        top: `${dropdownPosition.top}px`,
                        right: `${dropdownPosition.right}px`,
                      }}
                      className="w-96 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-[9999]"
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
                              className={`p-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!notif.leida ? 'bg-primary-500/5' : ''
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
                      <div className="p-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-xs text-gray-400">Efectos</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePreference('soundEnabled');
                            }}
                            title={preferences.soundEnabled ? 'Sonido: activado' : 'Sonido: desactivado'}
                            className={`p-2 rounded-lg border transition-colors ${preferences.soundEnabled
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                              }`}
                          >
                            {preferences.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePreference('hapticsEnabled');
                            }}
                            title={preferences.hapticsEnabled ? 'Vibración: activada' : 'Vibración: desactivada'}
                            className={`p-2 rounded-lg border transition-colors ${preferences.hapticsEnabled
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                              }`}
                          >
                            <Smartphone className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="p-3 border-t border-white/10">
                        <button
                          onClick={() => {
                            setIsOpen(false);
                            router.push('/notificaciones');
                          }}
                          className="w-full py-2 text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors"
                        >
                          Ver todas las notificaciones
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>,
              document.body
            )}
          </div>

          {/* Theme toggle */}
          <Tooltip content={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Cambiar tema"
              className="hover-glass-bright"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </Tooltip>

          {/* Refresh */}
          <Tooltip content="Refrescar" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.reload()}
              aria-label="Refrescar"
              className="hover-glass-bright group"
            >
              <RefreshCw className={cn('w-5 h-5 transition-transform duration-300', !reduceMotion && 'group-hover:rotate-180')} />
            </Button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
};