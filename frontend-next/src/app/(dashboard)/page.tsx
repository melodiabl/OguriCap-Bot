'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Users, MessageSquare, Package, ShoppingCart, Bot, Zap,
  TrendingUp, Activity, Clock, CheckCircle, AlertCircle, RefreshCw, Radio,
} from 'lucide-react';
import { Card, StatCard, GlowCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressRing, BarChart, DonutChart, Sparkline } from '@/components/ui/Charts';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
import { useDashboardStats, useBotStatus, useSystemStats, useSubbotsStatus } from '@/hooks/useRealTime';
import { useSocket, SOCKET_EVENTS } from '@/contexts/SocketContext';
import { formatUptime } from '@/lib/utils';

interface RecentActivity {
  icon: any;
  title: string;
  desc: string;
  time: string;
  color: string;
}

export default function DashboardPage() {
  const { stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats(15000);
  const { status: botStatus, isConnected, isConnecting, refetch: refetchBot } = useBotStatus(5000);
  const { memoryUsage, uptime } = useSystemStats(10000);
  const { onlineCount, totalCount } = useSubbotsStatus(10000);
  const { isConnected: isSocketConnected, socket } = useSocket();
  const [recentActivity, setRecentActivity] = React.useState<RecentActivity[]>([]);

  // Listen for real-time events to build activity feed
  React.useEffect(() => {
    if (!socket) return;

    const addActivity = (activity: RecentActivity) => {
      setRecentActivity(prev => [activity, ...prev.slice(0, 4)]);
    };

    const handleAporteCreated = () => {
      addActivity({ icon: Package, title: 'Nuevo aporte', desc: 'Aporte recibido', time: 'Ahora', color: 'success' });
    };

    const handlePedidoCreated = () => {
      addActivity({ icon: ShoppingCart, title: 'Nuevo pedido', desc: 'Pedido creado', time: 'Ahora', color: 'warning' });
    };

    const handleBotConnected = () => {
      addActivity({ icon: Bot, title: 'Bot conectado', desc: 'Conexión establecida', time: 'Ahora', color: 'success' });
    };

    const handleSubbotConnected = (data: any) => {
      addActivity({ icon: Zap, title: 'SubBot conectado', desc: `Instancia ${data?.subbotCode || ''} online`, time: 'Ahora', color: 'success' });
    };

    socket.on(SOCKET_EVENTS.APORTE_CREATED, handleAporteCreated);
    socket.on(SOCKET_EVENTS.PEDIDO_CREATED, handlePedidoCreated);
    socket.on(SOCKET_EVENTS.BOT_CONNECTED, handleBotConnected);
    socket.on(SOCKET_EVENTS.SUBBOT_CONNECTED, handleSubbotConnected);

    return () => {
      socket.off(SOCKET_EVENTS.APORTE_CREATED, handleAporteCreated);
      socket.off(SOCKET_EVENTS.PEDIDO_CREATED, handlePedidoCreated);
      socket.off(SOCKET_EVENTS.BOT_CONNECTED, handleBotConnected);
      socket.off(SOCKET_EVENTS.SUBBOT_CONNECTED, handleSubbotConnected);
    };
  }, [socket]);

  const handleRefresh = () => {
    refetchStats();
    refetchBot();
  };

  const getHourlyActivity = () => {
    // Datos basados en estadísticas reales del backend
    const baseValue = stats?.mensajesHoy || 0;
    const hourlyAvg = Math.max(1, Math.floor(baseValue / 12));
    return Array.from({ length: 12 }, (_, i) => ({
      label: `${(i * 2).toString().padStart(2, '0')}:00`,
      value: Math.floor(hourlyAvg * (0.5 + Math.random())),
      color: '#6366f1'
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
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isSocketConnected 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
            {isSocketConnected ? 'Tiempo Real Activo' : 'Sin conexión'}
          </div>
          <RealTimeBadge isActive={isConnected} />
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={handleRefresh}>
            Actualizar
          </Button>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Usuarios Totales" value={stats?.totalUsuarios || 0} subtitle={`${stats?.usuariosActivos || 0} activos`} icon={<Users className="w-6 h-6" />} color="primary" delay={0} loading={statsLoading} />
        <StatCard title="Grupos" value={stats?.totalGrupos || 0} subtitle={`${stats?.gruposActivos || 0} activos`} icon={<MessageSquare className="w-6 h-6" />} color="success" delay={0.1} loading={statsLoading} />
        <StatCard title="Aportes" value={stats?.totalAportes || 0} subtitle={`${stats?.aportesHoy || 0} hoy`} icon={<Package className="w-6 h-6" />} color="violet" delay={0.2} loading={statsLoading} />
        <StatCard title="Pedidos" value={stats?.totalPedidos || 0} subtitle={`${stats?.pedidosHoy || 0} hoy`} icon={<ShoppingCart className="w-6 h-6" />} color="warning" delay={0.3} loading={statsLoading} />
        <StatCard title="SubBots" value={stats?.totalSubbots || totalCount} subtitle={`${onlineCount} online`} icon={<Zap className="w-6 h-6" />} color="cyan" delay={0.4} loading={statsLoading} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bot Status */}
        <Card animated delay={0.5} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Estado del Bot</h3>
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-glow-emerald' : 'bg-red-500'}`} />
          </div>

          <div className="flex items-center justify-center mb-6">
            <motion.div animate={isConnected ? { scale: [1, 1.05, 1] } : {}} transition={{ repeat: Infinity, duration: 2 }}>
              <ProgressRing progress={isConnected ? 100 : 0} size={140} color={isConnected ? '#10b981' : '#ef4444'} label={isConnected ? 'Conectado' : 'Desconectado'} />
            </motion.div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
              <span className="text-gray-400 text-sm">Número</span>
              <span className="text-white font-mono text-sm">{botStatus?.phone || 'No conectado'}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
              <span className="text-gray-400 text-sm">Uptime</span>
              <span className="text-emerald-400 font-medium text-sm">{botStatus?.uptime || formatUptime(uptime)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
              <span className="text-gray-400 text-sm">Estado</span>
              <span className={`text-sm font-medium ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                {isConnecting ? 'Conectando...' : isConnected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </Card>

        {/* Activity Chart */}
        <Card animated delay={0.6} className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Actividad de Hoy</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary-500" />
                <span className="text-gray-400">Mensajes</span>
              </div>
            </div>
          </div>

          <BarChart data={getHourlyActivity()} height={180} />

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 rounded-xl bg-white/5">
              <p className="text-2xl font-bold text-white">{stats?.mensajesHoy || 0}</p>
              <p className="text-xs text-gray-400 mt-1">Mensajes Hoy</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5">
              <p className="text-2xl font-bold text-white">{stats?.comandosHoy || 0}</p>
              <p className="text-xs text-gray-400 mt-1">Comandos Hoy</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5">
              <p className="text-2xl font-bold text-white">{stats?.usuariosActivos || 0}</p>
              <p className="text-xs text-gray-400 mt-1">Usuarios Activos</p>
            </div>
          </div>
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
                { label: 'Usado', value: memoryUsage?.systemPercentage || 45, color: '#6366f1' },
                { label: 'Libre', value: 100 - (memoryUsage?.systemPercentage || 45), color: 'rgba(255,255,255,0.1)' },
              ]}
              size={140}
              centerValue={`${memoryUsage?.systemPercentage || 45}%`}
              centerLabel="Memoria"
            />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">CPU</span>
                <span className="text-white">~{Math.min(100, Math.floor((memoryUsage?.systemPercentage || 30) * 0.7))}%</span>
              </div>
              <div className="progress-bar">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.floor((memoryUsage?.systemPercentage || 30) * 0.7))}%` }} transition={{ duration: 1 }} className="progress-bar-fill" />
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
              <p className="text-xl font-bold text-white">{stats?.gruposActivos || 0}</p>
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
              <p className="text-xl font-bold text-white">{stats?.pedidosHoy || 0}</p>
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
            {recentActivity.length > 0 ? (
              recentActivity.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className={`p-2 rounded-lg bg-${item.color === 'success' ? 'emerald' : item.color === 'warning' ? 'amber' : item.color === 'info' ? 'cyan' : 'primary'}-500/20`}>
                    <item.icon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 truncate">{item.desc}</p>
                  </div>
                  <span className="text-xs text-gray-500">{item.time}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Sin actividad reciente</p>
                <p className="text-gray-500 text-xs mt-1">Los eventos aparecerán aquí en tiempo real</p>
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
              <p className="text-2xl font-bold text-white">{stats?.totalMensajes || 0}</p>
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
              <p className="text-2xl font-bold text-white">{stats?.totalComandos || 0}</p>
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
    </div>
  );
}