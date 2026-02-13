'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useBotStatus } from '@/hooks/useRealTime';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { Bell, Search, Moon, Sun, RefreshCw, Menu, X, Zap, Palette, Sparkles } from 'lucide-react';
import { useOguriTheme } from '@/contexts/OguriThemeContext';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/navigation';

interface HeaderProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarOpen }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { isConnected: isSocketConnected } = useSocketConnection();
  const { isConnected: pollingConnected, isConnecting } = useBotStatus(5000);
  const { unreadCount, isOpen, setIsOpen, toggleOpen } = useNotifications();
  const { isInZone, toggleZone, currentAura, setCurrentAura } = useOguriTheme();
  const [isAuraSelectorOpen, setIsAuraSelectorOpen] = useState(false);
  const auraRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentPage = NAV_ITEMS.find(item => item.path === pathname);
  const isConnected = pollingConnected;

  return (
    <header className={cn(
      "sticky top-0 z-50 h-20 w-full border-b border-oguri-purple/10 glass-phantom px-4 lg:px-8 transition-all duration-500",
      isInZone && "animate-oguri-zone shadow-glow-oguri-cyan border-oguri-cyan/30"
    )}>
      <div className="max-w-7xl mx-auto w-full flex h-full items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="hover:bg-oguri-purple/10 text-oguri-lavender/60"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>

          <div className="hidden sm:block">
            <h2 className="text-2xl font-black text-gradient-oguri tracking-tight animate-start-burst">
              {currentPage?.headerLabel || currentPage?.label || 'Panel'}
            </h2>
          </div>
        </div>

        {/* Center - Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-oguri-lavender/40" />
            <input
              type="text"
              placeholder="Buscar en el panel..."
              className="w-full h-11 pl-11 pr-4 rounded-xl bg-oguri-phantom-900/40 border border-oguri-purple/10 focus:border-oguri-lavender/50 focus:bg-oguri-phantom-800/60 outline-none text-sm text-white placeholder:text-oguri-phantom-400 transition-all focus:shadow-glow-oguri-purple"
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

          {/* Modo Zona Toggle */}
          <Tooltip content={isInZone ? "Desactivar Modo Zona" : "Activar Modo Zona"}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleZone}
              className={cn(
                "p-2.5 rounded-xl transition-all duration-500 group relative overflow-hidden",
                isInZone 
                  ? "bg-oguri-cyan/20 text-oguri-cyan shadow-glow-oguri-cyan" 
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              )}
            >
              <Zap className={cn("w-5 h-5 transition-transform", isInZone && "fill-current scale-110 animate-pulse")} />
            </Button>
          </Tooltip>

          {/* Aura Selector */}
          <div className="relative" ref={auraRef}>
            <Tooltip content="Personalizar Aura">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAuraSelectorOpen(!isAuraSelectorOpen)}
                className="p-2.5 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all group"
              >
                <Palette className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              </Button>
            </Tooltip>

            <AnimatePresence>
              {isAuraSelectorOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 p-2 rounded-2xl glass-phantom border border-oguri-purple/20 shadow-2xl z-50"
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-oguri-lavender/40 px-2 py-1 mb-1">Elegir Aura</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: 'purple', name: 'Oguri', color: 'bg-oguri-purple' },
                      { id: 'phantom', name: 'Phantom', color: 'bg-slate-700' },
                      { id: 'gold', name: 'Victoria', color: 'bg-oguri-gold' },
                      { id: 'cyan', name: 'Cian', color: 'bg-oguri-cyan' }
                    ].map((aura) => (
                      <button
                        key={aura.id}
                        onClick={() => {
                          setCurrentAura(aura.id as any);
                          setIsAuraSelectorOpen(false);
                        }}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-xl transition-all hover:bg-oguri-purple/10",
                          currentAura === aura.id && "bg-oguri-purple/20 ring-1 ring-oguri-purple/30"
                        )}
                      >
                        <div className={cn("w-3 h-3 rounded-full shadow-sm", aura.color)} />
                        <span className="text-[10px] font-bold text-white uppercase">{aura.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
                    className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center text-xs font-bold bg-danger text-white rounded-full border-2 border-background"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.span>
                )}
              </Button>
            </Tooltip>

            <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} buttonRef={buttonRef} />
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

          <div className="flex items-center gap-3 p-1 rounded-2xl bg-oguri-phantom-900/40 border border-oguri-purple/10 hover:bg-oguri-phantom-800/60 hover:border-oguri-lavender/30 transition-all cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-gradient-oguri-primary flex items-center justify-center text-white font-black text-sm shadow-glow-oguri-purple group-hover:scale-105 transition-transform group-hover:animate-oguri-aura">
              AD
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
