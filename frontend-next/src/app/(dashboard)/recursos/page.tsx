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
  Minus,
  Utensils,
  Beef,
  Flame,
  Gauge
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Progress } from '@/components/ui/Progress';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useOguriTheme } from '@/contexts/OguriThemeContext';
import { cn } from '@/lib/utils';
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
      toast.error(`Alerta: ${data.resource} en estado ${data.newState}`);
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
        <RefreshCw className="w-8 h-8 text-oguri-lavender animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6 transition-all duration-500", isInZone && "is-in-zone")}>
      <div className="oguri-zone-overlay" />
      
      <PageHeader
        title="Paddock de Alimentación"
        description="Estado de energía y recursos de Oguri Cap"
        icon={<Utensils className="w-5 h-5 text-oguri-gold animate-bounce" />}
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
        <div className="glass-phantom p-4 border-oguri-purple/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-green-400 shadow-glow-oguri-cyan' : 'bg-red-400'}`}
                animate={isMonitoring ? { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-white font-bold uppercase tracking-widest text-xs">
                {isMonitoring ? 'Monitoreo de Aura Activo' : 'Monitoreo Detenido'}
              </span>
            </div>
            {metrics && (
              <div className="text-[10px] font-black text-oguri-lavender/40 uppercase tracking-widest">
                Sincronización: {new Date(metrics.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {metrics && (
        <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CPU - Combustión */}
          <StaggerItem className="glass-phantom p-6 border-oguri-purple/10 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-oguri-purple/20 shadow-glow-oguri-purple group-hover:animate-oguri-aura">
                <Flame className="w-5 h-5 text-oguri-lavender" />
              </div>
              <div className={cn("px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", getAlertColor(alertStates?.cpu || 'normal'))}>
                {alertStates?.cpu === 'normal' ? 'Aura Estable' : 'Aura Crítica'}
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-oguri-lavender/40 mb-1">Combustión</p>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-3xl font-black text-white tracking-tighter">
                <AnimatedNumber value={metrics.cpu.usage} decimals={1} />%
              </span>
              <div className="mb-1">{getTrendIcon(metrics.cpu.usage, historicalData[historicalData.length - 2]?.cpu || 0)}</div>
            </div>
            <Progress value={metrics.cpu.usage} className="h-2 bg-oguri-phantom-950" color={getUsageColor(metrics.cpu.usage, thresholds?.cpu)} />
          </StaggerItem>

          {/* Memoria - Nutrición */}
          <StaggerItem className="glass-phantom p-6 border-oguri-purple/10 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-oguri-gold/10 shadow-glow-oguri-mixed group-hover:animate-bounce">
                <Beef className="w-5 h-5 text-oguri-gold" />
              </div>
              <div className={cn("px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", getAlertColor(alertStates?.memory || 'normal'))}>
                {metrics.memory.usage > 80 ? 'Hambrienta' : 'Satisfecha'}
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-oguri-lavender/40 mb-1">Nutrición</p>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-3xl font-black text-white tracking-tighter">
                <AnimatedNumber value={metrics.memory.usage} decimals={1} />%
              </span>
              <div className="mb-1">{getTrendIcon(metrics.memory.usage, historicalData[historicalData.length - 2]?.memory || 0)}</div>
            </div>
            <Progress value={metrics.memory.usage} className="h-2 bg-oguri-phantom-950" color={getUsageColor(metrics.memory.usage, thresholds?.memory)} />
          </StaggerItem>

          {/* Disco */}
          <StaggerItem className="glass-phantom p-6 border-oguri-purple/10 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-oguri-cyan/10 text-oguri-cyan">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className={cn("px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", getAlertColor(alertStates?.disk || 'normal'))}>
                {alertStates?.disk || 'Normal'}
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-oguri-lavender/40 mb-1">Almacenamiento</p>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-3xl font-black text-white tracking-tighter">
                <AnimatedNumber value={metrics.disk.usage} />%
              </span>
            </div>
            <Progress value={metrics.disk.usage} className="h-2 bg-oguri-phantom-950" color={getUsageColor(metrics.disk.usage, thresholds?.disk)} />
          </StaggerItem>

          {/* Bot Status */}
          <StaggerItem className="glass-phantom p-6 border-oguri-purple/10 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-oguri-lavender/10 text-oguri-lavender">
                <Zap className="w-5 h-5" />
              </div>
              <div className={cn("w-3 h-3 rounded-full", metrics.bot.connection.status === 'connected' ? 'bg-green-400' : 'bg-red-400')} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-oguri-lavender/40 mb-1">Estado del Bot</p>
            <p className="text-xl font-black text-white uppercase tracking-tighter mb-4">{metrics.bot.connection.status}</p>
            <div className="space-y-1 text-[10px] font-bold text-oguri-lavender/60 uppercase">
              <div className="flex justify-between"><span>Chats</span><span>{metrics.bot.database.chats}</span></div>
              <div className="flex justify-between"><span>Subbots</span><span>{metrics.bot.subbots.connected}/{metrics.bot.subbots.total}</span></div>
            </div>
          </StaggerItem>
        </Stagger>
      )}

      <AnimatePresence>
        {showSettings && thresholds && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="glass-phantom p-6 border-oguri-purple/20">
            <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6">Ajustes de Umbrales de Aura</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {Object.entries(thresholds).map(([resource, values]) => (
                <div key={resource} className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-oguri-gold">{resource}</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-oguri-lavender/40 uppercase mb-1">Advertencia (%)</label>
                      <input type="number" value={values.warning} onChange={(e) => updateThresholds({ [resource]: { ...values, warning: parseInt(e.target.value) } })} className="input-glass w-full text-xs" min="0" max="100" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-oguri-lavender/40 uppercase mb-1">Crítico (%)</label>
                      <input type="number" value={values.critical} onChange={(e) => updateThresholds({ [resource]: { ...values, critical: parseInt(e.target.value) } })} className="input-glass w-full text-xs" min="0" max="100" />
                    </div>
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
