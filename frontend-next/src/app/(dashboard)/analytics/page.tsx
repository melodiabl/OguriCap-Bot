'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  Activity, 
  Clock,
  Users, 
  MessageSquare, 
  Zap, 
  TrendingUp, 
  TrendingDown,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  Trophy
} from 'lucide-react';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useOguriTheme } from '@/contexts/OguriThemeContext';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { notify } from '@/lib/notify';

interface MetricCard {
  title: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType;
  color: string;
}

interface ChartData {
  name: string;
  value: number;
  timestamp?: string;
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Métricas principales
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  
  // Datos de gráficos
  const [commandsOverTime, setCommandsOverTime] = useState<ChartData[]>([]);
  const [userActivity, setUserActivity] = useState<ChartData[]>([]);
  const [groupActivity, setGroupActivity] = useState<ChartData[]>([]);
  const [errorRates, setErrorRates] = useState<ChartData[]>([]);
  const [topCommands, setTopCommands] = useState<ChartData[]>([]);
  const [responseTimeData, setResponseTimeData] = useState<ChartData[]>([]);

  const { socket, isConnected: isSocketConnected } = useSocketConnection();
  const { isInZone } = useOguriTheme();

  // Colores para gráficos
  const colors = useMemo(
    () => ({
      primary: 'rgb(var(--primary))',
      primaryFill: 'rgb(var(--primary) / 0.18)',
      success: 'rgb(var(--success))',
      warning: 'rgb(var(--warning))',
      error: 'rgb(var(--danger))',
      errorFill: 'rgb(var(--danger) / 0.18)',
      info: 'rgb(var(--accent))',
      purple: 'rgb(var(--secondary))',
      grid: 'rgb(var(--border) / 0.18)',
      axis: 'rgb(var(--muted))',
    }),
    []
  );

  useEffect(() => {
    if (!socket) return;

    // Escuchar eventos en tiempo real
    const handleCommandExecuted = (data: any) => {
      if (autoRefresh) {
        updateRealTimeMetrics(data);
      }
    };

    const handleStatsUpdate = (data: any) => {
      if (autoRefresh) {
        updateMetricsFromSocket(data);
      }
    };

    socket.on('command:executed', handleCommandExecuted);
    socket.on('stats:update', handleStatsUpdate);

    return () => {
      socket.off('command:executed', handleCommandExecuted);
      socket.off('stats:update', handleStatsUpdate);
    };
  }, [socket, autoRefresh]);

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Usar el endpoint principal de dashboard que tiene datos reales
      const [
        dashboardStats,
        commandStats,
        userStats,
        groupStats
      ] = await Promise.all([
        api.getStats(), // Este usa /api/dashboard/stats que tiene datos reales
        api.getBotCommandStats(),
        api.getUsuarioStats(),
        api.getGroupStats()
      ]);

      // Procesar métricas principales usando datos reales del dashboard
      const newMetrics: MetricCard[] = [
        {
          title: 'Comandos Ejecutados',
          value: dashboardStats.comandosHoy || commandStats.totalToday || 0,
          change: calculateChange(dashboardStats.comandosHoy || commandStats.totalToday, dashboardStats.totalComandos || commandStats.totalYesterday),
          changeType: (dashboardStats.comandosHoy || commandStats.totalToday) > (dashboardStats.totalComandos || commandStats.totalYesterday || 0) ? 'increase' : 'decrease',
          icon: Zap,
          color: colors.primary
        },
        {
          title: 'Usuarios Activos',
          value: dashboardStats.usuariosActivos || userStats.activeToday || 0,
          change: calculateChange(dashboardStats.usuariosActivos || userStats.activeToday, userStats.activeYesterday),
          changeType: (dashboardStats.usuariosActivos || userStats.activeToday) > (userStats.activeYesterday || 0) ? 'increase' : 'decrease',
          icon: Users,
          color: colors.success
        },
        {
          title: 'Grupos Activos',
          value: dashboardStats.gruposActivos || groupStats.activeToday || 0,
          change: calculateChange(dashboardStats.gruposActivos || groupStats.activeToday, groupStats.activeYesterday),
          changeType: (dashboardStats.gruposActivos || groupStats.activeToday) > (groupStats.activeYesterday || 0) ? 'increase' : 'decrease',
          icon: MessageSquare,
          color: colors.info
        },
        {
          title: 'Tasa de Errores',
          value: dashboardStats.rendimiento?.errorRate || commandStats.errorRate || 0,
          change: calculateChange(dashboardStats.rendimiento?.errorRate || commandStats.errorRate, commandStats.errorRateYesterday),
          changeType: (dashboardStats.rendimiento?.errorRate || commandStats.errorRate) < (commandStats.errorRateYesterday || 0) ? 'increase' : 'decrease',
          icon: AlertTriangle,
          color: colors.error
        }
      ];

