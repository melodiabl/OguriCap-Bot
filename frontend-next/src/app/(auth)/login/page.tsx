'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Turnstile from 'react-turnstile';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal';
import { Eye, EyeOff, Lock, User, Sparkles, Shield, Crown, UserCheck, Users, Wrench, AlertTriangle, Terminal } from 'lucide-react';
import { notify } from '@/lib/notif';
import { useDevicePerformance } from '@/contexts/DevicePerformanceContext';
import { cn } from '@/lib/utils';
import { LoginRolesSelector, type LoginRoleOption } from '@/components/auth/LoginRolesSelector';

function FloatingSignal({ delay = 0, className = '' }: { delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className={`absolute h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent ${className}`}
      animate={reduceMotion ? { opacity: 0.3 } : { x: ['-16%', '16%', '-16%'], opacity: [0.05, 0.45, 0.05] }}
      transition={reduceMotion ? {} : { repeat: Infinity, duration: 7, delay, ease: 'easeInOut' }}
    />
  );
}

function FloatingCommandCloud() {
  const reduceMotion = useReducedMotion();
  const commands = [
    { text: '/menu',      pos: 'left-[4%] top-[14%]',  delay: 0,   colors: 'border-primary/20 text-primary/70 bg-black/70' },
    { text: '/daily',     pos: 'left-[56%] top-[9%]',  delay: 0.5, colors: 'border-secondary/20 text-secondary/70 bg-black/70' },
    { text: '/sticker',   pos: 'right-[8%] top-[22%]', delay: 1,   colors: 'border-accent/20 text-accent/70 bg-black/70' },
    { text: '/rollwaifu', pos: 'right-[5%] top-[60%]', delay: 1.5, colors: 'border-warning/20 text-warning/70 bg-black/70' },
    { text: '/tagall',    pos: 'left-[3%] top-[68%]',  delay: 2,   colors: 'border-success/20 text-success/70 bg-black/70' },
    { text: '/top',       pos: 'left-[52%] top-[78%]', delay: 2.5, colors: 'border-danger/20 text-danger/70 bg-black/70' },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden xl:block">
      {commands.map((item, i) => (
        <motion.span
          key={i}
          className={cn('absolute flex items-center gap-1 rounded-sm border px-2.5 py-1 font-mono text-[11px] font-bold backdrop-blur-sm', item.pos, item.colors)}
          animate={reduceMotion ? { opacity: 0.4 } : { y: [0, -9, 0], opacity: [0.25, 0.75, 0.25] }}
          transition={reduceMotion ? {} : { repeat: Infinity, duration: 5.2, delay: item.delay, ease: 'easeInOut' }}
        >
          <span className="h-[3px] w-[3px] rounded-full bg-current" />
          {item.text}
        </motion.span>
      ))}
    </div>
  );
}

