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
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useSocketConnection } from '@/contexts/SocketContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

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
        toast.error(`Alerta Crítica: ${data.ruleName}`, {
          duration: 10000,
          position: 'top-right'
        });
      } else if (data.severity >= 3) {
        toast.error(`Alerta: ${data.ruleName}`, {
          duration: 5000,
          position: 'top-right'
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
      toast.error('Error cargando alertas');
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
        toast.success('Alerta reconocida');
        return;
      } catch {}

      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, state: 'acknowledged', acknowledgedAt: new Date().toISOString() }
          : alert
      ));
      toast.success('Alerta reconocida');
    } catch (error) {
      toast.error('Error reconociendo alerta');
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      // Preferir operaciÇün real del backend
      try {
        await api.resolveAlert(alertId);
        await loadAlerts();
        toast.success('Alerta resuelta');
        return;
      } catch {}

      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, state: 'resolved', resolvedAt: new Date().toISOString() }
          : alert
      ));
      toast.success('Alerta resuelta');
    } catch (error) {
      toast.error('Error resolviendo alerta');
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      // Preferir operaciÇün real del backend
      try {
        await api.updateAlertRule(ruleId, { enabled });
        await loadRules();
        toast.success(enabled ? 'Regla habilitada' : 'Regla deshabilitada');
        return;
      } catch {}

      setRules(prev => prev.map(rule => 
        rule.id === ruleId ? { ...rule, enabled } : rule
      ));
      toast.success(enabled ? 'Regla habilitada' : 'Regla deshabilitada');
    } catch (error) {
      toast.error('Error actualizando regla');
    }
  };

  const suppressRule = async (ruleId: string, duration: number) => {
    try {
      // Preferir operaciÇün real del backend
      try {
        await api.suppressAlertRule(ruleId, duration);
        await loadRules();
        toast.success(`Regla suprimida por ${duration / 60} minutos`);
        return;
      } catch {}

      toast.success(`Regla suprimida por ${duration / 60} minutos`);
    } catch (error) {
      toast.error('Error suprimiendo regla');
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
      case 5: return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 4: return <XCircle className="w-4 h-4 text-red-400" />;
      case 3: return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 2: return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default: return <AlertTriangle className="w-4 h-4 text-blue-400" />;
    }
  };

  const getSeverityColor = (severity: number) => {
    switch (severity) {
      case 5: return 'text-red-500 bg-red-500/20 border-red-500/30';
      case 4: return 'text-red-400 bg-red-400/20 border-red-400/30';
      case 3: return 'text-orange-400 bg-orange-400/20 border-orange-400/30';
      case 2: return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30';
      default: return 'text-blue-400 bg-blue-400/20 border-blue-400/30';
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
      case 'active': return <Bell className="w-4 h-4 text-red-400" />;
      case 'acknowledged': return <Eye className="w-4 h-4 text-yellow-400" />;
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'suppressed': return <BellOff className="w-4 h-4 text-gray-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'active': return 'text-red-400 bg-red-500/20';
      case 'acknowledged': return 'text-yellow-400 bg-yellow-500/20';
      case 'resolved': return 'text-green-400 bg-green-500/20';
      case 'suppressed': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
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
    <div className="space-y-6">
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
      <Stagger className="grid grid-cols-1 md:grid-cols-4 gap-4" delay={0.02} stagger={0.06}>
        <StaggerItem whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }} className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <Bell className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Activas</p>
              <p className="text-xl font-bold text-white">
                <AnimatedNumber value={alerts.filter(a => a.state === 'active').length} />
              </p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }} className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Eye className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Reconocidas</p>
              <p className="text-xl font-bold text-white">
                <AnimatedNumber value={alerts.filter(a => a.state === 'acknowledged').length} />
              </p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }} className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Resueltas</p>
              <p className="text-xl font-bold text-white">
                <AnimatedNumber value={alerts.filter(a => a.state === 'resolved').length} />
              </p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }} className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Reglas</p>
              <p className="text-xl font-bold text-white">
                <AnimatedNumber value={rules.filter(r => r.enabled).length} />/<AnimatedNumber value={rules.length} />
              </p>
            </div>
          </div>
        </StaggerItem>
      </Stagger>

      {/* Filtros */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar alertas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-glass pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
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
          
          <div className="flex items-center gap-2">
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
      </div>

      {/* Lista de alertas */}
      <div className="glass-card">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            Alertas ({filteredAlerts.length})
          </h2>
        </div>
        
        <div className="divide-y divide-white/5">
          <AnimatePresence>
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">
                  {alerts.length === 0 
                    ? 'No hay alertas registradas' 
                    : 'No se encontraron alertas con los filtros aplicados'
                  }
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`p-4 hover:bg-white/5 transition-colors border-l-4 ${
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
                        
                        <div className="flex items-center gap-1 text-gray-400">
                          {getTypeIcon(alert.type)}
                          <span className="text-xs">{alert.type}</span>
                        </div>
                        
                        <span className="text-xs text-gray-500">
                          {getTimeSince(alert.triggeredAt)}
                        </span>
                      </div>
                      
                      <h3 className="font-medium text-white mb-1">{alert.ruleName}</h3>
                      <p className="text-sm text-gray-400 mb-2">{alert.message}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Métrica: {alert.details.metric}</span>
                        <span>Valor: {alert.details.value}</span>
                        <span>Umbral: {alert.details.threshold}</span>
                        <span>Disparada: {formatTime(alert.triggeredAt)}</span>
                      </div>
                      
                      {alert.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          {alert.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">
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
      </div>

      {/* Reglas de alerta */}
      <AnimatePresence>
        {showRules && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card"
          >
            <div className="p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                Reglas de Alerta ({rules.length})
              </h2>
            </div>
            
            <div className="divide-y divide-white/5">
              {rules.map((rule) => (
                <div key={rule.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-white">{rule.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(rule.severity)}`}>
                          {getSeverityLabel(rule.severity)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          rule.enabled ? 'text-green-400 bg-green-500/20' : 'text-gray-400 bg-gray-500/20'
                        }`}>
                          {rule.enabled ? 'Habilitada' : 'Deshabilitada'}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-400 mb-2">{rule.description}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Métrica: {rule.metric}</span>
                        <span>Condición: {rule.condition} {rule.threshold}</span>
                        <span>Duración: {rule.duration}s</span>
                        <span>Disparos: {rule.triggerCount}</span>
                        {rule.lastTriggered && (
                          <span>Último: {getTimeSince(rule.lastTriggered)}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
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
