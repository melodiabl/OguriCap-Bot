import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Users,
  MessageSquare,
  FileText,
  Clock,
  Download,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Server,
  Loader2
} from 'lucide-react';
import { useQuery } from 'react-query';
import { apiService, getUsuarioStats, getGroupStats, getAporteStats, getPedidoStats } from '../services/api';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { ProgressRing, BarChart } from '../components/ui/Charts';
import { CustomSelect } from '../components/ui/CustomSelect';

export const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: analyticsData, isLoading, error } = useQuery(
    ['analytics', timeRange],
    () => apiService.getAnalytics(timeRange)
  );

  const { data: userStats } = useQuery('userStats', getUsuarioStats);
  const { data: groupStats } = useQuery('groupStats', getGroupStats);
  const { data: aporteStats } = useQuery('aporteStats', getAporteStats);
  const { data: pedidoStats } = useQuery('pedidoStats', getPedidoStats);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const tabs = [
    { id: 0, name: 'Resumen', icon: BarChart3 },
    { id: 1, name: 'Usuarios', icon: Users },
    { id: 2, name: 'Contenido', icon: FileText },
    { id: 3, name: 'Rendimiento', icon: Server },
  ];

  if (error) {
    return (
      <div className="p-6">
        <AnimatedCard className="p-6 border-red-500/30">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-red-400" />
            <span className="text-red-400">Error al cargar analíticas: {(error as any).message}</span>
          </div>
        </AnimatedCard>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary-400" />
          <h2 className="text-xl font-semibold text-white">Cargando analíticas...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-xl">
                <BarChart3 className="w-8 h-8 text-cyan-400" />
              </div>
              Analíticas del Sistema
            </h1>
            <p className="text-gray-400 mt-2">Métricas y estadísticas detalladas del sistema</p>
          </div>
          <div className="flex items-center gap-3">
            <CustomSelect
              value={timeRange}
              onChange={setTimeRange}
              options={[
                { value: '1d', label: 'Último día' },
                { value: '7d', label: 'Últimos 7 días' },
                { value: '30d', label: 'Últimos 30 días' },
                { value: '90d', label: 'Últimos 90 días' }
              ]}
              placeholder="Seleccionar período"
            />
            <AnimatedButton
              onClick={handleRefresh}
              loading={isRefreshing}
              variant="secondary"
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Actualizar
            </AnimatedButton>
            <AnimatedButton variant="primary" icon={<Download className="w-4 h-4" />}>
              Exportar
            </AnimatedButton>
          </div>
        </motion.div>

        {/* Stats principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Usuarios Totales"
            value={formatNumber(userStats?.totalUsuarios || 0)}
            icon={<Users className="w-6 h-6" />}
            color="info"
            trend={{ value: analyticsData?.trends?.usersGrowth || 0, isPositive: (analyticsData?.trends?.usersGrowth || 0) > 0 }}
            delay={0}
          />
          <StatCard
            title="Grupos Activos"
            value={formatNumber(groupStats?.totalGrupos || 0)}
            icon={<MessageSquare className="w-6 h-6" />}
            color="success"
            trend={{ value: analyticsData?.trends?.groupsGrowth || 0, isPositive: (analyticsData?.trends?.groupsGrowth || 0) > 0 }}
            delay={0.1}
          />
          <StatCard
            title="Aportes"
            value={formatNumber(aporteStats?.totalAportes || 0)}
            icon={<FileText className="w-6 h-6" />}
            color="violet"
            trend={{ value: analyticsData?.trends?.aportesGrowth || 0, isPositive: (analyticsData?.trends?.aportesGrowth || 0) > 0 }}
            delay={0.2}
          />
          <StatCard
            title="Pedidos"
            value={formatNumber(pedidoStats?.totalPedidos || 0)}
            icon={<Clock className="w-6 h-6" />}
            color="warning"
            trend={{ value: analyticsData?.trends?.pedidosGrowth || 0, isPositive: (analyticsData?.trends?.pedidosGrowth || 0) > 0 }}
            delay={0.3}
          />
        </div>

        {/* Tabs */}
        <AnimatedCard delay={0.2} className="overflow-hidden">
          <div className="border-b border-white/10">
            <nav className="flex space-x-1 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-4 border-b-2 font-medium text-sm transition-all ${
                      activeTab === tab.id
                        ? 'border-cyan-500 text-cyan-400'
                        : 'border-transparent text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Tab Resumen */}
            {activeTab === 0 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Resumen General</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Engagement */}
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Engagement</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Usuarios Activos Diarios</span>
                          <span className="text-white font-semibold">{formatNumber(analyticsData?.engagement?.dailyActiveUsers || 0)}</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((analyticsData?.engagement?.dailyActiveUsers || 0) / (userStats?.totalUsuarios || 1) * 100, 100)}%` }}
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Usuarios Activos Semanales</span>
                          <span className="text-white font-semibold">{formatNumber(analyticsData?.engagement?.weeklyActiveUsers || 0)}</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((analyticsData?.engagement?.weeklyActiveUsers || 0) / (userStats?.totalUsuarios || 1) * 100, 100)}%` }}
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Usuarios Activos Mensuales</span>
                          <span className="text-white font-semibold">{formatNumber(analyticsData?.engagement?.monthlyActiveUsers || 0)}</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((analyticsData?.engagement?.monthlyActiveUsers || 0) / (userStats?.totalUsuarios || 1) * 100, 100)}%` }}
                            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tendencias */}
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Tendencias</h3>
                    <div className="space-y-4">
                      {analyticsData?.trends && Object.entries(analyticsData.trends).map(([key, value]) => {
                        const numValue = value as number;
                        const isPositive = numValue > 0;
                        return (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-gray-400 capitalize">{key.replace('Growth', '')}</span>
                            <div className={`flex items-center gap-2 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              <span className="font-semibold">{isPositive ? '+' : ''}{numValue}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Usuarios */}
            {activeTab === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Análisis de Usuarios</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Distribución por Rol</h3>
                    <div className="flex items-center justify-center mb-6">
                      <ProgressRing
                        progress={Math.round((userStats?.totalAdmins || 0) / (userStats?.totalUsuarios || 1) * 100)}
                        size={120}
                        strokeWidth={10}
                        color="#6366f1"
                      />
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Administradores', value: userStats?.totalAdmins || 0, color: 'bg-red-500' },
                        { label: 'Creadores', value: userStats?.totalCreadores || 0, color: 'bg-blue-500' },
                        { label: 'Moderadores', value: userStats?.totalModeradores || 0, color: 'bg-emerald-500' },
                        { label: 'Usuarios', value: (userStats?.totalUsuarios || 0) - (userStats?.totalAdmins || 0) - (userStats?.totalCreadores || 0) - (userStats?.totalModeradores || 0), color: 'bg-gray-500' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${item.color}`} />
                            <span className="text-gray-400">{item.label}</span>
                          </div>
                          <span className="text-white font-semibold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Actividad de Usuarios</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <span className="text-gray-400">Tiempo Promedio de Sesión</span>
                        <span className="text-white font-semibold">{analyticsData?.engagement?.averageSessionTime || '0m'}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <span className="text-gray-400">Tasa de Rebote</span>
                        <span className="text-white font-semibold">{(analyticsData?.engagement?.bounceRate || 0).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <span className="text-gray-400">Usuarios Activos</span>
                        <span className="text-white font-semibold">{formatNumber(analyticsData?.overview?.activeUsers || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Contenido */}
            {activeTab === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Análisis de Contenido</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Estados de Aportes</h3>
                    <BarChart
                      data={[
                        { label: 'Aprobados', value: aporteStats?.aportesAprobados || 0, color: '#10b981' },
                        { label: 'Pendientes', value: aporteStats?.aportesPendientes || 0, color: '#f59e0b' },
                        { label: 'Rechazados', value: aporteStats?.aportesRechazados || 0, color: '#ef4444' },
                      ]}
                      height={200}
                    />
                  </div>

                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Estados de Pedidos</h3>
                    <BarChart
                      data={[
                        { label: 'Completados', value: pedidoStats?.pedidosCompletados || 0, color: '#10b981' },
                        { label: 'Pendientes', value: pedidoStats?.pedidosPendientes || 0, color: '#f59e0b' },
                        { label: 'En Proceso', value: pedidoStats?.pedidosEnProceso || 0, color: '#3b82f6' },
                      ]}
                      height={200}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab Rendimiento */}
            {activeTab === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Análisis de Rendimiento</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Métricas del Sistema</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Tiempo de Respuesta</span>
                          <span className="text-white font-semibold">{analyticsData?.performance?.responseTime || 0}ms</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((analyticsData?.performance?.responseTime || 0) / 1000 * 100, 100)}%` }}
                            className={`h-full rounded-full ${(analyticsData?.performance?.responseTime || 0) < 500 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Uptime</span>
                          <span className="text-white font-semibold">{(analyticsData?.performance?.uptime || 0).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${analyticsData?.performance?.uptime || 0}%` }}
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Tasa de Error</span>
                          <span className="text-white font-semibold">{(analyticsData?.performance?.errorRate || 0).toFixed(2)}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${analyticsData?.performance?.errorRate || 0}%` }}
                            className="h-full bg-red-500 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Estado del Sistema</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-white/5 rounded-xl">
                        <ProgressRing
                          progress={analyticsData?.performance?.uptime || 0}
                          size={80}
                          strokeWidth={8}
                          color="#10b981"
                        />
                        <p className="text-gray-400 text-sm mt-2">Uptime</p>
                      </div>
                      <div className="text-center p-4 bg-white/5 rounded-xl">
                        <ProgressRing
                          progress={100 - (analyticsData?.performance?.errorRate || 0)}
                          size={80}
                          strokeWidth={8}
                          color="#06b6d4"
                        />
                        <p className="text-gray-400 text-sm mt-2">Estabilidad</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
};

export default Analytics;
