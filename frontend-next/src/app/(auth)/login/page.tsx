'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal';
import { Bot, Eye, EyeOff, Lock, User, Sparkles, Zap, Shield, Crown, UserCheck, Users, Wrench, AlertTriangle } from 'lucide-react';
import { notify } from '@/lib/notify';
import { useDevicePerformance } from '@/contexts/DevicePerformanceContext';
import { cn } from '@/lib/utils';
import { LoginRolesSelector, type LoginRoleOption } from '@/components/auth/LoginRolesSelector';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ username?: boolean; password?: boolean; role?: boolean }>({});
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
          tone: 'secondary',
          description: 'Acceso completo al sistema',
        },
        {
          value: 'admin',
          label: 'Administrador',
          icon: Shield,
          tone: 'danger',
          description: 'Gestión avanzada del bot',
        },
        {
          value: 'moderador',
          label: 'Moderador',
          icon: UserCheck,
          tone: 'accent',
          description: 'Moderación de contenido',
        },
        {
          value: 'usuario',
          label: 'Usuario',
          icon: Users,
          tone: 'success',
          description: 'Acceso básico al panel',
        },
      ],
    []
  );

  const checkMaintenanceStatus = useCallback(async () => {
    try {
      setIsCheckingMaintenance(true);
      const response = await fetch('/api/health');
      const data = await response.json();

      if (data.maintenanceMode) {
        setIsMaintenanceMode(true);
        notify.warning('El sistema está en modo de mantenimiento');
      } else {
        setIsMaintenanceMode(false);
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error);
      setIsMaintenanceMode(false);
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
      router.replace('/');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verificar modo de mantenimiento antes de proceder
    if (isMaintenanceMode) {
      notify.warning('El sistema está en modo de mantenimiento. Solo los administradores pueden acceder.');
      return;
    }

    // Validaciones mejoradas
    if (!username.trim()) {
      setFieldErrors({ username: true });
      notify.error('El nombre de usuario es requerido');
      return;
    }

    if (username.trim().length < 3) {
      setFieldErrors({ username: true });
      notify.error('El usuario debe tener al menos 3 caracteres');
      return;
    }

    if (!password.trim()) {
      setFieldErrors({ password: true });
      notify.error('La contraseña es requerida');
      return;
    }

    if (password.length < 4) {
      setFieldErrors({ password: true });
      notify.error('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    if (!selectedRole) {
      setFieldErrors({ role: true });
      notify.error('Debes seleccionar un rol para continuar');
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim(), password, selectedRole);
      const selectedRoleData = roles.find(r => r.value === selectedRole);
      notify.success(`¡Bienvenido como ${selectedRoleData?.label}!`);
      router.push('/');
    } catch (error: any) {
      console.error('Login error:', error);

      // Manejo de errores mejorado
      let errorMessage = 'Error al iniciar sesión';

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.status === 401) {
        errorMessage = 'Credenciales incorrectas';
      } else if (error?.response?.status === 403) {
        errorMessage = 'No tienes permisos para este rol';
      } else if (error?.response?.status === 503) {
        // Modo de mantenimiento activado durante el login
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
    } finally {
      setIsLoading(false);
    }
  };

  const features = useMemo(
    () => [
      { icon: Zap, text: 'Gestión de SubBots', tone: 'warning' as const },
      { icon: Shield, text: 'Control Total', tone: 'success' as const },
      { icon: Sparkles, text: 'Tiempo Real', tone: 'accent' as const },
    ],
    []
  );

  // Mostrar pantalla de carga mientras se verifica el mantenimiento
  if (isCheckingMaintenance) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow mb-4 relative">
            <div className="absolute inset-[3px] rounded-2xl bg-slate-950/90" />
            <Image
              src="/oguricap-avatar.png"
              alt="Oguri Cap"
              width={40}
              height={40}
              className="relative w-10 h-10 rounded-full border-2 border-white/70 object-cover animate-pulse"
              priority
            />
          </div>
          <p className="text-muted">Verificando estado del sistema...</p>
        </div>
      </div>
    );
  }

  // Mostrar pantalla de mantenimiento si está activo
  if (isMaintenanceMode) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="glass-card p-8">
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
    <div className="min-h-screen mesh-bg flex items-center lg:items-stretch justify-center p-4 lg:p-10 relative overflow-hidden">
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
      </div>

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-12 items-center relative z-10 lg:min-h-[calc(100vh-5rem)]">
        {/* Left side - Branding */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex flex-col items-start justify-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-8"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow mb-6 relative">
              <div className="absolute inset-[4px] rounded-3xl bg-slate-950/90" />
              <Image
                src="/oguricap-login.png"
                alt="Oguri Cap"
                width={96}
                height={96}
                className="relative w-20 h-20 rounded-3xl object-cover border border-white/40"
                priority
              />
            </div>
            <h1 className="text-5xl font-bold mb-4">
              <span className="gradient-text-animated">OguriCap Bot</span>
            </h1>
            <p className="text-xl text-muted">Panel de Control Avanzado</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-card/20 border border-border/20 backdrop-blur-sm hover-glass-bright"
              >
                <div
                  className={cn(
                    'p-2 rounded-xl border',
                    feature.tone === 'warning' && 'bg-warning/10 border-warning/20 text-warning',
                    feature.tone === 'success' && 'bg-success/10 border-success/20 text-success',
                    feature.tone === 'accent' && 'bg-accent/10 border-accent/20 text-accent'
                  )}
                >
                  <feature.icon className="w-5 h-5" />
                </div>
                <span className="text-foreground/85">{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right side - Login Form */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center py-6 sm:py-8 lg:py-0"
        >
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="lg:hidden text-center mb-5 [@media(max-height:740px)]:mb-3"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow mb-4 relative">
                <div className="absolute inset-[3px] rounded-2xl bg-slate-950/90" />
                <Image
                  src="/oguricap-login.png"
                  alt="Oguri Cap"
                  width={56}
                  height={56}
                  className="relative w-12 h-12 rounded-2xl object-cover border border-white/50"
                  priority
                />
              </div>
              <h1 className="text-3xl font-black gradient-text-animated">OguriCap Bot</h1>
            </motion.div>

            {/* Login card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6 sm:p-7 [@media(max-height:740px)]:p-5"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black tracking-tight mb-1">
                  <span className="gradient-text-animated">Bienvenido</span>
                </h2>
                <p className="text-sm text-muted">Inicia sesión para continuar</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5">Usuario</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (fieldErrors.username) setFieldErrors((prev) => ({ ...prev, username: false }));
                      }}
                      placeholder="Ingresa tu usuario"
                      className={cn('input-glass !py-2.5 pl-12', fieldErrors.username && 'is-error')}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: false }));
                      }}
                      placeholder="Ingresa tu contraseña"
                      className={cn('input-glass !py-2.5 pl-12 pr-12', fieldErrors.password && 'is-error')}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <LoginRolesSelector
                  roles={roles}
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

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-border/40 bg-card/20 text-primary focus:ring-2 focus:ring-primary/35"
                    />
                    Recordarme
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className={`w-full ${!selectedRole ? 'opacity-75 cursor-not-allowed' : ''}`}
                  loading={isLoading}
                  disabled={!selectedRole || isLoading}
                >
                  {!selectedRole ? 'Selecciona un rol para continuar' : 'Iniciar Sesión'}
                </Button>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="pt-1 text-center text-xs text-muted"
                >
                  ¿No tenés cuenta?{' '}
                  <Link href="/register" className="text-primary hover:text-primary/80 transition-colors">
                    Registrarte
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
