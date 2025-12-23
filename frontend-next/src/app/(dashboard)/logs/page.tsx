'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Search, RefreshCw, Trash2, Download, Info, AlertTriangle, XCircle, Radio, Eye, Plus } from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SimpleSelect as Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useSocket } from '@/contexts/SocketContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface LogEntry {
  id: number;
  tipo: string;
  mensaje: string;
  usuario?: string;
  fecha: string;
  nivel?: 'info' | 'warning' | 'error' | 'debug' | string;
  metadata?: any;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showCreateLogModal, setShowCreateLogModal] = useState(false);
  const [newLog, setNewLog] = useState({
    tipo: 'manual',
    mensaje: '',
    nivel: 'info' as 'info' | 'warning' | 'error' | 'debug'
  });

  const { isConnected: isSocketConnected } = useSocket();

  const loadLogs = async () => {
    // Evitar múltiples llamadas simultáneas
    if (loading) return;
    
    try {
      setLoading(true);
      const data = await api.getLogs(page, 50, levelFilter !== 'all' ? levelFilter : undefined);
      setLogs(data?.logs || []);
      setPagination(data?.pagination);
    } catch (err) {
      console.error('Error loading logs:', err);
      toast.error('Error al cargar logs');
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial única
  useEffect(() => {
    loadLogs();
  }, [page, levelFilter]); // Recargar cuando cambie página o filtro

  // Escuchar nuevos logs via eventos personalizados (no auto-refresh constante)
  useEffect(() => {
    const handleNewLogEntry = (event: CustomEvent) => {
      const { log } = event.detail;
      if (log && log.id) {
        // Agregar el nuevo log al inicio de la lista si no existe
        setLogs(prevLogs => {
          const exists = prevLogs.some(existingLog => existingLog.id === log.id);
          if (!exists) {
            return [log, ...prevLogs.slice(0, 49)]; // Mantener solo 50 logs
          }
          return prevLogs;
        });
      }
    };

    window.addEventListener('newLogEntry', handleNewLogEntry as EventListener);
    
    return () => {
      window.removeEventListener('newLogEntry', handleNewLogEntry as EventListener);
    };
  }, []);

  const clearLogs = async () => {
    if (!confirm('¿Eliminar todos los logs? Esta acción no se puede deshacer.')) return;
    try {
      await api.clearLogs();
      
      // Crear notificación automática
      await api.createNotification({
        title: 'Logs Eliminados',
        message: 'Todos los logs del sistema han sido eliminados por el administrador',
        type: 'warning',
        category: 'sistema'
      });
      
      toast.success('Logs eliminados');
      loadLogs();
    } catch (err) {
      toast.error('Error al eliminar logs');
    }
  };

  const exportLogs = async () => {
    try {
      const data = await api.exportLogs();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      // Crear notificación automática
      await api.createNotification({
        title: 'Logs Exportados',
        message: `Los logs del sistema han sido exportados correctamente (${data?.length || 0} registros)`,
        type: 'success',
        category: 'sistema'
      });
      
      toast.success('Logs exportados');
    } catch (err) {
      toast.error('Error al exportar logs');
    }
  };

  const createLog = async () => {
    if (!newLog.mensaje.trim()) {
      toast.error('El mensaje es requerido');
      return;
    }
    
    try {
      // Crear log manual (esto sería útil para testing y debugging)
      const logData = {
        ...newLog,
        usuario: 'admin', // Usuario actual
        fecha: new Date().toISOString(),
        metadata: { source: 'panel', manual: true }
      };
      
      // Simular creación de log (en un sistema real esto iría al backend)
      setLogs(prev => [logData as any, ...prev]);
      
      toast.success('Log creado');
      setShowCreateLogModal(false);
      setNewLog({ tipo: 'manual', mensaje: '', nivel: 'info' });
    } catch (err) {
      toast.error('Error al crear log');
    }
  };

  const getLevelIcon = (nivel?: string) => {
    if (!nivel || typeof nivel !== 'string') nivel = 'info';
    const icons: Record<string, { icon: React.ReactNode; color: string }> = {
      info: { icon: <Info className="w-4 h-4" />, color: 'text-cyan-400' },
      warning: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-400' },
      error: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-400' },
      debug: { icon: <FileText className="w-4 h-4" />, color: 'text-gray-400' },
    };
    return icons[nivel] || icons.info;
  };

  const getLevelBadge = (nivel?: string) => {
    if (!nivel || typeof nivel !== 'string') nivel = 'info';
    const config: Record<string, string> = {
      info: 'badge-info',
      warning: 'badge-warning',
      error: 'badge-danger',
      debug: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return <span className={`badge ${config[nivel] || config.info}`}>{nivel.toUpperCase()}</span>;
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

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
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isSocketConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
            {isSocketConnected ? 'Tiempo Real' : 'Sin conexión'}
          </div>
          <Button variant="success" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateLogModal(true)}>Crear Log</Button>
          <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportLogs}>Exportar</Button>
          <Button variant="danger" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={clearLogs}>Limpiar</Button>
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
      <Card animated delay={0.2} className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Buscar en logs..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="input-glass w-full pl-12" />
          </div>
          <Select value={levelFilter} onChange={setLevelFilter} options={[
            { value: 'all', label: 'Todos' },
            { value: 'info', label: 'Info' },
            { value: 'warning', label: 'Warning' },
            { value: 'error', label: 'Error' },
            { value: 'debug', label: 'Debug' }
          ]} className="md:w-40" />
        </div>
      </Card>

      {/* Logs List */}
      <Card animated delay={0.3} className="overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Registros</h2>
            <p className="text-gray-400 text-sm mt-1">{filteredLogs.length} logs mostrados</p>
          </div>
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
                  <motion.div key={`log-${log.id}-${index}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }} transition={{ delay: index * 0.02 }} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg bg-white/5 ${levelConfig.color}`}>{levelConfig.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          {getLevelBadge(log.nivel)}
                          <span className="text-xs text-gray-500">{log.tipo}</span>
                          {log.usuario && <span className="text-xs text-gray-500">• {log.usuario}</span>}
                        </div>
                        <p className="text-white text-sm">{log.mensaje}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(log.fecha)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedLog(log); setShowLogModal(true); }}
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Log Detail Modal */}
      <Modal isOpen={showLogModal && !!selectedLog} onClose={() => setShowLogModal(false)} title="Detalles del Log">
        {selectedLog && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-white/5 ${getLevelIcon(selectedLog.nivel).color}`}>
                {getLevelIcon(selectedLog.nivel).icon}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white">{selectedLog.tipo}</h4>
                {getLevelBadge(selectedLog.nivel)}
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-sm text-gray-400 mb-2">Mensaje</p>
              <p className="text-white whitespace-pre-wrap">{selectedLog.mensaje}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-sm text-gray-400">Fecha y Hora</p>
                <p className="text-white mt-1">{formatDate(selectedLog.fecha)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-sm text-gray-400">Usuario</p>
                <p className="text-white mt-1">{selectedLog.usuario || 'Sistema'}</p>
              </div>
            </div>
            
            {selectedLog.metadata && (
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-sm text-gray-400 mb-2">Metadata</p>
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4">
              <Button onClick={() => setShowLogModal(false)} variant="secondary">
                Cerrar
              </Button>
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
                  toast.success('Log copiado al portapapeles');
                }}
                variant="primary"
              >
                Copiar Log
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Log Modal */}
      <Modal isOpen={showCreateLogModal} onClose={() => setShowCreateLogModal(false)} title="Crear Log Manual">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Tipo</label>
            <input
              type="text"
              value={newLog.tipo}
              onChange={(e) => setNewLog(prev => ({ ...prev, tipo: e.target.value }))}
              className="input-glass w-full"
              placeholder="Ej: test, debug, manual"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Nivel</label>
            <Select
              value={newLog.nivel}
              onChange={(value) => setNewLog(prev => ({ ...prev, nivel: value as any }))}
              options={[
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Warning' },
                { value: 'error', label: 'Error' },
                { value: 'debug', label: 'Debug' }
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Mensaje</label>
            <textarea
              value={newLog.mensaje}
              onChange={(e) => setNewLog(prev => ({ ...prev, mensaje: e.target.value }))}
              className="input-glass w-full h-24 resize-none"
              placeholder="Mensaje del log..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowCreateLogModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={createLog}
            >
              Crear Log
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
