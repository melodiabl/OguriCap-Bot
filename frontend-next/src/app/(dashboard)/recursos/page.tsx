'use client';

import React, { useState, useEffect } from 'react';
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
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { notify } from '@/lib/notify';

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

  const { socket } = useSocketConnection();
  const { isInZone } = useOguriTheme();

  useEffect(() => {
    loadResourceStats();
    loadHistoricalData();
  }, []);

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
        dedupeMs: 7000,
      });
      loadResourceStats();
    };

    socket.on('resource:metrics', handleMetricsUpdate);
    socket.on('resource:alert', handleAlertStateChanged);

    return () => {
      socket.off('resource:metrics', handleMetricsUpdate);
      socket.off('resource:alert', handleAlertStateChanged);
    };
  }, [socket]);

  const loadResourceStats = async () => {
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
      console.error('Error loading resource stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoricalData = async () => {
    try {
      const historyRes = await api.getResourcesHistory(60).catch(() => ({ history: [] }));
      const historyRaw = (historyRes as any)?.history;
      setHistoricalData(Array.isArray(historyRaw) ? historyRaw : []);
    } catch (error) {
      console.error('Error loading historical data:', error);
    }
  };

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
      case 'critical': return 'text-red-400 bg-red-500/20';
      case 'warning': return 'text-yellow-400 bg-yellow-500/20';
      case 'normal': return 'text-green-400 bg-green-500/20';
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
    if (usage >= thresholds?.critical) return 'bg-red-500';
    if (usage >= thresholds?.warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <div className="panel-empty-state min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-[rgb(var(--text-secondary))]">Cargando recursos del sistema...</p>
      </div>
    );
  }

  return (
    <div className={cn("panel-page transition-all duration-500", isInZone && "is-in-zone")}>
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

      <Reveal>
        <div className="panel-setting-row">
          <div className="flex items-center gap-3">
            <motion.div
              className={cn('h-3 w-3 rounded-full', isMonitoring ? 'bg-emerald-400 shadow-glow-oguri-cyan' : 'bg-red-400')}
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
            <Badge variant="outline">Intervalo: {Math.round(updateInterval / 1000)}s</Badge>
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
              <div className="panel-data-row"><span className="panel-data-row__label">Uptime</span><span className="panel-data-row__value">{Math.round(metrics.process.uptime / 60)} min</span></div>
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
