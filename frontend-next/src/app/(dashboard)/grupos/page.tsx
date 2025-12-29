'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Search, RefreshCw, CheckCircle, XCircle, Power, PowerOff,
  Star, X, Plus, Radio,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useGroupsSmartRefresh } from '@/hooks/useSmartRefresh';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { Group } from '@/types';

export default function GruposPage() {
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
  
  // Usar el contexto global del bot
  const { isGloballyOn: globalBotState } = useBotGlobalState();

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getGroups(page, 20, searchTerm, botFilter !== 'all' ? botFilter : undefined, proveedorFilter !== 'all' ? proveedorFilter : undefined);
      setGroups(response?.grupos || response?.data || []);
      setPagination(response?.pagination);
    } catch (err) {
      toast.error('Error al cargar grupos');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, botFilter, proveedorFilter]);

  // Auto-refresh cuando cambia el estado global del bot
  useEffect(() => {
    // Recargar grupos cuando cambie el estado global
    loadGroups();
  }, [globalBotState, loadGroups]);

  // Auto-refresh automático - DISABLED to prevent resource exhaustion
  // useAutoRefresh(loadGroups, { 
  //   interval: 30000, 
  //   dependencies: [searchTerm, botFilter, proveedorFilter, page] 
  // });

  const checkConnectionStatus = useCallback(async () => {
    try {
      const response = await api.getMainBotStatus();
      setConnectionStatus(response);
    } catch (err) {
      console.error('Error checking connection status:', err);
    }
  }, []);

  // Usar smart refresh para grupos
  const { isRefreshing, manualRefresh, isSocketConnected } = useGroupsSmartRefresh(
    useCallback(async () => {
      await Promise.all([loadGroups(), checkConnectionStatus()]);
    }, [loadGroups, checkConnectionStatus])
  );

  useEffect(() => {
    loadGroups();
    checkConnectionStatus();
  }, [loadGroups, checkConnectionStatus]);

  const toggleBot = async (group: Group) => {
    try {
      const action = group.bot_enabled ? 'off' : 'on';
      await api.toggleGroupBot(group.wa_jid, action);
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
      await api.toggleProvider(group.wa_jid, !group.es_proveedor);
      setGroups(prev => prev.map(g =>
        g.wa_jid === group.wa_jid ? { ...g, es_proveedor: !g.es_proveedor } : g
      ));
      toast.success(`Grupo ${!group.es_proveedor ? 'marcado como' : 'desmarcado de'} proveedor`);
    } catch (err) {
      toast.error('Error al cambiar estado de proveedor');
    }
  };

  const syncWhatsAppGroups = async () => {
    if (!connectionStatus?.connected) {
      toast.error('El bot debe estar conectado para sincronizar grupos.');
      return;
    }

    try {
      setSyncing(true);
      const res = await api.syncWhatsAppGroups();
      toast.success(res?.message || 'Grupos sincronizados');
      setShowSyncModal(false);
      await manualRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al sincronizar grupos');
    } finally {
      setSyncing(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadGroups();
  };

  const stats = {
    total: pagination?.total || groups.length,
    botActivo: globalBotState ? groups.filter(g => g.bot_enabled).length : 0,
    botInactivo: globalBotState ? groups.filter(g => !g.bot_enabled).length : groups.length,
    proveedores: groups.filter(g => g.es_proveedor).length,
  };

  return (
    <div className="space-y-6">
      {/* Banner de estado global */}
      {!globalBotState && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <PowerOff className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-red-400 font-medium">Bot Apagado Globalmente</p>
              <p className="text-red-300/70 text-sm">
                El bot está desactivado en todos los grupos. Los toggles individuales no funcionarán hasta que se reactive globalmente.
              </p>
            </div>
          </div>
        </motion.div>
      )}

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
          {/* Indicador de conexión Socket.IO */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isSocketConnected 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
            {isSocketConnected ? 'Tiempo Real' : 'Modo Fallback'}
          </div>
          
          <Button 
            variant="primary" 
            icon={<Plus className="w-4 h-4" />} 
            onClick={() => setShowSyncModal(true)}
            loading={syncing}
          >
            Sincronizar WhatsApp
          </Button>
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
      <Card animated delay={0.2} className="p-6">
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
          <Select value={botFilter} onValueChange={setBotFilter}>
            <SelectTrigger className="md:w-40">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Bot Activo</SelectItem>
              <SelectItem value="false">Bot Inactivo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={proveedorFilter} onValueChange={setProveedorFilter}>
            <SelectTrigger className="md:w-40">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Proveedores</SelectItem>
              <SelectItem value="false">No Proveedores</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="primary" onClick={handleSearch}>Buscar</Button>
        </div>
      </Card>

      {/* Groups Grid */}
      <Card animated delay={0.3}>
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
                  key={group.wa_jid || group.id}
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
                      <span className={`text-sm ${
                        globalBotState && group.bot_enabled 
                          ? 'text-emerald-400' 
                          : 'text-red-400'
                      }`}>
                        {globalBotState 
                          ? (group.bot_enabled ? 'Bot Activo' : 'Bot Inactivo')
                          : 'Bot Apagado (Global)'
                        }
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
                        whileHover={{ scale: globalBotState ? 1.1 : 1 }}
                        whileTap={{ scale: globalBotState ? 0.9 : 1 }}
                        onClick={() => globalBotState ? toggleBot(group) : toast.error('El bot está apagado globalmente')}
                        disabled={!globalBotState}
                        className={`p-2 rounded-lg transition-colors ${
                          !globalBotState
                            ? 'text-gray-500 bg-gray-500/10 cursor-not-allowed opacity-50'
                            : group.bot_enabled
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-red-400 bg-red-500/10'
                        }`}
                        title={
                          !globalBotState 
                            ? 'Bot apagado globalmente' 
                            : group.bot_enabled 
                            ? 'Desactivar bot' 
                            : 'Activar bot'
                        }
                      >
                        {!globalBotState ? (
                          <PowerOff className="w-4 h-4" />
                        ) : group.bot_enabled ? (
                          <Power className="w-4 h-4" />
                        ) : (
                          <PowerOff className="w-4 h-4" />
                        )}
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
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Anterior
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Sync Modal */}
      <Modal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} title="Sincronizar Grupos de WhatsApp">
        <div className="space-y-4">
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
                  Estado: {connectionStatus.connected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              {!connectionStatus.connected && (
                <p className="text-xs text-red-400">
                  El bot debe estar conectado para sincronizar grupos.
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
              Obtiene la lista actual de grupos de WhatsApp y actualiza la base de datos.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <Button
              variant="primary"
              className="w-full"
              loading={syncing}
              disabled={syncing || !connectionStatus?.connected}
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={syncWhatsAppGroups}
            >
              Sincronización Simple
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setShowSyncModal(false)} disabled={syncing}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
