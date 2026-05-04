'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  HardDrive, 
  Wifi, 
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Download,
  RefreshCw,
  Zap,
  Database,
  Minus,
  Utensils,
  Beef,
  Flame,
  Gauge
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Progress } from '@/components/ui/Progress';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from '@/components/ui/Card';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useOguriTheme } from '@/contexts/OguriThemeContext';
import { cn, formatUptime , getErrorMessage } from '@/lib/utils';
import api from '@/services/api';
import { notify } from '@/lib/notif';

interface ResourceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    cores: number;
    model: string;
    speed: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usage: number;
    process: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
  };
  disk: {
    usage: number;
    total: string;
    used: string;
    available: string;
    filesystem: string;
  };
  network: {
    interfaces: Array<{
      name: string;
      address: string;
      family: string;
      mac: string;
    }>;
    hostname: string;
  };
  process: {
    uptime: number;
    pid: number;
    version: string;
    platform: string;
    arch: string;
    cwd: string;
    startTime: number;
    restarts: number;
    errors: number;
    connections: number;
  };
  bot: {
    connection: {
      status: string;
      phoneNumber: string | null;
      qrStatus: string | null;
    };
    database: {
      users: number;
      groups: number;
      chats: number;
    };
    subbots: {
      total: number;
      connected: number;
    };
  };
  system: {
    uptime: number;
    loadavg: number[];
    platform: string;
    arch: string;
    hostname: string;
  };
}

interface AlertStates {
  cpu: string;
  memory: string;
  disk: string;
  temperature: string;
}

interface Thresholds {
  cpu: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  disk: { warning: number; critical: number };
  temperature: { warning: number; critical: number };
}

