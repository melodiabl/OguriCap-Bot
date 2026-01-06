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
import { notify } from '@/lib/notify';

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

  const restartSystem = async (systemName: string) => {
    try {
      if (!canControl) {
        notify.error('Permisos insuficientes');
        return;
      }
      const response = await fetch(`/api/system/${systemName}/restart`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      
      if (response.ok) {
        await loadSystemData(); // Recargar datos
        const data = await response.json().catch(() => ({}));
        notify.success(data?.message || `Sistema ${systemName} reiniciado`);
      } else {
        const data = await response.json().catch(() => ({}));
        notify.error(data?.error || `No se pudo reiniciar ${systemName}`);
      }
    } catch (error) {
      console.error('Error reiniciando sistema:', error);
      notify.error('Error reiniciando sistema');
    }
  };

  const getLevelConfig = (level: string) => {
    return LOG_LEVELS[level as keyof typeof LOG_LEVELS] || LOG_LEVELS.info;
  };

  const logsListVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.02,
      },
    },
  };

  const logItemVariants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.99 },
    show: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.99 },
  };

  if (isLoading && logs.length === 0 && !systemMetrics) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-7 w-56 rounded" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-36 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-stat">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-20 rounded mb-2" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
          ))}
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-44 rounded" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/5">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-2/3 rounded mb-2" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Logs & Sistema"
        description="Gestión de logs y monitoreo del sistema"
        icon={<FileText className="w-6 h-6 text-primary-400" />}
        actions={
          <>
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? "primary" : "secondary"}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto-refresh
            </Button>

            <Button
              onClick={() => {
                if (activeTab === 'logs') {
                  loadLogs();
                  loadStats();
                } else {
                  loadSystemData();
                }
              }}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <Reveal>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="border-b-0">
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Logs del Sistema
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Monitoreo del Sistema
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Reveal>

      {error && (
        <Card className="p-4 border border-red-500/20 bg-red-500/10">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
            
            <Button
              onClick={() => exportLogs('json')}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar
            </Button>
            
            <Button
              onClick={clearLogs}
              variant="danger"
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Limpiar
            </Button>
          </div>

          {/* Estadísticas de Logs */}
          {stats && (
            <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" delay={0.08} stagger={0.07}>
              <StaggerItem>
                <StatCard
                  title="Total Logs"
                  value={stats.totalLogs}
                  subtitle={`${stats.errorCount} errores • ${stats.warnCount} warnings`}
                  icon={<FileText className="w-6 h-6" />}
                  color="primary"
                  delay={0}
                  loading={false}
                  animated
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  title="Errores"
                  value={stats.errorCount}
                  subtitle="Últimas 24h"
                  icon={<XCircle className="w-6 h-6" />}
                  color="danger"
                  delay={0.05}
                  loading={false}
                  animated
                  active={stats.errorCount > 0}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  title="Disco (logs)"
                  value={stats.diskUsage.formattedSize}
                  subtitle={`${stats.diskUsage.fileCount} archivos`}
                  icon={<HardDrive className="w-6 h-6" />}
                  color="success"
                  delay={0.1}
                  loading={false}
                  animated
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  title="Uptime"
                  value={formatUptime(stats.uptime)}
                  subtitle={stats.lastLogTime ? `Último: ${formatTimestamp(stats.lastLogTime)}` : undefined}
                  icon={<Clock className="w-6 h-6" />}
                  color="info"
                  delay={0.15}
                  loading={false}
                  animated
                />
              </StaggerItem>
            </Stagger>
          )}

          {/* Filtros */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-card p-6"
              >
                <h3 className="text-lg font-semibold text-white mb-4">Filtros de Búsqueda</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Búsqueda
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-glass pl-10"
                        placeholder="Buscar en logs..."
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nivel
                    </label>
                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="input-glass"
                    >
                      <option value="">Todos los niveles</option>
                      <option value="error">Error</option>
                      <option value="warn">Warning</option>
                      <option value="info">Info</option>
                      <option value="debug">Debug</option>
                      <option value="trace">Trace</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Categoría
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="input-glass"
                    >
                      <option value="">Todas las categorías</option>
                      {LOG_CATEGORIES.map(category => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Rango de Fechas
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="input-glass text-sm"
                      />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="input-glass text-sm"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lista de logs */}
          <div className="glass-card">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Logs del Sistema ({logs.length})
                </h2>
                
                <div className="flex items-center gap-3">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(parseInt(e.target.value))}
                    className="input-glass text-sm"
                  >
                    <option value={25}>25 por página</option>
                    <option value={50}>50 por página</option>
                    <option value={100}>100 por página</option>
                  </select>
                </div>
              </div>
            </div>
            
            <motion.div variants={logsListVariants} initial="hidden" animate="show" className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout" initial={false}>
                {logs.length === 0 ? (
                  <motion.div key="empty" variants={logItemVariants} exit="exit" className="p-6">
                    <EmptyState
                      title="No se encontraron logs"
                      description="Probá ajustando filtros o refrescando."
                      icon={<FileText className="w-6 h-6 text-primary-400" />}
                    />
                  </motion.div>
                ) : (
                  logs.map((log, index) => {
                    const levelConfig = getLevelConfig(log.level);
                    const Icon = levelConfig.icon;
                    const isExpanded = expandedLogs.has(index);

                    return (
                      <motion.div
                        key={`${log.timestamp}-${index}`}
                        layout="position"
                        variants={logItemVariants}
                        exit="exit"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : {
                                opacity: { duration: 0.18, ease: 'easeOut' },
                                y: { type: 'spring', stiffness: 420, damping: 34, mass: 0.85 },
                                scale: { type: 'spring', stiffness: 420, damping: 34, mass: 0.85 },
                              }
                        }
                        className="p-4 hover:bg-white/5 transition-colors"
                      >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${levelConfig.color} flex-shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-400">
                                {formatTimestamp(log.timestamp)}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${levelConfig.color}`}>
                                {(String(log.level || '')).toUpperCase() || 'INFO'}
                              </span>
                              <span className="px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-300">
                                {log.category}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => copyLogToClipboard(log)}
                                variant="ghost"
                                size="sm"
                                className="p-1"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              
                              {(log.data && Object.keys(log.data).length > 0) || log.stack ? (
                                <Button
                                  onClick={() => toggleLogExpansion(index)}
                                  variant="ghost"
                                  size="sm"
                                  className="p-1"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          
                          <p className="text-white text-sm mb-2">{log.message}</p>
                          
                          {log.hostname && (
                            <p className="text-xs text-gray-500">
                              Host: {log.hostname} | PID: {log.pid}
                            </p>
                          )}
                          
                          {/* Detalles expandidos */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 space-y-3"
                              >
                                {log.data && Object.keys(log.data).length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-300 mb-2">Datos:</h4>
                                    <pre className="text-xs bg-gray-900 p-3 rounded-lg overflow-x-auto text-gray-300">
                                      {JSON.stringify(log.data, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                
                                {log.stack && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-300 mb-2">Stack Trace:</h4>
                                    <pre className="text-xs bg-gray-900 p-3 rounded-lg overflow-x-auto text-red-300">
                                      {log.stack.join('\n')}
                                    </pre>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}

      {/* System Monitoring Tab */}
      {activeTab === 'system' && (
        <>
          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU</CardTitle>
                <Cpu className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {systemMetrics?.cpu.usage.toFixed(1)}%
                </div>
                <Progress value={systemMetrics?.cpu.usage || 0} className="mt-2" />
                <p className="text-xs text-gray-500 mt-2">
                  {systemMetrics?.cpu.cores} núcleos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memoria</CardTitle>
                <MemoryStick className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {systemMetrics?.memory.usage.toFixed(1)}%
                </div>
                <Progress value={systemMetrics?.memory.usage || 0} className="mt-2" />
                <p className="text-xs text-gray-500 mt-2">
                  {formatBytes(systemMetrics?.memory.used || 0)} / {formatBytes(systemMetrics?.memory.total || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Disco</CardTitle>
                <HardDrive className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {systemMetrics?.disk.usage.toFixed(1)}%
                </div>
                <Progress value={systemMetrics?.disk.usage || 0} className="mt-2" />
                <p className="text-xs text-gray-500 mt-2">
                  {systemMetrics?.disk.used} / {systemMetrics?.disk.total}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <Clock className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatUptime(systemMetrics?.uptime || 0)}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Sistema activo
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos de métricas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>CPU y Memoria (Última hora)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metricsHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Line type="monotone" dataKey="cpu" stroke="rgb(var(--primary))" name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="rgb(var(--success))" name="Memoria %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Uso de Disco</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metricsHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Area type="monotone" dataKey="disk" stroke="rgb(var(--warning))" fill="rgb(var(--warning))" name="Disco %" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Estado de sistemas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Server className="h-5 w-5" />
                <span>Estado de Sistemas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {systemStatus && Object.entries(systemStatus.systems).map(([name, isRunning]) => (
                  <div key={name} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="text-sm font-medium capitalize">
                      {name.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <div className={`flex items-center space-x-1 ${getSystemStatusColor(isRunning)}`}>
                      {isRunning ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      <span className="text-xs">{isRunning ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alertas recientes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Alertas del Sistema</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">No hay alertas activas</p>
                  <p className="text-gray-400">El sistema está funcionando correctamente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className={`w-3 h-3 rounded-full mt-1 ${getSeverityColor(alert.severity)}`} />
                          <div className="flex-1">
                            <h4 className="font-medium">{alert.title}</h4>
                            <p className="text-sm text-gray-400 mt-1">{alert.message}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant={alert.resolved ? 'success' : 'danger'}>
                          {alert.resolved ? 'Resuelta' : (String(alert.severity || 'info')).toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Control de sistemas */}
          {canControl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Control de Sistemas</span>
                </CardTitle>
                <CardDescription>
                  Gestionar y controlar los sistemas del bot
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {systemStatus && Object.entries(systemStatus.systems).map(([name, isRunning]) => (
                    <div key={name} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium capitalize">
                            {name.replace(/([A-Z])/g, ' $1').trim()}
                          </h4>
                          <p className={`text-sm ${getSystemStatusColor(isRunning)}`}>
                            {isRunning ? 'Activo' : 'Inactivo'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => restartSystem(name)}
                        >
                          Reiniciar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reportes del sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Reportes del Sistema</span>
              </CardTitle>
              <CardDescription>
                Generar y descargar reportes del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Button onClick={() => generateReport('daily')} variant="secondary" disabled={!canControl}>
                    Reporte Diario
                  </Button>
                  <Button onClick={() => generateReport('performance')} variant="secondary" disabled={!canControl}>
                    Reporte de Rendimiento
                  </Button>
                  <Button onClick={() => generateReport('security')} variant="secondary" disabled={!canControl}>
                    Reporte de Seguridad
                  </Button>
                </div>
                {!canControl && (
                  <p className="text-sm text-gray-400 [html[data-theme=light]_&]:text-gray-600">
                    Solo admins/owner pueden generar reportes o reiniciar sistemas.
                  </p>
                )}

                <div className="space-y-3">
                  {reports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{report.title}</p>
                        <p className="text-sm text-gray-400">
                          {new Date(report.generatedAt).toLocaleString()} • {formatBytes(report.size)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            report.status === 'completed'
                              ? 'success'
                              : report.status === 'failed'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {report.status === 'completed'
                            ? 'Completado'
                            : report.status === 'generating'
                              ? 'Generando'
                              : 'Error'}
                        </Badge>
                        {report.status === 'completed' && (
                          <Button size="sm" variant="secondary" onClick={() => downloadReport(report)}>
                            Descargar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
