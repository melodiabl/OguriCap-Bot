'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Bot, Mail, User, Lock, ArrowLeft, Phone, AlertCircle, CheckCircle2 } from 'lucide-react';

import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { useAuth } from '@/contexts/AuthContext';
import { notify } from '@/lib/notif';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const reduceMotion = useReducedMotion();

  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const registerHighlights = [
    {
      label: 'Alta rápida',
      title: 'Cuenta base',
      detail: 'Registro público pensado para entrar al panel sin pasos innecesarios.',
      icon: Bot,
      tone: 'text-primary',
    },
    {
      label: 'Contacto',
      title: 'Email y WhatsApp',
      detail: 'Tus credenciales y avisos quedan mejor atados a un canal real.',
      icon: Mail,
      tone: 'text-secondary',
    },
    {
      label: 'Seguridad',
      title: 'Clave verificada',
      detail: 'Validación simple para evitar cuentas rotas desde el inicio.',
      icon: CheckCircle2,
      tone: 'text-success',
    },
  ];

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  const validateUsername = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length < 3) return 'El usuario debe tener al menos 3 caracteres';
    if (trimmed.length > 20) return 'El usuario debe tener máximo 20 caracteres';
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

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameError(validateUsername(value));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value && value.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
    } else {
      setPasswordError(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailStr = email.trim();
    const usernameStr = username.trim();

    const usernameValidationError = validateUsername(usernameStr);
    if (usernameValidationError) {
      setUsernameError(usernameValidationError);
      notify.error(usernameValidationError);
      return;
    }

    if (!emailStr || !emailStr.includes('@')) {
      notify.error('Email inválido');
      return;
    }
    if (!usernameStr || usernameStr.length < 3) {
      notify.error('El usuario debe tener al menos 3 caracteres');
      return;
    }
    if (!password || password.length < 6) {
      notify.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== password2) {
      notify.error('Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.registerPublic({ email: emailStr, username: usernameStr, password, whatsapp_number: whatsapp.trim() || undefined });
      notify.success('Registro exitoso. Tu rol es Usuario. Revisá tu email de confirmación.');

      const warnings = Array.isArray(response?.warnings) ? response.warnings : [];
      if (warnings.length > 0) {
        notify.warning((warnings[0] || 'Registro creado, pero hubo advertencias de notificación.').toString());
      }

      router.push(`/login?username=${encodeURIComponent(usernameStr)}&registered=1&role=usuario`);
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Error registrando usuario';
      notify.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = calculatePasswordStrength(password);
  const strengthLabels = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Excelente'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];

  return (
    <div className="auth-shell lg:items-stretch">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={reduceMotion ? { opacity: 1 } : { x: [0, 100, 0], y: [0, -50, 0] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 20, ease: 'linear' }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={reduceMotion ? { opacity: 1 } : { x: [0, -100, 0], y: [0, 50, 0] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 25, ease: 'linear' }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 grid w-full max-w-sm gap-4 px-2 sm:max-w-md sm:px-4 lg:max-w-5xl lg:grid-cols-[minmax(0,0.96fr)_minmax(0,0.82fr)] lg:items-center lg:gap-8">
        <motion.div
          initial={{ opacity: 0, x: -24, y: 10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:flex flex-col gap-5"
        >
          <div className="auth-showcase-panel">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary/85">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgba(37,211,102,0.68)]" />
              Registro público
            </div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">Crea tu acceso al panel</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Abrimos una cuenta inicial con rol Usuario para que entres rápido y con una base ordenada desde el primer login.
            </p>

            <div className="auth-stat-grid mt-6">
              {registerHighlights.map((item) => (
                <div key={item.label} className="auth-stat-card">
                  <div className="relative z-10">
                    <div className={cn('mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/15', item.tone)}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-showcase-panel">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted">Qué se valida</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[22px] border border-white/10 bg-black/10 px-4 py-3 text-sm text-foreground/84">Email válido y usable para recuperación.</div>
              <div className="rounded-[22px] border border-white/10 bg-black/10 px-4 py-3 text-sm text-foreground/84">Usuario limpio, corto y compatible con el panel.</div>
              <div className="rounded-[22px] border border-white/10 bg-black/10 px-4 py-3 text-sm text-foreground/84">Contraseña consistente antes de guardar la cuenta.</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md mx-auto"
        >
        <Reveal className="auth-card p-4 sm:p-6">
          <PageHeader
            title="Registrarte"
            description="Tu cuenta se crea con rol Usuario"
            icon={<Bot className="w-5 h-5 text-primary-400" />}
            actions={
              <Link
                href="/login"
                className="auth-back-link"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Link>
            }
            className="mb-6"
          />

          <div className="mb-4 flex flex-wrap justify-center gap-2 lg:hidden">
            {registerHighlights.map((item) => (
              <span
                key={item.label}
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-white/65"
              >
                {item.label}
              </span>
            ))}
          </div>

          <form onSubmit={handleRegister}>
            <Stagger className="space-y-4" delay={0.02} stagger={0.06}>
              <StaggerItem>
              <label className="panel-field-label mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="input-glass pl-12"
                  placeholder="tu@email.com"
                />
              </div>
              </StaggerItem>

              <StaggerItem>
              <label className="panel-field-label mb-2">WhatsApp (opcional)</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  type="text"
                  className="input-glass pl-12"
                  placeholder="5491123456789"
                />
              </div>
              <p className="panel-field-hint mt-1">Opcional. Se guarda como contacto de WhatsApp de la cuenta.</p>
              </StaggerItem>

              <StaggerItem>
              <label className="panel-field-label mb-2">Usuario</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={cn(
                    "input-glass pl-12",
                    usernameError && "border-red-500/50 focus:border-red-500"
                  )}
                  placeholder="usuario"
                />
              </div>
              {usernameError && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {usernameError}
                </p>
              )}
              {username && !usernameError && (
                <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Usuario válido
                </p>
              )}
              <p className="text-xs text-muted/60 mt-1">Mínimo 3, máximo 20 caracteres</p>
              </StaggerItem>

              <StaggerItem>
              <label className="panel-field-label mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  type="password"
                  className={cn(
                    "input-glass pl-12",
                    passwordError && "border-red-500/50 focus:border-red-500"
                  )}
                  placeholder="••••••••"
                />
              </div>
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-gray-700"
                        )}
                      />
                    ))}
                  </div>
                  <p className={cn(
                    "text-xs",
                    passwordStrength <= 1 ? "text-red-400" :
                    passwordStrength <= 2 ? "text-orange-400" :
                    passwordStrength <= 3 ? "text-yellow-400" :
                    "text-green-400"
                  )}>
                    {passwordStrength > 0 ? strengthLabels[passwordStrength - 1] : ''}
                  </p>
                </div>
              )}
              {passwordError && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {passwordError}
                </p>
              )}
              </StaggerItem>

              <StaggerItem>
              <label className="panel-field-label mb-2">Repetir contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  type="password"
                  className={cn(
                    "input-glass pl-12",
                    password2 && password !== password2 && "border-red-500/50 focus:border-red-500"
                  )}
                  placeholder="••••••••"
                />
              </div>
              {password2 && password !== password2 && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Las contraseñas no coinciden
                </p>
              )}
              </StaggerItem>

              <StaggerItem>
                <Button type="submit" variant="primary" className="w-full" loading={isLoading} disabled={isLoading}>
                  Registrarme
                </Button>
              </StaggerItem>
            </Stagger>
          </form>
        </Reveal>
        </motion.div>
      </div>
    </div>
  );
}
