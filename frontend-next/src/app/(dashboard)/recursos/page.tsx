'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
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
  Users,
  MessageSquare,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Progress } from '@/components/ui/Progress';
import { useSocketConnection } from '@/contexts/SocketContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

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

  useEffect(() => {
    loadResourceStats();
    loadHistoricalData();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleMetricsUpdate = (data: ResourceMetrics) => {
      setMetrics(data);
      
      // Agregar al historial local (mantener últimos 60 puntos)
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
      toast.error(`Alerta: ${data.resource} en estado ${data.newState}`);
      loadResourceStats(); // Recargar stats para obtener estados actualizados
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

      setMetrics(null);
      setAlertStates(null);
      setThresholds(null);
      setIsMonitoring(false);
    } catch (error) {
      console.error('Error loading resource stats:', error);
      toast.error('Error cargando estadísticas de recursos');
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoricalData = async () => {
    try {
      const historyRes = await api.getResourcesHistory(60).catch(() => ({ history: [] }));
      const historyRaw = (historyRes as any)?.history;
      const history = Array.isArray(historyRaw) ? historyRaw : [];
      setHistoricalData(history);
    } catch (error) {
      console.error('Error loading historical data:', error);
    }
  };

  const toggleMonitoring = async () => {
    try {
      if (isMonitoring) {
        await api.stopResourcesMonitoring();
        toast.success('Monitoreo detenido');
      } else {
        await api.startResourcesMonitoring(updateInterval);
        toast.success('Monitoreo iniciado');
      }
      await loadResourceStats();
    } catch (error) {
      toast.error('Error al cambiar estado del monitoreo');
    }
  };

  const updateThresholds = async (newThresholds: Partial<Thresholds>) => {
    try {
      await api.updateResourcesThresholds(newThresholds);
      toast.success('Umbrales actualizados');
      await loadResourceStats();
    } catch (error) {
      toast.error('Error actualizando umbrales');
    }
  };

  const exportMetrics = async (format: string) => {
    try {
      const data = {
        timestamp: Date.now(),
        metrics: metrics,
        historicalData: historicalData,
        alertStates: alertStates,
        thresholds: thresholds
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
      toast.success('Métricas exportadas');
    } catch (error) {
      toast.error('Error exportando métricas');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="w-4 h-4 text-red-400" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-green-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Monitoreo de Recursos"
        description="Monitoreo en tiempo real del sistema y recursos"
        icon={<Activity className="w-5 h-5 text-primary-400" />}
        actions={
          <>
            <Button
              onClick={() => setShowSettings(!showSettings)}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </Button>

            <Button
              onClick={() => exportMetrics('json')}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar
            </Button>

            <Button
              onClick={toggleMonitoring}
              variant={isMonitoring ? "danger" : "primary"}
              className="flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              {isMonitoring ? 'Detener' : 'Iniciar'}
            </Button>
          </>
        }
      />

      {/* Estado del monitoreo */}
      <Reveal>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-green-400' : 'bg-red-400'}`}
                animate={
                  isMonitoring
                    ? { scale: [1, 1.25, 1], opacity: [1, 0.7, 1] }
                    : { scale: 1, opacity: 1 }
                }
                transition={isMonitoring ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
              />
              <span className="text-white font-medium">{isMonitoring ? 'Monitoreo Activo' : 'Monitoreo Detenido'}</span>
              {isMonitoring && <span className="text-sm text-gray-400">(actualización cada {updateInterval / 1000}s)</span>}
            </div>

            {metrics && (
              <div className="text-sm text-gray-400">
                Última actualización: {new Date(metrics.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {/* Métricas principales */}
      {metrics && (
        <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" delay={0.02} stagger={0.06}>
          {/* CPU */}
          <StaggerItem
            className="glass-card p-6"
            whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Cpu className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">CPU</p>
                  <p className="text-xl font-bold text-white">
                    <AnimatedNumber value={metrics.cpu.usage} decimals={1} />%
                  </p>
                </div>
              </div>
              
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getAlertColor(alertStates?.cpu || 'normal')}`}>
                {getAlertIcon(alertStates?.cpu || 'normal')}
                {alertStates?.cpu || 'normal'}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Uso</span>
                <span className="text-white">
                  <AnimatedNumber value={metrics.cpu.usage} decimals={1} />%
                </span>
              </div>
              <Progress
                value={Math.min(metrics.cpu.usage, 100)}
                max={100}
                className="h-2 bg-gray-700 rounded-full ring-0"
                fillClassName={getUsageColor(metrics.cpu.usage, thresholds?.cpu)}
              />
              <div className="text-xs text-gray-500">
                {metrics.cpu.cores} núcleos • {metrics.cpu.model}
              </div>
            </div>
          </StaggerItem>

          {/* Memoria */}
          <StaggerItem
            className="glass-card p-6"
            whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <MemoryStick className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Memoria</p>
                  <p className="text-xl font-bold text-white">
                    <AnimatedNumber value={metrics.memory.usage} decimals={1} />%
                  </p>
                </div>
              </div>
              
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getAlertColor(alertStates?.memory || 'normal')}`}>
                {getAlertIcon(alertStates?.memory || 'normal')}
                {alertStates?.memory || 'normal'}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Usado</span>
                <span className="text-white">{formatBytes(metrics.memory.used)}</span>
              </div>
              <Progress
                value={Math.min(metrics.memory.usage, 100)}
                max={100}
                className="h-2 bg-gray-700 rounded-full ring-0"
                fillClassName={getUsageColor(metrics.memory.usage, thresholds?.memory)}
              />
              <div className="text-xs text-gray-500">
                {formatBytes(metrics.memory.free)} libre de {formatBytes(metrics.memory.total)}
              </div>
            </div>
          </StaggerItem>

          {/* Disco */}
          <StaggerItem
            className="glass-card p-6"
            whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <HardDrive className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Disco</p>
                  <p className="text-xl font-bold text-white">
                    <AnimatedNumber value={metrics.disk.usage} />%
                  </p>
                </div>
              </div>
              
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getAlertColor(alertStates?.disk || 'normal')}`}>
                {getAlertIcon(alertStates?.disk || 'normal')}
                {alertStates?.disk || 'normal'}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Usado</span>
                <span className="text-white">{metrics.disk.used}</span>
              </div>
              <Progress
                value={Math.min(metrics.disk.usage, 100)}
                max={100}
                className="h-2 bg-gray-700 rounded-full ring-0"
                fillClassName={getUsageColor(metrics.disk.usage, thresholds?.disk)}
              />
              <div className="text-xs text-gray-500">
                {metrics.disk.available} disponible • {metrics.disk.filesystem}
              </div>
            </div>
          </StaggerItem>

          {/* Bot Status */}
          <StaggerItem
            className="glass-card p-6"
            whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <Zap className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Bot</p>
                  <p className="text-xl font-bold text-white capitalize">{metrics.bot.connection.status}</p>
                </div>
              </div>
              
              <div className={`w-3 h-3 rounded-full ${
                metrics.bot.connection.status === 'connected' ? 'bg-green-400' : 
                metrics.bot.connection.status === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
            </div>
            
            <div className="space-y-2">
              {metrics.bot.connection.phoneNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Número</span>
                  <span className="text-white">+{metrics.bot.connection.phoneNumber}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Chats</span>
                <span className="text-white">
                  <AnimatedNumber value={metrics.bot.database.chats} />
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">SubBots</span>
                <span className="text-white">
                  <AnimatedNumber value={metrics.bot.subbots.connected} />/<AnimatedNumber value={metrics.bot.subbots.total} />
                </span>
              </div>
            </div>
          </StaggerItem>
        </Stagger>
      )}

      {/* Información del sistema */}
      {metrics && (
        <Stagger className="grid grid-cols-1 lg:grid-cols-2 gap-6" delay={0.04} stagger={0.08}>
          {/* Información del proceso */}
          <StaggerItem
            className="glass-card p-6"
            whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Server className="w-5 h-5" />
              Información del Proceso
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Tiempo activo</p>
                <p className="text-white font-medium">{formatUptime(metrics.process.uptime / 1000)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">PID</p>
                <p className="text-white font-medium">{metrics.process.pid}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Versión Node.js</p>
                <p className="text-white font-medium">{metrics.process.version}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Plataforma</p>
                <p className="text-white font-medium">
                  {metrics.process.platform} {metrics.process.arch}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Reinicios</p>
                <p className="text-white font-medium">
                  <AnimatedNumber value={metrics.process.restarts} />
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Errores</p>
                <p className="text-white font-medium">
                  <AnimatedNumber value={metrics.process.errors} />
                </p>
              </div>
            </div>
          </StaggerItem>

          {/* Estadísticas de la base de datos */}
          <StaggerItem
            className="glass-card p-6"
            whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Base de Datos
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-400">Usuarios</span>
                </div>
                <span className="text-white font-medium">
                  <AnimatedNumber value={metrics.bot.database.users} />
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-green-400" />
                  <span className="text-gray-400">Grupos</span>
                </div>
                <span className="text-white font-medium">
                  <AnimatedNumber value={metrics.bot.database.groups} />
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <span className="text-gray-400">Total Chats</span>
                </div>
                <span className="text-white font-medium">
                  <AnimatedNumber value={metrics.bot.database.chats} />
                </span>
              </div>
            </div>
          </StaggerItem>
        </Stagger>
      )}

      {/* Configuración de umbrales */}
      <AnimatePresence>
        {showSettings && thresholds && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Configuración de Umbrales</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(thresholds).map(([resource, values]) => (
                <div key={resource} className="space-y-4">
                  <h4 className="font-medium text-white capitalize">{resource}</h4>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Advertencia (%)</label>
                    <input
                      type="number"
                      value={values.warning}
                      onChange={(e) => updateThresholds({
                        [resource]: { ...values, warning: parseInt(e.target.value) }
                      })}
                      className="input-glass w-full"
                      min="0"
                      max="100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Crítico (%)</label>
                    <input
                      type="number"
                      value={values.critical}
                      onChange={(e) => updateThresholds({
                        [resource]: { ...values, critical: parseInt(e.target.value) }
                      })}
                      className="input-glass w-full"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
