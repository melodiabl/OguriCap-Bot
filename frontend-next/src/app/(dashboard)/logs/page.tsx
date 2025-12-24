'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useSocket } from '@/hooks/useSocket';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import toast from 'react-hot-toast';

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
  'performance', 'user', 'plugin', 'network', 'error'
];

// Componentes UI simples
const Badge = ({ children, variant = 'default', className = '' }: { children: React.ReactNode, variant?: string, className?: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
    variant === 'secondary' ? 'bg-gray-100 text-gray-800' : 
    variant === 'destructive' ? 'bg-red-100 text-red-800' : 
    'bg-blue-100 text-blue-800'
  } ${className}`}>
    {children}
  </span>
);

const Progress = ({ value = 0, className = '' }: { value?: number, className?: string }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2.5 ${className}`}>
    <div 
      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
    />
  </div>
);

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('logs');
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

  const socket = useSocket();

  useEffect(() => {
    loadLogs();
    loadStats();
    loadSystemData();
  }, [searchQuery, selectedLevel, selectedCategory, startDate, endDate, currentPage]);

  // Auto-refresh cada 30 segundos
  useAutoRefresh(() => {
    if (activeTab === 'logs') {
      loadLogs();
      loadStats();
    } else {
      loadSystemData();
    }
  }, { interval: 30000 });

  const loadSystemData = async () => {
    try {
      setError(null);
      
      // Cargar métricas del sistema
      const metricsRes = await fetch('/api/system/metrics');
      if (metricsRes.ok) {
        const metrics = await metricsRes.json();
        setSystemMetrics(metrics);
      }
      
      // Cargar estado de sistemas
      const statusRes = await fetch('/api/system/status');
      if (statusRes.ok) {
        const status = await statusRes.json();
        setSystemStatus(status);
      }
      
      // Cargar alertas activas
      const alertsRes = await fetch('/api/system/alerts');
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }
      
      // Cargar reportes recientes
      const reportsRes = await fetch('/api/system/reports');
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData.reports || []);
      }
      
      // Cargar historial de métricas
      const historyRes = await fetch('/api/system/metrics/history?timeRange=3600000'); // 1 hora
      if (historyRes.ok) {
        const history = await historyRes.json();
        setMetricsHistory(history.data || []);
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

    const handleNewLog = (logEntry: LogEntry) => {
      if (autoRefresh) {
        setLogs(prev => [logEntry, ...prev.slice(0, pageSize - 1)]);
        loadStats(); // Actualizar estadísticas
      }
    };

    socket.on('log:new', handleNewLog);

    return () => {
      socket.off('log:new', handleNewLog);
    };
  }, [socket, autoRefresh, pageSize]);

  useEffect(() => {
    if (autoRefresh && activeTab === 'logs') {
      const interval = setInterval(() => {
        loadLogs();
        loadStats();
      }, 10000); // Cada 10 segundos

      return () => clearInterval(interval);
    }
  }, [autoRefresh, searchQuery, selectedLevel, selectedCategory, startDate, endDate, activeTab]);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        page: currentPage.toString()
      });
      
      if (searchQuery) params.append('query', searchQuery);
      if (selectedLevel) params.append('level', selectedLevel);
      if (selectedCategory) params.append('category', selectedCategory);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/logs/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Error cargando logs');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/logs/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const exportLogs = async (format: string) => {
    try {
      const params = new URLSearchParams({ format });
      
      if (selectedCategory) params.append('category', selectedCategory);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/logs/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Logs exportados');
      }
    } catch (error) {
      toast.error('Error exportando logs');
    }
  };

  const clearLogs = async () => {
    if (!confirm('¿Estás seguro de que quieres limpiar todos los logs? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch('/api/logs/clear', { method: 'POST' });
      if (response.ok) {
        setLogs([]);
        loadStats();
        toast.success('Logs limpiados');
      } else {
        toast.error('Error limpiando logs');
      }
    } catch (error) {
      toast.error('Error limpiando logs');
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
    toast.success('Log copiado al portapapeles');
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
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

  const generateReport = async (type: string) => {
    try {
      const response = await fetch('/api/system/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      
      if (response.ok) {
        await loadSystemData(); // Recargar datos
        toast.success('Reporte generado');
      }
    } catch (error) {
      console.error('Error generando reporte:', error);
      toast.error('Error generando reporte');
    }
  };

  const restartSystem = async (systemName: string) => {
    try {
      const response = await fetch(`/api/system/${systemName}/restart`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await loadSystemData(); // Recargar datos
        toast.success(`Sistema ${systemName} reiniciado`);
      }
    } catch (error) {
      console.error('Error reiniciando sistema:', error);
      toast.error('Error reiniciando sistema');
    }
  };

  const getLevelConfig = (level: string) => {
    return LOG_LEVELS[level as keyof typeof LOG_LEVELS] || LOG_LEVELS.info;
  };

  if (isLoading && logs.length === 0 && !systemMetrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs & Sistema</h1>
          <p className="text-gray-400">Gestión de logs y monitoreo del sistema</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "primary" : "secondary"}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh
          </Button>
          
          <Button
            onClick={() => activeTab === 'logs' ? loadLogs() : loadSystemData()}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'bg-primary-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Logs del Sistema
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'system'
              ? 'bg-primary-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          Monitoreo del Sistema
        </button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Logs</p>
                    <p className="text-xl font-bold text-white">{stats.totalLogs.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-red-400">Errores</span>
                    <span className="text-white">{stats.errorCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-400">Warnings</span>
                    <span className="text-white">{stats.warnCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-400">Info</span>
                    <span className="text-white">{stats.infoCount}</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <HardDrive className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Almacenamiento</p>
                    <p className="text-xl font-bold text-white">{stats.diskUsage.formattedSize}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Archivos</span>
                    <span className="text-white">{stats.diskUsage.fileCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Rotados</span>
                    <span className="text-white">{stats.filesRotated}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Comprimidos</span>
                    <span className="text-white">{stats.filesCompressed}</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Tiempo Activo</p>
                    <p className="text-xl font-bold text-white">{formatUptime(stats.uptime)}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Buffer</span>
                    <span className="text-white">{stats.bufferSize}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Streams</span>
                    <span className="text-white">{stats.activeStreams}</span>
                  </div>
                  {stats.lastLogTime && (
                    <div className="text-xs text-gray-500">
                      Último: {formatTimestamp(stats.lastLogTime)}
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <Database className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Estado</p>
                    <p className="text-xl font-bold text-white">Activo</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-sm text-gray-400">Logging habilitado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-sm text-gray-400">Rotación automática</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-sm text-gray-400">Compresión activa</span>
                  </div>
                </div>
              </motion.div>
            </div>
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
            
            <div className="divide-y divide-white/5">
              {logs.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No se encontraron logs</p>
                </div>
              ) : (
                logs.map((log, index) => {
                  const levelConfig = getLevelConfig(log.level);
                  const Icon = levelConfig.icon;
                  const isExpanded = expandedLogs.has(index);
                  
                  return (
                    <motion.div
                      key={`${log.timestamp}-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
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
                                {log.level.toUpperCase()}
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
            </div>
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
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {systemMetrics?.cpu.usage.toFixed(1)}%
                </div>
                <Progress value={systemMetrics?.cpu.usage || 0} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {systemMetrics?.cpu.cores} núcleos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memoria</CardTitle>
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {systemMetrics?.memory.usage.toFixed(1)}%
                </div>
                <Progress value={systemMetrics?.memory.usage || 0} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {formatBytes(systemMetrics?.memory.used || 0)} / {formatBytes(systemMetrics?.memory.total || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Disco</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {systemMetrics?.disk.usage.toFixed(1)}%
                </div>
                <Progress value={systemMetrics?.disk.usage || 0} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {systemMetrics?.disk.used} / {systemMetrics?.disk.total}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatUptime(systemMetrics?.uptime || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
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
                    <Line type="monotone" dataKey="cpu" stroke="#8884d8" name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="#82ca9d" name="Memoria %" />
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
                    <Area type="monotone" dataKey="disk" stroke="#ffc658" fill="#ffc658" name="Disco %" />
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
                  <p className="text-muted-foreground">El sistema está funcionando correctamente</p>
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
                            <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant={alert.resolved ? 'secondary' : 'destructive'}>
                          {alert.resolved ? 'Resuelta' : alert.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Control de sistemas */}
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
                  <Button onClick={() => generateReport('daily')} variant="secondary">
                    Reporte Diario
                  </Button>
                  <Button onClick={() => generateReport('performance')} variant="secondary">
                    Reporte de Rendimiento
                  </Button>
                  <Button onClick={() => generateReport('security')} variant="secondary">
                    Reporte de Seguridad
                  </Button>
                </div>

                <div className="space-y-3">
                  {reports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{report.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(report.generatedAt).toLocaleString()} • {formatBytes(report.size)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={report.status === 'completed' ? 'secondary' : 'default'}>
                          {report.status}
                        </Badge>
                        {report.status === 'completed' && (
                          <Button size="sm" variant="secondary">
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