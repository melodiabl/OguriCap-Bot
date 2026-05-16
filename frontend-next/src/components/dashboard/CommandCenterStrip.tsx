'use client';
import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Bell, Radio, Shield, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useSocketConnection } from '@/contexts/SocketContext';
import { cn } from '@/lib/utils';

const ROL_COLOR: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  owner:          { bg: 'bg-[#ff4d8d]/10',   border: 'border-[#ff4d8d]/25',  text: 'text-[#ff9fbd]',  glow: 'shadow-[0_0_14px_rgba(255,77,141,0.18)]' },
  admin:          { bg: 'bg-[#2dd4bf]/10',   border: 'border-[#2dd4bf]/25',  text: 'text-[#2dd4bf]',  glow: 'shadow-[0_0_14px_rgba(45,212,191,0.18)]' },
  administrador:  { bg: 'bg-[#2dd4bf]/10',   border: 'border-[#2dd4bf]/25',  text: 'text-[#2dd4bf]',  glow: 'shadow-[0_0_14px_rgba(45,212,191,0.18)]' },
  usuario:        { bg: 'bg-[#25d366]/10',   border: 'border-[#25d366]/25',  text: 'text-[#a7f3c7]',  glow: '' },
};

function RealTimeClock() {
  const [time, setTime] = React.useState<string>('');
  const [date, setDate] = React.useState<string>('');
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  const [hh, mm, ss] = time.split(':');

  return (
    <div className="flex flex-col items-end gap-0.5 min-w-0">
      <div className="flex items-baseline gap-[2px] font-mono leading-none">
        <span className="text-lg font-black text-foreground tabular-nums">{hh}</span>
        <motion.span
          animate={reduceMotion ? undefined : { opacity: [1, 0.2, 1] }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="text-[#25d366]/60 text-base font-black"
        >:</motion.span>
        <span className="text-lg font-black text-foreground tabular-nums">{mm}</span>
        <motion.span
          animate={reduceMotion ? undefined : { opacity: [1, 0.2, 1] }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="text-[#25d366]/60 text-base font-black"
        >:</motion.span>
        <span className="text-base font-black text-muted tabular-nums">{ss}</span>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted/60 capitalize">{date}</span>
    </div>
  );
}

function Pip({ active, className }: { active: boolean; className?: string }) {
  return (
    <span className={cn('relative flex h-2 w-2 shrink-0', className)}>
      {active && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25d366] opacity-60" />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', active ? 'bg-[#25d366]' : 'bg-white/20')} />
    </span>
  );
}

function Sep() {
  return <div className="hidden sm:block h-8 w-px shrink-0 bg-white/[0.07]" />;
}

export function CommandCenterStrip() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { isConnected } = useSocketConnection();
  const reduceMotion = useReducedMotion();

  const rol = String(user?.rol || 'usuario').toLowerCase();
  const rolCfg = ROL_COLOR[rol] ?? ROL_COLOR.usuario;
  const rolLabel = String(user?.rol || 'usuario').toUpperCase();

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3',
        'rounded-2xl border border-white/[0.08] bg-[#0a1410]/80 px-4 py-3.5 backdrop-blur-xl',
        'shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]',
      )}
    >
      {/* Glow accent top-left */}
      <div className="pointer-events-none absolute left-0 top-0 h-px w-48 bg-gradient-to-r from-transparent via-[#25d366]/40 to-transparent rounded-full" />

      {/* LEFT — Branding */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Icon cluster */}
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#25d366]/20 bg-[#25d366]/8 shadow-[0_0_16px_rgba(37,211,102,0.12)]">
          <Radio className="h-4 w-4 text-[#25d366]" />
          <Pip active={isConnected} className="absolute -right-1 -top-1" />
        </div>

        {/* Labels */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#25d366]/70">
              Control Central
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-muted/50">
              {isConnected ? (
                <><Wifi className="h-2.5 w-2.5" /> En línea</>
              ) : (
                <><WifiOff className="h-2.5 w-2.5 text-[#ff4d8d]/60" /> Offline</>
              )}
            </span>
          </div>
          <p className="text-base font-black tracking-tight text-foreground leading-tight">
            Dashboard
          </p>
        </div>
      </div>

      {/* CENTER — Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Alerts badge */}
        {unreadCount > 0 ? (
          <Link href="/alertas">
            <motion.div
              animate={reduceMotion ? undefined : { scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#ff4d8d]/30 bg-[#ff4d8d]/10 px-3 py-1.5 text-xs font-black text-[#ff9fbd] shadow-[0_0_12px_rgba(255,77,141,0.15)] transition-all hover:border-[#ff4d8d]/50 hover:bg-[#ff4d8d]/15"
            >
              <AlertTriangle className="h-3 w-3" />
              {unreadCount > 99 ? '99+' : unreadCount} alertas
            </motion.div>
          </Link>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full border border-[#25d366]/15 bg-[#25d366]/5 px-3 py-1.5 text-xs font-black text-[#25d366]/60">
            <Bell className="h-3 w-3" />
            Sin alertas
          </div>
        )}

        <Sep />

        {/* Role badge */}
        <div className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em]',
          rolCfg.bg, rolCfg.border, rolCfg.text, rolCfg.glow,
        )}>
          <Shield className="h-3 w-3" />
          {rolLabel}
          {user?.username && (
            <span className="hidden sm:inline font-semibold normal-case tracking-normal opacity-70">
              — {user.username}
            </span>
          )}
        </div>
      </div>

      {/* RIGHT — Clock */}
      <div className="ml-auto flex items-center gap-3 pl-2">
        <Sep />
        <RealTimeClock />
      </div>
    </motion.div>
  );
}
