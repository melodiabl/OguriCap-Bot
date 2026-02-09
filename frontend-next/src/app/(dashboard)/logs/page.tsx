
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  RefreshCw,
  Calendar,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  Bug,
  Eye,
  Settings,
  Archive,
  HardDrive,
  Clock,
  Database,
  ChevronDown,
  ChevronRight,
  Copy,
  Activity,
  CheckCircle,
  Cpu,
  MemoryStick,
  Network,
  Server,
  Shield,
  TrendingUp,
  Zap,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { SOCKET_EVENTS, useSocketConnection } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import api from '@/services/api';
import { notify } from '@/lib/notify.tsx';

interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data: any;
  pid?: number;
  hostname?: string;
  stack?: string[];
}

interface LogStats {
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  debugCount: number;
  traceCount: number;
  filesCreated: number;
  filesRotated: number;
  filesCompressed: number;
  lastLogTime: string;
  uptime: number;
  bufferSize: number;
  activeStreams: number;
  diskUsage: {
    totalSize: number;
    fileCount: number;
    formattedSize: string;
  };
}

interface SystemMetrics {
  cpu: { usage: number; cores: number; loadAverage: number[] }
  memory: { usage: number; total: number; free: number; used: number }
  disk: { usage: number; total: string; used: string; available: string }
  network: { interfaces: number; active: number }
  uptime: number
}

interface SystemStatus {
  isRunning: boolean
  systems: {
    metrics: boolean
    alerts: boolean
    reporting: boolean
    resourceMonitor: boolean
    logManager: boolean
    backupSystem: boolean
    securityMonitor: boolean
  }
}

interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  timestamp: string
  resolved: boolean
}

interface Report {
  id: string
  type: string
  title: string
  generatedAt: string
  size: number
  status: 'completed' | 'generating' | 'failed'
  manifest?: any
}

const LOG_LEVELS = {
  error: { color: 'text-red-400 bg-red-500/20', icon: XCircle },
  warn: { color: 'text-yellow-400 bg-yellow-500/20', icon: AlertTriangle },
  info: { color: 'text-blue-400 bg-blue-500/20', icon: Info },
  debug: { color: 'text-purple-400 bg-purple-500/20', icon: Bug },
  trace: { color: 'text-gray-400 bg-gray-500/20', icon: Eye }
};

