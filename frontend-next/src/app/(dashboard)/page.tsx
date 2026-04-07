'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Bot,
  CheckCircle,
  Clock,
  Cpu,
  HardDrive,
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
import { RealTimeBadge, StatusIndicator } from '@/components/ui/StatusIndicator';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDashboardStats, useBotStatus, useSystemStats, useSubbotsStatus, useRecentActivity } from '@/hooks/useRealTime';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useGlobalUpdate } from '@/contexts/GlobalUpdateContext';
import { useSocketConnection } from '@/contexts/SocketContext';
import { formatUptime } from '@/lib/utils';
import { useDevicePerformance } from '@/contexts/DevicePerformanceContext';

const DASHBOARD_SPARKS = [
  { className: 'left-[5%] top-[6%] h-2 w-2', tone: 'bg-primary/80', duration: 7.8, delay: 0 },
  { className: 'left-[18%] top-[24%] h-1.5 w-1.5', tone: 'bg-oguri-lavender/80', duration: 9.6, delay: 1.2 },
  { className: 'left-[44%] top-[10%] h-2.5 w-2.5', tone: 'bg-oguri-cyan/75', duration: 8.7, delay: 0.7 },
  { className: 'right-[14%] top-[8%] h-2 w-2', tone: 'bg-oguri-blue/80', duration: 10.4, delay: 1.4 },
  { className: 'right-[7%] top-[28%] h-1.5 w-1.5', tone: 'bg-oguri-gold/80', duration: 8.9, delay: 2.2 },
  { className: 'left-[28%] top-[38%] h-2 w-2', tone: 'bg-primary/70', duration: 11.2, delay: 1.8 },
];

