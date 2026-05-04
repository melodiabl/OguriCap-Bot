'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle,
  Clock,
  Cpu,
  MessageSquare,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import { StatCard } from '@/components/ui/Card';
import { ActionButton } from '@/components/ui/ActionButton';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing, BarChart, DonutChart } from '@/components/ui/Charts';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { PageHeader } from '@/components/ui/PageHeader';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { BroadcastTool } from '@/components/broadcast/BroadcastTool';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { Progress } from '@/components/ui/Progress';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDashboardStats, useBotStatus, useSystemStats, useSubbotsStatus, useRecentActivity } from '@/hooks/useRealTime';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useGlobalUpdate } from '@/contexts/GlobalUpdateContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useSocketConnection } from '@/contexts/SocketContext';
import { formatUptime, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardPage() {
  const { stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const { status: botStatus, isConnected, isConnecting, refetch: refetchBot } = useBotStatus();
  const { isGloballyOn } = useBotGlobalState();
  const { refreshAll } = useGlobalUpdate();
  const { memoryUsage, cpuUsage, uptime } = useSystemStats();
  const { onlineCount, totalCount } = useSubbotsStatus();
  const { isConnected: isSocketConnected } = useSocketConnection();
  const { activities: recentActivity, isLoading: activitiesLoading } = useRecentActivity();
  const { unreadCount } = useNotifications();

  const handleRefresh = React.useCallback(() => {
    refreshAll();
    refetchStats();
    refetchBot();
  }, [refreshAll, refetchStats, refetchBot]);

  const botStatusText = !isGloballyOn ? 'Desactivado' : isConnecting ? 'Sincronizando' : isConnected ? 'Conectado' : 'Desconectado';

  const topStats = [
    {
      title: 'Usuarios Panel',
      value: stats?.totalUsuarios || 0,
      subtitle: `${stats?.usuariosActivos || 0} activos ahora`,
      icon: <Users className="h-6 w-6" />,
      color: 'primary' as const,
      trend: stats?.tendencias?.usuarios,
    },
    {
      title: 'Comunidad WP',
      value: stats?.comunidad?.usuariosWhatsApp || 0,
      subtitle: `${stats?.comunidad?.usuariosActivos || 0} activos`,
      icon: <MessageSquare className="h-6 w-6" />,
      color: 'success' as const,
      trend: stats?.tendencias?.usuarios,
    },
    {
      title: 'Grupos Activos',
      value: stats?.totalGrupos || 0,
      subtitle: `${stats?.gruposActivos || 0} vinculados`,
      icon: <CheckCircle className="h-6 w-6" />,
      color: 'violet' as const,
      trend: stats?.tendencias?.grupos,
    },
    {
      title: 'Aportes Totales',
      value: stats?.totalAportes || 0,
      subtitle: `${stats?.aportesHoy || 0} hoy`,
      icon: <Package className="h-6 w-6" />,
      color: 'warning' as const,
      trend: stats?.tendencias?.aportes,
    },
    {
      title: 'Red SubBots',
      value: totalCount,
      subtitle: `${onlineCount} en linea`,
      icon: <Zap className="h-6 w-6" />,
      color: 'info' as const,
      active: onlineCount > 0,
    },
  ];

  return (
    <div className="relative space-y-8 p-4 sm:p-8 lg:p-10 min-h-screen overflow-hidden">
      {/* Premium Ambient Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(var(--primary),0.05),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(var(--page-c),0.05),transparent_40%)]" />
        {!isSocketConnected && (
          <div className="absolute inset-0 bg-danger/5 animate-pulse" />
        )}
      </div>

      <div className="relative z-10 space-y-10">
        <PageHeader 
          title="Command Center"
          description="Gestiona y monitorea la actividad de OguriCap en tiempo real."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton
                icon={<RefreshCw className={cn("h-4 w-4", (statsLoading || activitiesLoading) && "animate-spin")} />}
                onClick={handleRefresh}
                variant="secondary"
                disabled={statsLoading}
              >
                Sincronizar
              </ActionButton>
              <Link href="/configuracion">
                <ActionButton icon={<Settings className="h-4 w-4" />} variant="primary">
                  Configurar
                </ActionButton>
              </Link>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <RealTimeBadge isActive={isSocketConnected} />
            <StatusBadge 
              tone={!isGloballyOn ? 'danger' : isConnecting ? 'warning' : isConnected ? 'success' : 'neutral'} 
              pulse={isConnecting}
            >
              {!isGloballyOn ? 'Sistema Desactivado' : isConnecting ? 'Sincronizando...' : isConnected ? 'Bot Activo' : 'Bot Desconectado'}
            </StatusBadge>
            <div className="hidden sm:block w-px h-4 bg-white/10 mx-1" />
            {uptime > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3 w-3 text-primary" />
                Uptime: {formatUptime(uptime)}
              </div>
            )}
            {unreadCount > 0 && (
              <Badge variant="danger" className="animate-pulse">
                {unreadCount} Alertas
              </Badge>
            )}
          </div>
        </PageHeader>

        {/* Main Stats Grid */}
        <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {topStats.map((stat, i) => (
            <StaggerItem key={stat.title}>
              <StatCard {...stat} delay={i * 0.1} loading={statsLoading && !stats} />
            </StaggerItem>
          ))}
        </Stagger>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Activity & Broadcast */}
          <div className="lg:col-span-8 space-y-8">
            <DashboardCard
              title="Flujo de Interacción"
              description="Mensajes y comandos procesados en tiempo real."
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
              variant="chart"
              glow
            >
              <div className="h-[320px] w-full mt-8">
                <BarChart 
                  data={stats?.actividadPorHora || []} 
                  height={320}
                  showGrid
                  animated
                />
              </div>
            </DashboardCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <BroadcastTool />
              
              <DashboardCard
                title="Actividad Reciente"
                description="Últimos eventos registrados en el sistema."
                icon={<Activity className="h-5 w-5 text-oguri-lavender" />}
              >
                <div className="space-y-1 mt-4">
                  {activitiesLoading && !recentActivity ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 py-3">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </div>
                    ))
                  ) : (
                    recentActivity?.slice(0, 6).map((activity: any, i: number) => (
                      <motion.div 
                        key={activity.id || i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 hover:bg-white/[0.03]"
                      >
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 shadow-glow-sm",
                          activity.type === 'command' ? "bg-primary/10 text-primary" : 
                          activity.type === 'system' ? "bg-warning/10 text-warning" : "bg-info/10 text-info"
                        )}>
                          {activity.type === 'command' ? <Zap className="h-5 w-5" /> : 
                           activity.type === 'system' ? <Settings className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {activity.message}
                            </p>
                            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{activity.timestamp}</span>
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                            {activity.user || 'Sistema'} • {activity.target || 'Global'}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
                <Link href="/logs" className="block mt-6">
                  <button className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:bg-white/10 hover:text-foreground hover:border-primary/30 transition-all duration-300">
                    Ver todos los registros
                  </button>
                </Link>
              </DashboardCard>
            </div>
          </div>

          {/* Right Column: System & Quick Access */}
          <div className="lg:col-span-4 space-y-8">
            <DashboardCard
              title="System Health"
              description="Estado actual de la infraestructura."
              icon={<Cpu className="h-5 w-5 text-oguri-cyan" />}
              glow={cpuUsage > 80}
            >
              <div className="space-y-8 mt-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                    <span className="text-muted-foreground">CPU Usage</span>
                    <span className={cn(cpuUsage > 80 ? "text-danger" : "text-primary")}>{cpuUsage.toFixed(1)}%</span>
                  </div>
                  <div className="progress-bar h-2.5">
                    <div 
                      className={cn("progress-bar-fill shadow-glow-sm", cpuUsage > 80 ? "bg-danger" : "bg-primary")} 
                      style={{ transform: `scaleX(${cpuUsage / 100})` }} 
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                    <span className="text-muted-foreground">Memory Usage</span>
                    <span className="text-oguri-lavender">{memoryUsage?.systemPercentage?.toFixed(1) || 0}%</span>
                  </div>
                  <div className="progress-bar h-2.5">
                    <div 
                      className="progress-bar-fill bg-oguri-lavender shadow-glow-sm" 
                      style={{ transform: `scaleX(${(memoryUsage?.systemPercentage || 0) / 100})` }} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  {[
                    { label: 'Msgs Hoy', value: stats?.mensajesHoy || 0, icon: <Activity className="h-4 w-4 text-primary" /> },
                    { label: 'Cmds Hoy', value: stats?.comandosHoy || 0, icon: <Zap className="h-4 w-4 text-oguri-lavender" /> },
                    { label: 'Pedidos', value: stats?.pedidosHoy || 0, icon: <ShoppingCart className="h-4 w-4 text-oguri-gold" /> },
                    { label: 'SubBots', value: `${onlineCount}/${totalCount}`, icon: <Bot className="h-4 w-4 text-oguri-cyan" /> },
                  ].map((tile) => (
                    <div key={tile.label} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all duration-300">
                      <div className="flex items-center justify-between mb-2">
                        {tile.icon}
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Live</span>
                      </div>
                      <p className="text-xl font-black text-foreground">{tile.value}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">{tile.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </DashboardCard>

            <DashboardCard
              title="Accesos Rápidos"
              description="Gestión de módulos core."
              icon={<Zap className="h-5 w-5 text-oguri-gold" />}
            >
              <div className="grid grid-cols-1 gap-4 mt-4">
                {[
                  { title: 'Bot Principal', href: '/bot', desc: 'Control de sesión QR', icon: <Bot />, color: 'from-primary/20 via-primary/5 to-transparent', val: botStatusText },
                  { title: 'SubBots Network', href: '/subbots', desc: 'Instancias conectadas', icon: <Zap />, color: 'from-oguri-cyan/20 via-oguri-cyan/5 to-transparent', val: `${onlineCount} online` },
                  { title: 'Gestión Usuarios', href: '/usuarios', desc: 'Roles y permisos', icon: <Users />, color: 'from-violet-500/20 via-violet-500/5 to-transparent', val: `${stats?.totalUsuarios || 0} panel` },
                ].map((route) => (
                  <Link key={route.title} href={route.href}>
                    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.05]">
                      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", route.color)} />
                      <div className="relative z-10 flex items-center gap-4">
                        <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 text-white/60 transition-all duration-300 group-hover:scale-110 group-hover:text-primary">
                          {React.cloneElement(route.icon as React.ReactElement, { className: "h-6 w-6" })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h4 className="text-sm font-bold text-foreground">{route.title}</h4>
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">{route.val}</span>
                          </div>
                          <p className="text-[11px] font-medium text-muted-foreground truncate">{route.desc}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard
              title="Rendimiento de Ventas"
              icon={<ShoppingCart className="h-5 w-5 text-oguri-gold" />}
            >
              <div className="flex flex-col items-center justify-center py-6">
                <ProgressRing
                  value={Math.min(((stats?.pedidosHoy || 0) / 100) * 100, 100)}
                  size={140}
                  strokeWidth={14}
                  color="rgb(var(--oguri-gold))"
                  glow
                >
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-black tracking-tight">
                      <AnimatedNumber value={stats?.pedidosHoy || 0} />
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pedidos</span>
                  </div>
                </ProgressRing>
                <div className="mt-6 text-center space-y-2">
                  <p className="text-xs font-bold text-foreground">Actividad de pedidos hoy</p>
                  <p className="text-[10px] font-medium text-muted-foreground leading-relaxed max-w-[200px]">
                    El bot ha procesado {stats?.pedidosHoy || 0} solicitudes de compra en las últimas 24 horas.
                  </p>
                </div>
              </div>
            </DashboardCard>
          </div>
        </div>
      </div>
    </div>
  );
}