const LOG_CATEGORIES = [
  'system', 'bot', 'api', 'database', 'security', 
  'performance', 'user', 'plugin', 'network', 'error',
  'terminal', 'mensaje', 'comando', 'evento', 'grupo', 'subbot', 'pedido', 'aporte', 'notificacion'
];

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'system'>('logs');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const { socket } = useSocketConnection();
  const { user } = useAuth();
  const canControl = !!user && ['owner', 'admin', 'administrador'].includes(String(user.rol || '').toLowerCase());
  const reduceMotion = useReducedMotion();

  const normalizeLogEntry = (raw: any): LogEntry => {
    const timestampRaw = raw?.timestamp ?? raw?.fecha ?? raw?.date ?? raw?.createdAt ?? raw?.time;
    const timestamp = typeof timestampRaw === 'string' && timestampRaw
      ? timestampRaw
      : new Date().toISOString();

    const levelRaw = String(raw?.level ?? raw?.nivel ?? raw?.severity ?? raw?.type ?? 'info').toLowerCase();
    const level =
      levelRaw === 'warning' ? 'warn' :
      levelRaw === 'fatal' ? 'error' :
      levelRaw;

    const category = String(raw?.category ?? raw?.tipo ?? raw?.categoria ?? raw?.source ?? 'system');

    const message = String(
      raw?.message ?? raw?.mensaje ?? raw?.detalles ?? raw?.titulo ?? raw?.comando ?? raw?.text ?? ''
    ) || 'Sin mensaje';

    const dataBase = raw?.data ?? raw?.metadata ?? null;
    const extra: any = {};
    if (raw?.id != null) extra.id = raw.id;
    if (raw?.usuario) extra.usuario = raw.usuario;
    if (raw?.grupo) extra.grupo = raw.grupo;

    const data =
      dataBase && typeof dataBase === 'object'
        ? Object.keys(extra).length ? { ...dataBase, ...extra } : dataBase
        : Object.keys(extra).length ? extra : {};

    const stackRaw = raw?.stack ?? raw?.error?.stack;
    const stack = Array.isArray(stackRaw)
      ? stackRaw.map((s: any) => String(s))
      : typeof stackRaw === 'string' && stackRaw
        ? stackRaw.split('\n')
        : undefined;

    return {
      timestamp,
      level,
      category,
      message,
      data,
      pid: raw?.pid,
      hostname: raw?.hostname,
      stack,
    };
  };

  // Initial load
  useEffect(() => {
    loadLogs();
    loadStats();
    loadSystemData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- bootstrap on mount

  // Load logs when filters change (with debouncing)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadLogs();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedLevel, selectedCategory, startDate, endDate, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps -- debounced filters

  // Auto-refresh cada 30 segundos - DISABLED to prevent resource exhaustion
  // useAutoRefresh(() => {
  //   if (activeTab === 'logs') {
  //     loadLogs();
  //     loadStats();
  //   } else {
  //     loadSystemData();
  //   }
  // }, { interval: 30000 });

  const loadSystemData = async () => {
    try {
      setError(null);
      
      // Cargar métricas del sistema
      try {
        const metrics = await api.getSystemStats();
        setSystemMetrics(metrics);
      } catch (err) {
        console.error('Error loading system metrics:', err);
      }
      
      // Cargar estado de sistemas
      try {
        const status = await api.getSystemHealth();
        setSystemStatus(status);
      } catch (err) {
        console.error('Error loading system status:', err);
      }
      
      // Cargar alertas activas
      try {
        const alertsData = await api.getSystemAlerts();
        setAlerts(alertsData.alerts || []);
      } catch (err) {
        console.error('Error loading alerts:', err);
      }
      
      // Cargar reportes recientes
      try {
        const reportsData = await api.getBackups();
        const backupsRaw = (reportsData as any)?.backups;
        const backups = Array.isArray(backupsRaw) ? backupsRaw : [];
        const mapped = backups.map((b: any) => {
          const statusRaw = String(b?.status || '').toLowerCase();
          const status =
            statusRaw === 'completed' ? 'completed' :
            statusRaw === 'failed' ? 'failed' :
            'generating';

          const type = String(b?.type || 'backup');
          const title = String(b?.description || '').trim() || `Reporte ${type}`;
          const generatedAt = String(b?.completedAt || b?.timestamp || new Date().toISOString());
          const size = Number(b?.size || 0);

          return { id: String(b?.id || ''), type, title, generatedAt, size, status, manifest: b } as Report;
        }).filter((r: Report) => Boolean(r.id));
        setReports(mapped);
      } catch (err) {
        console.error('Error loading reports:', err);
      }
      
      // Cargar historial de métricas (simular con datos actuales)
      try {
        const historyRes = await api.getResourcesHistory(60).catch(() => ({ history: [] }));
        const historyRaw = (historyRes as any)?.history;
        const history = Array.isArray(historyRaw) ? historyRaw : [];
        setMetricsHistory(history.map((h: any) => ({
          timestamp: Number(h?.timestamp) || Date.now(),
          cpu: Number(h?.cpu) || 0,
          memory: Number(h?.memory) || 0,
          disk: Number(h?.disk) || 0
        })));
      } catch (err) {
        console.error('Error loading metrics history:', err);
      }
      
    } catch (error) {
      console.error('Error cargando datos del sistema:', error);
      setError('Error cargando datos del sistema');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (rawEntry: any) => {
      const logEntry = normalizeLogEntry(rawEntry);
      if (autoRefresh) {
        setLogs(prev => [logEntry, ...prev.slice(0, pageSize - 1)]);
        loadStats(); // Actualizar estadísticas
      }
    };

    socket.on('log:new', handleNewLog);
    socket.on(SOCKET_EVENTS.LOG_ENTRY, handleNewLog);

    return () => {
      socket.off('log:new', handleNewLog);
      socket.off(SOCKET_EVENTS.LOG_ENTRY, handleNewLog);
    };
  }, [socket, autoRefresh, pageSize]);

  // Disable auto-refresh interval to prevent resource exhaustion
  // useEffect(() => {
  //   if (autoRefresh && activeTab === 'logs') {
  //     const interval = setInterval(() => {
  //       loadLogs();
  //       loadStats();
  //     }, 30000); // Increased to 30 seconds to reduce load

  //     return () => clearInterval(interval);
  //   }
  // }, [autoRefresh, activeTab]); // Removed filter dependencies to prevent excessive calls

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      
      const data = await api.getLogs({
        limit: pageSize,
        page: currentPage,
        query: searchQuery || undefined,
        level: selectedLevel || undefined,
        category: selectedCategory || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      const list = Array.isArray(data?.logs) ? data.logs : [];
      setLogs(list.map(normalizeLogEntry));
    } catch (error) {
      console.error('Error loading logs:', error);
      notify.error('Error cargando logs');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await api.getLogsStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const exportLogs = async (format: string) => {
    try {
      if (!canControl) {
        notify.error('Permisos insuficientes');
        return;
      }
      await api.exportLogs();
      notify.success('Logs exportados');
    } catch (error) {
      notify.error('Error exportando logs');
    }
  };

  const clearLogs = async () => {
    if (!confirm('¿Estás seguro de que quieres limpiar todos los logs? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await api.clearLogs();
      setLogs([]);
      loadStats();
      notify.success('Logs limpiados');
    } catch (error) {
      notify.error('Error limpiando logs');
    }
  };

  const toggleLogExpansion = (index: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  };

  const copyLogToClipboard = (log: LogEntry) => {
    const logText = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(logText);
    notify.success('Log copiado al portapapeles');
  };

  const formatTimestamp = (timestamp: string) => {
    const t = new Date(timestamp);
    if (Number.isNaN(t.getTime())) return '-';
    return t.toLocaleString();
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m ${seconds % 60}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSystemStatusColor = (isRunning: boolean) => {
    return isRunning ? 'text-green-500' : 'text-red-500';
  };

  const getAuthHeaders = () => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const generateReport = async (type: string) => {
    try {
      if (!canControl) {
        notify.error('Permisos insuficientes');
        return;
      }
      await api.createBackup({
        type,
        includeDatabase: type === 'daily',
        includeConfig: true,
        includeLogs: type !== 'performance',
        description: `Reporte ${type}`,
      });
      await loadSystemData(); // Recargar datos
      notify.success('Reporte generado');
    } catch (error) {
      console.error('Error generando reporte:', error);
      notify.error((error as any)?.response?.data?.error || 'Error generando reporte');
    }
  };

  const downloadReport = async (report: Report) => {
    try {
      if (typeof window === 'undefined') return;
      const data = report?.manifest ?? report;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-${report.id}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando reporte:', error);
      notify.error('Error descargando reporte');
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este reporte?')) return;
    try {
      await api.deleteBackup(reportId);
      setReports(prev => prev.filter(r => r.id !== reportId));
      notify.success('Reporte eliminado');
    } catch (error) {
      console.error('Error eliminando reporte:', error);
      notify.error('Error eliminando reporte');
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
    notify.info(`Actualización automática ${autoRefresh ? 'desactivada' : 'activada'}`);
  };

  const getLevelIcon = (level: string) => {
    const config = LOG_LEVELS[level as keyof typeof LOG_LEVELS];
    return config ? <config.icon className="w-4 h-4" /> : <Info className="w-4 h-4" />;
  };

  const getLevelColorClass = (level: string) => {
    const config = LOG_LEVELS[level as keyof typeof LOG_LEVELS];
    return config ? config.color : 'text-gray-400 bg-gray-500/20';
  };

  const getCategoryColorClass = (category: string) => {
    switch (category) {
      case 'error': return 'bg-red-500/20 text-red-400';
      case 'security': return 'bg-purple-500/20 text-purple-400';
      case 'bot': return 'bg-emerald-500/20 text-emerald-400';
      case 'api': return 'bg-blue-500/20 text-blue-400';
      case 'database': return 'bg-indigo-500/20 text-indigo-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getSystemStatusIcon = (systemName: string, isRunning: boolean) => {
    const IconComponent = {
      metrics: Cpu,
      alerts: Bell,
      reporting: FileText,
      resourceMonitor: Activity,
      logManager: Database,
      backupSystem: HardDrive,
      securityMonitor: Shield,
    }[systemName as keyof typeof SystemStatus.systems] || Info;

    return <IconComponent className={`w-5 h-5 ${isRunning ? 'text-emerald-400' : 'text-red-400'}`} />;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs y Monitoreo"
        description="Visualiza logs del sistema, métricas y estado de servicios en tiempo real."
        icon={<FileText className="w-6 h-6 text-blue-400" />}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => { loadLogs(); loadStats(); loadSystemData(); }}
              loading={isLoading}
            >
              Actualizar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Settings className="w-4 h-4" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filtros
            </Button>
            {canControl && (
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={clearLogs}
              >
                Limpiar Logs
              </Button>
            )}
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="logs">Logs del Sistema</TabsTrigger>
            <TabsTrigger value="system">Estado del Sistema</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Auto-refresh:</span>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={toggleAutoRefresh}
              className="toggle toggle-primary"
            />
          </div>
        </div>

        {activeTab === 'logs' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {showFilters && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Opciones de Filtro</CardTitle>
                  <CardDescription>Refina la búsqueda de logs por nivel, categoría y fecha.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">Buscar</label>
                    <input
                      type="text"
                      placeholder="Buscar mensaje o datos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-glass w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">Nivel</label>
                    <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Todos los niveles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos los niveles</SelectItem>
                        {Object.keys(LOG_LEVELS).map(level => (
                          <SelectItem key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">Categoría</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Todas las categorías" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas las categorías</SelectItem>
                        {LOG_CATEGORIES.map(category => (
                          <SelectItem key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">Fecha Inicio</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input-glass w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">Fecha Fin</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input-glass w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Logs Recientes</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={() => exportLogs('json')}>Exportar JSON</Button>
                  {/* <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={() => exportLogs('csv')}>Exportar CSV</Button> */}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : logs.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="w-6 h-6 text-gray-400" />}
                    title="No hay logs para mostrar"
                    description="Ajusta tus filtros o espera a que se generen nuevos logs."
                  />
                ) : (
                  <div className="divide-y divide-white/5">
                    {logs.map((log, index) => (
                      <div key={index} className="py-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <Badge className={getLevelColorClass(log.level)}>
                              {getLevelIcon(log.level)}
                              <span className="ml-1 capitalize">{log.level}</span>
                            </Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</span>
                                <Badge className={getCategoryColorClass(log.category)}>
                                  <span className="capitalize">{log.category}</span>
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => copyLogToClipboard(log)} title="Copiar log">
                                  <Copy className="w-4 h-4 text-gray-500 hover:text-white" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => toggleLogExpansion(index)} title="Ver detalles">
                                  {expandedLogs.has(index) ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-white/90 leading-relaxed break-words">
                              {log.message}
                            </p>
                            <AnimatePresence>
                              {expandedLogs.has(index) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 text-xs font-mono overflow-x-auto"
                                >
                                  <pre className="whitespace-pre-wrap break-all">{JSON.stringify(log.data, null, 2)}</pre>
                                  {log.stack && log.stack.length > 0 && (
                                    <>
                                      <h4 className="font-bold mt-3 mb-1">Stack Trace:</h4>
                                      <pre className="whitespace-pre-wrap break-all text-red-400">{log.stack.join('\n')}</pre>
                                    </>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'system' && systemMetrics && systemStatus && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Métricas del Sistema</CardTitle>
                <CardDescription>Uso de CPU, memoria y disco en tiempo real.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">Uso de CPU</h4>
                  <Progress value={systemMetrics.cpu.usage} className="w-full" />
                  <p className="text-xs text-muted mt-1">{systemMetrics.cpu.usage.toFixed(2)}% de {systemMetrics.cpu.cores} núcleos</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">Uso de Memoria</h4>
                  <Progress value={systemMetrics.memory.usage} className="w-full" />
                  <p className="text-xs text-muted mt-1">{formatBytes(systemMetrics.memory.used)} / {formatBytes(systemMetrics.memory.total)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">Uso de Disco</h4>
                  <Progress value={systemMetrics.disk.usage} className="w-full" />
                  <p className="text-xs text-muted mt-1">{systemMetrics.disk.used} / {systemMetrics.disk.total}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2">Uptime</h4>
                  <p className="text-sm text-white">{formatUptime(systemMetrics.uptime * 1000)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estado de Servicios</CardTitle>
                <CardDescription>Estado actual de los componentes clave del sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(systemStatus.systems).map(([key, isRunning]) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3">
                      {getSystemStatusIcon(key, isRunning)}
                      <span className="text-sm font-medium capitalize text-white">{key.replace(/([A-Z])/g, ' $1')}</span>
                    </div>
                    <Badge className={isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                      {isRunning ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Historial de Recursos</CardTitle>
                <CardDescription>Tendencias de uso de CPU y memoria en las últimas horas.</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={metricsHistory}>
                      <defs>
                        <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(ts) => new Date(ts).toLocaleTimeString()} 
                        stroke="#6b7280"
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        unit="%"
                      />
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: '8px' }}
                        labelStyle={{ color: '#e5e7eb' }}
                        itemStyle={{ color: '#d1d5db' }}
                        formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === 'cpu' ? 'CPU' : 'Memoria']}
                      />
                      <Area type="monotone" dataKey="cpu" stroke="#8884d8" fillOpacity={1} fill="url(#colorCpu)" />
                      <Area type="monotone" dataKey="memory" stroke="#82ca9d" fillOpacity={1} fill="url(#colorMemory)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    icon={<TrendingUp className="w-6 h-6 text-gray-400" />}
                    title="No hay datos de historial"
                    description="El historial de métricas se recopilará con el tiempo."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas Activas</CardTitle>
                <CardDescription>Notificaciones importantes del sistema.</CardDescription>
              </CardHeader>
              <CardContent>
                {alerts.length > 0 ? (
                  <div className="space-y-3">
                    {alerts.map(alert => (
                      <div key={alert.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className={`w-2 h-2 rounded-full ${getSeverityColor(alert.severity)}`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{alert.title}</p>
                          <p className="text-xs text-muted">{alert.message}</p>
                        </div>
                        <span className="text-xs text-gray-500">{formatTimestamp(alert.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Bell className="w-6 h-6 text-gray-400" />}
                    title="No hay alertas activas"
                    description="Tu sistema está funcionando sin problemas."
                  />
                )}
              </CardContent>
            </Card>

            {canControl && (
              <Card>
                <CardHeader>
                  <CardTitle>Reportes y Backups</CardTitle>
                  <CardDescription>Genera y gestiona reportes de sistema y backups.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => generateReport('daily')}>Generar Reporte Diario</Button>
                    <Button variant="secondary" size="sm" onClick={() => generateReport('weekly')}>Generar Reporte Semanal</Button>
                    <Button variant="secondary" size="sm" onClick={() => generateReport('monthly')}>Generar Reporte Mensual</Button>
                  </div>
                  {reports.length > 0 ? (
                    <div className="space-y-3">
                      {reports.map(report => (
                        <div key={report.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">{report.title}</p>
                            <p className="text-xs text-muted">{report.type} - {formatTimestamp(report.generatedAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={report.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : report.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}>
                              {report.status === 'completed' ? 'Completado' : report.status === 'failed' ? 'Fallido' : 'Generando'}
                            </Badge>
                            {report.status === 'completed' && (
                              <Button variant="ghost" size="icon" onClick={() => downloadReport(report)} title="Descargar Reporte">
                                <Download className="w-4 h-4 text-gray-500 hover:text-white" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => deleteReport(report.id)} title="Eliminar Reporte">
                              <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Archive className="w-6 h-6 text-gray-400" />}
                      title="No hay reportes generados"
                      description="Genera reportes para tener un historial de tu sistema."
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </Tabs>
    </div>
  );
}
