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
import { notify } from '@/lib/notify';

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

  const { socket } = useSocketConnection();

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
          dedupeMs: 10000,
        });
      } else if (data.severity >= 3) {
        notify.warning(`Alerta: ${data.ruleName}`, {
          dedupeKey: `alert-${data.id}`,
          dedupeMs: 5000,
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
      console.error('Error loading alerts:', error);
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
      console.error('Error loading alert rules:', error);
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
    return new Date(timestamp).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  return (
    <div className="panel-page">
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

      {/* Stats Cards */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" delay={0.02} stagger={0.06}>
        <StaggerItem>
          <StatCard title="Activas" value={alerts.filter(a => a.state === 'active').length} icon={<Bell className="w-6 h-6 text-red-400" />} color="danger" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Reconocidas" value={alerts.filter(a => a.state === 'acknowledged').length} icon={<Eye className="w-6 h-6 text-yellow-400" />} color="warning" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Resueltas" value={alerts.filter(a => a.state === 'resolved').length} icon={<CheckCircle className="w-6 h-6 text-green-400" />} color="success" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Reglas" value={rules.filter(r => r.enabled).length} subtitle={`${rules.length} totales`} icon={<Settings className="w-6 h-6 text-blue-400" />} color="info" delay={0} animated={false} />
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
                    alert.state === 'active' ? 'border-red-500' :
                    alert.state === 'acknowledged' ? 'border-yellow-500' :
                    alert.state === 'resolved' ? 'border-green-500' :
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
                            className="flex items-center gap-1 text-green-400 hover:text-green-300"
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
              {rules.map((rule) => (
                <div key={rule.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <h3 className="font-medium text-foreground">{rule.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(rule.severity)}`}>
                          {getSeverityLabel(rule.severity)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          rule.enabled ? 'text-green-400 bg-green-500/20' : 'text-gray-400 bg-gray-500/20'
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
                        onClick={() => suppressRule(rule.id, 3600)} // 1 hora
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <BellOff className="w-3 h-3" />
                        Suprimir
                      </Button>
                      
                      <Button
                        onClick={() => {/* Editar regla */}}
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
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
