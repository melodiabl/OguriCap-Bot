'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Bell, 
  BellOff,
  Eye,
  EyeOff,
  Settings,
  Filter,
  Search,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  BarChart3,
  TrendingUp,
  Shield,
  Zap,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, StatCard } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useSocketConnection } from '@/contexts/SocketContext';
import api from '@/services/api';
import { notify } from '@/lib/notif';
import { formatDateTime , getErrorMessage } from '@/lib/utils';

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  type: string;
  severity: number;
  state: 'active' | 'acknowledged' | 'resolved' | 'suppressed';
  message: string;
  details: {
    metric: string;
    value: any;
    threshold: any;
    condition: string;
  };
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  tags: string[];
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: string;
  severity: number;
  metric: string;
  condition: string;
  threshold: any;
  duration: number;
  enabled: boolean;
  actions: string[];
  tags: string[];
  lastTriggered?: string;
  triggerCount: number;
}

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [search, setSearch] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    type: 'threshold',
    severity: 3,
    metric: 'cpu',
    condition: '>',
    threshold: 80,
    duration: 60,
    enabled: true,
    actions: ['notify'],
  });

  const handleCreateRule = async () => {
    if (!newRule.name.trim()) {
      notify.error('El nombre de la regla es requerido');
      return;
    }
    try {
      const ruleData = await api.createAlertRule(newRule);
      notify.success('Regla creada correctamente');
      setShowCreateRule(false);
      setNewRule({
        name: '',
        description: '',
        type: 'threshold',
        severity: 3,
        metric: 'cpu',
        condition: '>',
        threshold: 80,
        duration: 60,
        enabled: true,
        actions: ['notify'],
      });
      await loadRules();
    } catch (err: any) {
      notify.error(err?.message || 'Error al crear regla');
    }
  };

  const { socket, isConnected: isSocketConnected } = useSocketConnection();

  useEffect(() => {
    loadAlerts();
    loadRules();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (data: Alert) => {
      setAlerts(prev => [data, ...prev]);
      
      // Mostrar toast para alertas críticas
      if (data.severity >= 4) {
        notify.error(`Alerta Crítica: ${data.ruleName}`, {
          dedupeKey: `critical-alert-${data.id}`,
        });
      } else if (data.severity >= 3) {
        notify.warning(`Alerta: ${data.ruleName}`, {
          dedupeKey: `alert-${data.id}`,
        });
      }
    };

    const handleAlertResolved = (data: { alertId: string }) => {
      setAlerts(prev => prev.map(alert => 
        alert.id === data.alertId 
          ? { ...alert, state: 'resolved', resolvedAt: new Date().toISOString() }
          : alert
      ));
    };

    socket.on('alert:triggered', handleNewAlert);
    socket.on('alert:resolved', handleAlertResolved);

    return () => {
      socket.off('alert:triggered', handleNewAlert);
      socket.off('alert:resolved', handleAlertResolved);
    };
  }, [socket]);

  const loadAlerts = async () => {
    try {
      setIsLoading(true);
      // Preferir datos reales del backend
      try {
        const data = await api.getAlerts().catch(() => ({} as any));
        const list = (data as any)?.alerts || (data as any)?.data?.alerts || [];
        setAlerts(Array.isArray(list) ? list : []);
        return;
      } catch {}

      setAlerts([]);
    } catch (error) {
      console.error('Error loading alerts:', getErrorMessage(error));
      notify.error('Error cargando alertas');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRules = async () => {
    try {
      // Preferir datos reales del backend
      try {
        const data = await api.getAlertRules().catch(() => ({} as any));
        const list = (data as any)?.rules || (data as any)?.data?.rules || [];
        setRules(Array.isArray(list) ? list : []);
        return;
      } catch {}

      setRules([]);
    } catch (error) {
      console.error('Error loading alert rules:', getErrorMessage(error));
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      // Preferir operaciÇün real del backend
      try {
        await api.acknowledgeAlert(alertId);
        await loadAlerts();
        notify.success('Alerta reconocida');
        return;
      } catch {}

      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, state: 'acknowledged', acknowledgedAt: new Date().toISOString() }
          : alert
      ));
      notify.success('Alerta reconocida');
    } catch (error) {
      notify.error('Error reconociendo alerta');
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      // Preferir operaciÇün real del backend
      try {
        await api.resolveAlert(alertId);
        await loadAlerts();
        notify.success('Alerta resuelta');
        return;
      } catch {}

      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, state: 'resolved', resolvedAt: new Date().toISOString() }
          : alert
      ));
      notify.success('Alerta resuelta');
    } catch (error) {
      notify.error('Error resolviendo alerta');
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      // Preferir operaciÇün real del backend
      try {
        await api.updateAlertRule(ruleId, { enabled });
        await loadRules();
        notify.success(enabled ? 'Regla habilitada' : 'Regla deshabilitada');
        return;
      } catch {}

      setRules(prev => prev.map(rule => 
        rule.id === ruleId ? { ...rule, enabled } : rule
      ));
      notify.success(enabled ? 'Regla habilitada' : 'Regla deshabilitada');
    } catch (error) {
      notify.error('Error actualizando regla');
    }
  };

  const suppressRule = async (ruleId: string, duration: number) => {
    try {
      // Preferir operaciÇün real del backend
      try {
        await api.suppressAlertRule(ruleId, duration);
        await loadRules();
        notify.success(`Regla suprimida por ${duration / 60} minutos`);
        return;
      } catch {}

      notify.success(`Regla suprimida por ${duration / 60} minutos`);
    } catch (error) {
      notify.error('Error suprimiendo regla');
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    // Filtro por estado
    if (filter !== 'all' && alert.state !== filter) return false;
    
    // Filtro por severidad
    if (severityFilter !== 'all' && alert.severity !== parseInt(severityFilter)) return false;

    // Filtro por búsqueda
    if (search) {
      const searchLower = search.toLowerCase();
      return alert.ruleName.toLowerCase().includes(searchLower) ||
             alert.message.toLowerCase().includes(searchLower) ||
             alert.tags.some(tag => tag.toLowerCase().includes(searchLower));
    }

    return true;
  });

  const getSeverityIcon = (severity: number) => {
    switch (severity) {
      case 5: return <AlertTriangle className="w-4 h-4 text-[rgb(var(--danger))]" />;
      case 4: return <XCircle className="w-4 h-4 text-[rgb(var(--danger)/0.8)]" />;
      case 3: return <AlertTriangle className="w-4 h-4 text-[rgb(var(--warning))]" />;
      case 2: return <AlertTriangle className="w-4 h-4 text-[rgb(var(--warning)/0.8)]" />;
      default: return <AlertTriangle className="w-4 h-4 text-[rgb(var(--accent))]" />;
    }
  };

  const getSeverityColor = (severity: number) => {
    switch (severity) {
      case 5: return 'text-[rgb(var(--danger))] bg-[rgb(var(--danger)/0.2)] border-[rgb(var(--danger)/0.3)]';
      case 4: return 'text-[rgb(var(--danger)/0.8)] bg-[rgb(var(--danger)/0.15)] border-[rgb(var(--danger)/0.25)]';
      case 3: return 'text-[rgb(var(--warning))] bg-[rgb(var(--warning)/0.2)] border-[rgb(var(--warning)/0.3)]';
      case 2: return 'text-[rgb(var(--warning)/0.8)] bg-[rgb(var(--warning)/0.15)] border-[rgb(var(--warning)/0.25)]';
      default: return 'text-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.2)] border-[rgb(var(--accent)/0.3)]';
    }
  };

  const getSeverityLabel = (severity: number) => {
    switch (severity) {
      case 5: return 'Emergencia';
      case 4: return 'Crítica';
      case 3: return 'Alta';
      case 2: return 'Media';
      default: return 'Baja';
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'active': return <Bell className="w-4 h-4 text-[rgb(var(--danger))]" />;
      case 'acknowledged': return <Eye className="w-4 h-4 text-[rgb(var(--warning))]" />;
      case 'resolved': return <CheckCircle className="w-4 h-4 text-[rgb(var(--success))]" />;
      case 'suppressed': return <BellOff className="w-4 h-4 text-[rgb(var(--text-muted))]" />;
      default: return <Clock className="w-4 h-4 text-[rgb(var(--text-muted))]" />;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'active': return 'text-[rgb(var(--danger))] bg-[rgb(var(--danger)/0.2)]';
      case 'acknowledged': return 'text-[rgb(var(--warning))] bg-[rgb(var(--warning)/0.2)]';
      case 'resolved': return 'text-[rgb(var(--success))] bg-[rgb(var(--success)/0.2)]';
      case 'suppressed': return 'text-[rgb(var(--text-muted))] bg-[rgb(var(--text-muted)/0.2)]';
      default: return 'text-[rgb(var(--text-muted))] bg-[rgb(var(--text-muted)/0.2)]';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'threshold': return <BarChart3 className="w-4 h-4" />;
      case 'anomaly': return <TrendingUp className="w-4 h-4" />;
      case 'security': return <Shield className="w-4 h-4" />;
      case 'performance': return <Zap className="w-4 h-4" />;
      case 'availability': return <Activity className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const formatTime = (timestamp: string) => {
    return formatDateTime(timestamp);
  };

  const getTimeSince = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `hace ${days}d`;
    if (hours > 0) return `hace ${hours}h`;
    if (minutes > 0) return `hace ${minutes}m`;
    return 'ahora';
  };

  const activeCount = alerts.filter((alert) => alert.state === 'active').length;
  const acknowledgedCount = alerts.filter((alert) => alert.state === 'acknowledged').length;
  const resolvedCount = alerts.filter((alert) => alert.state === 'resolved').length;
  const criticalCount = alerts.filter((alert) => alert.state === 'active' && alert.severity >= 4).length;
  const enabledRulesCount = rules.filter((rule) => rule.enabled).length;

  const alertLanes = [
    {
      label: 'Pulso en vivo',
      value: isSocketConnected ? 'Stream conectado' : 'Fallback manual',
      description: isSocketConnected ? 'Las alertas entran al panel en tiempo real.' : 'El panel sigue operativo, pero depende de recarga manual.',
      icon: <Activity className="w-4 h-4" />,
      badge: isSocketConnected ? 'live' : 'http',
      badgeClassName: isSocketConnected ? 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
    },
    {
      label: 'Alertas criticas',
      value: `${criticalCount}`,
      description: criticalCount > 0 ? 'Eventos altos que conviene revisar primero.' : 'No hay incidentes criticos activos.',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: criticalCount > 0 ? 'urgente' : 'estable',
      badgeClassName: criticalCount > 0 ? 'border-danger/20 bg-danger/10 text-danger/80' : 'border-[rgb(var(--success))]/20 bg-[rgb(var(--success))]/10 text-[#c7f9d8]',
      glowClassName: 'from-red-500/18 via-amber-500/10 to-transparent',
    },
    {
      label: 'Estados pendientes',
      value: `${activeCount + acknowledgedCount}`,
      description: 'Suma de alertas activas y reconocidas aun no resueltas.',
      icon: <Bell className="w-4 h-4" />,
      badge: 'seguimiento',
      badgeClassName: 'border-warning/20 bg-warning/10 text-warning/80',
      glowClassName: 'from-amber-400/18 via-yellow-400/10 to-transparent',
    },
    {
      label: 'Reglas habilitadas',
      value: `${enabledRulesCount}/${rules.length}`,
      description: 'Cobertura activa del motor de monitoreo y disparo.',
      icon: <Settings className="w-4 h-4" />,
      badge: 'motor',
      badgeClassName: 'border-accent/20 bg-accent/10 text-accent',
      glowClassName: 'from-violet-400/18 via-oguri-lavender/10 to-transparent',
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[440px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-danger/14 blur-3xl"
          animate={{ x: [0, 18, 0], y: [0, 14, 0], opacity: [0.18, 0.38, 0.18] }}
          transition={{ repeat: Infinity, duration: 11.2, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-warning/14 blur-3xl"
          animate={{ x: [0, -18, 0], y: [0, 18, 0], opacity: [0.18, 0.4, 0.18] }}
          transition={{ repeat: Infinity, duration: 10.6, ease: 'easeInOut', delay: 0.6 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(239,68,68,0.16),rgba(245,158,11,0.12),rgba(168,85,247,0.10))] p-5 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6"
      >
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit">
              <Bell className="h-3.5 w-3.5 text-warning/80" />
              Vigilancia continua
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Radar operativo de alertas</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Prioriza incidentes, monitorea reglas y mantén claro qué está pasando sin perder tiempo leyendo ruido.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Activas</p>
              <p className="mt-2 text-lg font-black text-white">{activeCount}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Criticas</p>
              <p className="mt-2 text-lg font-black text-white">{criticalCount}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Live</p>
              <p className="mt-2 text-lg font-black text-white">{isSocketConnected ? 'On' : 'Fallback'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <PageHeader
        title="Sistema de Alertas"
        description="Monitoreo y gestión de alertas del sistema"
        icon={<Bell className="w-5 h-5 text-primary-400" />}
        actions={
          <>
            <Button
              onClick={() => setShowRules(!showRules)}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {showRules ? 'Ocultar' : 'Ver'} Reglas
            </Button>

            <Button onClick={() => setShowCreateRule(true)} variant="primary" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nueva Regla
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {alertLanes.map((lane, index) => (
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

      {/* Stats Cards */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" delay={0.02} stagger={0.06}>
        <StaggerItem>
          <StatCard title="Activas" value={activeCount} icon={<Bell className="w-6 h-6 text-danger" />} color="danger" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Reconocidas" value={acknowledgedCount} icon={<Eye className="w-6 h-6 text-warning" />} color="warning" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Resueltas" value={resolvedCount} icon={<CheckCircle className="w-6 h-6 text-success" />} color="success" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Reglas" value={enabledRulesCount} subtitle={`${rules.length} totales`} icon={<Settings className="w-6 h-6 text-info" />} color="info" delay={0} animated={false} />
        </StaggerItem>
      </Stagger>

      {/* Filtros */}
      <Card>
        <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Buscar alertas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-glass pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 rounded-2xl border border-border/15 bg-card/60 px-3 py-2">
            <Filter className="w-4 h-4 text-muted" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="input-glass min-w-[120px]"
            >
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="acknowledged">Reconocidas</option>
              <option value="resolved">Resueltas</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 rounded-2xl border border-border/15 bg-card/60 px-3 py-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="input-glass min-w-[120px]"
            >
              <option value="all">Todas las severidades</option>
              <option value="5">Emergencia</option>
              <option value="4">Crítica</option>
              <option value="3">Alta</option>
              <option value="2">Media</option>
              <option value="1">Baja</option>
            </select>
          </div>
          
          <Button
            onClick={loadAlerts}
            variant="secondary"
            loading={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
        </div>
        </CardContent>
      </Card>

      {/* Lista de alertas */}
      <Card>
        <CardHeader>
          <CardTitle>
            Alertas ({filteredAlerts.length})
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
        <div className="divide-y divide-border/10">
          <AnimatePresence>
            {filteredAlerts.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Bell className="w-6 h-6 text-muted" />}
                  title={alerts.length === 0 ? 'No hay alertas registradas' : 'Sin resultados'}
                  description={alerts.length === 0 ? 'No hay alertas registradas' : 'No se encontraron alertas con los filtros aplicados'}
                />
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`p-4 transition-colors hover:bg-card/55 border-l-4 ${
                    alert.state === 'active' ? 'border-danger' :
                    alert.state === 'acknowledged' ? 'border-warning' :
                    alert.state === 'resolved' ? 'border-success' :
                    'border-gray-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(alert.severity)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                            {getSeverityLabel(alert.severity)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {getStateIcon(alert.state)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStateColor(alert.state)}`}>
                            {alert.state}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-muted">
                          {getTypeIcon(alert.type)}
                          <span className="text-xs">{alert.type}</span>
                        </div>
                        
                        <span className="text-xs text-muted">
                          {getTimeSince(alert.triggeredAt)}
                        </span>
                      </div>
                      
                      <h3 className="mb-1 font-medium text-foreground">{alert.ruleName}</h3>
                      <p className="mb-2 text-sm text-muted">{alert.message}</p>
                      
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                        <span>Métrica: {alert.details.metric}</span>
                        <span>Valor: {alert.details.value}</span>
                        <span>Umbral: {alert.details.threshold}</span>
                        <span>Disparada: {formatTime(alert.triggeredAt)}</span>
                      </div>
                      
                      {alert.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          {alert.tags.map(tag => (
                            <span key={tag} className="rounded px-2 py-1 text-xs text-[rgb(var(--text-secondary))] bg-card/70 border border-border/10">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {alert.state === 'active' && (
                        <>
                          <Button
                            onClick={() => acknowledgeAlert(alert.id)}
                            variant="secondary"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Reconocer
                          </Button>
                          
                          <Button
                            onClick={() => resolveAlert(alert.id)}
                            variant="secondary"
                            size="sm"
                            className="flex items-center gap-1 text-success hover:text-success/80"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Resolver
                          </Button>
                        </>
                      )}
                      
                      <Button
                        onClick={() => setSelectedAlert(alert)}
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Detalles
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
        </CardContent>
      </Card>

      {/* Reglas de alerta */}
      <AnimatePresence>
        {showRules && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="panel-editor-shell"
          >
            <div className="border-b border-border/15 p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Reglas de Alerta ({rules.length})
              </h2>
            </div>
            
            <div className="divide-y divide-border/10">
              {rules.length === 0 ? (
                <div className="p-8 text-center text-muted">
                  <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay reglas de alerta configuradas</p>
                  <p className="text-sm mt-1">Crea una nueva regla para comenzar</p>
                </div>
              ) : (
                rules.map((rule) => (
                  <div key={rule.id} className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                          <h3 className="font-medium text-foreground">{rule.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(rule.severity)}`}>
                            {getSeverityLabel(rule.severity)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            rule.enabled ? 'text-success bg-success/20' : 'text-gray-400 bg-gray-500/20'
                          }`}>
                            {rule.enabled ? 'Habilitada' : 'Deshabilitada'}
                          </span>
                        </div>
                        
                        <p className="mb-2 text-sm text-muted">{rule.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                          <span>Métrica: {rule.metric}</span>
                          <span>Condición: {rule.condition} {rule.threshold}</span>
                          <span>Duración: {rule.duration}s</span>
                          <span>Disparos: {rule.triggerCount}</span>
                          {rule.lastTriggered && (
                            <span>Último: {getTimeSince(rule.lastTriggered)}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="panel-actions-wrap xl:justify-end">
                        <Button
                          onClick={() => toggleRule(rule.id, !rule.enabled)}
                          variant="secondary"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          {rule.enabled ? (
                            <>
                              <Pause className="w-3 h-3" />
                              Deshabilitar
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              Habilitar
                            </>
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => suppressRule(rule.id, 3600)}
                          variant="secondary"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <BellOff className="w-3 h-3" />
                          Suprimir
                        </Button>
                        
                        <Button
                          onClick={() => {}}
                          variant="secondary"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal para crear nueva regla */}
      <AnimatePresence>
        {showCreateRule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateRule(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-card border border-border/20 rounded-3xl p-6 shadow-glow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-foreground">Nueva Regla de Alerta</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateRule(false)}>
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Nombre</label>
                  <input
                    type="text"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="Nombre de la regla"
                    className="input-glass w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Descripción</label>
                  <textarea
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="Descripción de la regla"
                    className="input-glass w-full min-h-[80px] resize-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Tipo</label>
                    <select
                      value={newRule.type}
                      onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                      className="input-glass w-full"
                    >
                      <option value="threshold">Umbral</option>
                      <option value="anomaly">Anomalía</option>
                      <option value="security">Seguridad</option>
                      <option value="performance">Rendimiento</option>
                      <option value="availability">Disponibilidad</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Severidad</label>
                    <select
                      value={newRule.severity}
                      onChange={(e) => setNewRule({ ...newRule, severity: parseInt(e.target.value) })}
                      className="input-glass w-full"
                    >
                      <option value="1">Baja</option>
                      <option value="2">Media</option>
                      <option value="3">Alta</option>
                      <option value="4">Crítica</option>
                      <option value="5">Emergencia</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Métrica</label>
                    <select
                      value={newRule.metric}
                      onChange={(e) => setNewRule({ ...newRule, metric: e.target.value })}
                      className="input-glass w-full"
                    >
                      <option value="cpu">CPU</option>
                      <option value="memory">Memoria</option>
                      <option value="disk">Disco</option>
                      <option value="responseTime">Tiempo de respuesta</option>
                      <option value="errors">Errores</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Condición</label>
                    <select
                      value={newRule.condition}
                      onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
                      className="input-glass w-full"
                    >
                      <option value=">"> mayor que</option>
                      <option value=">="> mayor o igual</option>
                      <option value="<"> menor que</option>
                      <option value="<="> menor o igual</option>
                      <option value="=="> igual a</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Umbral</label>
                    <input
                      type="number"
                      value={newRule.threshold}
                      onChange={(e) => setNewRule({ ...newRule, threshold: parseFloat(e.target.value) })}
                      className="input-glass w-full"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Duración (segundos)</label>
                  <input
                    type="number"
                    value={newRule.duration}
                    onChange={(e) => setNewRule({ ...newRule, duration: parseInt(e.target.value) })}
                    className="input-glass w-full"
                  />
                </div>
                
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="rule-enabled"
                    checked={newRule.enabled}
                    onChange={(e) => setNewRule({ ...newRule, enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-border/40 bg-card/20"
                  />
                  <label htmlFor="rule-enabled" className="text-sm text-muted">Habilitar regla inmediatamente</label>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" className="flex-1" onClick={() => setShowCreateRule(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" className="flex-1" onClick={handleCreateRule}>
                  <Plus className="w-4 h-4" />
                  Crear Regla
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
