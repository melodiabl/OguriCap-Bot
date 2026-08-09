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
import { Bot, Eye, EyeOff, Lock, User, Sparkles, Zap, Shield, Crown, UserCheck, Users, Wrench, AlertTriangle } from 'lucide-react';
import { notify } from '@/lib/notify';
import { useDevicePerformance } from '@/contexts/DevicePerformanceContext';
import { cn } from '@/lib/utils';
import { LoginRolesSelector, type LoginRoleOption } from '@/components/auth/LoginRolesSelector';

function FloatingSignal({ delay = 0, className = '' }: { delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className={`absolute h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent ${className}`}
      animate={reduceMotion ? { opacity: 0.48 } : { x: ['-14%', '14%', '-14%'], opacity: [0.12, 0.88, 0.12] }}
      transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 5.8, delay, ease: 'easeInOut' }}
    />
  );
}

function FloatingCommandCloud() {
  const reduceMotion = useReducedMotion();

  const commands = [
    { text: '/menu', className: 'left-[5%] top-[15%]', delay: 0, color: 'border-primary/25 text-primary/70' },
    { text: '/menu', className: 'left-[52%] top-[22%]', delay: 0.3, color: 'border-secondary/35 text-secondary/70' },
    { text: '/sticker', className: 'left-[76%] top-[18%]', delay: 0.8, color: 'border-accent/35 text-accent/70' },
    { text: '/daily', className: 'right-[8%] top-[35%]', delay: 1.2, color: 'border-success/35 text-success/70' },
    { text: '/tagall', className: 'right-[4%] top-[65%]', delay: 1.7, color: 'border-warning/35 text-warning/70' },
    { text: '/rollwaifu', className: 'left-[60%] top-[72%]', delay: 2.1, color: 'border-danger/35 text-danger/70' },
  ];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden xl:block">
      {commands.map((item) => (
        <motion.span
          key={item.text}
          className={`absolute rounded-lg border bg-card/60 px-3 py-2 font-mono text-xs font-black backdrop-blur-md ${item.className} ${item.color}`}
          animate={reduceMotion ? { opacity: 0.55 } : { y: [0, -12, 0], opacity: [0.42, 1, 0.42] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 4.8, delay: item.delay, ease: 'easeInOut' }}
        >
          {item.text}
        </motion.span>
      ))}
    </div>
  );
}

