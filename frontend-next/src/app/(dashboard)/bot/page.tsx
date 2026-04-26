'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Wifi, WifiOff, RefreshCw, Power, PowerOff, QrCode, Smartphone,
  Clock, Activity, AlertCircle, CheckCircle, Radio, Sparkles, ShieldCheck,
  Zap, Gauge, HardDrive, ScanLine, Loader2, Activity as ActivityIcon, Key
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ProgressRing } from '@/components/ui/Charts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { Reveal } from '@/components/motion/Reveal';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
import { Badge } from '@/components/ui/Badge';
import { useBotStatus, useBotGlobalState, useSystemStats } from '@/hooks/useRealTime';
import { useSocketBotStatus, useSocketConnection } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLoadingOverlay } from '@/contexts/LoadingOverlayContext';
import { cn, formatDateTime, formatUptime } from '@/lib/utils';
import api from '@/services/api';
import QRCode from 'qrcode';
import { notify } from '@/lib/notify';

export default function BotStatusPage() {
  const [authMethod, setAuthMethod] = useState<'qr' | 'pairing'>('qr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const pairingPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status, isConnected, isConnecting: botConnecting, refetch } = useBotStatus();
  const { isOn, setGlobalState } = useBotGlobalState();
  const { memoryUsage, cpuUsage, diskUsage, uptime } = useSystemStats();
  const { isConnected: isSocketConnected } = useSocketConnection();
  const socketBotStatus = useSocketBotStatus();
  const { user } = useAuth();
  const { withLoading } = useLoadingOverlay();

  const connected = socketBotStatus?.connected ?? isConnected;
  const connecting = socketBotStatus?.connecting ?? botConnecting ?? isConnecting;
  const canControl = !!user && ['owner', 'admin', 'administrador'].includes(String(user.rol || '').toLowerCase());
  const currentPhone = socketBotStatus?.phone ?? status?.phone ?? null;
  const currentUptime = socketBotStatus?.uptime ?? status?.uptime ?? formatUptime(uptime);
  
  const connectionLabel = connected ? 'Conectado' : connecting ? 'Conectando' : 'Desconectado';
  const connectionSummary = connected
    ? 'La sesión principal está activa y respondiendo comandos.'
    : connecting
      ? 'El núcleo está sincronizando la autenticación. Espera un momento...'
      : 'El motor principal está inactivo. Inicia sesión para habilitar el bot.';

  useEffect(() => {
    const qr = socketBotStatus?.qrCode || status?.qrCode;
    if (qr && !connected) {
      QRCode.toDataURL(qr, { width: 256, margin: 2 }).then(setQrImage).catch(console.error);
    } else if (connected) {
      setQrImage(null);
    }
  }, [socketBotStatus?.qrCode, status?.qrCode, connected]);

  useEffect(() => {
    if (authMethod === 'pairing') {
      const handlePairingCode = (data: { pairingCode: string }) => {
        setPairingCode(data.pairingCode);
        setIsConnecting(false);
      };
      const socket = (window as any).socket;
      if (socket) {
        socket.on('bot:pairingCode', handlePairingCode);
        return () => socket.off('bot:pairingCode', handlePairingCode);
      }
    }
  }, [authMethod]);

  useEffect(() => {
    if (socketBotStatus?.pairingCode) {
      setPairingCode(socketBotStatus.pairingCode);
    }
  }, [socketBotStatus?.pairingCode]);

  const handleConnect = async () => {
    if (!canControl) return notify.error('Permisos insuficientes');
    setIsConnecting(true);
    try {
      const sanitizedPhone = phoneNumber.replace(/\D/g, '');
      await api.setMainBotMethod(authMethod, authMethod === 'pairing' ? sanitizedPhone : undefined);
      await api.connectMainBot(authMethod, authMethod === 'pairing' ? sanitizedPhone : undefined);
      notify.info(`Iniciando conexión vía ${authMethod.toUpperCase()}...`);
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      notify.error(error?.response?.data?.error || 'Error al conectar');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!canControl) return notify.error('Permisos insuficientes');
    try {
      await withLoading(() => api.disconnectMainBot(), { message: 'Desconectando bot...' });
      notify.success('Bot desconectado');
      refetch();
    } catch (error) {
      notify.error('Error al desconectar');
    }
  };

  const operationLanes = [
    {
      label: 'Sesión Principal',
      value: currentPhone || 'Sin Vincular',
      description: connected ? 'Línea activa con respuesta inmediata.' : 'Pendiente de vinculación activa.',
      icon: <Smartphone className="h-4 w-4" />,
      badge: connected ? 'live' : connecting ? 'sync' : 'idle',
      glowClassName: 'from-emerald-400/20 via-transparent to-transparent',
    },
    {
      label: 'Carga del Host',
      value: `CPU ${Number(cpuUsage || 0).toFixed(0)}%`,
      description: `MEM ${Number(memoryUsage?.systemPercentage || 0).toFixed(0)}% | DISK ${Number(diskUsage?.percentage || 0).toFixed(0)}%`,
      icon: <Gauge className="h-4 w-4" />,
      badge: Number(cpuUsage || 0) > 80 ? 'HIGH' : 'STABLE',
      glowClassName: 'from-oguri-cyan/20 via-transparent to-transparent',
    },
    {
      label: 'Uptime Sistema',
      value: currentUptime,
      description: 'Tiempo total de actividad del motor principal.',
      icon: <Clock className="h-4 w-4" />,
      badge: 'TIME',
      glowClassName: 'from-oguri-lavender/20 via-transparent to-transparent',
    },
    {
      label: 'Control Global',
      value: isOn ? 'Habilitado' : 'Silenciado',
      description: 'Estado de respuesta en todos los grupos vinculados.',
      icon: <ShieldCheck className="h-4 w-4" />,
      badge: isOn ? 'ON' : 'OFF',
      glowClassName: isOn ? 'from-emerald-400/20 via-transparent to-transparent' : 'from-rose-400/20 via-transparent to-transparent',
    },
  ];

  return (
    <div className="relative space-y-8 p-4 sm:p-8 lg:p-10 min-h-screen overflow-hidden">
      {/* Premium Ambient Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(var(--page-a),0.05),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(var(--page-b),0.05),transparent_40%)]" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 space-y-10">
        <PageHeader 
          title="Bot Core Engine"
          description="Monitoreo y control del motor principal de OguriCap."
          icon={<Bot className="h-6 w-6 text-primary" />}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <RealTimeBadge isActive={isSocketConnected} />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <StatusIndicator status={connecting ? 'connecting' : connected ? 'online' : 'offline'} size="sm" />
                {connectionLabel}
              </div>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-4 mt-4">
             {canControl && connected && (
               <Button size="sm" variant="danger" onClick={handleDisconnect} icon={<PowerOff className="h-4 w-4" />}>
                 Cerrar Sesión
               </Button>
             )}
             {canControl && !connected && !connecting && (
               <Button size="sm" variant="glow" onClick={handleConnect} loading={isConnecting} icon={<Power className="h-4 w-4" />}>
                 Iniciar Núcleo
               </Button>
             )}
          </div>
        </PageHeader>

        <Stagger className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {operationLanes.map((lane, index) => (
            <StaggerItem key={lane.label}>
              <div className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-card/40 p-5 backdrop-blur-xl transition-all duration-300 hover:bg-card/60">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-5 transition-opacity group-hover:opacity-10 ${lane.glowClassName}`} />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-glow-sm">
                      {lane.icon}
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black tracking-widest uppercase">
                      {lane.badge}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{lane.label}</p>
                    <p className="mt-1 text-xl font-black text-foreground">{lane.value}</p>
                    <p className="mt-2 text-xs font-medium text-muted-foreground leading-relaxed">{lane.description}</p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Status Visualizer */}
          <Card className="lg:col-span-8 p-6 sm:p-8 relative overflow-hidden" glow>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
              <div className="relative h-64 w-64 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-primary/10 animate-[spin_20s_linear_infinite]" />
                <div className="absolute inset-4 rounded-full border border-primary/20 animate-[spin_15s_linear_infinite_reverse]" />
                <ProgressRing 
                  progress={connected ? 100 : connecting ? 65 : 15}
                  size={220}
                  strokeWidth={14}
                  glow={connected}
                  color={connected ? "rgb(var(--success))" : connecting ? "rgb(var(--warning))" : "rgb(var(--primary))"}
                >
                  <div className="text-center">
                    <AnimatedNumber value={connected ? 100 : connecting ? 65 : 0} className="text-4xl font-black text-foreground" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">SINC</p>
                  </div>
                </ProgressRing>
              </div>

              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Núcleo de Operación</h3>
                  <p className="text-muted-foreground mt-2 leading-relaxed">{connectionSummary}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ID Sesión</p>
                      <p className="text-sm font-bold text-foreground truncate">{currentPhone || 'Desvinculado'}</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Método Activo</p>
                      <p className="text-sm font-bold text-foreground uppercase">{authMethod} Session</p>
                   </div>
                </div>

                {!connected && (
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-primary/10 border border-primary/20">
                    <ScanLine className="h-5 w-5 text-primary animate-pulse" />
                    <p className="text-xs font-medium text-primary-foreground/80">
                      Listo para iniciar vinculación. Elige un método y presiona &quot;Iniciar Núcleo&quot;.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* System Control Card */}
          <Card className="lg:col-span-4 p-6 sm:p-8 space-y-8">
            <div>
               <div className="panel-live-pill mb-3">
                 <ActivityIcon className="h-3.5 w-3.5 text-primary" />
                 Estado Global
               </div>
               <h3 className="text-xl font-black text-foreground">Interruptor Maestro</h3>
            </div>

            <div className="flex flex-col items-center justify-center py-6 text-center">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => canControl && setGlobalState(!isOn)}
                className={cn(
                  "relative h-24 w-24 rounded-full border-4 flex items-center justify-center transition-all duration-500",
                  isOn 
                    ? "border-emerald-500/30 bg-emerald-500/10 shadow-glow-emerald" 
                    : "border-rose-500/30 bg-rose-500/10 shadow-glow-danger"
                )}
              >
                <Power className={cn("h-10 w-10 transition-colors duration-500", isOn ? "text-emerald-400" : "text-rose-400")} />
              </motion.button>
              <div className="mt-4">
                <Badge variant={isOn ? 'success' : 'danger'} className="text-[10px] font-black uppercase tracking-widest">
                  {isOn ? 'RESPONDIENDO' : 'SILENCIADO'}
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-xs font-bold text-muted-foreground">CPU</span>
                <span className="text-xs font-black text-foreground">{Number(cpuUsage || 0).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-xs font-bold text-muted-foreground">MEM</span>
                <span className="text-xs font-black text-foreground">{Number(memoryUsage?.systemPercentage || 0).toFixed(1)}%</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Authentication Flow Card */}
        {!connected && (
          <Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <Card 
                 className={cn(
                   "p-6 cursor-pointer border-2 transition-all duration-300",
                   authMethod === 'qr' ? "border-primary bg-primary/5" : "border-white/10"
                 )}
                 onClick={() => setAuthMethod('qr')}
               >
                 <div className="flex gap-4">
                   <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                     <QrCode className="h-6 w-6 text-primary" />
                   </div>
                   <div>
                     <h4 className="font-black text-foreground">Vincular con QR</h4>
                     <p className="text-xs text-muted-foreground mt-1">Escanea el código directamente desde WhatsApp.</p>
                   </div>
                 </div>
               </Card>

               <Card 
                 className={cn(
                   "p-6 cursor-pointer border-2 transition-all duration-300",
                   authMethod === 'pairing' ? "border-primary bg-primary/5" : "border-white/10"
                 )}
                 onClick={() => setAuthMethod('pairing')}
               >
                 <div className="flex gap-4">
                   <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                     <Smartphone className="h-6 w-6 text-primary" />
                   </div>
                   <div>
                     <h4 className="font-black text-foreground">Vincular con Código</h4>
                     <p className="text-xs text-muted-foreground mt-1">Recibe un código de 8 dígitos para ingresar en WhatsApp.</p>
                   </div>
                 </div>
               </Card>
            </div>

            {(qrImage || connecting || (authMethod === 'pairing')) && (
              <Card className="mt-8 p-10 text-center flex flex-col items-center gap-8 shadow-glow-primary">
                 {authMethod === 'qr' ? (
                   <div className="space-y-6">
                     <h3 className="text-2xl font-black text-foreground">Escanea para Conectar</h3>
                     <div className="p-4 rounded-[32px] bg-white shadow-glow-white inline-block">
                        {qrImage ? (
                          <img src={qrImage} alt="QR" className="h-64 w-64" />
                        ) : (
                          <div className="h-64 w-64 flex items-center justify-center text-black">
                            <Loader2 className="h-10 w-10 animate-spin" />
                          </div>
                        )}
                     </div>
                   </div>
                 ) : authMethod === 'pairing' && !pairingCode ? (
                    <div className="space-y-6 w-full">
                      <h3 className="text-2xl font-black text-foreground">Ingresa tu Número</h3>
                      <div className="relative">
                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="54911XXXXXXXX"
                          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-background/80 border-2 border-border/20 text-xl font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:border-opacity-50 transition-all"
                        />
                      </div>
                      <Button
                        onClick={handleConnect}
                        disabled={!phoneNumber || isConnecting}
                        className="w-full h-14 text-lg font-bold"
                        size="lg"
                      >
                        {isConnecting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Key className="h-5 w-5 mr-2" />}
                        {isConnecting ? 'Generando...' : 'Generar Código'}
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Ejemplo: 54911XXXXXXXX (incluye código de país)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6 w-full">
                       <h3 className="text-2xl font-black text-foreground">Código de Vinculación</h3>
                       <div className="flex justify-center">
                         <div className="p-8 rounded-[32px] bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 shadow-glow-primary">
                            <span className="text-5xl font-black font-mono tracking-[0.15em] text-primary">
                              {pairingCode || '--------'}
                            </span>
                         </div>
                       </div>
                       <div className="flex flex-col items-center gap-4">
                         <div className="flex items-center justify-center gap-2 text-muted-foreground">
                           <AlertCircle className="h-4 w-4" />
                           <span className="text-sm">Ingresa este código en WhatsApp &gt; Vincular dispositivo</span>
                         </div>
                         <Button 
                           variant="outline" 
                           onClick={() => { setPairingCode(null); setPhoneNumber(''); }} 
                           size="sm"
                         >
                           Cambiar Número / Regenerar
                         </Button>
                       </div>
                     </div>
                  )}
                 <p className="text-sm text-muted-foreground max-w-md">
                    Mantén esta ventana abierta. La sesión se activará automáticamente al detectar la vinculación.
                 </p>
              </Card>
            )}
          </Reveal>
        )}
      </div>
    </div>
  );
}
