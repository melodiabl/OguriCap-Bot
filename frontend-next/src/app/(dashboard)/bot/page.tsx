'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Wifi,
  WifiOff,
  RefreshCw,
  Power,
  PowerOff,
  QrCode,
  Smartphone,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle,
  Loader2,
  Radio,
  Sparkles,
  ShieldCheck,
  Zap,
  Gauge,
  HardDrive,
  ScanLine,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ProgressRing } from '@/components/ui/Charts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useBotStatus, useBotGlobalState, useSystemStats } from '@/hooks/useRealTime';
import { useSocketBotStatus, useSocketConnection } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLoadingOverlay } from '@/contexts/LoadingOverlayContext';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import QRCode from 'qrcode';
import { notify } from '@/lib/notify';

export default function BotStatusPage() {
  const [authMethod, setAuthMethod] = useState<'qr' | 'pairing'>('qr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const pairingToastShownRef = useRef(false);
  const pairingPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status, isConnected, isConnecting: botConnecting, refetch } = useBotStatus(3000);
  const { isOn, setGlobalState } = useBotGlobalState(5000);
  const { memoryUsage, cpuUsage, diskUsage, uptime } = useSystemStats(10000);
  const { isConnected: isSocketConnected } = useSocketConnection();
  const socketBotStatus = useSocketBotStatus();
  const { user } = useAuth();
  const { withLoading } = useLoadingOverlay();

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const connected = socketBotStatus?.connected ?? isConnected;
  const connecting = socketBotStatus?.connecting ?? botConnecting ?? isConnecting;
  const canControl = !!user && ['owner', 'admin', 'administrador'].includes(String(user.rol || '').toLowerCase());
  const currentPhone = socketBotStatus?.phone ?? status?.phone ?? null;
  const currentUptime = socketBotStatus?.uptime ?? status?.uptime ?? formatUptime(uptime);
  const lastSeenValue = socketBotStatus?.lastSeen ?? status?.lastSeen ?? null;
  const connectionLabel = connected ? 'Conectado' : connecting ? 'Conectando' : 'Desconectado';
  const connectionSummary = connected
    ? 'La sesión está activa, el canal en vivo está respondiendo y el bot ya puede operar.'
    : connecting
      ? 'El bot está negociando la autenticación. Mantén esta vista abierta mientras se genera la sesión.'
      : 'El bot está inactivo. Puedes iniciar una nueva sesión con QR o con código de 8 dígitos.';

  useEffect(() => {
    const qr = socketBotStatus?.qrCode || status?.qrCode;
    if (qr && !connected) {
      QRCode.toDataURL(qr, { width: 256, margin: 2 })
        .then(setQrImage)
        .catch(console.error);
    } else if (connected) {
      setQrImage(null);
    }
  }, [socketBotStatus?.qrCode, status?.qrCode, connected]);

  useEffect(() => {
    if (socketBotStatus?.pairingCode) setPairingCode(socketBotStatus.pairingCode);
  }, [socketBotStatus?.pairingCode]);

  useEffect(() => {
    if (connected) setPairingCode(null);
    if (connected) pairingToastShownRef.current = false;
    if (connected && pairingPollTimeoutRef.current) {
      clearTimeout(pairingPollTimeoutRef.current);
      pairingPollTimeoutRef.current = null;
    }
  }, [connected]);

  useEffect(() => {
    return () => {
      if (pairingPollTimeoutRef.current) clearTimeout(pairingPollTimeoutRef.current);
    };
  }, []);

  const showPairingCodeReady = (code: string) => {
    setPairingCode(code);
    if (pairingPollTimeoutRef.current) {
      clearTimeout(pairingPollTimeoutRef.current);
      pairingPollTimeoutRef.current = null;
    }
    if (pairingToastShownRef.current) return;
    pairingToastShownRef.current = true;
    notify.success('Código de emparejamiento generado', {
      dedupeKey: 'main-bot-pairing-code',
      dedupeMs: 8000,
    });
  };

  const pollPairingCode = (attempt = 0) => {
    if (pairingPollTimeoutRef.current) {
      clearTimeout(pairingPollTimeoutRef.current);
      pairingPollTimeoutRef.current = null;
    }

    if (attempt >= 20 || connected) return;

    pairingPollTimeoutRef.current = setTimeout(async () => {
      try {
        const codeResponse = await api.getMainBotPairingCode();
        if (codeResponse?.code) {
          showPairingCodeReady(codeResponse.code);
          return;
        }
      } catch (e) {
        console.error('Error obteniendo código:', e);
      }

      pollPairingCode(attempt + 1);
    }, attempt === 0 ? 1200 : 1500);
  };

  const handleConnect = async () => {
    if (!canControl) {
      notify.error('No tienes permisos para controlar el bot');
      return;
    }
    setIsConnecting(true);
    setPairingCode(null);
    pairingToastShownRef.current = false;
    try {
      const sanitizedPhone = phoneNumber.replace(/\D/g, '');

      if (authMethod === 'pairing') {
        if (!sanitizedPhone) {
          notify.warning('Ingresa un número de teléfono');
          setIsConnecting(false);
          return;
        }
      }

      await api.setMainBotMethod(authMethod, authMethod === 'pairing' ? sanitizedPhone : undefined);

      if (authMethod === 'pairing') {
        const response = await api.connectMainBot('pairing', sanitizedPhone);
        if (response?.pairingCode) {
          showPairingCodeReady(response.pairingCode);
        } else {
          notify.info('Generando código de emparejamiento...', {
            dedupeKey: 'main-bot-pairing-pending',
            dedupeMs: 5000,
          });
          pollPairingCode(0);
        }
      } else {
        await api.connectMainBot('qr');
        notify.info('Generando código QR...', { dedupeKey: 'main-bot-qr' });
        setTimeout(() => refetch(), 2000);
      }
      refetch();
    } catch (error: any) {
      notify.error(error?.response?.data?.error || 'Error al conectar');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!canControl) {
      notify.error('No tienes permisos para controlar el bot');
      return;
    }
    try {
      await withLoading(() => api.disconnectMainBot(), { message: 'Desconectando bot...' });
      notify.success('Bot desconectado');
      refetch();
    } catch (error) {
      notify.error('Error al desconectar');
    }
  };

  const handleRestart = async () => {
    if (!canControl) {
      notify.error('No tienes permisos para controlar el bot');
      return;
    }
    try {
      await withLoading(() => api.restartMainBot(), {
        message: 'Reiniciando bot...',
        details: 'Esto puede tardar unos segundos.',
      });
      notify.success('Bot reiniciado');
      refetch();
    } catch (error) {
      notify.error('Error al reiniciar');
    }
  };

  const handleGlobalToggle = async () => {
    if (!canControl) {
      notify.error('No tienes permisos para controlar el bot');
      return;
    }
    try {
      await withLoading(() => setGlobalState(!isOn), {
        message: !isOn ? 'Activando bot globalmente...' : 'Desactivando bot globalmente...',
        details: 'Aplicando cambios en todos los grupos.',
      });
      notify.success(isOn ? 'Bot desactivado globalmente' : 'Bot activado globalmente');
    } catch (error) {
      notify.error('Error al cambiar estado global');
    }
  };

  const quickSignals = [
    {
      label: 'Canal',
      value: isSocketConnected ? 'Tiempo real activo' : 'Fallback HTTP',
      description: isSocketConnected ? 'Socket.IO transmitiendo estado y QR.' : 'El panel sigue disponible mientras se reconecta.',
      icon: <Radio className="h-4 w-4" />,
      tone: 'border-oguri-cyan/25 bg-gradient-oguri-signal bg-[length:220%_100%] text-white shadow-glow-oguri-cyan animate-prism-pan',
    },
    {
      label: 'Permisos',
      value: canControl ? 'Control total' : 'Solo lectura',
      description: canControl ? 'Puedes conectar, reiniciar y cambiar el estado global.' : 'Necesitas rol admin u owner para operar el bot.',
      icon: <ShieldCheck className="h-4 w-4" />,
      tone: 'border-oguri-lavender/25 bg-gradient-oguri-spectrum bg-[length:220%_100%] text-white shadow-glow-oguri-mixed animate-prism-pan',
    },
    {
      label: 'Autenticación',
      value: authMethod === 'qr' ? 'QR dinámico' : 'Pairing numérico',
      description: authMethod === 'qr' ? 'Escaneo visual con refresco inmediato.' : 'Vinculación manual con código temporal.',
      icon: <Zap className="h-4 w-4" />,
      tone: 'border-oguri-blue/25 bg-[linear-gradient(135deg,rgba(127,180,255,0.22),rgba(91,61,173,0.18),rgba(16,185,129,0.18))] text-white shadow-glow-oguri-blue',
    },
  ];

  const detailCards = [
    {
      label: 'Uptime',
      value: currentUptime,
      hint: connected ? 'Sesión estable' : 'En espera de enlace',
      icon: <Clock className="h-5 w-5 text-oguri-lavender" />,
      glow: 'bg-oguri-lavender/20',
    },
    {
      label: 'Última actividad',
      value: lastSeenValue ? new Date(lastSeenValue).toLocaleString() : 'Sin actividad reciente',
      hint: connected ? 'Presencia actualizada' : 'Aún sin presencia activa',
      icon: <Activity className="h-5 w-5 text-oguri-cyan" />,
      glow: 'bg-oguri-cyan/20',
    },
    {
      label: 'Sistema',
      value: connected ? 'Conectado y escuchando' : connecting ? 'Sincronizando sesión' : 'Esperando autenticación',
      hint: authMethod === 'qr' ? 'Modo QR activo' : 'Modo pairing activo',
      icon: <Smartphone className="h-5 w-5 text-oguri-blue" />,
      glow: 'bg-oguri-blue/20',
    },
  ];

  const statCards: Array<{
    title: string;
    value: string;
    subtitle: string;
    icon: React.ReactNode;
    color: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'cyan';
    active?: boolean;
  }> = [
    {
      title: 'Estado',
      value: connecting ? 'Sync' : connected ? 'Online' : 'Offline',
      subtitle: connectionLabel,
      icon: connected ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />,
      color: connected ? 'success' : connecting ? 'warning' : 'danger',
      active: connected || connecting,
    },
    {
      title: 'Uptime',
      value: currentUptime,
      subtitle: currentPhone || 'Sin línea vinculada',
      icon: <Clock className="w-6 h-6" />,
      color: 'violet',
    },
    {
      title: 'Memoria',
      value: `${memoryUsage?.systemPercentage || 0}%`,
      subtitle: 'Uso total del sistema',
      icon: <Activity className="w-6 h-6" />,
      color: 'info',
      active: (memoryUsage?.systemPercentage || 0) > 75,
    },
    {
      title: 'Global',
      value: isOn ? 'Activo' : 'Inactivo',
      subtitle: isOn ? 'Responde en todos los grupos' : 'Silenciado globalmente',
      icon: isOn ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />,
      color: isOn ? 'success' : 'primary',
      active: isOn,
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden pb-2">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-10%] top-[-3rem] -z-10 h-[760px] overflow-hidden">
        <div className="absolute inset-0 opacity-40 panel-neon-grid" />
        <div className="absolute left-[-5%] top-8 h-64 w-64 rounded-full bg-oguri-purple/25 blur-3xl animate-orbital-float" />
        <div className="absolute right-[-4%] top-16 h-72 w-72 rounded-full bg-oguri-cyan/20 blur-3xl animate-orbital-float" style={{ animationDelay: '-2.4s' }} />
        <div className="absolute left-[36%] top-44 h-52 w-52 rounded-full bg-oguri-blue/16 blur-3xl animate-orbital-float" style={{ animationDelay: '-5s' }} />
      </div>

      <PageHeader
        title="Estado del Bot"
        description="Un panel más vivo para vigilar la sesión, lanzar autenticación y controlar el bot principal en tiempo real."
        icon={<Bot className="w-5 h-5 text-primary-400" />}
        className="shadow-glow-oguri-cosmic"
        actions={
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
            <div className="panel-live-pill">
              <span className={cn('panel-radio-wave', isSocketConnected ? 'animate-signal-wave' : 'opacity-70')} />
              {isSocketConnected ? 'Tiempo Real' : 'Reconectando'}
            </div>
            <div
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em]',
                connected
                  ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-300 shadow-glow-emerald'
                  : connecting
                    ? 'border-amber-400/30 bg-amber-500/12 text-amber-300'
                    : 'border-rose-400/30 bg-rose-500/12 text-rose-300'
              )}
            >
              {connectionLabel}
            </div>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {quickSignals.map((signal, index) => (
          <motion.div
            key={signal.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + index * 0.08, duration: 0.35 }}
            className={cn(
              'group relative overflow-hidden rounded-[28px] border p-4 backdrop-blur-xl',
              signal.tone
            )}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10 blur-2xl opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex items-start gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-3 text-white shadow-glow-sm">
                {signal.icon}
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">{signal.label}</p>
                <p className="mt-1 text-base font-black text-white">{signal.value}</p>
                <p className="mt-1 text-sm text-white/70">{signal.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card animated delay={0.1} glow className="lg:col-span-2 overflow-hidden p-6 sm:p-7 shadow-glow-oguri-cosmic">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-oguri-spectrum bg-[length:220%_100%] animate-prism-pan opacity-90" />
          <div className="pointer-events-none absolute -right-16 top-12 h-44 w-44 rounded-full bg-oguri-cyan/18 blur-3xl animate-orbital-float" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-oguri-purple/18 blur-3xl animate-orbital-float" style={{ animationDelay: '-4.5s' }} />

          <div className="relative z-10">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="panel-live-pill mb-3 w-fit">
                  <Sparkles className="h-3.5 w-3.5 text-oguri-cyan" />
                  Núcleo de conexión
                </div>
                <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">Estado de Conexión</h3>
                <p className="mt-2 max-w-2xl text-sm font-medium text-gray-400">{connectionSummary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="rounded-full border border-oguri-lavender/25 bg-oguri-lavender/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-oguri-lavender">
                    {currentPhone || 'Sin número'}
                  </div>
                  <div className="rounded-full border border-oguri-cyan/25 bg-oguri-cyan/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-oguri-cyan">
                    {authMethod === 'qr' ? 'QR en vivo' : 'Pairing manual'}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">
                    {currentUptime}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 shadow-[0_0_22px_rgba(127,180,255,0.08)]">
                <StatusIndicator status={connecting ? 'connecting' : connected ? 'online' : 'offline'} size="lg" />
                <span className="text-sm font-black uppercase tracking-[0.16em] text-white">{connectionLabel}</span>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="panel-scan-frame panel-neon-grid flex min-h-[340px] flex-col items-center justify-center p-6 text-center">
                {connecting && (
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-20 bg-gradient-to-b from-oguri-cyan/16 via-oguri-blue/10 to-transparent opacity-70 animate-scanline" />
                )}

                <div className="relative flex h-64 w-64 items-center justify-center">
                  <div className="absolute inset-2 rounded-full border border-oguri-lavender/15 animate-[spin_18s_linear_infinite]" />
                  <div className="absolute inset-6 rounded-full border border-oguri-cyan/20 animate-[spin_14s_linear_infinite_reverse]" />
                  <div
                    className={cn(
                      'absolute inset-10 rounded-full blur-2xl',
                      connected
                        ? 'bg-emerald-400/18'
                        : connecting
                          ? 'bg-amber-400/16'
                          : 'bg-rose-400/14'
                    )}
                  />
                  {connecting && (
                    <>
                      <span className="absolute inset-[14%] rounded-full border border-oguri-cyan/20 animate-signal-wave" />
                      <span
                        className="absolute inset-[24%] rounded-full border border-oguri-blue/20 animate-signal-wave"
                        style={{ animationDelay: '0.8s' }}
                      />
                    </>
                  )}
                  <ProgressRing
                    progress={connected ? 100 : connecting ? 58 : 12}
                    size={190}
                    strokeWidth={12}
                    color={connected ? 'rgb(var(--success))' : connecting ? 'rgb(var(--warning))' : 'rgb(var(--danger))'}
                    label={connected ? 'Online' : connecting ? 'Sync' : 'Offline'}
                  />
                </div>

                <div className="mt-6 max-w-md space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-500">Dispositivo principal</p>
                  <p className="text-lg font-black text-white">{currentPhone || 'Sin número conectado'}</p>
                  <p className="text-sm text-gray-400">
                    {connected
                      ? 'La sesión está lista para recibir eventos, responder y sincronizar estado con el panel.'
                      : connecting
                        ? 'Mantén esta pantalla abierta. El vínculo se está preparando para entregar el QR o cerrar la sesión actual.'
                        : 'El panel puede iniciar una nueva sesión en segundos desde esta misma vista.'}
                  </p>
                </div>
              </div>

              <div className="grid content-start gap-4">
                {detailCards.map((detail, index) => (
                  <motion.div
                    key={detail.label}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + index * 0.08, duration: 0.35 }}
                    className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-1 hover:border-white/20"
                  >
                    <div className={cn('absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-80 transition-opacity duration-300 group-hover:opacity-100', detail.glow)} />
                    <div className="relative flex items-start gap-3">
                      <div className="rounded-2xl border border-white/10 bg-black/10 p-3 shadow-glow-sm">{detail.icon}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">{detail.label}</p>
                        <p className="mt-1 text-base font-black leading-tight text-white">{detail.value}</p>
                        <p className="mt-2 text-sm text-gray-400">{detail.hint}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="panel-glow-divider mb-6" />
              <div className="flex flex-wrap gap-3">
                {canControl ? (
                  connected ? (
                    <>
                      <Button
                        variant="danger"
                        navFx
                        icon={<PowerOff className="w-4 h-4" />}
                        onClick={handleDisconnect}
                        className="shadow-[0_16px_36px_rgba(244,63,94,0.24)]"
                      >
                        Desconectar
                      </Button>
                      <Button
                        variant="secondary"
                        navFx
                        icon={<RefreshCw className="w-4 h-4" />}
                        onClick={handleRestart}
                        className="border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]"
                      >
                        Reiniciar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="glow"
                      navFx
                      icon={<Power className="w-4 h-4" />}
                      onClick={handleConnect}
                      loading={isConnecting}
                      className="shadow-glow-oguri-cosmic"
                    >
                      Conectar Bot
                    </Button>
                  )
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-400 [html[data-theme=light]_&]:text-gray-600">
                    Solo admins y owner pueden operar la conexión del bot.
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card animated delay={0.18} className="overflow-hidden p-6 shadow-[0_0_32px_rgba(70,195,207,0.14)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-oguri-spectrum bg-[length:220%_100%] animate-prism-pan opacity-80" />
          <div className="pointer-events-none absolute -right-10 top-6 h-32 w-32 rounded-full bg-oguri-blue/18 blur-3xl animate-orbital-float" style={{ animationDelay: '-1.8s' }} />

          <div className="relative z-10">
            <div className="mb-5">
              <div className="panel-live-pill mb-3 w-fit">
                <ShieldCheck className="h-3.5 w-3.5 text-oguri-lavender" />
                Control global
              </div>
              <h3 className="text-xl font-black tracking-tight text-white">Poder de respuesta</h3>
              <p className="mt-2 text-sm font-medium text-gray-400">
                Activa o pausa la respuesta global del bot y vigila el consumo base del sistema desde el mismo panel.
              </p>
            </div>

            <div className="panel-scan-frame panel-neon-grid flex flex-col items-center justify-center px-5 py-8 text-center">
              <div className="relative mb-5 flex h-32 w-32 items-center justify-center">
                {isOn && <span className="absolute inset-0 rounded-full border border-emerald-400/25 animate-signal-wave" />}
                {isOn && (
                  <span
                    className="absolute inset-3 rounded-full border border-oguri-cyan/20 animate-signal-wave"
                    style={{ animationDelay: '0.7s' }}
                  />
                )}
                <motion.div
                  animate={isOn ? { scale: [1, 1.08, 1], rotate: [0, 4, 0] } : { scale: 1, rotate: 0 }}
                  transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
                  className={cn(
                    'relative flex h-24 w-24 items-center justify-center rounded-full border shadow-glow-oguri-cosmic',
                    isOn
                      ? 'border-emerald-400/30 bg-gradient-to-br from-emerald-400 via-oguri-cyan to-oguri-blue'
                      : 'border-rose-400/25 bg-gradient-to-br from-rose-500 via-rose-600 to-oguri-purple'
                  )}
                >
                  {isOn ? <CheckCircle className="h-12 w-12 text-white" /> : <AlertCircle className="h-12 w-12 text-white" />}
                </motion.div>
              </div>

              <p className="text-2xl font-black text-white">Bot {isOn ? 'Activo' : 'Inactivo'}</p>
              <p className="mt-2 max-w-xs text-sm text-gray-400">
                {isOn
                  ? 'El bot está respondiendo a todos los grupos habilitados con el mismo pulso visual del panel.'
                  : 'El bot permanecerá visible en el sistema pero no responderá a ningún mensaje.'}
              </p>

              {canControl ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGlobalToggle}
                  className={cn(
                    'relative mt-5 h-10 w-20 overflow-hidden rounded-full border transition-all duration-300',
                    isOn
                      ? 'border-emerald-300/40 bg-emerald-500/20 shadow-glow-emerald'
                      : 'border-white/10 bg-white/[0.06]'
                  )}
                >
                  <span className={cn('absolute inset-1 rounded-full', isOn ? 'bg-gradient-to-r from-emerald-400/60 to-cyan-400/40' : 'bg-white/[0.06]')} />
                  <motion.span
                    animate={{ x: isOn ? 40 : 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    className="absolute left-1 top-1 h-8 w-8 rounded-full bg-white shadow-[0_8px_18px_rgba(255,255,255,0.22)]"
                  />
                </motion.button>
              ) : (
                <p className="mt-4 text-xs text-gray-500 [html[data-theme=light]_&]:text-gray-600">Control global solo para admins y owner.</p>
              )}
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-oguri-blue/20 bg-oguri-blue/10 p-2 text-oguri-blue">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">Memoria</p>
                    <p className="text-sm text-gray-400">Uso actual del sistema</p>
                  </div>
                </div>
                <p className="text-lg font-black text-white">
                  <AnimatedNumber value={memoryUsage?.systemPercentage || 0} decimals={1} />%
                </p>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-oguri-cyan/20 bg-oguri-cyan/10 p-2 text-oguri-cyan">
                    <Gauge className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">CPU</p>
                    <p className="text-sm text-gray-400">Carga de procesamiento</p>
                  </div>
                </div>
                <p className="text-lg font-black text-white">
                  <AnimatedNumber value={Number(cpuUsage) || 0} />%
                </p>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-oguri-lavender/20 bg-oguri-lavender/10 p-2 text-oguri-lavender">
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">Disco</p>
                    <p className="text-sm text-gray-400">Capacidad consumida</p>
                  </div>
                </div>
                <p className="text-lg font-black text-white">
                  <AnimatedNumber value={diskUsage?.percentage || 0} decimals={1} />%
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {!connected && canControl && (
        <Card animated delay={0.26} className="overflow-hidden p-6 sm:p-7 shadow-glow-oguri-cosmic">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-oguri-spectrum bg-[length:220%_100%] animate-prism-pan opacity-90" />
          <div className="pointer-events-none absolute right-0 top-10 h-40 w-40 rounded-full bg-oguri-purple/16 blur-3xl animate-orbital-float" style={{ animationDelay: '-3.2s' }} />

          <div className="relative z-10">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="panel-live-pill mb-3 w-fit">
                  <ScanLine className="h-3.5 w-3.5 text-oguri-cyan" />
                  Vinculación dinámica
                </div>
                <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">Método de Conexión</h3>
                <p className="mt-2 max-w-2xl text-sm font-medium text-gray-400">
                  Elige el flujo que mejor te sirva. El panel ahora resalta el QR, el código numérico y el progreso de autenticación con más feedback visual.
                </p>
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white">
                {authMethod === 'qr' ? 'QR dinámico' : 'Código 8 dígitos'}
              </div>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <button
                onClick={() => setAuthMethod('qr')}
                className={cn(
                  'group relative overflow-hidden rounded-[26px] border p-5 text-left transition-all duration-300',
                  authMethod === 'qr'
                    ? 'border-oguri-cyan/30 bg-gradient-oguri-signal bg-[length:220%_100%] text-white shadow-glow-oguri-cyan animate-prism-pan'
                    : 'border-white/10 bg-white/[0.04] text-gray-300 hover:border-white/20 hover:bg-white/[0.08]'
                )}
              >
                <div className="relative flex items-start gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                    <QrCode className={cn('h-6 w-6', authMethod === 'qr' ? 'text-white' : 'text-oguri-cyan')} />
                  </div>
                  <div>
                    <p className="text-base font-black">Código QR</p>
                    <p className={cn('mt-1 text-sm', authMethod === 'qr' ? 'text-white/80' : 'text-gray-400')}>
                      Escanea con WhatsApp y recibe el QR directamente en el panel con glow y refresco visual.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setAuthMethod('pairing')}
                className={cn(
                  'group relative overflow-hidden rounded-[26px] border p-5 text-left transition-all duration-300',
                  authMethod === 'pairing'
                    ? 'border-oguri-lavender/30 bg-gradient-oguri-spectrum bg-[length:220%_100%] text-white shadow-glow-oguri-mixed animate-prism-pan'
                    : 'border-white/10 bg-white/[0.04] text-gray-300 hover:border-white/20 hover:bg-white/[0.08]'
                )}
              >
                <div className="relative flex items-start gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                    <Smartphone className={cn('h-6 w-6', authMethod === 'pairing' ? 'text-white' : 'text-oguri-lavender')} />
                  </div>
                  <div>
                    <p className="text-base font-black">Código de 8 dígitos</p>
                    <p className={cn('mt-1 text-sm', authMethod === 'pairing' ? 'text-white/80' : 'text-gray-400')}>
                      Vincula el dispositivo con tu número de teléfono y genera un código temporal listo para ingresar.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {authMethod === 'qr' && (
                <motion.div
                  key="qr"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
                >
                  <div className="panel-scan-frame panel-neon-grid flex min-h-[360px] items-center justify-center p-6">
                    <div className="pointer-events-none absolute inset-x-5 top-0 h-24 bg-gradient-to-b from-oguri-cyan/16 via-oguri-purple/10 to-transparent opacity-80 animate-scanline" />

                    {qrImage ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative rounded-[32px] bg-white p-4 shadow-[0_0_60px_rgba(127,180,255,0.18)]"
                      >
                        <div className="absolute -inset-4 rounded-[36px] bg-gradient-oguri-spectrum opacity-20 blur-2xl" />
                        <img src={qrImage} alt="QR Code" className="relative h-64 w-64 rounded-2xl" decoding="async" />
                      </motion.div>
                    ) : (
                      <div className="relative flex h-72 w-full max-w-[320px] items-center justify-center rounded-[30px] border border-dashed border-white/15 bg-black/10 px-6">
                        {connecting ? (
                          <div className="text-center">
                            <Loader2 className="mx-auto h-12 w-12 animate-spin text-oguri-cyan" />
                            <p className="mt-4 text-sm font-semibold text-gray-300">Preparando QR en vivo...</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <QrCode className="mx-auto mb-3 h-12 w-12 text-oguri-cyan animate-oguri-aura" />
                            <p className="text-sm font-semibold text-gray-300">Pulsa en &quot;Generar QR&quot; para iniciar la autenticación visual.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-center">
                    <div className="panel-live-pill mb-4 w-fit">
                      <QrCode className="h-3.5 w-3.5 text-oguri-cyan" />
                      Escaneo seguro
                    </div>
                    <h4 className="text-2xl font-black tracking-tight text-white">Genera un QR con seguimiento en vivo</h4>
                    <p className="mt-3 text-sm font-medium text-gray-400">
                      El código aparece con más contraste, glow y una capa de escaneo para que el estado de autenticación se sienta claro y rápido.
                    </p>

                    <div className="mt-5 grid gap-3">
                      {[
                        'Abre WhatsApp en tu teléfono.',
                        'Entra a Dispositivos vinculados.',
                        'Escanea el QR cuando aparezca en el panel.',
                      ].map((step, index) => (
                        <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-oguri-spectrum text-sm font-black text-white">
                            {index + 1}
                          </div>
                          <p className="text-sm font-medium text-gray-300">{step}</p>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="glow"
                      navFx
                      className="mt-6 w-full shadow-glow-oguri-cosmic sm:w-auto"
                      icon={<QrCode className="w-4 h-4" />}
                      onClick={handleConnect}
                      loading={isConnecting}
                    >
                      Generar QR
                    </Button>
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
                      El QR puede renovarse automáticamente si expira.
                    </p>
                  </div>
                </motion.div>
              )}

              {authMethod === 'pairing' && (
                <motion.div
                  key="pairing"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start"
                >
                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Número de teléfono con código de país</label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="Ej: 521234567890"
                        className="input-glass w-full"
                      />
                      <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
                        Usa solo números, sin espacios ni símbolos.
                      </p>
                    </div>

                    <Button
                      variant="glow"
                      navFx
                      className="w-full shadow-glow-oguri-cosmic"
                      icon={<Smartphone className="w-4 h-4" />}
                      onClick={handleConnect}
                      loading={isConnecting}
                    >
                      Generar Código
                    </Button>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-gray-300">
                      Abre WhatsApp, ve a Dispositivos vinculados y elige la opción para vincular con número de teléfono.
                    </div>
                  </div>

                  <div className="panel-scan-frame panel-neon-grid flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
                    <div className="pointer-events-none absolute inset-x-5 top-0 h-20 bg-gradient-to-b from-oguri-lavender/16 via-oguri-blue/10 to-transparent opacity-80 animate-scanline" />

                    {pairingCode ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative w-full max-w-md overflow-hidden rounded-[30px] bg-gradient-oguri-spectrum bg-[length:220%_100%] p-[1px] shadow-glow-oguri-cosmic animate-prism-pan"
                      >
                        <div className="rounded-[28px] bg-[#0b1120]/90 px-6 py-8">
                          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-oguri-cyan shadow-glow-oguri-cyan">
                            <Smartphone className="h-7 w-7" />
                          </div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">Tu código de emparejamiento</p>
                          <p className="mt-4 text-4xl font-black tracking-[0.35em] text-white sm:text-5xl">{pairingCode}</p>
                          <p className="mt-4 text-sm text-gray-400">Ingresa este código en WhatsApp para terminar de vincular el dispositivo.</p>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="max-w-md">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-oguri-lavender shadow-glow-oguri-lavender animate-oguri-aura">
                          <ScanLine className="h-7 w-7" />
                        </div>
                        <h4 className="text-2xl font-black tracking-tight text-white">Genera un código listo para copiar</h4>
                        <p className="mt-3 text-sm font-medium text-gray-400">
                          Ideal si prefieres autenticar el bot desde el número de teléfono sin depender del escaneo visual.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      )}

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" delay={0.02} stagger={0.07}>
        {statCards.map((item) => (
          <StaggerItem key={item.title} whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <StatCard
              title={item.title}
              value={item.value}
              subtitle={item.subtitle}
              icon={item.icon}
              color={item.color}
              delay={0}
              animated={false}
              active={item.active}
            />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
