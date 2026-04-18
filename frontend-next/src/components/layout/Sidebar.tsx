'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut } from 'lucide-react';

import { useNavParticleBurst } from '@/components/ui/NavParticles';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProfileAvatar } from '@/components/user/ProfileAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useGlobalUpdate } from '@/contexts/GlobalUpdateContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useSocketBotStatus } from '@/contexts/SocketContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useBotStatus } from '@/hooks/useRealTime';
import { NAV_ITEMS, NAV_SECTIONS, type NavColor } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const colorClasses: Record<NavColor, string> = {
  primary: 'text-oguri-purple bg-oguri-purple/15 border-oguri-purple/20 shadow-glow-oguri-purple',
  success: 'text-oguri-cyan bg-oguri-cyan/15 border-oguri-cyan/20 shadow-glow-oguri-cyan',
  warning: 'text-oguri-gold bg-oguri-gold/15 border-oguri-gold/20 shadow-glow-oguri-mixed',
  danger: 'text-red-400 bg-red-500/15 border-red-500/20',
  info: 'text-oguri-blue bg-oguri-blue/15 border-oguri-blue/20 shadow-glow-oguri-blue',
  violet: 'text-oguri-lavender bg-oguri-lavender/15 border-oguri-lavender/20 shadow-glow-oguri-lavender',
  cyan: 'text-oguri-cyan bg-oguri-cyan/15 border-oguri-cyan/20 shadow-glow-oguri-cyan',
  purple: 'text-oguri-lavender bg-oguri-purple/15 border-oguri-purple/20 shadow-glow-oguri-purple',
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const SidebarNavLink: React.FC<{
  href: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ href, onClose, className, children }) => {
  const { emit, layer } = useNavParticleBurst();

  return (
    <Link
      href={href}
      onClick={() => {
        emit();
        onClose();
      }}
      onPointerEnter={() => emit()}
      className={cn('relative', className)}
    >
      {children}
      {layer}
    </Link>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { isConnected: pollingConnected, isConnecting } = useBotStatus();
  const botStatus = useSocketBotStatus();
  const { unreadCount } = useNotifications();
  const { isGloballyOn } = useBotGlobalState();
  const { dashboardStats, botStatus: globalBotStatus } = useGlobalUpdate();

  const allowedMenuItems = NAV_ITEMS.filter((item) => hasPermission(item.pageKey));
  const navSections = React.useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: allowedMenuItems.filter((item) => item.section === section.key),
      })).filter((section) => section.items.length > 0),
    [allowedMenuItems]
  );
  const isConnected = botStatus?.connected ?? globalBotStatus?.connected ?? pollingConnected;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-72 flex-col overflow-hidden border-r border-white/10 bg-[#0d0f0e]/86 shadow-[0_20px_80px_-35px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--primary),0.22),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(var(--secondary),0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(var(--accent),0.16),transparent_32%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:26px_26px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-primary/16 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-16 h-44 w-44 rounded-full bg-accent/14 blur-3xl" />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-20%] top-20 h-px w-[140%] bg-gradient-to-r from-transparent via-primary/30 to-transparent blur-[1px]"
          animate={{ x: ['0%', '18%', '0%'], opacity: [0.14, 0.4, 0.14] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-25%] top-40 h-px w-[120%] bg-gradient-to-r from-transparent via-secondary/30 to-transparent blur-[1px]"
          animate={{ x: ['0%', '-14%', '0%'], opacity: [0.08, 0.28, 0.08] }}
          transition={{ repeat: Infinity, duration: 10.5, ease: 'easeInOut', delay: 0.6 }}
        />

        <div className="relative z-10 flex h-full flex-col">
          <div className="border-b border-white/10 px-5 py-6">
            <Link href="/dashboard" className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.055] px-4 py-3 transition-all hover:border-[#25d366]/25 hover:bg-white/[0.075]">
              <motion.div
                whileHover={{ scale: 1.04 }}
                transition={{ duration: 0.2 }}
                className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-gradient-oguri-primary shadow-glow-oguri-mixed"
              >
                <div className="absolute inset-[2px] rounded-lg bg-oguri-phantom-950/90" />
                <Image
                  src="/oguricap-avatar.png"
                  alt="Oguri Cap"
                  width={36}
                  height={36}
                  className="relative h-10 w-10 rounded-full border border-oguri-lavender/40 object-cover"
                  priority
                />
              </motion.div>
              <div className="min-w-0">
                <div className="mb-1 inline-flex items-center gap-2 rounded-lg border border-[#25d366]/20 bg-[#25d366]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#a7f3c7]">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow-oguri-purple" />
                  WhatsApp Grid
                </div>
                <h1 className="truncate text-lg font-black tracking-tight text-foreground">OguriCap Bot</h1>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[rgb(var(--text-secondary))]">Panel en vivo</p>
              </div>
            </Link>
          </div>

            <div className="relative mx-4 mt-4 rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_42px_-26px_rgba(0,0,0,0.22)]">
            <motion.div
              aria-hidden="true"
              className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
              animate={{ opacity: [0.25, 0.7, 0.25], scaleX: [0.96, 1.03, 0.96] }}
              transition={{ repeat: Infinity, duration: 4.8, ease: 'easeInOut' }}
            />
            <div className="mb-2 flex items-center justify-between gap-3">
              <StatusIndicator
                status={!isGloballyOn ? 'offline' : isConnecting ? 'connecting' : isConnected ? 'online' : 'offline'}
                size="sm"
              />
              <StatusBadge
                tone={!isGloballyOn ? 'neutral' : isConnected ? 'success' : isConnecting ? 'warning' : 'danger'}
                pulse={isConnected && isGloballyOn}
              >
                {!isGloballyOn ? 'OFF' : isConnecting ? 'SYNC' : isConnected ? 'LIVE' : 'DOWN'}
              </StatusBadge>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {!isGloballyOn ? 'Bot desactivado globalmente' : isConnected ? 'Bot principal conectado' : 'Bot principal desconectado'}
            </p>
            {dashboardStats && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted">
                <div className="rounded-xl border border-border/10 bg-card/55 px-3 py-2">
                  <span className="block font-black text-foreground">{dashboardStats.totalGrupos || 0}</span>
                  Grupos
                </div>
                <div className="rounded-xl border border-border/10 bg-card/55 px-3 py-2">
                  <span className="block font-black text-foreground">{dashboardStats.comunidad?.usuariosWhatsApp || 0}</span>
                  Comunidad
                </div>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-4">
              {navSections.map((section, sectionIndex) => (
                <div key={section.key} className="rounded-[22px] border border-white/8 bg-white/[0.028] p-2.5">
                  <div className="mb-2.5 px-2 pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[rgb(var(--text-secondary))]">{section.label}</p>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold text-muted">
                        {section.items.length}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">{section.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    {section.items.map((item, itemIndex) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.path;
                      const showUnreadBadge = item.path === '/alertas' && unreadCount > 0;

                      return (
                        <motion.div
                          key={item.path}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: sectionIndex * 0.05 + itemIndex * 0.03 }}
                        >
                          <SidebarNavLink
                            href={item.path}
                            onClose={onClose}
                            className={cn(
                              'group flex items-start gap-3 overflow-hidden rounded-[18px] border px-3 py-3 transition-all duration-300',
                              isActive
                                ? 'border-primary/20 bg-card/72 text-foreground shadow-[0_16px_40px_-28px_rgba(0,0,0,0.2)]'
                                : 'border-transparent bg-transparent text-[rgb(var(--text-secondary))] hover:border-border/15 hover:bg-card/48 hover:text-foreground'
                            )}
                          >
                            {isActive && (
                              <motion.div
                                aria-hidden="true"
                                className="absolute inset-0 bg-[linear-gradient(135deg,rgba(var(--primary),0.14),rgba(var(--secondary),0.08),rgba(var(--accent),0.12))]"
                                animate={{ opacity: [0.35, 0.6, 0.35] }}
                                transition={{ repeat: Infinity, duration: 4.2, ease: 'easeInOut' }}
                              />
                            )}
                            {isActive && (
                              <>
                                <motion.span
                                  aria-hidden="true"
                                  className="absolute right-4 top-3 h-1.5 w-1.5 rounded-full bg-white/85 shadow-[0_0_12px_rgba(255,255,255,0.35)]"
                                  animate={{ opacity: [0.2, 0.95, 0.2], scale: [0.8, 1.25, 0.8], y: [0, -2, 0] }}
                                  transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut' }}
                                />
                                <motion.span
                                  aria-hidden="true"
                                  className="absolute right-7 bottom-3 h-1 w-1 rounded-full bg-oguri-cyan/85 shadow-[0_0_10px_rgba(70,195,207,0.45)]"
                                  animate={{ opacity: [0.18, 0.88, 0.18], scale: [0.8, 1.35, 0.8], x: [0, -2, 0] }}
                                  transition={{ repeat: Infinity, duration: 4.4, ease: 'easeInOut', delay: 0.7 }}
                                />
                              </>
                            )}
                            {isActive && <div className="absolute inset-y-2 left-0 w-1 rounded-full bg-gradient-to-b from-primary via-secondary to-accent shadow-glow-oguri-purple" />}
                            <div
                              className={cn(
                                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-all duration-300',
                                isActive ? colorClasses[item.color] : 'border-border/10 bg-card/55 group-hover:border-primary/15 group-hover:bg-card/75'
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </div>

                            <div className="relative z-10 min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-2">
                                <p className="truncate text-sm font-semibold">{item.label}</p>
                                {showUnreadBadge && (
                                  <span className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-[10px] font-black text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted/90">
                                {item.description}
                              </p>
                            </div>

                            {isActive && <div className="relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-oguri-lavender shadow-glow-oguri-lavender" />}
                          </SidebarNavLink>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-3">
              <ProfileAvatar editable size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{user?.username || 'Usuario'}</p>
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--text-secondary))]">
                  {user?.rol || 'usuario'} · Cambiar foto
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={logout}
                className="rounded-lg border border-border/15 bg-card/55 p-2 text-muted transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
                title="Cerrar sesión"
              >
                <LogOut className="h-5 w-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