export default function DashboardPage() {
  const { stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats(10000);
  const { status: botStatus, isConnected, isConnecting, refetch: refetchBot } = useBotStatus(3000);
  const { isGloballyOn } = useBotGlobalState();
  const { dashboardStats, botStatus: globalBotStatus, refreshAll } = useGlobalUpdate();
  const { memoryUsage, cpuUsage, diskUsage, uptime, systemInfo } = useSystemStats(8000);
  const { onlineCount, totalCount } = useSubbotsStatus(8000);
  const { isConnected: isSocketConnected } = useSocketConnection();
  const { activities: recentActivity, isLoading: activitiesLoading } = useRecentActivity(15000);
  const { performanceMode, viewport } = useDevicePerformance();

  const isMobileLite = performanceMode && viewport === 'mobile';

  const currentStats = React.useMemo(() => {
    if (!dashboardStats) return stats;
    if (!stats) return dashboardStats;

    const activityFromSocket = (dashboardStats as any)?.actividadPorHora;
    const activityFromApi = (stats as any)?.actividadPorHora;
    const actividadPorHora =
      Array.isArray(activityFromSocket) && activityFromSocket.length > 0
        ? activityFromSocket
        : Array.isArray(activityFromApi)
          ? activityFromApi
          : [];

    return {
      ...stats,
      ...dashboardStats,
      actividadPorHora,
      rendimiento: (dashboardStats as any)?.rendimiento ?? (stats as any)?.rendimiento,
      tendencias: (dashboardStats as any)?.tendencias ?? (stats as any)?.tendencias,
      comunidad: {
        ...(stats as any)?.comunidad,
        ...(dashboardStats as any)?.comunidad,
      },
    };
  }, [dashboardStats, stats]);

  const currentBotStatus = globalBotStatus || botStatus;
  const botVisualState = !isGloballyOn ? 'offline' : isConnecting ? 'connecting' : isConnected ? 'online' : 'offline';
  const botStatusText = !isGloballyOn ? 'Desactivado globalmente' : isConnecting ? 'Sincronizando sesion' : isConnected ? 'Bot conectado' : 'Bot desconectado';

  const handleRefresh = React.useCallback(() => {
    refreshAll();
    refetchStats();
    refetchBot();
  }, [refreshAll, refetchStats, refetchBot]);

  const activityByHour = React.useMemo(() => {
    const activity = (currentStats as any)?.actividadPorHora;
    if (Array.isArray(activity) && activity.length > 0) {
      return activity.map((item: any, index: number) => ({
        label: String(item?.label ?? `${(index * 2).toString().padStart(2, '0')}:00`),
        value: Number(item?.value) || 0,
        color: String(item?.color || 'rgb(var(--primary))'),
      }));
    }

    return Array.from({ length: 12 }, (_, index) => ({
      label: `${(index * 2).toString().padStart(2, '0')}:00`,
      value: 0,
      color: 'rgb(var(--primary))',
    }));
  }, [currentStats]);

  const topStats = [
    {
      title: 'Admins Panel',
      value: currentStats?.totalUsuarios || 0,
      subtitle: `${currentStats?.usuariosActivos || 0} activos`,
      icon: <Users className="h-6 w-6 text-oguri-purple" />,
      color: 'primary' as const,
      trend: currentStats?.tendencias?.usuarios,
    },
    {
      title: 'Comunidad',
      value: currentStats?.comunidad?.usuariosWhatsApp || 0,
      subtitle: `${currentStats?.comunidad?.usuariosActivos || 0} activos`,
      icon: <MessageSquare className="h-6 w-6 text-oguri-cyan" />,
      color: 'success' as const,
      trend: currentStats?.tendencias?.usuarios,
    },
    {
      title: 'Grupos',
      value: currentStats?.totalGrupos || 0,
      subtitle: `${currentStats?.gruposActivos || 0} activos`,
      icon: <MessageSquare className="h-6 w-6 text-oguri-lavender" />,
      color: 'violet' as const,
      trend: currentStats?.tendencias?.grupos,
    },
    {
      title: 'Aportes',
      value: currentStats?.totalAportes || 0,
      subtitle: `${currentStats?.aportesHoy || 0} hoy`,
      icon: <Package className="h-6 w-6 text-oguri-gold" />,
      color: 'warning' as const,
      trend: currentStats?.tendencias?.aportes,
    },
    {
      title: 'SubBots',
      value: currentStats?.totalSubbots || totalCount,
      subtitle: `${onlineCount} online`,
      icon: <Zap className="h-6 w-6 text-oguri-blue" />,
      color: 'info' as const,
      active: onlineCount > 0,
    },
  ];

  const activityMetrics = [
    { label: 'Mensajes Hoy', value: currentStats?.mensajesHoy || 0, meta: 'trafico actual' },
    { label: 'Comandos Hoy', value: currentStats?.comandosHoy || 0, meta: 'uso del panel y bot' },
    { label: 'Usuarios Activos', value: currentStats?.usuariosActivos || 0, meta: 'movimiento reciente' },
  ];

  const quickStats = [
    {
      title: 'Grupos Activos',
      description: 'bot habilitado',
      value: currentStats?.gruposActivos || 0,
      icon: <CheckCircle className="h-5 w-5" />,
      tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    },
    {
      title: 'Pedidos Pendientes',
      description: 'sin procesar',
      value: currentStats?.pedidosHoy || 0,
      icon: <ShoppingCart className="h-5 w-5" />,
      tone: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
    },
    {
      title: 'SubBots Online',
      description: 'instancias activas',
      value: `${onlineCount}/${totalCount}`,
      icon: <Zap className="h-5 w-5" />,
      tone: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/20',
    },
  ];

  const systemHealthRows = [
    {
      label: 'CPU',
      value: cpuUsage,
      detail: systemInfo?.cpu?.cores ? `${systemInfo.cpu.cores} núcleos` : 'uso actual',
      fillClassName: 'bg-gradient-to-r from-cyan-400 via-primary-500 to-violet-500',
      badge: <Badge variant="info">{cpuUsage.toFixed(0)}%</Badge>,
    },
    {
      label: 'Memoria',
      value: memoryUsage?.systemPercentage ?? 0,
      detail: systemInfo?.memory?.totalGB ? `${systemInfo.memory.totalGB} GB total` : 'memoria del host',
      fillClassName: 'bg-gradient-to-r from-primary-500 via-violet-500 to-cyan-400',
      badge: <Badge variant="primary">{(memoryUsage?.systemPercentage ?? 0).toFixed(0)}%</Badge>,
    },
    {
      label: 'Disco',
      value: diskUsage?.percentage ?? 0,
      detail: diskUsage?.totalGB ? `${diskUsage.totalGB} GB total` : 'almacenamiento',
      fillClassName: 'bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500',
      badge: <Badge variant="warning">{(diskUsage?.percentage ?? 0).toFixed(0)}%</Badge>,
    },
  ];

  const systemTiles = [
    { label: 'Mensajes Totales', value: currentStats?.totalMensajes || 0, meta: 'historico', icon: <TrendingUp className="h-5 w-5 text-primary" /> },
    { label: 'Comandos Totales', value: currentStats?.totalComandos || 0, meta: 'interacciones', icon: <Activity className="h-5 w-5 text-emerald-300" /> },
    { label: 'Tiempo Activo', value: formatUptime(uptime), meta: 'sesion actual', icon: <Clock className="h-5 w-5 text-violet-300" /> },
    { label: 'Total SubBots', value: totalCount, meta: 'instancias registradas', icon: <Bot className="h-5 w-5 text-cyan-300" /> },
  ];

  const recentActivityItems = recentActivity.slice(0, 5);

  return (
    <div className="panel-page relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-10%] top-[-4rem] -z-10 h-[520px] overflow-hidden">
        <div className="absolute inset-0 rounded-[42px] bg-[radial-gradient(circle_at_18%_20%,rgba(var(--primary),0.18),transparent_26%),radial-gradient(circle_at_80%_18%,rgba(var(--secondary),0.16),transparent_26%),radial-gradient(circle_at_50%_70%,rgba(var(--accent),0.12),transparent_34%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:30px_30px]" />
        <motion.div
          className="absolute left-[4%] top-[10%] h-56 w-56 rounded-full bg-oguri-purple/22 blur-3xl"
          animate={isMobileLite ? { opacity: 0.5 } : { x: [0, 16, 0], y: [0, 18, 0], opacity: [0.26, 0.52, 0.26] }}
          transition={isMobileLite ? { duration: 0.12 } : { repeat: Infinity, duration: 11.5, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[6%] top-[6%] h-64 w-64 rounded-full bg-oguri-cyan/18 blur-3xl"
          animate={isMobileLite ? { opacity: 0.45 } : { x: [0, -18, 0], y: [0, 16, 0], opacity: [0.18, 0.42, 0.18] }}
          transition={isMobileLite ? { duration: 0.12 } : { repeat: Infinity, duration: 10.6, ease: 'easeInOut', delay: 0.5 }}
        />
        {!isMobileLite &&
          DASHBOARD_SPARKS.map((spark, index) => (
            <motion.div
              key={`${spark.className}-${index}`}
              className={`${spark.className} ${spark.tone} absolute rounded-full shadow-[0_0_20px_rgba(255,255,255,0.16)]`}
              animate={{ y: [0, -14, 0], x: [0, index % 2 === 0 ? 6 : -6, 0], opacity: [0.22, 0.85, 0.22], scale: [0.9, 1.18, 0.9] }}
              transition={{ repeat: Infinity, duration: spark.duration, ease: 'easeInOut', delay: spark.delay }}
            />
          ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(var(--primary),0.16),rgba(var(--secondary),0.10),rgba(var(--accent),0.14))] p-5 shadow-[0_28px_90px_-46px_rgba(0,0,0,0.45),0_0_48px_rgba(127,180,255,0.08)] backdrop-blur-2xl sm:p-6"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit">
              <Zap className="h-3.5 w-3.5 text-oguri-cyan" />
              Atmosfera central
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Dashboard con pulso anime y neón</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              El centro de control ahora respira con una capa ambiental propia, partículas flotantes y brillo diferenciado para cada módulo.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Estado</p>
              <p className="mt-2 text-lg font-black text-white">{botStatusText}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Socket</p>
              <p className="mt-2 text-lg font-black text-white">{isSocketConnected ? 'Live Sync' : 'Fallback'}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">SubBots</p>
              <p className="mt-2 text-lg font-black text-white">{onlineCount}/{totalCount}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <PageHeader
        title="Centro de Control"
        description="Estado general del sistema, actividad del bot y salud operativa del panel Oguri."
        icon={<TrendingUp className="h-6 w-6 text-oguri-lavender" />}
        actions={
          <>
            <ActionButton
              tone="glow"
              onClick={handleRefresh}
              pulse={statsLoading}
              icon={
                <motion.div
                  animate={{ rotate: statsLoading ? 360 : 0 }}
                  transition={{ duration: 1, repeat: statsLoading ? Infinity : 0, ease: 'linear' }}
                >
                  <RefreshCw className="h-4 w-4" />
                </motion.div>
              }
            >
              Sincronizar
            </ActionButton>
            <StatusBadge tone={isGloballyOn ? 'success' : 'danger'} pulse={isGloballyOn}>
              {isGloballyOn ? 'Bot Global Activo' : 'Bot Global Off'}
            </StatusBadge>
            <RealTimeBadge isActive={isSocketConnected && isConnected && isGloballyOn} />
          </>
        }
      />

      <DashboardCard
        title="Pulso General"
        description="Vista central del bot principal, red y operacion actual."
        icon={<Bot className="h-5 w-5" />}
        actions={<StatusIndicator status={botVisualState} size="sm" />}
        glow={isConnected && isGloballyOn}
      >
        <div className="mb-5 overflow-hidden rounded-[26px] border border-border/15 bg-[linear-gradient(135deg,rgba(var(--primary),0.18),rgba(var(--secondary),0.10),rgba(var(--accent),0.14))] p-4 sm:p-5 shadow-[0_0_32px_rgba(127,180,255,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[rgb(var(--text-secondary))]">
                <span className="h-2 w-2 rounded-full bg-primary shadow-glow-oguri-purple" />
                Oguri Pulse
              </div>
              <p className="text-lg font-black tracking-tight text-foreground sm:text-xl">Cabina central del sistema</p>
              <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">Monitoreo vivo del bot principal, comunidad y capacidad del ecosistema.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{isSocketConnected ? 'Realtime Sync' : 'Fallback Mode'}</Badge>
              <Badge variant={isConnected ? 'success' : 'warning'}>{isConnected ? 'Main Bot Online' : 'Main Bot Waiting'}</Badge>
              <Badge variant="primary">{onlineCount}/{totalCount} SubBots</Badge>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="panel-surface-soft p-5 sm:p-6">
            <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:items-center lg:text-left">
              <motion.div
                animate={isConnected && isGloballyOn ? { scale: [1, 1.03, 1] } : {}}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="shrink-0"
              >
                <ProgressRing
                  progress={isConnected && isGloballyOn ? 100 : isConnecting ? 58 : 18}
                  size={150}
                  color={
                    !isGloballyOn
                      ? 'rgb(var(--danger))'
                      : isConnecting
                        ? 'rgb(var(--warning))'
                        : isConnected
                          ? 'rgb(var(--success))'
                          : 'rgb(var(--danger))'
                  }
                  label={botStatusText}
                />
              </motion.div>

              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="panel-data-row">
                  <span className="panel-data-row__label">Numero</span>
                  <span className="panel-data-row__value font-mono text-xs">{currentBotStatus?.phone || 'Sin vincular'}</span>
                </div>
                <div className="panel-data-row">
                  <span className="panel-data-row__label">Socket</span>
                  <span className={isSocketConnected ? 'panel-data-row__value text-oguri-cyan' : 'panel-data-row__value text-red-400'}>
                    {isSocketConnected ? 'Tiempo real activo' : 'Sin tiempo real'}
                  </span>
                </div>
                <div className="panel-data-row">
                  <span className="panel-data-row__label">Uptime</span>
                  <span className="panel-data-row__value">{currentBotStatus?.uptime || formatUptime(uptime)}</span>
                </div>
                <div className="panel-data-row">
                  <span className="panel-data-row__label">SubBots</span>
                  <span className="panel-data-row__value">{onlineCount}/{totalCount} online</span>
                </div>
              </div>
            </div>
          </div>

          <div className="panel-kpi-grid xl:grid-cols-2">
            <div className="panel-mini-tile">
              <p className="panel-mini-tile__label">Usuarios del panel</p>
              <p className="panel-mini-tile__value"><AnimatedNumber value={currentStats?.totalUsuarios || 0} duration={0.7} /></p>
              <p className="panel-mini-tile__meta">{currentStats?.usuariosActivos || 0} activos</p>
            </div>
            <div className="panel-mini-tile">
              <p className="panel-mini-tile__label">Comunidad</p>
              <p className="panel-mini-tile__value"><AnimatedNumber value={currentStats?.comunidad?.usuariosWhatsApp || 0} duration={0.7} /></p>
              <p className="panel-mini-tile__meta">usuarios conectados al ecosistema</p>
            </div>
            <div className="panel-mini-tile">
              <p className="panel-mini-tile__label">Mensajes hoy</p>
              <p className="panel-mini-tile__value"><AnimatedNumber value={currentStats?.mensajesHoy || 0} duration={0.7} /></p>
              <p className="panel-mini-tile__meta">flujo del dia</p>
            </div>
            <div className="panel-mini-tile">
              <p className="panel-mini-tile__label">Pedidos hoy</p>
              <p className="panel-mini-tile__value"><AnimatedNumber value={currentStats?.pedidosHoy || 0} duration={0.7} /></p>
              <p className="panel-mini-tile__meta">carga operativa</p>
            </div>
          </div>
        </div>
      </DashboardCard>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" delay={0.05} stagger={0.05}>
        {topStats.map((item, index) => (
          <StaggerItem key={item.title}>
            <StatCard
              title={item.title}
              value={item.value}
              subtitle={item.subtitle}
              icon={item.icon}
              color={item.color}
              trend={item.trend}
              loading={statsLoading}
              active={item.active}
              delay={index * 0.03}
            />
          </StaggerItem>
        ))}
      </Stagger>

      <BroadcastTool />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DashboardCard
          title="Actividad de Hoy"
          description="Mensajes y movimiento reciente del ecosistema."
          variant="chart"
          className="xl:col-span-2"
          icon={<TrendingUp className="h-5 w-5" />}
          actions={<Badge variant="info">Live Feed</Badge>}
          loading={statsLoading}
        >
          <BarChart
            data={activityByHour}
            height={isMobileLite ? 160 : 220}
            animated={!isMobileLite}
            scale={isMobileLite ? 'linear' : 'sqrt'}
            minBarHeight={isMobileLite ? 0 : 3}
            showGrid={!isMobileLite}
          />

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {activityMetrics.map((item) => (
              <div key={item.label} className="panel-mini-tile text-center sm:text-left">
                <p className="panel-mini-tile__label">{item.label}</p>
                <p className="panel-mini-tile__value"><AnimatedNumber value={item.value} duration={0.6} /></p>
                <p className="panel-mini-tile__meta">{item.meta}</p>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard
          title="Recursos del Sistema"
          description="CPU, memoria y disco del host actual."
          variant="chart"
          icon={<Activity className="h-5 w-5" />}
        >
          <div className="mb-5 flex items-center justify-center">
            <DonutChart
              data={[
                { label: 'Usado', value: memoryUsage?.systemPercentage || 0, color: 'rgb(var(--primary))' },
                { label: 'Libre', value: Math.max(0, 100 - (memoryUsage?.systemPercentage || 0)), color: 'rgba(255,255,255,0.1)' },
              ]}
              size={150}
              centerValue={`${(memoryUsage?.systemPercentage ?? 0).toFixed(0)}%`}
              centerLabel="Memoria"
            />
          </div>

          <div className="space-y-4">
            {systemHealthRows.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="text-xs text-muted">{item.detail}</p>
                  </div>
                  {item.badge}
                </div>
                <Progress value={item.value} max={100} fillClassName={item.fillClassName} />
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DashboardCard
          title="Operacion Rapida"
          description="Lectura corta de lo mas importante ahora mismo."
          icon={<Zap className="h-5 w-5" />}
        >
          <div className="space-y-3">
            {quickStats.map((item) => (
              <div key={item.title} className="panel-data-row">
                <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${item.tone}`}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-muted">{item.description}</p>
                  </div>
                </div>
                <p className="text-lg font-black text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard
          title="Actividad Reciente"
          description="Eventos importantes de las ultimas acciones."
          className="xl:col-span-2"
          icon={<Activity className="h-5 w-5" />}
        >
          <div className="space-y-3">
            {activitiesLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="panel-data-row animate-pulse">
                  <div className="h-10 w-10 rounded-2xl bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-white/10" />
                    <div className="h-2 w-1/2 rounded bg-white/5" />
                  </div>
                </div>
              ))
            ) : recentActivityItems.length > 0 ? (
              recentActivityItems.map((item, index) => {
                const IconComponent = {
                  Package,
                  ShoppingCart,
                  Users,
                  Zap,
                  Settings,
                  MessageSquare,
                  Bot,
                  Activity,
                }[item.icon] || Activity;

                const tone = {
                  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
                  warning: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
                  info: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/20',
                  primary: 'bg-primary/15 text-primary border-primary/20',
                  violet: 'bg-violet-500/15 text-violet-300 border-violet-400/20',
                  danger: 'bg-red-500/15 text-red-300 border-red-400/20',
                }[item.color] || 'bg-primary/15 text-primary border-primary/20';

                return (
                  <motion.div
                    key={`${item.title}-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                    className="panel-data-row"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${tone}`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                        <p className="truncate text-xs text-muted">{item.desc}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-muted">{item.time}</span>
                  </motion.div>
                );
              })
            ) : (
              <div className="panel-stack-center py-10">
                <Activity className="mb-3 h-12 w-12 text-gray-600" />
                <p className="text-sm font-semibold text-gray-300">Sin actividad reciente</p>
                <p className="mt-1 text-xs text-muted">La actividad aparecera aqui cuando ocurra movimiento.</p>
              </div>
            )}
          </div>
        </DashboardCard>
      </div>

      <div className="panel-kpi-grid">
        {systemTiles.map((item) => (
          <div key={item.label} className="panel-mini-tile">
            <div className="flex items-center gap-3">
              <div className="panel-card-icon h-10 w-10 rounded-xl">{item.icon}</div>
              <div className="min-w-0">
                <p className="panel-mini-tile__label">{item.label}</p>
                <p className="panel-mini-tile__meta">{item.meta}</p>
              </div>
            </div>
            <p className="panel-mini-tile__value">{typeof item.value === 'number' ? <AnimatedNumber value={item.value} duration={0.6} /> : item.value}</p>
          </div>
        ))}
      </div>

      <DashboardCard
        title="Detalles del Sistema"
        description="Lectura compacta del host y version actual para soporte rapido."
        icon={<Settings className="h-5 w-5" />}
        actions={<Badge variant="info">Live</Badge>}
        loading={!systemInfo}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="panel-mini-tile">
            <div className="flex items-center gap-3">
              <div className="panel-card-icon h-10 w-10 rounded-xl"><Cpu className="h-5 w-5" /></div>
              <div>
                <p className="panel-mini-tile__label">Procesador</p>
                <p className="panel-mini-tile__meta">{systemInfo?.cpu?.model || 'Sin datos'}</p>
              </div>
            </div>
            <p className="panel-mini-tile__value text-lg">{systemInfo?.cpu?.cores || '-'} cores</p>
          </div>

          <div className="panel-mini-tile">
            <div className="flex items-center gap-3">
              <div className="panel-card-icon h-10 w-10 rounded-xl"><Activity className="h-5 w-5" /></div>
              <div>
                <p className="panel-mini-tile__label">Node</p>
                <p className="panel-mini-tile__meta">runtime principal</p>
              </div>
            </div>
            <p className="panel-mini-tile__value text-lg">{systemInfo?.node || '-'}</p>
          </div>

          <div className="panel-mini-tile">
            <div className="flex items-center gap-3">
              <div className="panel-card-icon h-10 w-10 rounded-xl"><HardDrive className="h-5 w-5" /></div>
              <div>
                <p className="panel-mini-tile__label">Plataforma</p>
                <p className="panel-mini-tile__meta">arquitectura del host</p>
              </div>
            </div>
            <p className="panel-mini-tile__value text-lg">{systemInfo?.platform || '-'}</p>
          </div>

          <div className="panel-mini-tile">
            <div className="flex items-center gap-3">
              <div className="panel-card-icon h-10 w-10 rounded-xl"><Clock className="h-5 w-5" /></div>
              <div>
                <p className="panel-mini-tile__label">Arquitectura</p>
                <p className="panel-mini-tile__meta">build actual</p>
              </div>
            </div>
            <p className="panel-mini-tile__value text-lg">{systemInfo?.arch || '-'}</p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
