'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users, MessageSquare, FileText, Clock, Download, TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SimpleSelect as Select } from '@/components/ui/Select';
import { ProgressRing, BarChart } from '@/components/ui/Charts';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [groupStats, setGroupStats] = useState<any>(null);
  const [aporteStats, setAporteStats] = useState<any>(null);
  const [pedidoStats, setPedidoStats] = useState<any>(null);

  useEffect(() => { loadData(); }, [timeRange]);

  // Auto-refresh cada 5 minutos para analytics
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 300000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analytics, users, groups, aportes, pedidos] = await Promise.all([
        api.getAnalytics(timeRange).catch(() => ({})),
        api.getUsuarioStats().catch(() => ({})),
        api.getGroupStats().catch(() => ({})),
        api.getAporteStats().catch(() => ({})),
        api.getPedidoStats().catch(() => ({}))
      ]);
      setAnalyticsData(analytics);
      setUserStats(users);
      setGroupStats(groups);
      setAporteStats(aportes);
      setPedidoStats(pedidos);
    } catch (err) {
      toast.error('Error al cargar analíticas');
    } finally {
      setLoading(false);
    }
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
  ];

  if (loading) {
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
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-xl"><BarChart3 className="w-8 h-8 text-cyan-400" /></div>
            Analíticas del Sistema
          </h1>
          <p className="text-gray-400 mt-2">Métricas y estadísticas detalladas</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onChange={setTimeRange} options={[
            { value: '1d', label: 'Último día' }, { value: '7d', label: 'Últimos 7 días' },
            { value: '30d', label: 'Últimos 30 días' }, { value: '90d', label: 'Últimos 90 días' }
          ]} />
          <Button onClick={loadData} variant="secondary" icon={<RefreshCw className="w-4 h-4" />}>Actualizar</Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Usuarios Totales" value={formatNumber(userStats?.totalUsuarios || 0)} icon={<Users className="w-6 h-6" />} color="info" delay={0} />
        <StatCard title="Grupos Activos" value={formatNumber(groupStats?.totalGrupos || 0)} icon={<MessageSquare className="w-6 h-6" />} color="success" delay={0.1} />
        <StatCard title="Aportes" value={formatNumber(aporteStats?.totalAportes || 0)} icon={<FileText className="w-6 h-6" />} color="violet" delay={0.2} />
        <StatCard title="Pedidos" value={formatNumber(pedidoStats?.totalPedidos || 0)} icon={<Clock className="w-6 h-6" />} color="warning" delay={0.3} />
      </div>

      <Card animated delay={0.2} className="overflow-hidden">
        <div className="border-b border-white/10">
          <nav className="flex space-x-1 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-4 border-b-2 font-medium text-sm transition-all ${
                    activeTab === tab.id ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'
                  }`}>
                  <Icon className="w-5 h-5" />{tab.name}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="p-6">
          {activeTab === 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Tendencias</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Usuarios', value: Math.round(((userStats?.usuariosActivos || 0) / Math.max(1, userStats?.totalUsuarios || 1) * 100 - 50)) },
                    { label: 'Grupos', value: Math.round(((groupStats?.gruposActivos || 0) / Math.max(1, groupStats?.totalGrupos || 1) * 100 - 50)) },
                    { label: 'Aportes', value: Math.round(((aporteStats?.aportesAprobados || 0) / Math.max(1, aporteStats?.totalAportes || 1) * 100 - 50)) },
                    { label: 'Pedidos', value: Math.round(((pedidoStats?.pedidosCompletados || 0) / Math.max(1, pedidoStats?.totalPedidos || 1) * 100 - 50)) }
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-gray-400">{label}</span>
                      <div className={`flex items-center gap-2 ${value > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {value > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span className="font-semibold">{value > 0 ? '+' : ''}{value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Actividad</h3>
                <div className="flex items-center justify-center"><ProgressRing progress={Math.round((userStats?.usuariosActivos || 0) / Math.max(1, userStats?.totalUsuarios || 1) * 100)} size={120} strokeWidth={10} color="#06b6d4" label={`${Math.round((userStats?.usuariosActivos || 0) / Math.max(1, userStats?.totalUsuarios || 1) * 100)}%`} /></div>
              </div>
            </div>
          )}
          {activeTab === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Distribución por Rol</h3>
                <div className="space-y-3">
                  {[{ label: 'Admins', value: userStats?.totalAdmins || 0, color: 'bg-red-500' },
                    { label: 'Creadores', value: userStats?.totalCreadores || 0, color: 'bg-blue-500' },
                    { label: 'Moderadores', value: userStats?.totalModeradores || 0, color: 'bg-emerald-500' }
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${item.color}`} /><span className="text-gray-400">{item.label}</span></div>
                      <span className="text-white font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Actividad</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl"><span className="text-gray-400">Usuarios Activos</span><span className="text-white font-semibold">{userStats?.usuariosActivos || 0}</span></div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Estados de Aportes</h3>
                <BarChart data={[
                  { label: 'Aprobados', value: aporteStats?.aportesAprobados || 0, color: '#10b981' },
                  { label: 'Pendientes', value: aporteStats?.aportesPendientes || 0, color: '#f59e0b' },
                  { label: 'Rechazados', value: aporteStats?.aportesRechazados || 0, color: '#ef4444' },
                ]} height={200} />
              </div>
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Estados de Pedidos</h3>
                <BarChart data={[
                  { label: 'Completados', value: pedidoStats?.pedidosCompletados || 0, color: '#10b981' },
                  { label: 'Pendientes', value: pedidoStats?.pedidosPendientes || 0, color: '#f59e0b' },
                  { label: 'En Proceso', value: pedidoStats?.pedidosEnProceso || 0, color: '#3b82f6' },
                ]} height={200} />
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
