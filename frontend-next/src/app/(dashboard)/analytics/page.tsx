'use client';

import React, { useState, useEffect } from 'react';
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
import { useSocket } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/Button';
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

  const { socket } = useSocket();

  // Colores para gráficos
  const colors = {
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#06B6D4',
    purple: '#8B5CF6'
  };

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

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

  const loadAnalytics = async () => {
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
        setCommandsOverTime(activityData.map(item => ({
          name: item.label || item.name,
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
  };

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
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">{metric.title}</p>
            <p className="text-2xl font-bold text-white">{metric.value.toLocaleString()}</p>
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
                {metric.change > 0 ? '+' : ''}{metric.change}%
              </span>
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: `${metric.color}20` }}>
            <div className="w-6 h-6" style={{ color: metric.color }}>
              <IconComponent />
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-gray-400">
            Métricas y estadísticas en tiempo real
            {lastUpdate && (
              <span className="ml-2">
                • Última actualización: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="input-glass min-w-[100px]"
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
          >
            <Activity className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto
          </Button>
          
          <Button
            onClick={loadAnalytics}
            variant="secondary"
            loading={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
          
          <Button
            onClick={exportData}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} metric={metric} />
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comandos en el tiempo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Comandos Ejecutados</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={commandsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={colors.primary} 
                fill={`${colors.primary}30`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Actividad de usuarios */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Actividad de Usuarios</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={userActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={colors.success} 
                strokeWidth={2}
                dot={{ fill: colors.success, strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top comandos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Comandos Más Usados</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCommands} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9CA3AF" />
              <YAxis dataKey="name" type="category" stroke="#9CA3AF" width={80} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }} 
              />
              <Bar dataKey="value" fill={colors.info} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Tasa de errores */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Tasa de Errores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={errorRates}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={colors.error} 
                fill={`${colors.error}30`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Tiempo de respuesta */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4">Tiempo de Respuesta Promedio</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={responseTimeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: '8px'
              }} 
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={colors.warning} 
              strokeWidth={2}
              dot={{ fill: colors.warning, strokeWidth: 2, r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