      setMetrics(newMetrics);

      // Usar datos de actividad por hora del dashboard si están disponibles
      const activityData = dashboardStats.actividadPorHora || [];
      if (activityData.length > 0) {
        setCommandsOverTime(activityData.map((item: any) => ({
          name: item.label || item.name || 'N/A',
          value: item.value || 0,
          timestamp: item.timestamp
        })));
      } else {
        setCommandsOverTime(processTimeSeriesData(commandStats.hourlyData || []));
      }

      setUserActivity(processTimeSeriesData(userStats.hourlyActivity || []));
      setGroupActivity(processTimeSeriesData(groupStats.hourlyActivity || []));
      setErrorRates(processTimeSeriesData(commandStats.hourlyErrors || []));
      setTopCommands(processTopCommandsData(commandStats.topCommands || []));
      setResponseTimeData(processTimeSeriesData(commandStats.responseTimeData || []));

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading analytics:', error);
      notify.error('Error cargando analytics');
    } finally {
      setIsLoading(false);
    }
  }, [colors]);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, loadAnalytics]);

  const updateRealTimeMetrics = (data: any) => {
    // Actualizar métricas en tiempo real cuando se ejecuta un comando
    setMetrics(prev => prev.map(metric => {
      if (metric.title === 'Comandos Ejecutados') {
        return { ...metric, value: metric.value + 1 };
      }
      return metric;
    }));

    // Actualizar gráfico de comandos en tiempo real
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    setCommandsOverTime(prev => {
      const updated = [...prev];
      const lastEntry = updated[updated.length - 1];
      
      if (lastEntry && lastEntry.name === timeLabel) {
        lastEntry.value += 1;
      } else {
        updated.push({ name: timeLabel, value: 1 });
        // Mantener solo las últimas 20 entradas
        if (updated.length > 20) {
          updated.shift();
        }
      }
      
      return updated;
    });
  };

  const updateMetricsFromSocket = (data: any) => {
    // Actualizar métricas desde eventos de socket
    if (data.memory) {
      // Actualizar métricas de sistema si es necesario
    }
  };

  const calculateChange = (current: number, previous: number): number => {
    if (!previous) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const processTimeSeriesData = (data: any[]): ChartData[] => {
    return data.map(item => ({
      name: item.hour || item.time || item.label,
      value: item.count || item.value || 0,
      timestamp: item.timestamp
    }));
  };

  const processTopCommandsData = (data: any[]): ChartData[] => {
    return data.slice(0, 10).map(item => ({
      name: item.command || item.name,
      value: item.count || item.value || 0
    }));
  };

  const exportData = async () => {
    try {
      const data = {
        metrics,
        timeRange,
        exportDate: new Date().toISOString(),
        charts: {
          commandsOverTime,
          userActivity,
          groupActivity,
          errorRates,
          topCommands,
          responseTimeData
        }
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify.success('Datos exportados correctamente');
    } catch (error) {
      notify.error('Error exportando datos');
    }
  };

  const MetricCard: React.FC<{ metric: MetricCard }> = ({ metric }) => {
    const IconComponent = metric.icon;
    const tone = (() => {
      const c = String(metric.color || '').toLowerCase();
      if (c.includes('--success') || c.includes('success')) return 'success';
      if (c.includes('--warning') || c.includes('warning') || c.includes('orange')) return 'warning';
      if (c.includes('--danger') || c.includes('danger') || c.includes('error')) return 'danger';
      if (c.includes('--accent') || c.includes('info') || c.includes('cyan')) return 'info';
      if (c.includes('--secondary') || c.includes('violet') || c.includes('purple')) return 'violet';
      if (c.includes('--primary') || c.includes('primary') || c.includes('brand')) return 'primary';
      if (c.includes('10b981') || c.includes('16b981') || c.includes('emerald')) return 'success';
      if (c.includes('f59e0b') || c.includes('amber') || c.includes('orange')) return 'warning';
      if (c.includes('ef4444') || c.includes('f43f5e') || c.includes('red') || c.includes('rose')) return 'danger';
      if (c.includes('06b6d4') || c.includes('22d3ee') || c.includes('cyan')) return 'info';
      if (c.includes('8b5cf6') || c.includes('a78bfa') || c.includes('violet') || c.includes('purple')) return 'violet';
      return 'primary';
    })() as 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet';

    const toneStyles: Record<typeof tone, { chip: string; icon: string }> = {
      primary: { chip: 'bg-primary-500/16 border-primary-500/30', icon: 'text-primary-200' },
      success: { chip: 'bg-emerald-500/14 border-emerald-500/30', icon: 'text-emerald-200' },
      warning: { chip: 'bg-amber-500/14 border-amber-500/30', icon: 'text-amber-200' },
      danger: { chip: 'bg-red-500/14 border-red-500/30', icon: 'text-red-200' },
      info: { chip: 'bg-cyan-500/14 border-cyan-500/30', icon: 'text-cyan-200' },
      violet: { chip: 'bg-violet-500/14 border-violet-500/30', icon: 'text-violet-200' },
    };
    
    return (
      <div className="panel-surface-soft p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-sm text-muted">{metric.title}</p>
            <p className="text-2xl font-bold text-foreground">
              <AnimatedNumber value={metric.value} duration={0.6} />
            </p>
            <div className="flex items-center mt-2">
              {metric.changeType === 'increase' ? (
                <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
              ) : metric.changeType === 'decrease' ? (
                <TrendingDown className="w-4 h-4 text-red-400 mr-1" />
              ) : null}
              <span className={`text-sm ${
                metric.changeType === 'increase' ? 'text-green-400' : 
                metric.changeType === 'decrease' ? 'text-red-400' : 'text-muted'
              }`}>
                {metric.change > 0 ? '+' : ''}<AnimatedNumber value={metric.change} duration={0.6} />%
              </span>
            </div>
          </div>
          <div
            className={cn(
               'rounded-2xl border p-3 shadow-inner-glow ring-1 ring-border/10',
               toneStyles[tone].chip
             )}
           >
            <div className={cn('w-6 h-6', toneStyles[tone].icon)}>
              <IconComponent />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const first = payload[0];
    const name = String(first?.name || first?.dataKey || '').trim();
    const value = first?.value;

    return (
      <div className="chart-tooltip">
        <div className="text-[11px] font-black tracking-[0.18em] uppercase opacity-80">{label}</div>
        <div className="mt-1 text-sm font-extrabold">
          {name ? `${name}: ` : ''}
          {typeof value === 'number' ? <AnimatedNumber value={value} duration={0.4} /> : String(value ?? '')}
        </div>
      </div>
    );
  };

  const primaryMetric = metrics[0]?.value || 0;
  const analyticsLanes = [
    {
      label: 'Canal de datos',
      value: isSocketConnected ? 'Tiempo real activo' : 'Fallback HTTP',
      description: isSocketConnected ? 'Las métricas se refrescan desde eventos vivos del panel.' : 'Sigue operativo, pero depende de recargas y consultas directas.',
      icon: <Activity className="w-4 h-4" />,
      badge: isSocketConnected ? 'live' : 'http',
      badgeClassName: isSocketConnected ? 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
    },
    {
      label: 'Ventana analizada',
      value: timeRange.toUpperCase(),
      description: 'Escala temporal aplicada a gráficas, actividad y lectura comparativa.',
      icon: <Clock className="w-4 h-4" />,
      badge: 'range',
      badgeClassName: 'border-violet-400/20 bg-violet-500/10 text-violet-300',
      glowClassName: 'from-violet-400/18 via-oguri-lavender/10 to-transparent',
    },
    {
      label: 'Pulso principal',
      value: `${primaryMetric}`,
      description: metrics[0]?.title ? `${metrics[0].title} marca la referencia principal ahora mismo.` : 'Esperando datos base del panel.',
      icon: <Zap className="w-4 h-4" />,
      badge: autoRefresh ? 'auto' : 'manual',
      badgeClassName: autoRefresh ? 'border-[#25d366]/20 bg-[#25d366]/10 text-[#c7f9d8]' : 'border-amber-400/20 bg-amber-500/10 text-amber-300',
      glowClassName: 'from-[#25d366]/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Ultima lectura',
      value: lastUpdate ? lastUpdate.toLocaleTimeString('es-ES') : 'Sin datos',
      description: lastUpdate ? 'Marca temporal del ultimo barrido de analytics.' : 'Todavia no hay un ciclo completo de carga.',
      icon: <TrendingUp className="w-4 h-4" />,
      badge: lastUpdate ? 'sync' : 'wait',
      badgeClassName: lastUpdate ? 'border-oguri-gold/20 bg-oguri-gold/10 text-oguri-gold' : 'border-rose-400/20 bg-rose-500/10 text-rose-300',
      glowClassName: 'from-oguri-gold/18 via-oguri-purple/10 to-transparent',
    },
  ];

  return (
    <div className={cn("panel-page relative overflow-hidden transition-all duration-500", isInZone && "is-in-zone")}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-oguri-lavender/20 blur-3xl"
          animate={{ x: [0, 20, 0], y: [0, 18, 0], opacity: [0.24, 0.46, 0.24] }}
          transition={{ repeat: Infinity, duration: 11, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-cyan/18 blur-3xl"
          animate={{ x: [0, -18, 0], y: [0, 16, 0], opacity: [0.18, 0.4, 0.18] }}
          transition={{ repeat: Infinity, duration: 10.4, ease: 'easeInOut', delay: 0.6 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(var(--page-a),0.18),rgba(var(--page-b),0.10),rgba(var(--page-c),0.12))] p-5 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6"
      >
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit">
              <Trophy className="h-3.5 w-3.5 text-oguri-gold" />
              Telemetria avanzada
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Cabina analytics estilo HUD</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Métricas con una atmósfera propia, glow de gráficos y sensación de panel táctico en tiempo real.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Refresh</p>
              <p className="mt-2 text-lg font-black text-white">{autoRefresh ? 'AUTO' : 'PAUSA'}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Rango</p>
              <p className="mt-2 text-lg font-black text-white">{timeRange.toUpperCase()}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Socket</p>
              <p className="mt-2 text-lg font-black text-white">{socket ? 'LIVE' : 'HTTP'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <PageHeader
        title="Logros de Carrera"
        description={
          lastUpdate
            ? `Rendimiento y distancias recorridas por Oguri Cap • Última actualización: ${lastUpdate.toLocaleTimeString('es-ES')}`
            : 'Rendimiento y distancias recorridas por Oguri Cap'
        }
        icon={<Trophy className="w-6 h-6 text-oguri-gold animate-bounce" />}
        actions={
          <>
            <div className="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-border/15 bg-card/60 px-3 py-2 sm:w-auto">
              <Filter className="w-4 h-4 text-muted" />
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
                <SelectTrigger className="w-full min-w-0 border-0 bg-transparent px-0 shadow-none focus:ring-0 sm:min-w-[130px]">
                  <SelectValue placeholder="Rango" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 Hora</SelectItem>
                  <SelectItem value="24h">24 Horas</SelectItem>
                  <SelectItem value="7d">7 Días</SelectItem>
                  <SelectItem value="30d">30 Días</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? 'primary' : 'secondary'}
              className="flex items-center gap-2"
              title={autoRefresh ? 'Auto-refresh activo' : 'Auto-refresh pausado'}
            >
              <Activity className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              Auto
            </Button>

            <Button onClick={loadAnalytics} variant="secondary" loading={isLoading} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </Button>

            <Button onClick={exportData} variant="secondary" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {analyticsLanes.map((lane, index) => (
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

      {/* Métricas principales */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" delay={0.06} stagger={0.06}>
        {metrics.map((metric, index) => (
          <StaggerItem key={index}>
            <MetricCard metric={metric} />
          </StaggerItem>
        ))}
      </Stagger>

      {/* Gráficos */}
      <Stagger className="grid grid-cols-1 gap-6 lg:grid-cols-2" delay={0.08} stagger={0.08}>
        <StaggerItem>
          <DashboardCard title="Comandos Ejecutados" description="Flujo por ventana temporal" variant="chart" icon={<Zap className="h-5 w-5" />}>
             <ResponsiveContainer width="100%" height={300}>
               <AreaChart data={commandsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="name" stroke={colors.axis} />
                <YAxis stroke={colors.axis} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={colors.primary}
                  fill={colors.primaryFill}
                  strokeWidth={2}
                />
               </AreaChart>
             </ResponsiveContainer>
          </DashboardCard>
        </StaggerItem>

        <StaggerItem>
          <DashboardCard title="Actividad de Usuarios" description="Movimiento y presencia reciente" variant="chart" icon={<Users className="h-5 w-5" />}>
             <ResponsiveContainer width="100%" height={300}>
               <LineChart data={userActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="name" stroke={colors.axis} />
                <YAxis stroke={colors.axis} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={colors.success}
                  strokeWidth={2}
                  dot={{ fill: colors.success, strokeWidth: 2, r: 4 }}
                />
               </LineChart>
             </ResponsiveContainer>
          </DashboardCard>
        </StaggerItem>

        <StaggerItem>
          <DashboardCard title="Comandos Más Usados" description="Top actual de interacción" variant="chart" icon={<TrendingUp className="h-5 w-5" />}>
             <ResponsiveContainer width="100%" height={300}>
               <BarChart data={topCommands} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis type="number" stroke={colors.axis} />
                <YAxis dataKey="name" type="category" stroke={colors.axis} width={80} />
                <Tooltip content={<ChartTooltip />} />
                 <Bar dataKey="value" fill={colors.info} radius={[0, 4, 4, 0]} />
               </BarChart>
             </ResponsiveContainer>
          </DashboardCard>
        </StaggerItem>

        <StaggerItem>
          <DashboardCard title="Tasa de Errores" description="Incidentes y estabilidad" variant="chart" icon={<AlertTriangle className="h-5 w-5" />}>
             <ResponsiveContainer width="100%" height={300}>
               <AreaChart data={errorRates}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="name" stroke={colors.axis} />
                <YAxis stroke={colors.axis} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={colors.error}
                  fill={colors.errorFill}
                  strokeWidth={2}
                />
               </AreaChart>
             </ResponsiveContainer>
          </DashboardCard>
        </StaggerItem>
      </Stagger>

      {/* Tiempo de respuesta */}
      <Reveal>
        <DashboardCard title="Tiempo de Respuesta Promedio" description="Velocidad estimada del sistema" variant="chart" icon={<Activity className="h-5 w-5" />}>
           <ResponsiveContainer width="100%" height={200}>
             <LineChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="name" stroke={colors.axis} />
              <YAxis stroke={colors.axis} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={colors.warning}
                strokeWidth={2}
                dot={{ fill: colors.warning, strokeWidth: 2, r: 3 }}
               />
             </LineChart>
           </ResponsiveContainer>
        </DashboardCard>
      </Reveal>
    </div>
  );
}
