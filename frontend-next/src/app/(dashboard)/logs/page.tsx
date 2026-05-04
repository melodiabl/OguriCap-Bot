
'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronUp,
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/Select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { TerminalLogViewer } from '@/components/logs/TerminalLogViewer';
import { SOCKET_EVENTS, useSocketConnection } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import api from '@/services/api';
import { notify } from '@/lib/notif';
import { formatDateTime, formatUptime as formatSecondsUptime, getErrorMessage } from '@/lib/utils';

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
  error: { color: 'text-danger bg-danger/20', icon: XCircle },
  warn: { color: 'text-warning bg-warning/20', icon: AlertTriangle },
  info: { color: 'text-info bg-info/20', icon: Info },
  debug: { color: 'text-accent bg-accent/20', icon: Bug },
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
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const { socket, isConnected: isSocketConnected } = useSocketConnection();
  const { user } = useAuth();
  const canControl = !!user && ['owner', 'admin', 'administrador'].includes(String(user.rol || '').toLowerCase());
  const reduceMotion = useReducedMotion();
  const chartColors = useMemo(() => ({
    primary: 'rgb(var(--primary))',
    primaryFill: 'rgb(var(--primary) / 0.2)',
    success: 'rgb(var(--success))',
    successFill: 'rgb(var(--success) / 0.18)',
    grid: 'rgb(var(--border) / 0.18)',
    axis: 'rgb(var(--text-secondary) / 1)',
  }), []);

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

  // Initial load on mount
  useEffect(() => {
    loadLogs();
    loadStats();
    loadSystemData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        console.error('Error loading system metrics:', getErrorMessage(err));
      }
      
      // Cargar estado de sistemas
      try {
        const status = await api.getSystemHealth();
        setSystemStatus(status);
      } catch (err) {
        console.error('Error loading system status:', getErrorMessage(err));
      }
      
      // Cargar alertas activas
      try {
        const alertsData = await api.getSystemAlerts();
        setAlerts(alertsData.alerts || []);
      } catch (err) {
        console.error('Error loading alerts:', getErrorMessage(err));
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
        console.error('Error loading reports:', getErrorMessage(err));
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
        console.error('Error loading metrics history:', getErrorMessage(err));
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
      if (data?.totalPages !== undefined) setTotalPages(data.totalPages);
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
    return formatDateTime(timestamp, { second: '2-digit' });
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
      case 'critical': return 'bg-danger';
      case 'warning': return 'bg-warning';
      case 'info': return 'bg-info';
      default: return 'bg-gray-500';
    }
  };

  const getSystemStatusColor = (isRunning: boolean) => {
    return isRunning ? 'text-success' : 'text-danger';
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
      case 'error': return 'bg-danger/20 text-danger';
      case 'security': return 'bg-accent/20 text-accent';
      case 'bot': return 'bg-success/20 text-success';
      case 'api': return 'bg-info/20 text-info';
      case 'database': return 'bg-indigo-500/20 text-indigo-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getSystemStatusIcon = (systemName: string, isRunning: boolean) => {
    const systemIcons: Record<string, React.ComponentType<any>> = {
      metrics: Cpu,
      alerts: Bell,
      reporting: FileText,
      resourceMonitor: Activity,
      logManager: Database,
      backupSystem: HardDrive,
      securityMonitor: Shield,
    };
    const IconComponent = systemIcons[systemName] || Info;

    return <IconComponent className={`w-5 h-5 ${isRunning ? 'text-success' : 'text-danger'}`} />;
  };

  const runningSystemsCount = systemStatus?.systems ? Object.values(systemStatus.systems).filter(Boolean).length : 0;
  const totalSystemsCount = systemStatus?.systems ? Object.keys(systemStatus.systems).length : 0;
  const openSystemAlertsCount = alerts.filter((alert) => !alert.resolved).length;
  const logLanes = [
    {
      label: 'Canal de eventos',
      value: isSocketConnected ? 'Stream en vivo' : 'Fallback local',
      description: isSocketConnected ? 'Entradas nuevas y estado del sistema en tiempo real.' : 'El panel sigue disponible con recarga y polling puntual.',
      icon: <Activity className="w-4 h-4" />,
      badge: isSocketConnected ? 'live' : 'local',
      badgeClassName: isSocketConnected ? 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
    },
    {
      label: 'Alertas abiertas',
      value: `${openSystemAlertsCount}`,
      description: openSystemAlertsCount > 0 ? 'Incidentes del sistema todavia pendientes de resolucion.' : 'No hay alertas del host pendientes ahora mismo.',
      icon: <Bell className="w-4 h-4" />,
      badge: openSystemAlertsCount > 0 ? 'pendiente' : 'ok',
      badgeClassName: openSystemAlertsCount > 0 ? 'border-warning/20 bg-warning/10 text-warning/80' : 'border-[rgb(var(--success))]/20 bg-[rgb(var(--success))]/10 text-[#c7f9d8]',
      glowClassName: 'from-amber-400/18 via-oguri-gold/10 to-transparent',
    },
    {
      label: 'Servicios del stack',
      value: totalSystemsCount > 0 ? `${runningSystemsCount}/${totalSystemsCount}` : 'Sin datos',
      description: totalSystemsCount > 0 ? 'Módulos internos activos del centro de observabilidad.' : 'Esperando el estado detallado del sistema.',
      icon: <Server className="w-4 h-4" />,
      badge: runningSystemsCount === totalSystemsCount && totalSystemsCount > 0 ? 'estable' : 'revisar',
      badgeClassName: runningSystemsCount === totalSystemsCount && totalSystemsCount > 0 ? 'border-accent/20 bg-accent/10 text-accent' : 'border-danger/20 bg-danger/10 text-danger/80',
      glowClassName: 'from-violet-400/18 via-oguri-lavender/10 to-transparent',
    },
    {
      label: 'Reportes recientes',
      value: `${reports.length}`,
      description: reports.length > 0 ? 'Backups y reportes listos para auditoria o descarga.' : 'Todavia no hay reportes cargados en esta vista.',
      icon: <Archive className="w-4 h-4" />,
      badge: 'audit',
      badgeClassName: 'border-success/20 bg-success/10 text-success/80',
      glowClassName: 'from-emerald-400/18 via-oguri-cyan/10 to-transparent',
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-success/16 blur-3xl"
          animate={reduceMotion ? { opacity: 0.28 } : { x: [0, 18, 0], y: [0, 16, 0], opacity: [0.18, 0.36, 0.18] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 11.4, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-blue/16 blur-3xl"
          animate={reduceMotion ? { opacity: 0.24 } : { x: [0, -18, 0], y: [0, 18, 0], opacity: [0.16, 0.34, 0.16] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 10.8, ease: 'easeInOut', delay: 0.6 }}
        />
      </div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(var(--page-a),0.14),rgba(var(--page-b),0.10),rgba(var(--page-c),0.10))] p-5 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6"
      >
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit">
              <Shield className="h-3.5 w-3.5 text-success/80" />
              Observabilidad total
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Centro de logs con HUD táctico</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Eventos, métricas y sistema en una cabina con lectura rápida, brillo técnico y textura tipo consola viva.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Modo</p>
              <p className="mt-2 text-lg font-black text-white">{activeTab === 'logs' ? 'LOGS' : 'SYSTEM'}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Refresh</p>
              <p className="mt-2 text-lg font-black text-white">{autoRefresh ? 'AUTO' : 'MANUAL'}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Errores</p>
              <p className="mt-2 text-lg font-black text-white">{stats?.errorCount || 0}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <PageHeader
        title="Logs y Monitoreo"
        description="Visualiza logs del sistema, métricas y estado de servicios en tiempo real."
        icon={<FileText className="w-6 h-6 text-info" />}
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {logLanes.map((lane, index) => (
          <motion.div
            key={lane.label}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
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

      {stats && (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" delay={0.04} stagger={0.05}>
          <StaggerItem>
            <StatCard title="Logs Totales" value={stats.totalLogs || 0} subtitle={`${stats.bufferSize || 0} en buffer`} icon={<FileText className="h-6 w-6 text-primary" />} color="primary" />
          </StaggerItem>
          <StaggerItem>
            <StatCard title="Errores" value={stats.errorCount || 0} subtitle={`${stats.warnCount || 0} warnings`} icon={<AlertCircle className="h-6 w-6 text-danger" />} color="danger" />
          </StaggerItem>
          <StaggerItem>
            <StatCard title="Archivos" value={stats.diskUsage?.fileCount || 0} subtitle={stats.diskUsage?.formattedSize || '0 B'} icon={<HardDrive className="h-6 w-6 text-info" />} color="info" />
          </StaggerItem>
          <StaggerItem>
            <StatCard title="Uptime" value={formatSecondsUptime(stats.uptime || 0)} subtitle={`${stats.activeStreams || 0} streams`} icon={<Clock className="h-6 w-6 text-success/80" />} color="success" />
          </StaggerItem>
        </Stagger>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="panel-setting-row mb-4">
          <TabsList>
            <TabsTrigger value="logs">Logs del Sistema</TabsTrigger>
            <TabsTrigger value="system">Estado del Sistema</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Auto-refresh:</span>
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
              <Card className="mb-6 shadow-glow-oguri-cyan">
                <CardHeader>
                  <CardTitle>Opciones de Filtro</CardTitle>
                  <CardDescription>Refina la búsqueda de logs por nivel, categoría y fecha.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="panel-field">
                    <label className="panel-field-label text-xs">Buscar</label>
                    <input
                      type="text"
                      placeholder="Buscar mensaje o datos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-glass w-full"
                    />
                  </div>
                  <div className="panel-field">
                    <label className="panel-field-label text-xs">Nivel</label>
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
                  <div className="panel-field">
                    <label className="panel-field-label text-xs">Categoría</label>
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
                  <div className="panel-field">
                    <label className="panel-field-label text-xs">Fecha Inicio</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input-glass w-full"
                    />
                  </div>
                  <div className="panel-field">
                    <label className="panel-field-label text-xs">Fecha Fin</label>
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

              <Card className="overflow-hidden shadow-glow-oguri-blue">
                <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Logs Recientes</CardTitle>
                  <div className="panel-actions-wrap">
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
                  <div className="divide-y divide-border/10">
                    {logs.map((log, index) => (
                      <div key={index} className="panel-terminal-row px-4 py-4">
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
                                <span className="text-xs text-muted">{formatTimestamp(log.timestamp)}</span>
                                <Badge className={getCategoryColorClass(log.category)}>
                                  <span className="capitalize">{log.category}</span>
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => copyLogToClipboard(log)} title="Copiar log">
                                  <Copy className="w-4 h-4 text-muted hover:text-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => toggleLogExpansion(index)} title="Ver detalles">
                                  {expandedLogs.has(index) ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed break-words">
                              {log.message}
                            </p>
                            <AnimatePresence>
                              {expandedLogs.has(index) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="panel-readonly-block mt-3 overflow-x-auto text-xs font-mono"
                                >
                                  <pre className="whitespace-pre-wrap break-all">{JSON.stringify(log.data, null, 2)}</pre>
                                  {log.stack && log.stack.length > 0 && (
                                    <>
                                      <h4 className="font-bold mt-3 mb-1">Stack Trace:</h4>
                                      <pre className="whitespace-pre-wrap break-all text-danger">{log.stack.join('\n')}</pre>
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

            {canControl && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Terminal en Vivo</CardTitle>
                  <CardDescription>Flujo de salida reciente del sistema en tiempo real.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TerminalLogViewer />
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === 'system' && systemMetrics && systemStatus && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-2"
          >
            <Card>
              <CardHeader>
                <CardTitle>Métricas del Sistema</CardTitle>
                <CardDescription>Uso de CPU, memoria y disco en tiempo real.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">Uso de CPU</h4>
                  <Progress value={systemMetrics.cpu.usage} className="w-full" />
                  <p className="text-xs text-muted mt-1">{systemMetrics.cpu.usage.toFixed(2)}% de {systemMetrics.cpu.cores} núcleos</p>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">Uso de Memoria</h4>
                  <Progress value={systemMetrics.memory.usage} className="w-full" />
                  <p className="text-xs text-muted mt-1">{formatBytes(systemMetrics.memory.used)} / {formatBytes(systemMetrics.memory.total)}</p>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">Uso de Disco</h4>
                  <Progress value={systemMetrics.disk.usage} className="w-full" />
                  <p className="text-xs text-muted mt-1">{systemMetrics.disk.used} / {systemMetrics.disk.total}</p>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">Uptime</h4>
                  <p className="text-sm text-foreground">{formatSecondsUptime(systemMetrics.uptime)}</p>
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
                  <div key={key} className="panel-setting-row">
                    <div className="flex items-center gap-3">
                      {getSystemStatusIcon(key, isRunning)}
                      <span className="text-sm font-medium capitalize text-foreground">{key.replace(/([A-Z])/g, ' $1')}</span>
                    </div>
                    <Badge className={isRunning ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}>
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
                          <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.success} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={chartColors.success} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(ts) => new Date(ts).toLocaleTimeString()} 
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.axis, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.axis, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        unit="%"
                      />
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.5} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgb(var(--surface-elevated))', border: '1px solid rgb(var(--border) / 0.15)', borderRadius: '12px' }}
                        labelStyle={{ color: 'rgb(var(--text-primary))' }}
                        itemStyle={{ color: 'rgb(var(--text-secondary))' }}
                        formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === 'cpu' ? 'CPU' : 'Memoria']}
                      />
                      <Area type="monotone" dataKey="cpu" stroke={chartColors.primary} fillOpacity={1} fill="url(#colorCpu)" />
                      <Area type="monotone" dataKey="memory" stroke={chartColors.success} fillOpacity={1} fill="url(#colorMemory)" />
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
                      <div key={alert.id} className="panel-setting-row">
                        <div className={`w-2 h-2 rounded-full ${getSeverityColor(alert.severity)}`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{alert.title}</p>
                          <p className="text-xs text-muted">{alert.message}</p>
                        </div>
                        <span className="text-xs text-muted">{formatTimestamp(alert.timestamp)}</span>
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
                        <div key={report.id} className="panel-setting-row">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{report.title}</p>
                            <p className="text-xs text-muted">{report.type} - {formatTimestamp(report.generatedAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={report.status === 'completed' ? 'bg-success/20 text-success' : report.status === 'failed' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'}>
                              {report.status === 'completed' ? 'Completado' : report.status === 'failed' ? 'Fallido' : 'Generando'}
                            </Badge>
                            {report.status === 'completed' && (
                              <Button variant="ghost" size="icon" onClick={() => downloadReport(report)} title="Descargar Reporte">
                                <Download className="w-4 h-4 text-muted hover:text-foreground" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => deleteReport(report.id)} title="Eliminar Reporte">
                              <Trash2 className="w-4 h-4 text-muted hover:text-danger" />
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
