'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useBotStatus } from '@/hooks/useRealTime';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { Bell, Search, Moon, Sun, RefreshCw, Menu, X } from 'lucide-react';
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
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { isConnected: isSocketConnected } = useSocketConnection();
  const { isConnected: pollingConnected, isConnecting } = useBotStatus(5000);
  const { unreadCount, isOpen, setIsOpen, toggleOpen } = useNotifications();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

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

            {mounted && <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} />}
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
