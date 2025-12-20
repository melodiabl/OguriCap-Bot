import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  MessageSquare,
  Package,
  ShoppingCart,
  Bot,
  Zap,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { AnimatedCard, StatCard, GlowCard } from '../components/ui/AnimatedCard';
import { AnimatedGrid, ActivityItem } from '../components/ui/AnimatedList';
import { ProgressRing, BarChart, DonutChart, Sparkline } from '../components/ui/Charts';
import { BotStatusCard, RealTimeBadge } from '../components/ui/StatusIndicator';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { useDashboardStats, useBotStatus, useSystemStats, useSubbotsStatus } from '../hooks/useRealTime';
import { useSocket } from '../contexts/SocketContext';
import { useSocketBotStatus, useSocketNotifications } from '../hooks/useSocketEvents';

export const ModernDashboard: React.FC = () => {
  const { stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats(15000);
  const { status: botStatus, isConnected, isConnecting, refetch: refetchBot } = useBotStatus(5000);
  const { memoryUsage, uptime } = useSystemStats(10000);
  const { onlineCount, totalCount } = useSubbotsStatus(10000);
  const { isConnected: isSocketConnected } = useSocket();
  
  // Socket.IO real-time updates
  useSocketBotStatus();
  useSocketNotifications();

  const handleRefresh = () => {
    refetchStats();
    refetchBot();
  };

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Sample sparkline data
  const generateSparkline = () => Array.from({ length: 12 }, () => Math.floor(Math.random() * 100));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Vista general del sistema en tiempo real</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          {/* Socket.IO indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isSocketConnected 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
            {isSocketConnected ? 'Tiempo Real Activo' : 'Sin conexión'}
          </div>
          <RealTimeBadge isActive={isConnected} />
          <AnimatedButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={handleRefresh}
          >
            Actualizar
          </AnimatedButton>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <AnimatedGrid columns={5} className="gap-4">
        <StatCard
          title="Usuarios Totales"
          value={stats?.totalUsuarios || 0}
          subtitle={`${stats?.usuariosActivos || 0} activos hoy`}
          icon={<Users className="w-6 h-6" />}
          color="primary"
          delay={0}
          loading={statsLoading}
        />
        <StatCard
          title="Grupos"
          value={stats?.totalGrupos || 0}
          subtitle={`${stats?.gruposActivos || 0} activos`}
          icon={<MessageSquare className="w-6 h-6" />}
          color="success"
          delay={0.1}
          loading={statsLoading}
        />
        <StatCard
          title="Aportes"
          value={stats?.totalAportes || 0}
          subtitle={`${stats?.aportesHoy || 0} hoy`}
          icon={<Package className="w-6 h-6" />}
          color="violet"
          delay={0.2}
          loading={statsLoading}
        />
        <StatCard
          title="Pedidos"
          value={stats?.totalPedidos || 0}
          subtitle={`${stats?.pedidosHoy || 0} hoy`}
          icon={<ShoppingCart className="w-6 h-6" />}
          color="warning"
          delay={0.3}
          loading={statsLoading}
        />
        <StatCard
          title="SubBots"
          value={stats?.totalSubbots || 0}
          subtitle={`${onlineCount} online`}
          icon={<Zap className="w-6 h-6" />}
          color="cyan"
          delay={0.4}
          loading={statsLoading}
        />
      </AnimatedGrid>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bot Status */}
        <AnimatedCard delay={0.5} className="lg:col-span-1">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Estado del Bot</h3>
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-glow-emerald' : 'bg-red-500'}`} />
            </div>

            <div className="flex items-center justify-center mb-6">
              <motion.div
                animate={isConnected ? { scale: [1, 1.05, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <ProgressRing
                  progress={isConnected ? 100 : 0}
                  size={140}
                  color={isConnected ? '#10b981' : '#ef4444'}
                  label={isConnected ? 'Conectado' : 'Desconectado'}
                />
              </motion.div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
                <span className="text-gray-400 text-sm">Número</span>
                <span className="text-white font-mono text-sm">
                  {botStatus?.phone || 'No conectado'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
                <span className="text-gray-400 text-sm">Uptime</span>
                <span className="text-emerald-400 font-medium text-sm">
                  {botStatus?.uptime || formatUptime(uptime)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
                <span className="text-gray-400 text-sm">Estado</span>
                <span className={`text-sm font-medium ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isConnecting ? 'Conectando...' : isConnected ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* Activity Chart */}
        <AnimatedCard delay={0.6} className="lg:col-span-2">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Actividad de Hoy</h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary-500" />
                  <span className="text-gray-400">Mensajes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-gray-400">Comandos</span>
                </div>
              </div>
            </div>

            <BarChart
              data={[
                { label: '00:00', value: Math.floor(Math.random() * 50), color: '#6366f1' },
                { label: '04:00', value: Math.floor(Math.random() * 50), color: '#6366f1' },
                { label: '08:00', value: Math.floor(Math.random() * 100), color: '#6366f1' },
                { label: '12:00', value: Math.floor(Math.random() * 150), color: '#6366f1' },
                { label: '16:00', value: Math.floor(Math.random() * 120), color: '#6366f1' },
                { label: '20:00', value: Math.floor(Math.random() * 80), color: '#6366f1' },
                { label: 'Ahora', value: stats?.mensajesHoy || 0, color: '#10b981' },
              ]}
              height={180}
            />

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
          </div>
        </AnimatedCard>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Resources */}
        <AnimatedCard delay={0.7}>
          <div className="p-6">
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
                  <span className="text-white">32%</span>
                </div>
                <div className="progress-bar">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '32%' }}
                    transition={{ duration: 1 }}
                    className="progress-bar-fill"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Memoria</span>
                  <span className="text-white">{memoryUsage?.systemPercentage || 45}%</span>
                </div>
                <div className="progress-bar">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${memoryUsage?.systemPercentage || 45}%` }}
                    transition={{ duration: 1 }}
                    className="progress-bar-fill"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Disco</span>
                  <span className="text-white">28%</span>
                </div>
                <div className="progress-bar">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '28%' }}
                    transition={{ duration: 1 }}
                    className="progress-bar-fill"
                  />
                </div>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* Quick Stats */}
        <AnimatedCard delay={0.8}>
          <div className="p-6">
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
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{stats?.gruposActivos || 0}</p>
                  <Sparkline data={generateSparkline()} color="#10b981" width={60} height={20} />
                </div>
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
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{stats?.pedidosHoy || 0}</p>
                  <Sparkline data={generateSparkline()} color="#f59e0b" width={60} height={20} />
                </div>
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
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{onlineCount}/{totalCount}</p>
                  <Sparkline data={generateSparkline()} color="#06b6d4" width={60} height={20} />
                </div>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* Recent Activity */}
        <AnimatedCard delay={0.9}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Actividad Reciente</h3>
            
            <div className="space-y-2">
              <ActivityItem
                icon={<MessageSquare className="w-4 h-4" />}
                title="Nuevo mensaje"
                description="Grupo: Manhwas Premium"
                time="Hace 2m"
                color="primary"
              />
              <ActivityItem
                icon={<Package className="w-4 h-4" />}
                title="Aporte recibido"
                description="Usuario: @melodia"
                time="Hace 5m"
                color="success"
              />
              <ActivityItem
                icon={<Users className="w-4 h-4" />}
                title="Nuevo usuario"
                description="Se unió al bot"
                time="Hace 10m"
                color="info"
              />
              <ActivityItem
                icon={<AlertCircle className="w-4 h-4" />}
                title="Pedido pendiente"
                description="Requiere atención"
                time="Hace 15m"
                color="warning"
              />
              <ActivityItem
                icon={<Zap className="w-4 h-4" />}
                title="SubBot conectado"
                description="Instancia #3 online"
                time="Hace 20m"
                color="success"
              />
            </div>
          </div>
        </AnimatedCard>
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
};

export default ModernDashboard;
