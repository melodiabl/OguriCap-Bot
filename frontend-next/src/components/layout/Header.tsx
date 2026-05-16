'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Bell, Leaf, Menu, Moon, Sparkles, Sun, Waves, X } from 'lucide-react';

import { DiagnosticsPanelButton } from '@/components/diagnostics/DiagnosticsPanelButton';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { ProfileAvatar } from '@/components/user/ProfileAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useDevicePerformance } from '@/contexts/DevicePerformanceContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useOguriTheme } from '@/contexts/OguriThemeContext';
import { NAV_ITEMS } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarOpen }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { user } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { unreadCount, isOpen, setIsOpen, toggleOpen } = useNotifications();
  const { isInZone, toggleZone } = useOguriTheme();
  const { effectsMode, performanceMode, cycleEffectsMode } = useDevicePerformance();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentPage = NAV_ITEMS.find((item) => item.path === pathname);

  const effectsLabel =
    effectsMode === 'auto'
      ? performanceMode
        ? 'Eco (Auto)'
        : 'Full (Auto)'
      : effectsMode === 'full'
        ? 'Full (Forzado)'
        : 'Eco (Forzado)';

  const EffectsIcon = performanceMode ? Leaf : Sparkles;

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-white/10 bg-[#0d0f0e]/72 px-4 backdrop-blur-2xl transition-all duration-300 lg:px-8',
        isInZone && 'border-[#25d366]/25 shadow-[0_12px_40px_-24px_rgba(37,211,102,0.45)]'
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_left_top,rgba(var(--primary),0.16),transparent_24%),radial-gradient(circle_at_right_bottom,rgba(var(--accent),0.14),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:30px_30px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 top-0 h-24 w-40 rounded-full bg-primary/14 blur-3xl opacity-50"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1 h-20 w-32 rounded-full bg-secondary/16 blur-3xl opacity-40"
      />

      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 py-3 lg:py-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={onMenuClick}
                className="border border-border/15 bg-card/55 text-muted hover:bg-card/80 hover:text-foreground"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="hidden items-center gap-2 rounded-lg border border-[#25d366]/20 bg-[#25d366]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#a7f3c7] sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-primary shadow-glow-oguri-purple" />
              OguriCap Live
              </div>
              <h2 className="text-lg font-black tracking-tight text-foreground [overflow-wrap:anywhere] sm:mt-2 sm:text-2xl">
                {currentPage?.headerLabel || currentPage?.label || 'Panel'}
              </h2>
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#111713]/74 p-1.5 shadow-[0_18px_38px_-28px_rgba(0,0,0,0.24)] sm:w-auto sm:max-w-[min(100%,46rem)] sm:shrink-0 sm:justify-end">
            <div className="relative">
              <Tooltip content="Notificaciones" side="bottom">
                <Button
                  ref={buttonRef}
                  variant="ghost"
                  size="icon"
                  onClick={toggleOpen}
                  aria-label="Abrir notificaciones"
                  className={cn(
                    'relative rounded-lg border border-transparent bg-transparent text-muted hover:border-[#25d366]/20 hover:bg-white/[0.06] hover:text-foreground',
                    unreadCount > 0 && 'pulse-on-alert border-primary/20 bg-primary/10 text-foreground shadow-glow-oguri-purple'
                  )}
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
                    <Bell className="h-5 w-5" />
                  </motion.div>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-background bg-danger px-1.5 text-xs font-bold text-white"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.span>
                  )}
                </Button>
              </Tooltip>

              <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} buttonRef={buttonRef} />
            </div>

            <div className="flex items-center gap-2">
              <DiagnosticsPanelButton />
              

              <Tooltip content={isInZone ? 'Desactivar Aura Fluida' : 'Activar Aura Fluida'}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleZone}
                  className={cn(
                    'relative overflow-hidden rounded-lg border border-transparent transition-all duration-300',
                    isInZone
                      ? 'bg-oguri-cyan/15 text-oguri-cyan shadow-glow-oguri-cyan'
                      : 'text-muted hover:border-border/20 hover:bg-white/[0.06] hover:text-foreground'
                  )}
                >
                  <Waves className={cn('h-5 w-5 transition-transform', isInZone && 'scale-110 animate-pulse')} />
                </Button>
              </Tooltip>

              <Tooltip content={`Efectos: ${effectsLabel}`} side="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cycleEffectsMode}
                  aria-label="Cambiar calidad de efectos"
                  className={cn(
                    'relative overflow-hidden rounded-lg border border-transparent transition-all duration-300',
                    performanceMode
                      ? 'text-muted hover:border-border/20 hover:bg-white/[0.06] hover:text-foreground'
                      : 'bg-oguri-purple/15 text-oguri-lavender shadow-glow-oguri-purple'
                  )}
                >
                  <EffectsIcon className={cn('h-5 w-5 transition-transform', !performanceMode && 'group-hover:scale-110')} />
                  {effectsMode !== 'auto' && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-background',
                        effectsMode === 'full' ? 'bg-oguri-cyan' : 'bg-oguri-gold'
                      )}
                    />
                  )}
                </Button>
              </Tooltip>
            </div>

            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="rounded-lg border border-transparent bg-transparent text-muted hover:border-border/20 hover:bg-white/[0.06] hover:text-foreground"
              >
                {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            )}

            <div className="hidden h-8 w-px bg-border/20 xl:block" />

            <Link
              href="/perfil"
              className="hidden xl:flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] px-2.5 py-1.5 transition-colors hover:border-[#25d366]/30 hover:bg-[#25d366]/5"
            >
              <ProfileAvatar size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{user?.username || 'Usuario'}</p>
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--text-secondary))]">{user?.rol || 'sesion activa'}</p>
              </div>
            </Link>
          </div>
        </div>

      </div>
    </header>
  );
};