function LiveBotConsole() {
  const reduceMotion = useReducedMotion();
  const termLines = [
    { type: 'cmd', text: '$ oguri /menu' },
    { type: 'out', text: '  Grupo · RPG · Gacha · Media · Tools' },
    { type: 'gap', text: '' },
    { type: 'cmd', text: '$ oguri /rollwaifu' },
    { type: 'out', text: '  ✦ Fischl [4★] añadida a tu colección' },
    { type: 'gap', text: '' },
    { type: 'cmd', text: '$ oguri /daily' },
    { type: 'out', text: '  Recompensa: +500 coin · Racha: 7d' },
  ];
  return (
    <motion.div
      className="overflow-hidden rounded-sm border border-primary/18 bg-black/90 shadow-[0_0_24px_rgba(37,211,102,0.07)] hidden lg:block"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="flex items-center gap-2 border-b border-primary/12 bg-black/80 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
        </div>
        <div className="ml-2 flex items-center gap-1.5 font-mono text-[10px]">
          <Terminal className="h-3 w-3 text-primary/40" />
          <span className="text-muted/40">oguri-bot — live-feed</span>
        </div>
        <motion.div
          className="ml-auto flex items-center gap-1 font-mono text-[10px] font-bold text-success"
          animate={reduceMotion ? {} : { opacity: [0.5, 1, 0.5] }}
          transition={reduceMotion ? {} : { repeat: Infinity, duration: 2 }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          ONLINE
        </motion.div>
      </div>
      <div className="p-4 font-mono text-[11px] space-y-0.5">
        {termLines.map((line, i) => (
          <motion.div
            key={i}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.06 }}
            className={cn(
              'leading-5',
              line.type === 'cmd' && 'text-primary/80',
              line.type === 'out' && 'text-foreground/40',
              line.type === 'gap' && 'h-1'
            )}
          >
            {line.text}
          </motion.div>
        ))}
        <div className="flex items-center gap-0.5 text-primary/50 pt-1">
          <span>$</span>
          <motion.span
            className="ml-1 inline-block h-3.5 w-1.5 bg-primary/55"
            animate={reduceMotion ? {} : { opacity: [1, 0, 1] }}
            transition={reduceMotion ? {} : { repeat: Infinity, duration: 0.9 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceAccessAllowed, setMaintenanceAccessAllowed] = useState(false);
  const [detectedIP, setDetectedIP] = useState<string | null>(null);
  const [showMaintenanceLogin, setShowMaintenanceLogin] = useState(false);
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ username?: boolean; password?: boolean; role?: boolean }>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(true);

  const effectiveTurnstileSiteKey = turnstileSiteKey || '';
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { performanceMode } = useDevicePerformance();

  const roles = useMemo<readonly LoginRoleOption[]>(
    () => [
      { value: 'owner',     label: 'Owner',          icon: Crown,     tone: 'accent',     description: 'Control absoluto del Aura' },
      { value: 'admin',     label: 'Administrador',  icon: Shield,    tone: 'danger',     description: 'Gestión táctica Cinderella Gray' },
      { value: 'moderador', label: 'Moderador',      icon: UserCheck, tone: 'secondary',  description: 'Moderación de Competencia' },
      { value: 'usuario',   label: 'Usuario',        icon: Users,     tone: 'success',    description: 'Acceso básico al Paddock' },
    ],
    []
  );

  const rolesForLogin = useMemo<readonly LoginRoleOption[]>(() => {
    if (!isMaintenanceMode) return roles;
    if (maintenanceAccessAllowed) return roles;
    return roles.filter((r) => r.value === 'owner' || r.value === 'admin');
  }, [isMaintenanceMode, maintenanceAccessAllowed, roles]);

  const checkMaintenanceStatus = useCallback(async () => {
    try {
      setIsCheckingMaintenance(true);
      const response = await fetch('/api/health');
      const data = await response.json();
      const siteKey = typeof data?.turnstileSiteKey === 'string' && data.turnstileSiteKey.trim() ? data.turnstileSiteKey.trim() : null;
      setTurnstileSiteKey(siteKey);
      if (typeof data?.turnstileRequired === 'boolean') setTurnstileRequired(data.turnstileRequired);
      if (data.maintenanceMode) {
        setIsMaintenanceMode(true);
        const allowed = !!(data.canAccessDuringMaintenance || data.ipAllowed);
        setMaintenanceAccessAllowed(allowed);
        setDetectedIP(typeof data.clientIP === 'string' ? data.clientIP : null);
        setShowMaintenanceLogin(allowed);
        if (!allowed) notify.warning('El sistema está en modo de mantenimiento');
      } else {
        setIsMaintenanceMode(false);
        setMaintenanceAccessAllowed(true);
        setDetectedIP(typeof data.clientIP === 'string' ? data.clientIP : null);
        setShowMaintenanceLogin(true);
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error);
      setIsMaintenanceMode(false);
      setMaintenanceAccessAllowed(true);
      setDetectedIP(null);
      setShowMaintenanceLogin(true);
      setTurnstileSiteKey(null);
      setTurnstileRequired(true);
    } finally {
      setIsCheckingMaintenance(false);
    }
  }, []);

  useEffect(() => { checkMaintenanceStatus(); }, [checkMaintenanceStatus]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) { router.replace('/dashboard'); }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const u = params.get('username');
      if (u && !username) setUsername(u);
      const registered = params.get('registered');
      const role = params.get('role');
      if (registered === '1') {
        const roleText = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Usuario';
        notify.success(`Tu rol es ${roleText}. Iniciá sesión para continuar.`);
        params.delete('registered');
        params.delete('role');
        const qs = params.toString();
        router.replace(qs ? `/login?${qs}` : '/login');
      }
    } catch { }
  }, [username, router]);

  useEffect(() => {
    if (!isMaintenanceMode || maintenanceAccessAllowed) return;
    if (selectedRole && !['owner', 'admin', 'administrador'].includes(String(selectedRole).toLowerCase())) {
      setSelectedRole('');
    }
  }, [isMaintenanceMode, maintenanceAccessAllowed, selectedRole]);

  const validateUsername = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'El nombre de usuario es requerido';
    if (trimmed.length < 3) return 'El usuario debe tener al menos 3 caracteres';
    if (trimmed.length > 20) return 'El usuario debe tener máximo 20 caracteres';
    return null;
  };

  const validatePassword = (value: string): string | null => {
    if (!value) return 'La contraseña es requerida';
    if (value.length < 4) return 'La contraseña debe tener al menos 4 caracteres';
    if (value.length > 50) return 'La contraseña es muy larga';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMaintenanceMode && !maintenanceAccessAllowed && selectedRole && !['owner', 'admin', 'administrador'].includes(String(selectedRole).toLowerCase())) {
      notify.warning('El sistema está en modo de mantenimiento. Solo los administradores pueden acceder.');
      return;
    }
    const usernameError = validateUsername(username);
    if (usernameError) { setFieldErrors({ username: true }); notify.error(usernameError); return; }
    const passwordError = validatePassword(password);
    if (passwordError) { setFieldErrors({ password: true }); notify.error(passwordError); return; }
    if (!selectedRole) { setFieldErrors({ role: true }); notify.error('Debes seleccionar un rol para continuar'); return; }
    if (turnstileRequired && (!effectiveTurnstileSiteKey || !turnstileToken)) {
      notify.error('Por favor completa la verificación de Turnstile');
      return;
    }
    setIsLoading(true);
    try {
      await login(username.trim(), password, selectedRole, turnstileRequired ? turnstileToken : undefined);
      const selectedRoleData = roles.find(r => r.value === selectedRole);
      const ipInfo = detectedIP ? ` (${detectedIP})` : '';
      notify.success(`¡Bienvenido como ${selectedRoleData?.label}!${ipInfo}`, { title: 'Sesión iniciada' });
      let nextPath = '/dashboard';
      try {
        const params = new URLSearchParams(window.location.search);
        const requestedNext = params.get('next');
        if (requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//') && !requestedNext.startsWith('/login')) {
          nextPath = requestedNext;
        }
      } catch {}
      router.push(nextPath);
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Error al iniciar sesión';
      if (error?.message) { errorMessage = error.message; }
      else if (error?.response?.data?.error) { errorMessage = error.response.data.error; }
      else if (error?.response?.status === 401) { errorMessage = 'Credenciales incorrectas'; }
      else if (error?.response?.status === 403) { errorMessage = 'No tienes permisos para este rol'; }
      else if (error?.response?.status === 429) { errorMessage = 'Demasiados intentos de login. Intenta más tarde'; }
      else if (error?.response?.status === 503) {
        if (error?.response?.data?.maintenanceMode) { setIsMaintenanceMode(true); errorMessage = 'El sistema está en modo de mantenimiento'; }
        else { errorMessage = 'Servicio temporalmente no disponible'; }
      } else if (error?.response?.status >= 500) { errorMessage = 'Error del servidor. Inténtalo más tarde'; }
      notify.error(errorMessage);
      setTurnstileToken(null);
      setTurnstileKey(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const liveCommands = [
    '/menu', '/sticker', '/play', '/daily', '/mine',
    '/rollwaifu', '/tagall', '/hidetag', '/traducir',
    '/spotify', '/warns', '/infogrupo', '/top', '/claim',
  ];

  function CommandTicker({ reverse = false }: { reverse?: boolean }) {
    const reduceMotion = useReducedMotion();
    const commands = [...liveCommands, ...liveCommands];
    return (
      <div className="relative overflow-hidden border-y border-primary/8 bg-black/50 py-2">
        <motion.div
          className="flex w-max gap-2"
          animate={reduceMotion ? { x: 0 } : { x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
          transition={reduceMotion ? {} : { repeat: Infinity, duration: 30, ease: 'linear' }}
        >
          {commands.map((command, index) => (
            <span
              key={`${command}-${index}`}
              className="inline-flex items-center gap-1 rounded-sm border border-primary/12 bg-black/60 px-3 py-1 font-mono text-[10px] font-bold text-primary/50"
            >
              <span className="h-[3px] w-[3px] rounded-full bg-primary/40" />
              {command}
            </span>
          ))}
        </motion.div>
      </div>
    );
  }

  // ── Loading screen ──
  if (isCheckingMaintenance) {
    return (
      <div className="auth-shell">
        <div className="panel-stack-center relative z-10">
          <motion.div
            animate={reduceMotion ? {} : { opacity: [0.5, 1, 0.5] }}
            transition={reduceMotion ? {} : { repeat: Infinity, duration: 1.6 }}
            className="w-16 h-16 mx-auto rounded-sm border border-primary/25 bg-black/85 flex items-center justify-center shadow-[0_0_30px_rgba(37,211,102,0.12)] mb-4 relative"
          >
            <Image src="/oguricap-avatar.png" alt="Oguri Cap" width={40} height={40} className="w-10 h-10 object-cover" priority />
          </motion.div>
          <p className="font-mono text-[11px] font-bold text-primary/50 uppercase tracking-[0.3em]">
            Sincronizando sistema...
          </p>
        </div>
      </div>
    );
  }

  // ── Maintenance screen ──
  if (isMaintenanceMode && !maintenanceAccessAllowed && !showMaintenanceLogin) {
    return (
      <div className="auth-shell">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="relative overflow-hidden rounded-sm border border-warning/25 bg-black/90 backdrop-blur-xl p-8">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-warning to-transparent" />
            <span aria-hidden className="absolute left-2.5 top-2.5 h-5 w-5 border-l-2 border-t-2 border-warning/30" />
            <span aria-hidden className="absolute right-2.5 top-2.5 h-5 w-5 border-r-2 border-t-2 border-warning/30" />
            <span aria-hidden className="absolute bottom-2.5 left-2.5 h-5 w-5 border-b-2 border-l-2 border-warning/30" />
            <span aria-hidden className="absolute bottom-2.5 right-2.5 h-5 w-5 border-b-2 border-r-2 border-warning/30" />
            <div className="text-center">
              <div className="mb-5 mx-auto w-16 h-16 rounded-sm border border-warning/25 bg-warning/8 flex items-center justify-center">
                <Wrench className="w-8 h-8 text-warning" />
              </div>
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-warning/50 mb-1">SISTEMA — OGURI BOT</p>
              <h1 className="text-xl font-black text-foreground mb-1">Mantenimiento</h1>
              <p className="font-mono text-[10px] text-warning/60 mb-5 flex items-center justify-center gap-2">
                <AlertTriangle className="w-3 h-3" />
                ACCESO TEMPORALMENTE RESTRINGIDO
              </p>
              <p className="text-sm text-muted/60 mb-6 leading-relaxed">
                El sistema está fuera de servicio por mantenimiento programado. Solo los administradores pueden acceder durante este período.
              </p>
              <div className="space-y-3">
                <Button onClick={checkMaintenanceStatus} variant="primary" className="w-full font-mono tracking-widest text-xs" loading={isCheckingMaintenance}>
                  Verificar Estado
                </Button>
                <Button type="button" onClick={() => setShowMaintenanceLogin(true)} variant="secondary" className="w-full font-mono tracking-widest text-xs">
                  Soy Owner / Admin
                </Button>
                {detectedIP && (
                  <p className="font-mono text-[9px] text-muted/40">IP detectada: {detectedIP}</p>
                )}
              </div>
            </div>
          </div>
          <p className="text-center font-mono text-[9px] text-muted/30 mt-4">© 2026 OGURICAP BOT</p>
        </motion.div>
      </div>
    );
  }

  const enableBgMotion = !reduceMotion && !performanceMode;

  // ── Main login ──
  return (
    <div className="auth-shell lg:items-stretch min-h-[100dvh]">

      {/* Background layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Subtle grid */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage: `linear-gradient(rgba(37,211,102,1) 1px, transparent 1px), linear-gradient(90deg, rgba(37,211,102,1) 1px, transparent 1px)`,
            backgroundSize: '44px 44px',
          }}
        />
        {/* Primary orb */}
        <motion.div
          aria-hidden="true"
          className="absolute -top-32 left-1/4 h-[520px] w-[520px] rounded-full bg-primary/8 blur-[130px]"
          animate={enableBgMotion ? { scale: [1, 1.1, 1], opacity: [0.5, 0.9, 0.5] } : {}}
          transition={enableBgMotion ? { repeat: Infinity, duration: 14, ease: 'easeInOut' } : {}}
        />
        {/* Secondary orb */}
        <motion.div
          aria-hidden="true"
          className="absolute bottom-0 right-1/4 h-[440px] w-[440px] rounded-full bg-secondary/8 blur-[120px]"
          animate={enableBgMotion ? { scale: [1, 1.08, 1], opacity: [0.4, 0.75, 0.4] } : {}}
          transition={enableBgMotion ? { repeat: Infinity, duration: 18, ease: 'easeInOut', delay: 5 } : {}}
        />
        <FloatingSignal className="top-[28%] w-[40%] left-[8%]" delay={0} />
        <FloatingSignal className="top-[64%] w-[28%] right-[12%]" delay={2.2} />
        <FloatingCommandCloud />
      </div>

      {/* Content grid */}
      <div className="relative z-10 grid w-full max-w-sm gap-4 px-3 sm:max-w-md sm:gap-6 sm:px-6 md:px-8 lg:min-h-[min(880px,calc(100vh-4rem))] lg:max-w-[1220px] lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,460px)] lg:items-center lg:gap-10">

        {/* ══ LEFT: Terminal branding ══ */}
        <motion.div
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:flex flex-col gap-4 lg:pr-4"
        >
          {/* System header */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <motion.div
                className="absolute -inset-3 rounded bg-primary/6 blur-lg"
                animate={enableBgMotion ? { opacity: [0.3, 0.7, 0.3] } : {}}
                transition={enableBgMotion ? { repeat: Infinity, duration: 3 } : {}}
              />
              <div className="relative h-[72px] w-[72px] rounded-sm border border-primary/22 bg-black/85 flex items-center justify-center shadow-[0_0_24px_rgba(37,211,102,0.1)]">
                <Image src="/oguricap-login.png" alt="Oguri Cap" width={56} height={56} className="h-[52px] w-[52px] object-cover" priority />
              </div>
              <motion.div
                className="absolute -bottom-1 -right-1 h-4 w-4 rounded-sm bg-success shadow-[0_0_8px_rgba(37,211,102,0.6)]"
                animate={reduceMotion ? {} : { scale: [1, 1.3, 1] }}
                transition={reduceMotion ? {} : { repeat: Infinity, duration: 2.2 }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <motion.span
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                  animate={reduceMotion ? {} : { opacity: [0.3, 1, 0.3] }}
                  transition={reduceMotion ? {} : { repeat: Infinity, duration: 1.5 }}
                />
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-primary/55">SISTEMA ACTIVO</span>
              </div>
              <h1 className="text-[2.6rem] font-black leading-none tracking-tight text-foreground xl:text-5xl">
                OguriCap<span className="text-primary">.</span>
              </h1>
              <p className="mt-1.5 font-mono text-[11px] text-muted/50">
                Panel de control — Ecosistema WhatsApp v2.0
              </p>
            </div>
          </div>

          {/* Status readout */}
          <div className="rounded-sm border border-primary/12 bg-black/65 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.28em] text-muted/35 mb-3 pb-2.5 border-b border-primary/8">
              <Terminal className="h-3 w-3" />
              STATUS.REPORT
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-[11px]">
              {[
                { k: 'usuarios_wa', v: '51,916',  c: 'text-primary' },
                { k: 'grupos_act',  v: '1,847',   c: 'text-secondary' },
                { k: 'cmds_hoy',   v: '284,391', c: 'text-accent' },
                { k: 'uptime',     v: '99.7%',   c: 'text-success' },
              ].map(({ k, v, c }) => (
                <div key={k} className="flex items-baseline justify-between gap-2">
                  <span className="text-muted/35">{k}</span>
                  <span className={cn('font-bold tabular-nums', c)}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live console */}
          <LiveBotConsole />

          {/* Command tickers */}
          <div className="rounded-sm border border-primary/10 bg-black/45 overflow-hidden">
            <div className="border-b border-primary/8 px-4 py-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted/35">LIVE — COMMAND — FEED</p>
            </div>
            <CommandTicker />
            <CommandTicker reverse />
          </div>
        </motion.div>

        {/* ══ RIGHT: Login form ══ */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center py-6 sm:py-8 lg:justify-self-center lg:py-0"
        >
          <div className="mx-auto w-full max-w-[340px] sm:max-w-md lg:max-w-[29rem] flex flex-col justify-center">

            {/* Mobile header */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:hidden text-center mb-5"
            >
              <div className="relative mb-3 mx-auto h-14 w-14 rounded-sm border border-primary/22 bg-black/85 flex items-center justify-center shadow-[0_0_20px_rgba(37,211,102,0.1)]">
                <Image src="/oguricap-login.png" alt="Oguri Cap" width={44} height={44} className="h-[38px] w-[38px] object-cover" priority />
              </div>
              <h1 className="text-2xl font-black text-foreground">OguriCap<span className="text-primary">.</span></h1>
              <p className="mt-1 font-mono text-[11px] text-muted/45">Panel de control v2.0</p>
            </motion.div>

            {/* Login card */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-sm border border-primary/18 bg-black/88 backdrop-blur-2xl shadow-[0_0_50px_rgba(37,211,102,0.05),0_24px_64px_rgba(0,0,0,0.7)]"
            >
              {/* Top neon stripe */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

              {/* Corner brackets */}
              <span aria-hidden className="absolute left-2.5 top-2.5 h-5 w-5 border-l-2 border-t-2 border-primary/25" />
              <span aria-hidden className="absolute right-2.5 top-2.5 h-5 w-5 border-r-2 border-t-2 border-primary/25" />
              <span aria-hidden className="absolute bottom-2.5 left-2.5 h-5 w-5 border-b-2 border-l-2 border-primary/25" />
              <span aria-hidden className="absolute bottom-2.5 right-2.5 h-5 w-5 border-b-2 border-r-2 border-primary/25" />

              <div className="relative z-10 p-6 sm:p-7">

                {/* Card header */}
                <div className="text-center mb-5">
                  <div className="inline-flex items-center gap-2.5 font-mono text-[9px] uppercase tracking-[0.3em] text-primary/55 mb-3">
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                      animate={reduceMotion ? {} : { opacity: [0.3, 1, 0.3] }}
                      transition={reduceMotion ? {} : { repeat: Infinity, duration: 1.6 }}
                    />
                    ACCESO AUTORIZADO
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                      animate={reduceMotion ? {} : { opacity: [1, 0.3, 1] }}
                      transition={reduceMotion ? {} : { repeat: Infinity, duration: 1.6 }}
                    />
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-foreground">
                    Iniciar <span className="text-primary">sesión</span>
                  </h2>
                  <p className="mt-1 font-mono text-[10px] text-muted/45">Ingresa tus credenciales de acceso</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {isMaintenanceMode && (
                    <div className="rounded-sm border border-warning/22 bg-warning/7 p-2.5">
                      <p className="font-mono text-[9px] font-bold text-warning flex items-center gap-2 uppercase tracking-wider">
                        <AlertTriangle className="w-3 h-3" />
                        Modo mantenimiento activo
                      </p>
                    </div>
                  )}

                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-muted/45">
                      Identificador
                    </label>
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center border-r border-primary/12 bg-primary/4">
                        <User className="w-3.5 h-3.5 text-primary/45" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); if (fieldErrors.username) setFieldErrors((prev) => ({ ...prev, username: false })); }}
                        placeholder="usuario"
                        className={cn('input-glass !py-2.5 !pl-11 !pr-3 text-sm font-mono', fieldErrors.username && 'is-error ring-2 ring-destructive/40')}
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-muted/45">
                      Contraseña
                    </label>
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center border-r border-secondary/12 bg-secondary/4">
                        <Lock className="w-3.5 h-3.5 text-secondary/45" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: false })); }}
                        placeholder="••••••••"
                        className={cn('input-glass !py-2.5 !pl-11 !pr-10 text-sm font-mono', fieldErrors.password && 'is-error ring-2 ring-destructive/40')}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-muted/40 hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Role selector */}
                  <LoginRolesSelector
                    roles={rolesForLogin}
                    selectedRole={selectedRole}
                    onChange={(value) => { setSelectedRole(value); if (fieldErrors.role) { setFieldErrors((prev) => ({ ...prev, role: false })); } }}
                    showError={!!fieldErrors.role}
                    performanceMode={performanceMode}
                  />

                  {/* Remember / forgot */}
                  <div className="flex items-center justify-between font-mono text-[10px] mt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative">
                        <input type="checkbox" className="peer sr-only" />
                        <div className="h-3.5 w-3.5 border border-border/25 bg-black/50 transition-all peer-checked:bg-primary peer-checked:border-primary group-hover:border-primary/40">
                          <svg className="w-full h-full text-black opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      </div>
                      <span className="text-muted/45 group-hover:text-muted/70 transition-colors">Recordarme</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-primary/55 hover:text-primary transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {/* Turnstile */}
                  {turnstileRequired && effectiveTurnstileSiteKey && (
                    <div className="flex justify-center py-1">
                      <Turnstile
                        key={turnstileKey}
                        sitekey={effectiveTurnstileSiteKey}
                        onSuccess={(token) => setTurnstileToken(token)}
                        onError={() => { setTurnstileToken(null); notify.error('Error en la verificación de Turnstile'); }}
                        onExpire={() => { setTurnstileToken(null); }}
                        theme="auto"
                        size="normal"
                      />
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="default"
                    className={cn(
                      'w-full mt-1 font-mono tracking-widest text-xs shadow-[0_0_20px_rgba(37,211,102,0.12)] hover:shadow-[0_0_32px_rgba(37,211,102,0.25)]',
                      (!selectedRole || (turnstileRequired && !turnstileToken)) && 'opacity-55 cursor-not-allowed'
                    )}
                    loading={isLoading}
                    disabled={!selectedRole || (turnstileRequired && (!turnstileToken || !effectiveTurnstileSiteKey)) || isLoading}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {!selectedRole ? 'SELECCIONA UN ROL' : 'ACCEDER AL SISTEMA'}
                  </Button>

                  {/* Register link */}
                  <p className="text-center font-mono text-[10px] text-muted/35 pt-0.5">
                    ¿Sin credenciales?{' '}
                    <Link href="/register" className="font-bold text-primary/65 hover:text-primary transition-colors">
                      Solicitar acceso
                    </Link>
                  </p>
                </form>
              </div>
            </motion.div>

            <p className="text-center font-mono text-[9px] text-muted/25 mt-4 [@media(max-height:740px)]:hidden">
              © 2026 OGURICAP BOT — SISTEMA DE ACCESO SEGURO
            </p>
          </div>
        </motion.div>
      </div>

      <ForgotPasswordModal isOpen={showForgotPassword} onClose={() => setShowForgotPassword(false)} />
    </div>
  );
}
