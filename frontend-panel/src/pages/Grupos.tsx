import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Users,
  Bot,
  CheckCircle,
  XCircle,
  Power,
  PowerOff,
  Star,
  X,
  Plus,
} from 'lucide-react';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton, ToggleButton } from '../components/ui/AnimatedButton';
import { AnimatedTableRow } from '../components/ui/AnimatedList';
import toast from 'react-hot-toast';
import api from '../config/api';

interface Group {
  id: number;
  nombre: string;
  descripcion: string;
  wa_jid: string;
  bot_enabled: boolean;
  es_proveedor: boolean;
  created_at: string;
  updated_at: string;
}

const Grupos: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [botFilter, setBotFilter] = useState<string>('all');
  const [proveedorFilter, setProveedorFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  useEffect(() => {
    loadGroups();
    checkConnectionStatus();
  }, [page, botFilter, proveedorFilter]);

  const checkConnectionStatus = async () => {
    try {
      const response = await api.get('/api/bot/main/status');
      setConnectionStatus(response.data);
    } catch (err) {
      console.error('Error checking connection status:', err);
    }
  };

  const loadGroups = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (searchTerm) params.append('search', searchTerm);
      if (botFilter !== 'all') params.append('botEnabled', botFilter);
      if (proveedorFilter !== 'all') params.append('proveedor', proveedorFilter);

      const response = await api.get(`/api/grupos?${params}`);
      setGroups(response.data?.grupos || []);
      setPagination(response.data?.pagination);
    } catch (err) {
      toast.error('Error al cargar grupos');
    } finally {
      setLoading(false);
    }
  };

  const toggleBot = async (group: Group) => {
    try {
      const action = group.bot_enabled ? 'off' : 'on';
      await api.post(`/api/grupos/${encodeURIComponent(group.wa_jid)}/toggle`, { action });
      setGroups(prev => prev.map(g =>
        g.wa_jid === group.wa_jid ? { ...g, bot_enabled: !g.bot_enabled } : g
      ));
      toast.success(`Bot ${action === 'on' ? 'activado' : 'desactivado'} en ${group.nombre}`);
    } catch (err) {
      toast.error('Error al cambiar estado del bot');
    }
  };

  const toggleProveedor = async (group: Group) => {
    try {
      await api.patch(`/api/grupos/${encodeURIComponent(group.wa_jid)}/proveedor`, {
        es_proveedor: !group.es_proveedor
      });
      setGroups(prev => prev.map(g =>
        g.wa_jid === group.wa_jid ? { ...g, es_proveedor: !g.es_proveedor } : g
      ));
      toast.success(`Grupo ${!group.es_proveedor ? 'marcado como' : 'desmarcado de'} proveedor`);
    } catch (err) {
      toast.error('Error al cambiar estado de proveedor');
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadGroups();
  };

  const syncGroups = async (clearOld: boolean = false) => {
    try {
      setSyncing(true);
      console.log(`Starting group sync with clearOld: ${clearOld}`);
      
      const response = await api.post('/api/grupos/sync', { clearOld });
      
      if (response.data?.success) {
        toast.success(response.data.message || 'Grupos sincronizados exitosamente');
        setShowSyncModal(false);
        
        // Esperar un poco antes de recargar para que la sincronización se complete
        setTimeout(() => {
          loadGroups();
        }, 1000);
      } else {
        toast.error('Error en la respuesta del servidor');
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Error al sincronizar grupos';
      toast.error(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  const stats = {
    total: pagination?.total || groups.length,
    botActivo: groups.filter(g => g.bot_enabled).length,
    botInactivo: groups.filter(g => !g.bot_enabled).length,
    proveedores: groups.filter(g => g.es_proveedor).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">Gestión de Grupos</h1>
            {connectionStatus && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                connectionStatus.connected 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus.connected ? 'bg-emerald-400' : 'bg-red-400'
                }`} />
                {connectionStatus.connected ? 'Bot Conectado' : 'Bot Desconectado'}
              </div>
            )}
          </div>
          <p className="text-gray-400 mt-1">Administra los grupos de WhatsApp conectados</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3">
          <AnimatedButton 
            variant="primary" 
            icon={<Plus className="w-4 h-4" />} 
            onClick={() => setShowSyncModal(true)}
            loading={syncing}
          >
            Sincronizar WhatsApp
          </AnimatedButton>
          <AnimatedButton variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={loadGroups} loading={loading}>
            Actualizar Lista
          </AnimatedButton>
        </motion.div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Grupos" value={stats.total} icon={<MessageSquare className="w-6 h-6" />} color="primary" delay={0} />
        <StatCard title="Bot Activo" value={stats.botActivo} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0.1} />
        <StatCard title="Bot Inactivo" value={stats.botInactivo} icon={<XCircle className="w-6 h-6" />} color="danger" delay={0.2} />
        <StatCard title="Proveedores" value={stats.proveedores} icon={<Star className="w-6 h-6" />} color="warning" delay={0.3} />
      </div>

      {/* Filters */}
      <AnimatedCard delay={0.2} className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o JID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input-search w-full"
            />
          </div>
          <select value={botFilter} onChange={(e) => setBotFilter(e.target.value)} className="input-glass md:w-40">
            <option value="all">Todos</option>
            <option value="true">Bot Activo</option>
            <option value="false">Bot Inactivo</option>
          </select>
          <select value={proveedorFilter} onChange={(e) => setProveedorFilter(e.target.value)} className="input-glass md:w-40">
            <option value="all">Todos</option>
            <option value="true">Proveedores</option>
            <option value="false">No Proveedores</option>
          </select>
          <AnimatedButton variant="primary" onClick={handleSearch}>Buscar</AnimatedButton>
        </div>
      </AnimatedCard>

      {/* Groups Grid */}
      <AnimatedCard delay={0.3}>
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Lista de Grupos</h2>
          <p className="text-gray-400 text-sm mt-1">{groups.length} grupos mostrados</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Cargando grupos...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No hay grupos</h3>
            <p className="text-gray-400">No se encontraron grupos con los filtros aplicados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            <AnimatePresence>
              {groups.map((group, index) => (
                <motion.div
                  key={group.wa_jid}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-card p-5 hover:border-primary-500/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        group.bot_enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{group.nombre}</h3>
                        <p className="text-xs text-gray-500 truncate">{group.wa_jid}</p>
                      </div>
                    </div>
                    {group.es_proveedor && (
                      <span className="badge badge-warning">
                        <Star className="w-3 h-3 mr-1" />
                        Proveedor
                      </span>
                    )}
                  </div>

                  {group.descripcion && (
                    <p className="text-sm text-gray-400 mb-4 line-clamp-2">{group.descripcion}</p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${group.bot_enabled ? 'text-emerald-400' : 'text-red-400'}`}>
                        {group.bot_enabled ? 'Bot Activo' : 'Bot Inactivo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleProveedor(group)}
                        className={`p-2 rounded-lg transition-colors ${
                          group.es_proveedor
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-gray-400 hover:bg-white/5'
                        }`}
                        title={group.es_proveedor ? 'Quitar proveedor' : 'Marcar como proveedor'}
                      >
                        <Star className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleBot(group)}
                        className={`p-2 rounded-lg transition-colors ${
                          group.bot_enabled
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-red-400 bg-red-500/10'
                        }`}
                        title={group.bot_enabled ? 'Desactivar bot' : 'Activar bot'}
                      >
                        {group.bot_enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-6 border-t border-white/10 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Página {pagination.page} de {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <AnimatedButton
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </AnimatedButton>
              <AnimatedButton
                variant="secondary"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Siguiente
              </AnimatedButton>
            </div>
          </div>
        )}
      </AnimatedCard>

      {/* Sync Modal */}
      <AnimatePresence>
        {showSyncModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSyncModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Sincronizar Grupos de WhatsApp</h3>
                <button onClick={() => setShowSyncModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {connectionStatus && (
                  <div className={`p-4 rounded-xl border ${
                    connectionStatus.connected 
                      ? 'bg-emerald-500/10 border-emerald-500/20' 
                      : 'bg-red-500/10 border-red-500/20'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${
                        connectionStatus.connected ? 'bg-emerald-400' : 'bg-red-400'
                      }`} />
                      <span className={`text-sm font-medium ${
                        connectionStatus.connected ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        Estado de Conexión: {connectionStatus.connected ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>
                    {!connectionStatus.connected && (
                      <p className="text-xs text-red-400">
                        El bot debe estar conectado a WhatsApp para sincronizar grupos. 
                        Verifica la conexión en la página de Estado del Bot.
                      </p>
                    )}
                  </div>
                )}
                
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-medium text-blue-400">¿Qué hace la sincronización?</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Obtiene la lista actual de grupos de WhatsApp conectados y actualiza la base de datos del panel.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Opciones de sincronización</span>
                  </div>
                  <div className="space-y-2 text-xs text-gray-400">
                    <p><strong>Sincronización simple:</strong> Agrega nuevos grupos sin eliminar los existentes</p>
                    <p><strong>Sincronización completa:</strong> Elimina grupos antiguos y sincroniza solo los actuales</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <AnimatedButton
                  onClick={() => syncGroups(false)}
                  variant="primary"
                  fullWidth
                  loading={syncing}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  Sincronización Simple
                </AnimatedButton>
                
                <AnimatedButton
                  onClick={() => syncGroups(true)}
                  variant="danger"
                  fullWidth
                  loading={syncing}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Sincronización Completa (Limpiar y Sincronizar)
                </AnimatedButton>
                
                <AnimatedButton
                  onClick={() => setShowSyncModal(false)}
                  variant="secondary"
                  fullWidth
                  disabled={syncing}
                >
                  Cancelar
                </AnimatedButton>
              </div>

              {syncing && (
                <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sincronizando grupos desde WhatsApp...
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Grupos;