function LiveBotConsole() {
  const reduceMotion = useReducedMotion();

  const messages = [
    { command: '/menu', response: 'Grupo, RPG, Gacha, Media, Tools.' },
    { command: '/sticker', response: 'Imagen convertida a sticker.' },
  ];

  return (
    <motion.div
      className="relative mx-auto w-full overflow-hidden rounded-lg border border-border/30 bg-card/80 shadow-glow backdrop-blur-xl hidden lg:block"
      initial={reduceMotion ? false : { opacity: 0, y: 24, rotate: 1.2 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: [0, -8, 0], rotate: [1.2, 0.3, 1.2] }}
      transition={reduceMotion ? { duration: 0.12 } : { opacity: { duration: 0.5 }, y: { repeat: Infinity, duration: 6, ease: 'easeInOut' }, rotate: { repeat: Infinity, duration: 6, ease: 'easeInOut' } }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      <div className="flex items-center justify-between border-b border-border/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
            <Image
              src="/oguricap-avatar.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg object-cover"
              priority
            />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">OguriCap Bot</p>
            <p className="flex items-center gap-2 text-xs font-bold text-success">
              <motion.span
                className="h-2 w-2 rounded-lg bg-success"
                animate={reduceMotion ? { opacity: 1 } : { scale: [1, 1.6, 1], opacity: [0.65, 1, 0.65] }}
                transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 1.4 }}
              />
              online ahora
            </p>
          </div>
        </div>
        <div className="rounded-md bg-secondary/20 p-1.5">
          <Sparkles className="h-4 w-4 text-secondary" />
        </div>
      </div>

      <div className="space-y-3 p-4">
        {messages.map((message, index) => (
          <motion.div
            key={message.command}
            className="space-y-2"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.1 }}
          >
            <div className="flex justify-end">
              <motion.div
                className="rounded-lg bg-gradient-oguri-primary px-3 py-2 font-mono text-xs font-black text-white"
                animate={reduceMotion ? { opacity: 1 } : { boxShadow: ['0 0 0 rgba(167,139,250,0)', '0 0 20px rgba(167,139,250,0.28)', '0 0 0 rgba(167,139,250,0)'] }}
                transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 3, delay: index * 0.5 }}
              >
                {message.command}
              </motion.div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[84%] rounded-lg border border-border/20 bg-card/60 px-3 py-2 text-sm text-foreground">
                {message.response}
              </div>
            </div>
          </motion.div>
        ))}

        <div className="flex items-center gap-2 rounded-lg border border-secondary/20 bg-secondary/8 px-3 py-2 text-xs font-bold text-secondary">
          <span>Oguri escribiendo</span>
          <span className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="h-1.5 w-1.5 rounded-lg bg-secondary"
                animate={reduceMotion ? { opacity: 0.7 } : { y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
                transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 0.8, delay: dot * 0.15 }}
              />
            ))}
          </span>
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
  const [passwordStrength, setPasswordStrength] = useState(0);
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
    () =>
      [
        {
          value: 'owner',
          label: 'Owner',
          icon: Crown,
          tone: 'accent',
          description: 'Control absoluto del Aura',
        },
        {
          value: 'admin',
          label: 'Administrador',
          icon: Shield,
          tone: 'danger',
          description: 'Gestión táctica Cinderella Gray',
        },
        {
          value: 'moderador',
          label: 'Moderador',
          icon: UserCheck,
          tone: 'secondary',
          description: 'Moderación de Competencia',
        },
        {
          value: 'usuario',
          label: 'Usuario',
          icon: Users,
          tone: 'success',
          description: 'Acceso básico al Paddock',
        },
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

  // Verificar modo de mantenimiento al cargar la página
  useEffect(() => {
    checkMaintenanceStatus();
  }, [checkMaintenanceStatus]);

  // Si ya hay sesión (por token en cookie/localStorage), no mostrar login
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  // Prefill username después de registrarse
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

  // checkMaintenanceStatus declared above (useCallback)

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

  const calculatePasswordStrength = (pwd: string): number => {
    if (!pwd) return 0;
    let strength = 0;
    if (pwd.length >= 4) strength += 1;
    if (pwd.length >= 8) strength += 1;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 1;
    if (/\d/.test(pwd)) strength += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength += 1;
    return Math.min(strength, 5);
  };

  useEffect(() => {
    if (password) {
      setPasswordStrength(calculatePasswordStrength(password));
    } else {
      setPasswordStrength(0);
    }
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isMaintenanceMode && !maintenanceAccessAllowed && selectedRole && !['owner', 'admin', 'administrador'].includes(String(selectedRole).toLowerCase())) {
      notify.warning('El sistema está en modo de mantenimiento. Solo los administradores pueden acceder.');
      return;
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      setFieldErrors({ username: true });
      notify.error(usernameError);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setFieldErrors({ password: true });
      notify.error(passwordError);
      return;
    }

    if (!selectedRole) {
      setFieldErrors({ role: true });
      notify.error('Debes seleccionar un rol para continuar');
      return;
    }

    if (turnstileRequired && (!effectiveTurnstileSiteKey || !turnstileToken)) {
      notify.error('Por favor completa la verificación de Turnstile');
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim(), password, selectedRole, turnstileRequired ? turnstileToken : undefined);
      const selectedRoleData = roles.find(r => r.value === selectedRole);
      const ipInfo = detectedIP ? ` (${detectedIP})` : '';
      notify.success(`¡Bienvenido como ${selectedRoleData?.label}!${ipInfo}`, {
        title: 'Sesión iniciada',
      });

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

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.status === 401) {
        errorMessage = 'Credenciales incorrectas';
      } else if (error?.response?.status === 403) {
        errorMessage = 'No tienes permisos para este rol';
      } else if (error?.response?.status === 429) {
        errorMessage = 'Demasiados intentos de login. Intenta más tarde';
      } else if (error?.response?.status === 503) {
        if (error?.response?.data?.maintenanceMode) {
          setIsMaintenanceMode(true);
          errorMessage = 'El sistema está en modo de mantenimiento';
        } else {
          errorMessage = 'Servicio temporalmente no disponible';
        }
      } else if (error?.response?.status >= 500) {
        errorMessage = 'Error del servidor. Inténtalo más tarde';
      }

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
      <div className="relative overflow-hidden border-y border-border/15 bg-card/40 py-2.5">
        <motion.div
          className="flex w-max gap-2.5"
          animate={reduceMotion ? { x: 0 } : { x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 28, ease: 'linear' }}
        >
          {commands.map((command, index) => (
            <span
              key={`${command}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-card/70 px-3 py-1.5 font-mono text-xs font-black text-primary shadow-[0_0_16px_rgba(167,139,250,0.08)]"
            >
              <span className="h-1 w-1 rounded-lg bg-primary/70" />
              {command}
            </span>
          ))}
        </motion.div>
      </div>
    );
  }

  const features = useMemo(
    () => [
      { icon: Zap, text: 'Gestión de SubBots', tone: 'warning' as const },
      { icon: Shield, text: 'Control Total', tone: 'success' as const },
      { icon: Sparkles, text: 'Tiempo Real', tone: 'accent' as const },
    ],
    []
  );

  const accessHighlights = useMemo(
    () => [
      {
        label: 'Carga inicial',
        value: 'Más robusta',
        detail: 'Reintentos automáticos para respuestas lentas o transitorias.',
        icon: Shield,
        accent: 'from-primary/20 via-primary/8 to-transparent text-primary',
      },
      {
        label: 'Sincronización',
        value: 'En vivo',
        detail: 'Bot, notificaciones y estado global con menos fricción visual.',
        icon: Bot,
        accent: 'from-secondary/20 via-secondary/8 to-transparent text-secondary',
      },
      {
        label: 'Acceso',
        value: 'Más claro',
        detail: 'Formulario centrado, estructura más limpia y lectura más rápida.',
        icon: Sparkles,
        accent: 'from-accent/20 via-accent/8 to-transparent text-accent',
      },
    ],
    []
  );

  // Mostrar pantalla de carga mientras se verifica el mantenimiento
  if (isCheckingMaintenance) {
    return (
      <div className="auth-shell">
        <div className="panel-stack-center relative z-10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-oguri-primary flex items-center justify-center shadow-glow-oguri-mixed mb-4 relative animate-oguri-aura">
            <div className="absolute inset-[3px] rounded-2xl bg-oguri-phantom-950/90" />
            <Image
              src="/oguricap-avatar.png"
              alt="Oguri Cap"
              width={40}
              height={40}
              className="relative w-10 h-10 rounded-full border-2 border-oguri-lavender/40 object-cover animate-pulse"
              priority
            />
          </div>
          <p className="text-oguri-lavender/60 font-bold uppercase tracking-widest text-xs">Sincronizando Aura...</p>
        </div>
      </div>
    );
  }

  // Mostrar pantalla de mantenimiento si está activo
  if (isMaintenanceMode && !maintenanceAccessAllowed && !showMaintenanceLogin) {
    return (
      <div className="auth-shell">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md text-center"
        >
          <div className="auth-card">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-glow mb-6">
              <Wrench className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-4">
              Sistema en Mantenimiento
            </h1>

            <div className="flex items-center justify-center gap-2 mb-4 text-warning">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">Acceso Temporalmente Restringido</span>
            </div>

            <p className="text-muted mb-6 leading-relaxed">
              El sistema está temporalmente fuera de servicio por mantenimiento programado.
              Solo los administradores pueden acceder durante este período.
            </p>

            <div className="space-y-3">
              <Button
                onClick={checkMaintenanceStatus}
                variant="primary"
                className="w-full"
                loading={isCheckingMaintenance}
              >
                Verificar Estado
              </Button>

              <Button
                type="button"
                onClick={() => setShowMaintenanceLogin(true)}
                variant="secondary"
                className="w-full"
              >
                Soy Owner/Admin, iniciar sesión
              </Button>

              {detectedIP && (
                <p className="text-xs text-muted/80">
                  IP detectada: <span className="font-semibold">{detectedIP}</span>
                </p>
              )}

              <p className="text-xs text-muted/80">
                Si eres administrador y necesitas acceso urgente, contacta al equipo técnico.
              </p>
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-sm text-muted/80 mt-6"
          >
            © 2026 Oguri Bot. Todos los derechos reservados.
          </motion.p>
        </motion.div>
      </div>
    );
  }

  const enableBgMotion = !reduceMotion && !performanceMode;

  return (
    <div className="auth-shell lg:items-stretch min-h-[100dvh]">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={enableBgMotion ? { x: [0, 100, 0], y: [0, -50, 0] } : { opacity: 1 }}
          transition={enableBgMotion ? { repeat: Infinity, duration: 20, ease: 'linear' } : { duration: 0.12 }}
          className={cn(
            "absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full",
            performanceMode ? "blur-2xl opacity-40" : "blur-3xl"
          )}
        />
        <motion.div
          animate={enableBgMotion ? { x: [0, -100, 0], y: [0, 50, 0] } : { opacity: 1 }}
          transition={enableBgMotion ? { repeat: Infinity, duration: 25, ease: 'linear' } : { duration: 0.12 }}
          className={cn(
            "absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full",
            performanceMode ? "blur-2xl opacity-35" : "blur-3xl"
          )}
        />
        <FloatingSignal className="top-[28%] w-[42%]" delay={0} />
        <FloatingSignal className="top-[62%] w-[28%]" delay={1.5} />
        <FloatingCommandCloud />
      </div>

      <div className="relative z-10 grid w-full max-w-sm gap-4 px-3 sm:max-w-md sm:gap-6 sm:px-6 md:px-8 lg:min-h-[min(880px,calc(100vh-4rem))] lg:max-w-[1220px] lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,460px)] lg:items-center lg:gap-10">
        {/* Left side - Branding */}
        <motion.div
          initial={{ opacity: 0, x: -30, y: 12 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:flex flex-col gap-5 lg:pr-4"
        >
          <div className="auth-showcase-panel">
            <div className="flex items-start justify-between gap-5">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-primary/85">
                  <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgba(37,211,102,0.68)]" />
                  Acceso operativo
                </div>
                <h1 className="text-4xl font-black tracking-tight text-foreground xl:text-5xl">
                  OguriCap Bot
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted xl:text-base">
                  Controla bot principal, subbots, grupos, alertas y recursos desde una entrada más estable y una composición menos cargada.
                </p>
              </div>
              <div className="relative hidden xl:flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-primary via-secondary to-accent shadow-glow-oguri-mixed">
                <div className="absolute inset-[4px] rounded-[20px] bg-slate-950/90" />
                <Image
                  src="/oguricap-login.png"
                  alt="Oguri Cap"
                  width={64}
                  height={64}
                  className="relative h-14 w-14 rounded-[18px] border border-border/20 object-cover"
                  priority
                />
              </div>
            </div>
            <div className="auth-stat-grid mt-6">
              {accessHighlights.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 + index * 0.08, duration: 0.45 }}
                  className="auth-stat-card"
                >
                  <div className={cn('absolute inset-0 bg-gradient-to-br opacity-90', item.accent)} />
                  <div className="relative z-10">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-2.5">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">{item.label}</span>
                    </div>
                    <p className="text-base font-black text-white">{item.value}</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/72">{item.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
            <div className="auth-showcase-panel">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted">Capacidades</p>
                  <h2 className="mt-1 text-xl font-black text-foreground">Entrada más ordenada</h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
                  3 focos
                </div>
              </div>

              <div className="grid gap-3">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.text}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.24 + index * 0.06, duration: 0.38 }}
                    className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-black/10 px-4 py-3"
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-2xl border',
                        feature.tone === 'warning' && 'bg-warning/10 border-warning/20 text-warning',
                        feature.tone === 'success' && 'bg-success/10 border-success/20 text-success',
                        feature.tone === 'accent' && 'bg-accent/10 border-accent/20 text-accent'
                      )}
                    >
                      <feature.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{feature.text}</p>
                      <p className="text-xs text-muted">Panel principal, sincronización y acciones rápidas.</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <LiveBotConsole />
              <div className="auth-showcase-panel overflow-hidden p-0">
                <div className="border-b border-white/10 px-5 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted">Actividad</p>
                  <p className="mt-1 text-sm text-foreground/80">Comandos y flujo del panel con una presencia más contenida.</p>
                </div>
                <CommandTicker />
                <CommandTicker reverse />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right side - Login Form */}
        <motion.div
          initial={{ opacity: 0, x: 24, y: 10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center py-6 sm:py-8 lg:justify-self-center lg:py-0"
        >
          <div className="mx-auto w-full max-w-[340px] sm:max-w-md lg:max-w-[29rem] flex flex-col justify-center">
            {/* Mobile logo */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="lg:hidden text-center mb-4"
            >
              <div className="relative mb-3 mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-glow">
                <div className="absolute inset-[2px] rounded-xl bg-slate-950/90" />
                <Image
                  src="/oguricap-login.png"
                  alt="Oguri Cap"
                  width={40}
                  height={40}
                  className="relative w-8 h-8 rounded-xl object-cover border border-border/25"
                  priority
                />
              </div>
              <h1 className="text-xl font-black gradient-text-animated">OguriCap</h1>
              <p className="mt-1 text-xs text-muted/80">Acceso estable, panel centrado y respuesta más limpia.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {accessHighlights.map((item) => (
                  <span
                    key={item.label}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-white/65"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Login card */}
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="auth-card p-4 sm:p-5 md:p-6 relative overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <motion.div
                className="absolute -left-16 -top-16 h-32 w-32 rounded-full bg-primary/10 blur-[60px]"
                animate={reduceMotion ? { opacity: 0.5 } : { x: [0, 20, 0], opacity: [0.5, 0.8, 0.5] }}
                transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 8, ease: 'easeInOut' }}
              />
              
              <div className="relative z-10 text-center mb-4 sm:mb-6">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.35, type: 'spring', stiffness: 300 }}
                  className="inline-flex items-center gap-2 mb-2"
                >
                  <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_12px_rgba(37,211,102,0.8)]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-primary/80">Acceso Seguro</span>
                  <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_12px_rgba(167,139,250,0.8)]" />
                </motion.div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight mb-1">
                  <span className="gradient-text-animated">Bienvenido</span>
                </h2>
                <p className="text-xs sm:text-sm text-muted font-medium">Inicia sesión para acceder</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
                <CommandTicker />
                {isMaintenanceMode && (
                  <div className="rounded-xl border border-warning/25 bg-warning/10 p-2 sm:p-3">
                    <p className="text-xs font-semibold text-warning flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" />
                      Sistema en mantenimiento
                    </p>
                  </div>
                )}
                <div className="relative group">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Usuario</label>
                  <div className="relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/20 flex items-center justify-center z-10">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (fieldErrors.username) setFieldErrors((prev) => ({ ...prev, username: false }));
                      }}
                      placeholder="Usuario"
                      className={cn('input-glass !py-2.5 !pl-12 sm:!py-3 sm:!pl-14 !pr-3 text-sm sm:text-base', fieldErrors.username && 'is-error ring-2 ring-destructive/40')}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="relative group">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Contraseña</label>
                  <div className="relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-secondary/20 to-accent/10 border border-secondary/20 flex items-center justify-center z-10">
                      <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: false }));
                      }}
                      placeholder="Contraseña"
                      className={cn('input-glass !py-2.5 !pl-12 sm:!py-3 sm:!pl-14 !pr-10 text-sm sm:text-base', fieldErrors.password && 'is-error ring-2 ring-destructive/40')}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-muted hover:text-foreground transition-colors hover:bg-white/5 rounded-r-lg sm:rounded-r-xl"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((level, idx) => (
                          <motion.div
                            key={level}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className={cn(
                              'h-1.5 flex-1 rounded-full transition-all',
                              passwordStrength >= level
                                ? level <= 1 ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]' : level <= 2 ? 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                                : 'bg-muted/20'
                            )}
                          />
                        ))}
                      </div>
                      <p className={cn(
                        'text-xs font-semibold flex items-center gap-1.5',
                        passwordStrength <= 1 ? 'text-destructive' : passwordStrength <= 2 ? 'text-warning' : 'text-success'
                      )}>
                        {passwordStrength === 0 && 'Muy débil'}
                        {passwordStrength === 1 && 'Débil'}
                        {passwordStrength === 2 && 'Regular'}
                        {passwordStrength === 3 && 'Buena'}
                        {passwordStrength === 4 && 'Fuerte'}
                        {passwordStrength === 5 && 'Muy fuerte'}
                        {passwordStrength >= 3 && <Zap className="w-3 h-3" />}
                      </p>
                    </div>
                  )}
                </div>

                <LoginRolesSelector
                  roles={rolesForLogin}
                  selectedRole={selectedRole}
                  onChange={(value) => {
                    setSelectedRole(value);
                    if (fieldErrors.role) {
                      setFieldErrors((prev) => ({ ...prev, role: false }));
                    }
                  }}
                  showError={!!fieldErrors.role}
                  performanceMode={performanceMode}
                />

                <div className="flex items-center justify-between text-xs sm:text-sm mt-1.5 sm:mt-2">
                  <label className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                      />
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg border-2 border-border/40 bg-card/30 transition-all peer-checked:bg-primary peer-checked:border-primary group-hover:border-primary/50 group-hover:bg-card/50">
                        <svg className="w-full h-full text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    </div>
                    <span className="text-muted group-hover:text-foreground transition-colors">Recordarme</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="relative text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-primary/60 after:transition-all hover:after:w-full"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {turnstileRequired && effectiveTurnstileSiteKey && (
                  <div className="flex justify-center py-2 sm:py-3">
                    <Turnstile
                      key={turnstileKey}
                      sitekey={effectiveTurnstileSiteKey}
                      onSuccess={(token) => setTurnstileToken(token)}
                      onError={() => {
                        setTurnstileToken(null);
                        notify.error('Error en la verificación de Turnstile');
                      }}
                      onExpire={() => {
                        setTurnstileToken(null);
                      }}
                      theme="auto"
                      size="normal"
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className={`w-full mt-1.5 sm:mt-2 shadow-glow hover:shadow-glow-lg text-sm sm:text-base ${!selectedRole || (turnstileRequired && !turnstileToken) ? 'opacity-75 cursor-not-allowed' : ''}`}
                  loading={isLoading}
                  disabled={!selectedRole || (turnstileRequired && (!turnstileToken || !effectiveTurnstileSiteKey)) || isLoading}
                >
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                  {!selectedRole ? 'Selecciona un rol' : 'Iniciar Sesión'}
                </Button>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="pt-2 sm:pt-3 text-center text-xs sm:text-sm text-muted"
                >
                  <span className="opacity-70">¿No tenés cuenta?</span>{' '}
                  <Link href="/register" className="font-bold text-primary hover:text-primary/80 transition-colors relative">
                    <span className="relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-primary/60 after:transition-all hover:after:w-full">
                      Registrarte
                    </span>
                  </Link>
                </motion.div>
              </form>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center text-xs text-muted/70 mt-4 [@media(max-height:740px)]:hidden"
            >
              © 2026 Oguri Bot. Todos los derechos reservados.
            </motion.p>
          </div>
        </motion.div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
}
