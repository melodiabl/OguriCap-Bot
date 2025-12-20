import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  RefreshCw,
  Trash2,
  Download,
  Info,
  AlertTriangle,
  XCircle,
  Radio,
} from 'lucide-react';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useSocketLogs } from '../hooks/useSocketEvents';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';
import api from '../config/api';

interface LogEntry {
  id: number;
  tipo: string;
  mensaje: string;
  usuario?: string;
  fecha: string;
  nivel?: 'info' | 'warning' | 'error' | 'debug' | string;
  metadata?: any;
}

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Socket.IO para actualizaciones en tiempo real
  const { isConnected: isSocketConnected } = useSocket();
  const { recentLogs } = useSocketLogs();

  useEffect(() => {
    loadLogs();
  }, [page, levelFilter]);

  // Agregar logs en tiempo real
  useEffect(() => {
    if (recentLogs.length > 0 && page === 1) {
      loadLogs();
    }
  }, [recentLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '50');
      if (levelFilter !== 'all') params.append('level', levelFilter);

      const response = await api.get(`/api/logs?${params}`);
      setLogs(response.data?.logs || []);
      setPagination(response.data?.pagination);
    } catch (err) {
      toast.error('Error al cargar logs');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm('¿Estás seguro de eliminar todos los logs?')) return;
    try {
      await api.delete('/api/logs');
      toast.success('Logs eliminados');
      loadLogs();
    } catch (err) {
      toast.error('Error al eliminar logs');
    }
  };

  const exportLogs = async () => {
    try {
      const response = await api.get('/api/logs/export');
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Logs exportados');
    } catch (err) {
      toast.error('Error al exportar logs');
    }
  };

  const getLevelIcon = (nivel?: string) => {
    // Validar que nivel no sea undefined o null
    if (!nivel || typeof nivel !== 'string') {
      nivel = 'info'; // Valor por defecto
    }
    
    const icons: Record<string, { icon: React.ReactNode; color: string }> = {
      info: { icon: <Info className="w-4 h-4" />, color: 'text-cyan-400' },
      warning: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-400' },
      error: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-400' },
      debug: { icon: <FileText className="w-4 h-4" />, color: 'text-gray-400' },
    };
    return icons[nivel] || icons.info;
  };

  const getLevelBadge = (nivel?: string) => {
    // Validar que nivel no sea undefined o null
    if (!nivel || typeof nivel !== 'string') {
      nivel = 'info'; // Valor por defecto
    }
    
    const config: Record<string, string> = {
      info: 'badge-info',
      warning: 'badge-warning',
      error: 'badge-danger',
      debug: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return (
      <span className={`badge ${config[nivel] || config.info}`}>
        {nivel.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const filteredLogs = logs.filter(log =>
    log.mensaje?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.tipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.usuario?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: logs.length,
    info: logs.filter(l => l.nivel === 'info').length,
    warning: logs.filter(l => l.nivel === 'warning').length,
    error: logs.filter(l => l.nivel === 'error').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">Logs del Sistema</h1>
          <p className="text-gray-400 mt-1">Monitorea la actividad y errores del sistema</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3 items-center">
          {/* Indicador de Socket.IO */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isSocketConnected 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
            {isSocketConnected ? 'Tiempo Real' : 'Sin conexión'}
          </div>
          <AnimatedButton
            variant={autoRefresh ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto ✓' : 'Auto'}
          </AnimatedButton>
          <AnimatedButton variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportLogs}>
            Exportar
          </AnimatedButton>
          <AnimatedButton variant="danger" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={clearLogs}>
            Limpiar
          </AnimatedButton>
          <AnimatedButton variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadLogs} loading={loading}>
            Actualizar
          </AnimatedButton>
        </motion.div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Logs" value={stats.total} icon={<FileText className="w-6 h-6" />} color="primary" delay={0} />
        <StatCard title="Info" value={stats.info} icon={<Info className="w-6 h-6" />} color="info" delay={0.1} />
        <StatCard title="Warnings" value={stats.warning} icon={<AlertTriangle className="w-6 h-6" />} color="warning" delay={0.2} />
        <StatCard title="Errors" value={stats.error} icon={<XCircle className="w-6 h-6" />} color="danger" delay={0.3} />
      </div>

      {/* Filters */}
      <AnimatedCard delay={0.2} className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar en logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-search w-full"
            />
          </div>
          <CustomSelect
            value={levelFilter}
            onChange={setLevelFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
              { value: 'error', label: 'Error' },
              { value: 'debug', label: 'Debug' }
            ]}
            className="md:w-40"
          />
        </div>
      </AnimatedCard>

      {/* Logs List */}
      <AnimatedCard delay={0.3} className="overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Registros</h2>
            <p className="text-gray-400 text-sm mt-1">{filteredLogs.length} logs mostrados</p>
          </div>
          {autoRefresh && (
            <span className="badge badge-success">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
              Auto-refresh activo
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Cargando logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No hay logs</h3>
            <p className="text-gray-400">No se encontraron registros con los filtros aplicados</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            <AnimatePresence>
              {filteredLogs.map((log, index) => {
                const levelConfig = getLevelIcon(log.nivel);
                return (
                  <motion.div
                    key={`log-${log.id}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.02 }}
                    className="p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg bg-white/5 ${levelConfig.color}`}>
                        {levelConfig.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          {getLevelBadge(log.nivel)}
                          <span className="text-xs text-gray-500">{log.tipo}</span>
                          {log.usuario && (
                            <span className="text-xs text-gray-500">• {log.usuario}</span>
                          )}
                        </div>
                        <p className="text-white text-sm">{log.mensaje}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(log.fecha)}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-6 border-t border-white/10 flex items-center justify-between">
            <p className="text-sm text-gray-400">Página {pagination.page} de {pagination.totalPages}</p>
            <div className="flex gap-2">
              <AnimatedButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Anterior
              </AnimatedButton>
              <AnimatedButton variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                Siguiente
              </AnimatedButton>
            </div>
          </div>
        )}
      </AnimatedCard>
    </div>
  );
};

export default Logs;
