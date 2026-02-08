'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useBotStatus } from '@/hooks/useRealTime';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { Bell, Search, Moon, Sun, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
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
  const { isConnected: pollingConnected } = useBotStatus(5000);
  const { unreadCount, isOpen, setIsOpen, toggleOpen } = useNotifications();

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentPage = menuItems.find(item => item.path === pathname);

  return (
    <header className="sticky top-0 z-50 h-20 w-full border-b border-white/5 bg-[#0a0a0f]/80 px-4 lg:px-8 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="hover:bg-white/5 text-gray-400"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>

          <div className="hidden sm:block">
            <h2 className="text-xl font-black text-white uppercase tracking-[0.15em]">
              {currentPage?.label || 'Panel'}
            </h2>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-md mx-12">
          <div className="relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Buscar en el panel..."
              className="w-full h-11 pl-11 pr-4 rounded-xl bg-white/5 border border-white/5 focus:border-primary/50 focus:bg-white/10 outline-none text-sm text-white placeholder:text-gray-600 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden xl:flex items-center gap-3">
            <RealTimeBadge isActive={isSocketConnected} />
          </div>

          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleOpen}
              className={cn(
                'relative p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300',
                unreadCount > 0 && 'text-primary'
              )}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center text-[10px] font-black bg-primary text-white rounded-full border-2 border-[#0a0a0f] animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
            
            <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} />
          </div>

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          )}

          <div className="h-8 w-[1px] bg-white/5 mx-1 hidden md:block" />

          <div className="flex items-center gap-3 p-1 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-glow-sm group-hover:scale-105 transition-transform">
              AD
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