export default function RecursosPage() {
  const [metrics, setMetrics] = useState<ResourceMetrics | null>(null);
  const [alertStates, setAlertStates] = useState<AlertStates | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [updateInterval, setUpdateInterval] = useState(5000);

  const { socket, isConnected: isSocketConnected } = useSocketConnection();
  const { isInZone } = useOguriTheme();

  // Wrap loaders in useCallback to fix dependency warning
  const loadResourceStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const stats = await api.getResourcesStats();
      const current = (stats as any)?.current || null;

      if (current) {
        setMetrics(current);
        setAlertStates((stats as any)?.alerts || null);
        setThresholds((stats as any)?.thresholds || null);
        setIsMonitoring(Boolean((stats as any)?.isMonitoring));
        setUpdateInterval(Number((stats as any)?.updateInterval) || 5000);
        return;
      }
    } catch (error) {
      console.error('Error loading resource stats:', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadHistoricalData = useCallback(async () => {
    try {
      const historyRes = await api.getResourcesHistory(60).catch(() => ({ history: [] }));
      const historyRaw = (historyRes as any)?.history;
      setHistoricalData(Array.isArray(historyRaw) ? historyRaw : []);
    } catch (error) {
      console.error('Error loading historical data:', getErrorMessage(error));
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadResourceStats();
    loadHistoricalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch when socket connects
  useEffect(() => {
    if (isSocketConnected) {
      loadResourceStats();
    }
  }, [isSocketConnected, loadResourceStats]);

  // Also refetch on window focus
  useEffect(() => {
    const onFocus = () => loadResourceStats();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadResourceStats]);

  // Sin intervalo - solo live via socket

  useEffect(() => {
    if (!socket) return;

    const handleMetricsUpdate = (data: ResourceMetrics) => {
      setMetrics(data);
      setHistoricalData(prev => {
        const newData = [...prev, {
          timestamp: data.timestamp,
          cpu: data.cpu.usage,
          memory: data.memory.usage,
          disk: data.disk.usage
        }].slice(-60);
        return newData;
      });
    };

    const handleAlertStateChanged = (data: any) => {
      notify.warning(`Alerta: ${data.resource} en estado ${data.newState}`, {
        dedupeKey: `resource-alert-${data.resource}-${data.newState}`,
      });
      loadResourceStats();
    };

    socket.on('resource:metrics', handleMetricsUpdate);
    socket.on('resource:alert', handleAlertStateChanged);

    return () => {
      socket.off('resource:metrics', handleMetricsUpdate);
      socket.off('resource:alert', handleAlertStateChanged);
    };
  }, [socket, loadResourceStats]);

  const toggleMonitoring = async () => {
    try {
      if (isMonitoring) {
        await api.stopResourcesMonitoring();
        notify.success('Monitoreo detenido');
      } else {
        await api.startResourcesMonitoring(updateInterval);
        notify.success('Monitoreo iniciado');
      }
      await loadResourceStats();
    } catch (error) {
      notify.error('Error al cambiar estado del monitoreo');
    }
  };

  const updateThresholds = async (newThresholds: Partial<Thresholds>) => {
    try {
      await api.updateResourcesThresholds(newThresholds);
      notify.success('Umbrales actualizados');
      await loadResourceStats();
    } catch (error) {
      notify.error('Error actualizando umbrales');
    }
  };

  const exportMetrics = async (format: string) => {
    try {
      const data = {
        timestamp: Date.now(),
        metrics,
        historicalData,
        alertStates,
        thresholds
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resource-metrics-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      notify.success('Métricas exportadas');
    } catch (error) {
      notify.error('Error exportando métricas');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getAlertColor = (state: string) => {
    switch (state) {
      case 'critical': return 'text-danger bg-danger/20';
      case 'warning': return 'text-warning bg-warning/20';
      case 'normal': return 'text-success bg-success/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getAlertIcon = (state: string) => {
    switch (state) {
      case 'critical': return <XCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'normal': return <CheckCircle className="w-4 h-4" />;
      default: return <Minus className="w-4 h-4" />;
    }
  };

  const getUsageColor = (usage: number, thresholds: any) => {
    if (usage >= thresholds?.critical) return 'bg-danger';
    if (usage >= thresholds?.warning) return 'bg-warning';
    return 'bg-success';
  };

  const resourceLanes = metrics
    ? [
        {
          label: 'Monitoreo',
          value: isMonitoring ? 'Activo y grabando' : 'Detenido',
          description: isMonitoring ? 'Recibe eventos en tiempo real del sistema.' : 'Puedes iniciarlo para vigilar CPU, RAM y disco en vivo.',
          icon: <Activity className="w-4 h-4" />,
          badge: isMonitoring ? 'live' : 'idle',
          badgeClassName: isMonitoring ? 'border-[rgb(var(--success))]/20 bg-[rgb(var(--success))]/10 text-[#c7f9d8]' : 'border-danger/20 bg-danger/10 text-danger/80',
          glowClassName: 'from-[rgb(var(--success))]/18 via-oguri-cyan/10 to-transparent',
        },
        {
          label: 'Presion del host',
          value: `CPU ${metrics.cpu.usage.toFixed(0)}%`,
          description: `RAM ${metrics.memory.usage.toFixed(0)}% · Disco ${metrics.disk.usage.toFixed(0)}%`,
          icon: <Gauge className="w-4 h-4" />,
          badge: alertStates?.cpu === 'critical' || alertStates?.memory === 'critical' || alertStates?.disk === 'critical' ? 'alto' : 'estable',
          badgeClassName:
            alertStates?.cpu === 'critical' || alertStates?.memory === 'critical' || alertStates?.disk === 'critical'
              ? 'border-danger/20 bg-danger/10 text-danger/80'
              : 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan',
          glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
        },
        {
          label: 'Motor del bot',
          value: String(metrics.bot.connection.status || 'offline').toUpperCase(),
          description: `${metrics.bot.subbots.connected}/${metrics.bot.subbots.total} subbots y ${metrics.bot.database.groups} grupos registrados.`,
          icon: <Zap className="w-4 h-4" />,
          badge: metrics.bot.connection.status === 'connected' ? 'online' : 'offline',
          badgeClassName: metrics.bot.connection.status === 'connected' ? 'border-accent/20 bg-accent/10 text-accent' : 'border-warning/20 bg-warning/10 text-warning/80',
          glowClassName: 'from-violet-400/18 via-oguri-lavender/10 to-transparent',
        },
        {
          label: 'Canal del panel',
          value: isSocketConnected ? 'Tiempo real' : 'Fallback',
          description: `Host ${metrics.network.hostname} · Node ${metrics.process.version}`,
          icon: <Wifi className="w-4 h-4" />,
          badge: isSocketConnected ? 'socket' : 'local',
          badgeClassName: isSocketConnected ? 'border-success/20 bg-success/10 text-success/80' : 'border-white/10 bg-white/[0.05] text-white/70',
          glowClassName: 'from-emerald-400/18 via-oguri-cyan/10 to-transparent',
        },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="panel-empty-state min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-[rgb(var(--text-secondary))]">Cargando recursos del sistema...</p>
      </div>
    );
  }

  return (
    <div className={cn("panel-page relative overflow-hidden transition-all duration-500", isInZone && "is-in-zone")}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[440px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-oguri-gold/18 blur-3xl"
          animate={{ x: [0, 18, 0], y: [0, 14, 0], opacity: [0.18, 0.38, 0.18] }}
          transition={{ repeat: Infinity, duration: 11.2, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-cyan/18 blur-3xl"
          animate={{ x: [0, -18, 0], y: [0, 18, 0], opacity: [0.18, 0.4, 0.18] }}
          transition={{ repeat: Infinity, duration: 10.6, ease: 'easeInOut', delay: 0.6 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(45,212,191,0.12),rgba(59,130,246,0.10))] p-5 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6"
      >
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit">
              <Utensils className="h-3.5 w-3.5 text-oguri-gold" />
              Paddock energetico
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Recursos con lectura viva del host</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              CPU, memoria, disco y estado del bot en una cabina visual que deja claro cuando el sistema esta estable y cuando pide atencion.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Monitoreo</p>
              <p className="mt-2 text-lg font-black text-white">{isMonitoring ? 'ACTIVO' : 'PAUSADO'}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Canal</p>
              <p className="mt-2 text-lg font-black text-white">{isSocketConnected ? 'LIVE' : 'LOCAL'}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Tiempo Real</p>
              <p className="mt-2 text-lg font-black text-white">{isSocketConnected ? 'SOCKET' : 'MANUAL'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <PageHeader
        title="Paddock de Alimentación"
        description="Estado de energía y recursos de Oguri Cap"
        icon={<Utensils className="w-5 h-5 text-oguri-gold" />}
        actions={
          <>
            <Button onClick={() => setShowSettings(!showSettings)} variant="secondary" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configurar
            </Button>
            <Button onClick={() => exportMetrics('json')} variant="secondary" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </Button>
            <Button onClick={toggleMonitoring} variant={isMonitoring ? "danger" : "primary"} className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {isMonitoring ? 'Detener' : 'Iniciar'}
            </Button>
          </>
        }
      />

      {metrics && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {resourceLanes.map((lane, index) => (
            <motion.div
              key={lane.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 + index * 0.05, duration: 0.3 }}
              className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#101512]/86 p-4 shadow-[0_22px_70px_-36px_rgba(0,0,0,0.4)]"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${lane.glowClassName}`} />
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
                    {lane.icon}
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${lane.badgeClassName}`}>
                    {lane.badge}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">{lane.label}</p>
                  <p className="mt-1 text-base font-black text-white">{lane.value}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">{lane.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Reveal>
        <div className="panel-setting-row">
          <div className="flex items-center gap-3">
            <motion.div
              className={cn('h-3 w-3 rounded-full', isMonitoring ? 'bg-success shadow-glow-oguri-cyan' : 'bg-danger')}
              animate={isMonitoring ? { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] } : { scale: 1, opacity: 1 }}
              transition={{ duration: 1.5, repeat: isMonitoring ? Infinity : 0 }}
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isMonitoring ? 'Monitoreo de recursos activo' : 'Monitoreo detenido'}
              </p>
              <p className="text-xs text-muted">{metrics ? `Sincronización: ${new Date(metrics.timestamp).toLocaleTimeString()}` : 'Sin datos'}</p>
            </div>
          </div>
          <div className="panel-actions-wrap sm:justify-end">
            <Badge variant={isMonitoring ? 'success' : 'danger'}>{isMonitoring ? 'Activo' : 'Detenido'}</Badge>
          </div>
        </div>
      </Reveal>

      {metrics && (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem>
            <StatCard
              title="CPU"
              value={metrics.cpu.usage}
              subtitle={String(alertStates?.cpu || 'normal').toUpperCase()}
              icon={<Flame className="h-6 w-6 text-oguri-lavender" />}
              color={alertStates?.cpu === 'critical' ? 'danger' : alertStates?.cpu === 'warning' ? 'warning' : 'primary'}
              trend={Math.round(metrics.cpu.usage - (historicalData[historicalData.length - 2]?.cpu || 0))}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Memoria"
              value={metrics.memory.usage}
              subtitle={`${formatBytes(metrics.memory.used)} usados`}
              icon={<Beef className="h-6 w-6 text-oguri-gold" />}
              color={alertStates?.memory === 'critical' ? 'danger' : alertStates?.memory === 'warning' ? 'warning' : 'success'}
              trend={Math.round(metrics.memory.usage - (historicalData[historicalData.length - 2]?.memory || 0))}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Disco"
              value={metrics.disk.usage}
              subtitle={`${metrics.disk.used} / ${metrics.disk.total}`}
              icon={<HardDrive className="h-6 w-6 text-oguri-cyan" />}
              color={alertStates?.disk === 'critical' ? 'danger' : alertStates?.disk === 'warning' ? 'warning' : 'info'}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Bot"
              value={String(metrics.bot.connection.status || 'offline').toUpperCase()}
              subtitle={`${metrics.bot.subbots.connected}/${metrics.bot.subbots.total} subbots`}
              icon={<Zap className="h-6 w-6 text-oguri-lavender" />}
              color={metrics.bot.connection.status === 'connected' ? 'success' : 'danger'}
            />
          </StaggerItem>
        </Stagger>
      )}

      {metrics && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <DashboardCard title="Carga del Sistema" description="Uso en tiempo real de CPU, memoria y disco." icon={<Gauge className="h-5 w-5" />} className="xl:col-span-2">
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">CPU</p>
                    <p className="text-xs text-muted">{metrics.cpu.model || 'Procesador principal'}</p>
                  </div>
                  <Badge className={getAlertColor(alertStates?.cpu || 'normal')}>{getAlertIcon(alertStates?.cpu || 'normal')} {String(alertStates?.cpu || 'normal')}</Badge>
                </div>
                <Progress value={metrics.cpu.usage} fillClassName={getUsageColor(metrics.cpu.usage, thresholds?.cpu)} />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Memoria</p>
                    <p className="text-xs text-muted">RSS: {formatBytes(metrics.memory.process.rss)}</p>
                  </div>
                  <Badge className={getAlertColor(alertStates?.memory || 'normal')}>{getAlertIcon(alertStates?.memory || 'normal')} {String(alertStates?.memory || 'normal')}</Badge>
                </div>
                <Progress value={metrics.memory.usage} fillClassName={getUsageColor(metrics.memory.usage, thresholds?.memory)} />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Disco</p>
                    <p className="text-xs text-muted">Disponible: {metrics.disk.available}</p>
                  </div>
                  <Badge className={getAlertColor(alertStates?.disk || 'normal')}>{getAlertIcon(alertStates?.disk || 'normal')} {String(alertStates?.disk || 'normal')}</Badge>
                </div>
                <Progress value={metrics.disk.usage} fillClassName={getUsageColor(metrics.disk.usage, thresholds?.disk)} />
              </div>
            </div>
          </DashboardCard>

          <DashboardCard title="Proceso" description="Información del runtime y del host actual." icon={<Server className="h-5 w-5" />}>
            <div className="space-y-3">
              <div className="panel-data-row"><span className="panel-data-row__label">Node</span><span className="panel-data-row__value">{metrics.process.version}</span></div>
              <div className="panel-data-row"><span className="panel-data-row__label">PID</span><span className="panel-data-row__value">{metrics.process.pid}</span></div>
              <div className="panel-data-row"><span className="panel-data-row__label">Uptime</span><span className="panel-data-row__value">{formatUptime(metrics.process.uptime)}</span></div>
              <div className="panel-data-row"><span className="panel-data-row__label">Restarts</span><span className="panel-data-row__value">{metrics.process.restarts}</span></div>
              <div className="panel-data-row"><span className="panel-data-row__label">Errores</span><span className="panel-data-row__value">{metrics.process.errors}</span></div>
            </div>
          </DashboardCard>

          <DashboardCard title="Bot y Base" description="Estado principal de conexión y datos persistidos." icon={<Database className="h-5 w-5" />} className="xl:col-span-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="panel-mini-tile"><p className="panel-mini-tile__label">Usuarios</p><p className="panel-mini-tile__value"><AnimatedNumber value={metrics.bot.database.users} /></p><p className="panel-mini-tile__meta">panel</p></div>
              <div className="panel-mini-tile"><p className="panel-mini-tile__label">Grupos</p><p className="panel-mini-tile__value"><AnimatedNumber value={metrics.bot.database.groups} /></p><p className="panel-mini-tile__meta">registrados</p></div>
              <div className="panel-mini-tile"><p className="panel-mini-tile__label">Chats</p><p className="panel-mini-tile__value"><AnimatedNumber value={metrics.bot.database.chats} /></p><p className="panel-mini-tile__meta">totales</p></div>
              <div className="panel-mini-tile"><p className="panel-mini-tile__label">Subbots</p><p className="panel-mini-tile__value">{metrics.bot.subbots.connected}/{metrics.bot.subbots.total}</p><p className="panel-mini-tile__meta">online</p></div>
            </div>
          </DashboardCard>

          <DashboardCard title="Red y Host" description="Identidad del host y conectividad base." icon={<Wifi className="h-5 w-5" />}>
            <div className="space-y-3">
              <div className="panel-data-row"><span className="panel-data-row__label">Hostname</span><span className="panel-data-row__value">{metrics.network.hostname}</span></div>
              <div className="panel-data-row"><span className="panel-data-row__label">Interfaces</span><span className="panel-data-row__value">{metrics.network.interfaces.length}</span></div>
              <div className="panel-data-row"><span className="panel-data-row__label">Plataforma</span><span className="panel-data-row__value">{metrics.system.platform} / {metrics.system.arch}</span></div>
              <div className="panel-data-row"><span className="panel-data-row__label">Bot</span><span className="panel-data-row__value">{metrics.bot.connection.phoneNumber || 'Sin número'}</span></div>
            </div>
          </DashboardCard>
        </div>
      )}

      <AnimatePresence>
        {showSettings && thresholds && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <Card>
              <CardHeader>
                <CardTitle>Ajustes de Umbrales</CardTitle>
                <CardDescription>Define advertencias y estados críticos para los recursos monitoreados.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {Object.entries(thresholds).map(([resource, values]) => (
                <div key={resource} className="panel-side-shell space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="panel-card-title">{resource}</h4>
                    <Badge variant="outline">{resource === 'cpu' ? 'CPU' : resource === 'memory' ? 'RAM' : resource === 'disk' ? 'DISK' : 'TEMP'}</Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="panel-field">
                      <label className="panel-field-label text-xs">Advertencia (%)</label>
                      <input type="number" value={values.warning} onChange={(e) => updateThresholds({ [resource]: { ...values, warning: parseInt(e.target.value) } })} className="input-glass w-full text-xs" min="0" max="100" />
                    </div>
                    <div className="panel-field">
                      <label className="panel-field-label text-xs">Crítico (%)</label>
                      <input type="number" value={values.critical} onChange={(e) => updateThresholds({ [resource]: { ...values, critical: parseInt(e.target.value) } })} className="input-glass w-full text-xs" min="0" max="100" />
                    </div>
                  </div>
                </div>
              ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
