'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Users, MessageSquare, Package, ShoppingCart, Bot, Zap,
  TrendingUp, Activity, Clock, CheckCircle, RefreshCw, Radio, Settings,
} from 'lucide-react';
import { Card, StatCard, GlowCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressRing, BarChart, DonutChart } from '@/components/ui/Charts';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
import PerformanceIndicator from '@/components/ui/PerformanceIndicator';
import { useDashboardStats, useBotStatus, useSystemStats, useSubbotsStatus, useRecentActivity } from '@/hooks/useRealTime';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useGlobalUpdate } from '@/contexts/GlobalUpdateContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useSocket, SOCKET_EVENTS } from '@/contexts/SocketContext';
import { formatUptime } from '@/lib/utils';

// Animated Counter Component
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1,
  className = "",
}) => {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(easeOutQuart * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  return <span className={className}>{displayValue.toLocaleString()}</span>;
};

export default function DashboardPage() {
  const { stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats(10000);
  const { status: botStatus, isConnected, isConnecting, refetch: refetchBot } = useBotStatus(3000);
  const { isGloballyOn } = useBotGlobalState();
  const { dashboardStats, botStatus: globalBotStatus, refreshAll } = useGlobalUpdate();
  const { memoryUsage, cpuUsage, diskUsage, uptime, systemInfo } = useSystemStats(8000);
  const { onlineCount, totalCount } = useSubbotsStatus(8000);
  const { isConnected: isSocketConnected, socket } = useSocket();
  const { activities: recentActivity, isLoading: activitiesLoading } = useRecentActivity(15000);

  // Auto-refresh del dashboard - DISABLED to prevent resource exhaustion
  // useAutoRefresh(async () => {
  //   await Promise.all([refetchStats(), refetchBot()]);
  // }, { interval: 15000 });

  // Usar datos del contexto global si están disponibles
  const currentStats = dashboardStats || stats;
  const currentBotStatus = globalBotStatus || botStatus;

  // Listen for real-time events to build activity feed (mantener para eventos en tiempo real)
  React.useEffect(() => {
    if (!socket) return;

    // Solo mantener eventos críticos en tiempo real
    const handleBotConnected = () => {
      // Refrescar actividad cuando el bot se conecte
      // La actividad real vendrá del endpoint
    };

    socket.on(SOCKET_EVENTS.BOT_CONNECTED, handleBotConnected);

    return () => {
      socket.off(SOCKET_EVENTS.BOT_CONNECTED, handleBotConnected);
    };
  }, [socket]);

  const handleRefresh = () => {
    refreshAll();
    refetchStats();
    refetchBot();
  };

  const getHourlyActivity = () => {
    // Datos basados en estadísticas reales del backend
    const activity = (currentStats as any)?.actividadPorHora;
    if (Array.isArray(activity) && activity.length > 0) {
      return activity.map((item: any, i: number) => ({
        label: String(item?.label ?? `${(i * 2).toString().padStart(2, '0')}:00`),
        value: Number(item?.value) || 0,
        color: String(item?.color || '#6366f1'),
      }));
    }

    return Array.from({ length: 12 }, (_, i) => ({
      label: `${(i * 2).toString().padStart(2, '0')}:00`,
      value: 0,
      color: '#6366f1',
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Vista general del sistema en tiempo real</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
          <motion.button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500/20 hover:bg-primary-500/30 border border-primary-500/30 rounded-lg text-primary-400 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            <motion.div
              animate={{ rotate: statsLoading ? 360 : 0 }}
              transition={{ duration: 1, repeat: statsLoading ? Infinity : 0, ease: "linear" }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.div>
            Actualizar
          </motion.button>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isSocketConnected 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <motion.div
              animate={isSocketConnected ? { 
                scale: [1, 1.2, 1],
                opacity: [1, 0.7, 1]
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Radio className="w-3 h-3" />
            </motion.div>
            {isSocketConnected ? 'Tiempo Real Activo' : 'Sin conexión'}
          </div>
          <RealTimeBadge isActive={isConnected && isGloballyOn} />
        </motion.div>
      </div>

      {/* Performance Indicators */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <PerformanceIndicator 
          metrics={currentStats?.rendimiento}
          className="mb-6"
        />
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <StatCard 
          title="Admins Panel" 
          value={currentStats?.totalUsuarios || 0} 
          subtitle={`${currentStats?.usuariosActivos || 0} activos`} 
          icon={<Users className="w-6 h-6" />} 
          color="primary" 
          delay={0} 
          loading={statsLoading}
          trend={currentStats?.tendencias?.usuarios}
          animated={true}
        />
        <StatCard 
          title="Comunidad" 
          value={currentStats?.comunidad?.usuariosWhatsApp || 0} 
          subtitle={`${currentStats?.comunidad?.usuariosActivos || 0} activos`} 
          icon={<MessageSquare className="w-6 h-6" />} 
          color="success" 
          delay={0.1} 
          loading={statsLoading}
          trend={currentStats?.tendencias?.usuarios}
          animated={true}
        />
        <StatCard 
          title="Grupos" 
          value={currentStats?.totalGrupos || 0} 
          subtitle={`${currentStats?.gruposActivos || 0} activos`} 
          icon={<MessageSquare className="w-6 h-6" />} 
          color="violet" 
          delay={0.2} 
          loading={statsLoading}
          trend={currentStats?.tendencias?.grupos}
          animated={true}
        />
        <StatCard 
          title="Aportes" 
          value={currentStats?.totalAportes || 0} 
          subtitle={`${currentStats?.aportesHoy || 0} hoy`} 
          icon={<Package className="w-6 h-6" />} 
          color="violet" 
          delay={0.3} 
          loading={statsLoading}
          trend={currentStats?.tendencias?.aportes}
          animated={true}
        />
        <StatCard 
          title="SubBots" 
          value={currentStats?.totalSubbots || totalCount} 
          subtitle={`${onlineCount} online`} 
          icon={<Zap className="w-6 h-6" />} 
          color="cyan" 
          delay={0.4} 
          loading={statsLoading}
          animated={true}
        />
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bot Status */}
        <Card animated delay={0.5} className="p-6" hover={true} glow={isConnected && isGloballyOn}>
          <div className="flex items-center justify-between mb-6">
            <motion.h3 
              className="text-lg font-semibold text-white"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              Estado del Bot
            </motion.h3>
            <motion.div 
              className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-glow-emerald' : 'bg-red-500'}`}
              animate={isConnected ? { 
                boxShadow: [
                  "0 0 10px rgba(16, 185, 129, 0.5)",
                  "0 0 20px rgba(16, 185, 129, 0.8)",
                  "0 0 10px rgba(16, 185, 129, 0.5)"
                ]
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>

          <div className="flex items-center justify-center mb-6">
            <motion.div 
              animate={isConnected && isGloballyOn ? { 
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0]
              } : {}} 
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
            >
              <ProgressRing 
                progress={isConnected && isGloballyOn ? 100 : 0} 
                size={140} 
                color={isConnected && isGloballyOn ? '#10b981' : '#ef4444'} 
                label={
                  !isGloballyOn ? 'Desactivado Globalmente' : 
                  isConnected ? 'Conectado' : 'Desconectado'
                } 
              />
            </motion.div>
          </div>

          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <motion.div 
              className="flex justify-between items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02, x: 5 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-gray-400 text-sm">Número</span>
              <span className="text-white font-mono text-sm">{botStatus?.phone || 'No conectado'}</span>
            </motion.div>
            <motion.div 
              className="flex justify-between items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02, x: 5 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-gray-400 text-sm">Uptime</span>
              <span className="text-emerald-400 font-medium text-sm">{botStatus?.uptime || formatUptime(uptime)}</span>
            </motion.div>
            <motion.div 
              className="flex justify-between items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02, x: 5 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-gray-400 text-sm">Estado Global</span>
              <motion.span 
                className={`text-sm font-medium ${isGloballyOn ? 'text-emerald-400' : 'text-red-400'}`}
                animate={isGloballyOn ? { 
                  textShadow: [
                    "0 0 5px rgba(16, 185, 129, 0.5)",
                    "0 0 10px rgba(16, 185, 129, 0.8)",
                    "0 0 5px rgba(16, 185, 129, 0.5)"
                  ]
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isGloballyOn ? 'Activo' : 'Desactivado'}
              </motion.span>
            </motion.div>
            <motion.div 
              className="flex justify-between items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02, x: 5 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-gray-400 text-sm">Conexión</span>
              <span className={`text-sm font-medium ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                {isConnecting ? 'Conectando...' : isConnected ? 'Online' : 'Offline'}
              </span>
            </motion.div>
          </motion.div>
        </Card>

        {/* Activity Chart */}
        <Card animated delay={0.6} className="lg:col-span-2 p-6" hover={true}>
          <div className="flex items-center justify-between mb-6">
            <motion.h3 
              className="text-lg font-semibold text-white"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.7 }}
            >
              Actividad de Hoy
            </motion.h3>
            <motion.div 
              className="flex items-center gap-4 text-sm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.8 }}
            >
              <div className="flex items-center gap-2">
                <motion.div 
                  className="w-3 h-3 rounded-full bg-primary-500"
                  animate={{ 
                    boxShadow: [
                      "0 0 5px rgba(99, 102, 241, 0.5)",
                      "0 0 15px rgba(99, 102, 241, 0.8)",
                      "0 0 5px rgba(99, 102, 241, 0.5)"
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-gray-400">Mensajes</span>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            <BarChart data={getHourlyActivity()} height={180} animated={true} />
          </motion.div>

          <motion.div 
            className="grid grid-cols-3 gap-4 mt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            <motion.div 
              className="text-center p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              whileHover={{ scale: 1.05, y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <motion.p 
                className="text-2xl font-bold text-white"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 1.3 }}
              >
                <AnimatedCounter value={currentStats?.mensajesHoy || 0} duration={1.5} />
              </motion.p>
              <p className="text-xs text-gray-400 mt-1">Mensajes Hoy</p>
            </motion.div>
            <motion.div 
              className="text-center p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              whileHover={{ scale: 1.05, y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <motion.p 
                className="text-2xl font-bold text-white"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 1.4 }}
              >
                <AnimatedCounter value={currentStats?.comandosHoy || 0} duration={1.5} />
              </motion.p>
              <p className="text-xs text-gray-400 mt-1">Comandos Hoy</p>
            </motion.div>
            <motion.div 
              className="text-center p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              whileHover={{ scale: 1.05, y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <motion.p 
                className="text-2xl font-bold text-white"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 1.5 }}
              >
                <AnimatedCounter value={currentStats?.usuariosActivos || 0} duration={1.5} />
              </motion.p>
              <p className="text-xs text-gray-400 mt-1">Usuarios Activos</p>
            </motion.div>
          </motion.div>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Resources */}
        <Card animated delay={0.7} className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Recursos del Sistema</h3>
          
          <div className="flex items-center justify-center mb-6">
            <DonutChart
              data={[
                { label: 'Usado', value: memoryUsage?.systemPercentage || 0, color: '#6366f1' },
                { label: 'Libre', value: Math.max(0, 100 - (memoryUsage?.systemPercentage || 0)), color: 'rgba(255,255,255,0.1)' },
              ]}
              size={140}
              centerValue={`${memoryUsage?.systemPercentage || 0}%`}
              centerLabel="Memoria"
            />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">CPU</span>
                <span className="text-white">{cpuUsage}%</span>
              </div>
              <div className="progress-bar">
                <motion.div initial={{ width: 0 }} animate={{ width: `${cpuUsage}%` }} transition={{ duration: 1 }} className="progress-bar-fill" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Memoria</span>
                <span className="text-white">{memoryUsage?.systemPercentage || 0}%</span>
              </div>
              <div className="progress-bar">
                <motion.div initial={{ width: 0 }} animate={{ width: `${memoryUsage?.systemPercentage || 0}%` }} transition={{ duration: 1 }} className="progress-bar-fill" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Disco</span>
                <span className="text-white">{diskUsage?.percentage || 0}%</span>
              </div>
              <div className="progress-bar">
                <motion.div initial={{ width: 0 }} animate={{ width: `${diskUsage?.percentage || 0}%` }} transition={{ duration: 1 }} className="progress-bar-fill" />
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <Card animated delay={0.8} className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Estadísticas Rápidas</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-medium">Grupos Activos</p>
                  <p className="text-xs text-gray-400">Bot habilitado</p>
                </div>
              </div>
              <p className="text-xl font-bold text-white">{currentStats?.gruposActivos || 0}</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-medium">Pedidos Pendientes</p>
                  <p className="text-xs text-gray-400">Sin procesar</p>
                </div>
              </div>
              <p className="text-xl font-bold text-white">{currentStats?.pedidosHoy || 0}</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-medium">SubBots Online</p>
                  <p className="text-xs text-gray-400">Instancias activas</p>
                </div>
              </div>
              <p className="text-xl font-bold text-white">{onlineCount}/{totalCount}</p>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card animated delay={0.9} className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Actividad Reciente</h3>
          
          <div className="space-y-3">
            {activitiesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 animate-pulse">
                  <div className="w-8 h-8 bg-white/10 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-3 bg-white/10 rounded mb-1 w-2/3"></div>
                    <div className="h-2 bg-white/5 rounded w-1/2"></div>
                  </div>
                  <div className="w-12 h-2 bg-white/5 rounded"></div>
                </div>
              ))
            ) : recentActivity.length > 0 ? (
              recentActivity.map((item, index) => {
                const IconComponent = {
                  Package,
                  ShoppingCart,
                  Users,
                  Zap,
                  Settings,
                  MessageSquare,
                  Bot,
                  Activity
                }[item.icon] || Activity;

                const colorClass = {
                  success: 'emerald',
                  warning: 'amber',
                  info: 'cyan',
                  primary: 'primary',
                  violet: 'violet',
                  danger: 'red'
                }[item.color] || 'primary';

                const bgClass = {
                  emerald: 'bg-emerald-500/20',
                  amber: 'bg-amber-500/20',
                  cyan: 'bg-cyan-500/20',
                  primary: 'bg-primary-500/20',
                  violet: 'bg-violet-500/20',
                  red: 'bg-red-500/20',
                }[colorClass] || 'bg-primary-500/20';

                return (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                    <div className={`p-2 rounded-lg ${bgClass}`}>
                      <IconComponent className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 truncate">{item.desc}</p>
                    </div>
                    <span className="text-xs text-gray-500">{item.time}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Sin actividad reciente</p>
                <p className="text-gray-500 text-xs mt-1">La actividad aparecerá aquí cuando ocurra</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlowCard>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary-500/20">
              <TrendingUp className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{currentStats?.totalMensajes || 0}</p>
              <p className="text-xs text-gray-400">Mensajes Totales</p>
            </div>
          </div>
        </GlowCard>

        <GlowCard>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{currentStats?.totalComandos || 0}</p>
              <p className="text-xs text-gray-400">Comandos Totales</p>
            </div>
          </div>
        </GlowCard>

        <GlowCard>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-violet-500/20">
              <Clock className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{formatUptime(uptime)}</p>
              <p className="text-xs text-gray-400">Tiempo Activo</p>
            </div>
          </div>
        </GlowCard>

        <GlowCard>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/20">
              <Bot className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalCount}</p>
              <p className="text-xs text-gray-400">Total SubBots</p>
            </div>
          </div>
        </GlowCard>
      </div>

      {/* System Information */}
      <Card animated delay={1.0} className="p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Información del Sistema</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Procesador</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Uso CPU</span>
                <span className="text-white font-mono">{cpuUsage}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Núcleos</span>
                <span className="text-white font-mono">{systemInfo?.cpu?.cores || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Modelo</span>
                <span className="text-white font-mono text-xs truncate" title={systemInfo?.cpu?.model}>
                  {systemInfo?.cpu?.model ? systemInfo.cpu.model.slice(0, 20) + '...' : '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Memoria RAM</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Uso</span>
                <span className="text-white font-mono">{memoryUsage?.systemPercentage || 0}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total</span>
                <span className="text-white font-mono">{systemInfo?.memory?.totalGB || '-'} GB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Libre</span>
                <span className="text-white font-mono">{systemInfo?.memory?.freeGB || '-'} GB</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Sistema</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Plataforma</span>
                <span className="text-white font-mono">{systemInfo?.platform || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Arquitectura</span>
                <span className="text-white font-mono">{systemInfo?.arch || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Node.js</span>
                <span className="text-white font-mono">{systemInfo?.node || '-'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Almacenamiento</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Uso</span>
                <span className="text-white font-mono">{diskUsage?.percentage || 0}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total</span>
                <span className="text-white font-mono">{diskUsage?.totalGB || '-'} GB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Libre</span>
                <span className="text-white font-mono">{diskUsage?.freeGB || '-'} GB</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
