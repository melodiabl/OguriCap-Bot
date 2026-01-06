'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Users, 
  MessageSquare, 
  Zap, 
  TrendingUp, 
  TrendingDown,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useSocketConnection } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import toast from 'react-hot-toast';

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

  const { socket } = useSocketConnection();

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
      toast.error('Error cargando analytics');
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

      toast.success('Datos exportados correctamente');
    } catch (error) {
      toast.error('Error exportando datos');
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
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">{metric.title}</p>
            <p className="text-2xl font-bold text-white">
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
                metric.changeType === 'decrease' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {metric.change > 0 ? '+' : ''}<AnimatedNumber value={metric.change} duration={0.6} />%
              </span>
            </div>
          </div>
          <div
            className={cn(
              'p-3 rounded-2xl border shadow-inner-glow ring-1 ring-white/10',
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Analytics"
        description={
          lastUpdate
            ? `Métricas y estadísticas en tiempo real • Última actualización: ${lastUpdate.toLocaleTimeString('es-ES')}`
            : 'Métricas y estadísticas en tiempo real'
        }
        icon={<Activity className="w-6 h-6 text-primary-400" />}
        actions={
          <>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="input-glass min-w-[110px]"
              >
                <option value="1h">1 Hora</option>
                <option value="24h">24 Horas</option>
                <option value="7d">7 Días</option>
                <option value="30d">30 Días</option>
              </select>
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

      {/* Métricas principales */}
      <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" delay={0.06} stagger={0.06}>
        {metrics.map((metric, index) => (
          <StaggerItem key={index}>
            <MetricCard metric={metric} />
          </StaggerItem>
        ))}
      </Stagger>

      {/* Gráficos */}
      <Stagger className="grid grid-cols-1 lg:grid-cols-2 gap-6" delay={0.08} stagger={0.08}>
        <StaggerItem>
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Comandos Ejecutados</h3>
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
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Actividad de Usuarios</h3>
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
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Comandos Más Usados</h3>
             <ResponsiveContainer width="100%" height={300}>
               <BarChart data={topCommands} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis type="number" stroke={colors.axis} />
                <YAxis dataKey="name" type="category" stroke={colors.axis} width={80} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill={colors.info} radius={[0, 4, 4, 0]} />
               </BarChart>
             </ResponsiveContainer>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Tasa de Errores</h3>
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
          </div>
        </StaggerItem>
      </Stagger>

      {/* Tiempo de respuesta */}
      <Reveal>
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Tiempo de Respuesta Promedio</h3>
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
        </div>
      </Reveal>
    </div>
  );
}
