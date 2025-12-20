'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Power, Bell, CheckCircle, XCircle, Eye, RefreshCw,
  ToggleRight, AlertTriangle, X, Radio, PowerOff
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useSocket } from '@/contexts/SocketContext';
import api from '@/services/api';
import { useGroups } from '@/contexts/GroupsContext';
import toast from 'react-hot-toast';

interface Group {
  id: number;
  wa_jid: string;
  nombre: string;
  descripcion: string;
  es_proveedor: boolean;
  bot_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

interface GlobalNotification {
  id: number;
  grupo_jid: string;
  grupo_nombre: string;
  tipo: string;
  mensaje: string;
  enviado_por: string;
  fecha_envio: string;
  estado: 'enviado' | 'error';
  error_message?: string;
}

export default function GruposManagementPage() {
  const { groups: contextGroups, refreshGroups } = useGroups(); // Usar context
  const [groups, setGroups] = useState<Group[]>([]);
  const [notifications, setNotifications] = useState<GlobalNotification[]>([]);
  const [notificationStats, setNotificationStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<GlobalNotification | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isShutdownModalOpen, setIsShutdownModalOpen] = useState(false);
  const [togglingGroup, setTogglingGroup] = useState<string | null>(null);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [isStartingUp, setIsStartingUp] = useState(false);

  const { isConnected: isSocketConnected } = useSocket();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Solo cargar notificaciones, los grupos vienen del context
      const [notifRes, statsRes] = await Promise.all([
        api.getNotificaciones(1, 50).catch(() => ({ data: [] })),
        api.getNotificationStats().catch(() => ({ total: 0 }))
      ]);
      setGroups(contextGroups); // Usar grupos del context
      setNotifications(notifRes.data || []);
      setNotificationStats(statsRes);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  }, [contextGroups]);

  useEffect(() => { 
    setGroups(contextGroups); // Actualizar cuando cambien los grupos del context
  }, [contextGroups]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleGroup = async (group: Group) => {
    const isActive = group.bot_enabled;
    setTogglingGroup(group.wa_jid);
    try {
      await api.toggleGroupBot(group.wa_jid, isActive ? 'off' : 'on');
      setGroups(prev => prev.map(g => 
        g.wa_jid === group.wa_jid ? { ...g, bot_enabled: !isActive } : g
      ));
      
      // Crear notificación automática
      await api.createNotification({
        title: `Bot ${isActive ? 'Desactivado' : 'Activado'} en Grupo`,
        message: `El bot ha sido ${isActive ? 'desactivado' : 'activado'} en el grupo "${group.nombre}"`,
        type: isActive ? 'warning' : 'success',
        category: 'bot'
      });
      
      toast.success(`Bot ${isActive ? 'desactivado' : 'activado'} en ${group.nombre}`);
    } catch (error) {
      toast.error('Error al cambiar estado');
    } finally {
      setTogglingGroup(null);
    }
  };

  const handleShutdownGlobally = async () => {
    setIsShuttingDown(true);
    try {
      await api.setBotGlobalState(false);
      
      // Crear notificación automática
      await api.createNotification({
        title: 'Bot Desactivado Globalmente',
        message: 'El bot ha sido desactivado en todos los grupos por el administrador',
        type: 'warning',
        category: 'bot'
      });
      
      toast.success('Bot desactivado globalmente');
      setIsShutdownModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Error al desactivar');
    } finally {
      setIsShuttingDown(false);
    }
  };

  const handleStartupGlobally = async () => {
    setIsStartingUp(true);
    try {
      await api.setBotGlobalState(true);
      
      // Crear notificación automática
      await api.createNotification({
        title: 'Bot Activado Globalmente',
        message: 'El bot ha sido activado globalmente y está respondiendo en todos los grupos habilitados',
        type: 'success',
        category: 'bot'
      });
      
      toast.success('Bot activado globalmente');
      fetchData();
    } catch (error) {
      toast.error('Error al activar');
    } finally {
      setIsStartingUp(false);
    }
  };

  const activeGroups = groups.filter(g => g.bot_enabled).length;
  const inactiveGroups = groups.length - activeGroups;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-ES', { 
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <Users className="w-8 h-8 text-indigo-400" />
            </div>
            Gestión de Grupos
          </h1>
          <p className="text-gray-400 mt-2">Administra el estado del bot en cada grupo</p>
        </motion.div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isSocketConnected 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
            {isSocketConnected ? 'Tiempo Real' : 'Sin conexión'}
          </div>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchData}>
            Actualizar
          </Button>
          <Button variant="danger" size="sm" icon={<Power className="w-4 h-4" />} onClick={() => setIsShutdownModalOpen(true)}>
            Apagar Global
          </Button>
          <Button variant="success" size="sm" icon={<ToggleRight className="w-4 h-4" />} onClick={handleStartupGlobally} loading={isStartingUp}>
            Encender Global
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Grupos" value={groups.length} icon={<Users className="w-6 h-6" />} color="primary" delay={0} loading={isLoading} />
        <StatCard title="Bot Activo" value={activeGroups} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0.1} loading={isLoading} />
        <StatCard title="Bot Inactivo" value={inactiveGroups} icon={<XCircle className="w-6 h-6" />} color="danger" delay={0.2} loading={isLoading} />
        <StatCard title="Notificaciones" value={notificationStats?.total || 0} icon={<Bell className="w-6 h-6" />} color="warning" delay={0.3} loading={isLoading} />
      </div>

      {/* Tabs */}
      <Card animated delay={0.2} className="overflow-hidden">
        <div className="border-b border-white/10">
          <nav className="flex space-x-1 px-6">
            {[{ id: 0, name: 'Grupos', icon: Users }, { id: 1, name: 'Notificaciones Globales', icon: Bell }].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-medium text-sm transition-all ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Tab Grupos */}
          {activeTab === 0 && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Cargando grupos...</p>
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No hay grupos registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Grupo</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Estado Bot</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Última Actividad</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group, index) => {
                        const isActive = group.bot_enabled;
                        return (
                          <motion.tr
                            key={group.wa_jid}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-4 px-4">
                              <p className="font-semibold text-white">{group.nombre}</p>
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">{group.wa_jid}</p>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                  isActive
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                                }`}>
                                  {isActive ? 'Activo' : 'Inactivo'}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-gray-400">
                                {group.updated_at ? new Date(group.updated_at).toLocaleDateString() : 'N/A'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleToggleGroup(group)}
                                  disabled={togglingGroup === group.wa_jid}
                                  className={`relative w-12 h-6 rounded-full transition-colors ${
                                    isActive ? 'bg-emerald-500' : 'bg-gray-600'
                                  } ${togglingGroup === group.wa_jid ? 'opacity-50' : ''}`}
                                >
                                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                    isActive ? 'left-7' : 'left-1'
                                  }`} />
                                </button>
                                <button
                                  onClick={() => { setSelectedGroup(group); setIsGroupModalOpen(true); }}
                                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                  <Eye className="w-4 h-4 text-gray-400" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab Notificaciones */}
          {activeTab === 1 && (
            <div className="space-y-4">
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No hay notificaciones globales</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Grupo</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Tipo</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Estado</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Fecha</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.map((notif, index) => (
                        <motion.tr
                          key={notif.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <p className="font-semibold text-white">{notif.grupo_nombre || 'Global'}</p>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2 py-1 text-xs font-medium text-indigo-400 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                              {notif.tipo || 'info'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              {notif.estado === 'enviado' ? (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400" />
                              )}
                              <span className={notif.estado === 'enviado' ? 'text-emerald-400' : 'text-red-400'}>
                                {notif.estado === 'enviado' ? 'Enviado' : 'Error'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-gray-400">{formatDate(notif.fecha_envio)}</span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-end">
                              <button
                                onClick={() => { setSelectedNotification(notif); setIsNotificationModalOpen(true); }}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-gray-400" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Modal Grupo */}
      <Modal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} title="Detalles del Grupo">
        {selectedGroup && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 rounded-xl">
                <Users className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white">{selectedGroup.nombre}</h4>
                <p className="text-sm text-gray-500 truncate max-w-[300px]">{selectedGroup.wa_jid}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-sm text-gray-400">Estado del Bot</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                    selectedGroup.bot_enabled
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}>
                    {selectedGroup.bot_enabled ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-sm text-gray-400">Última Actividad</p>
                <p className="text-white mt-1">
                  {selectedGroup.updated_at ? new Date(selectedGroup.updated_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
            {selectedGroup.descripcion && (
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-sm text-gray-400">Descripción</p>
                <p className="text-white mt-1">{selectedGroup.descripcion}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Notificación */}
      <Modal isOpen={isNotificationModalOpen} onClose={() => setIsNotificationModalOpen(false)} title="Detalles de Notificación">
        {selectedNotification && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 rounded-xl">
                <Bell className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white">{selectedNotification.grupo_nombre || 'Global'}</h4>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-sm text-gray-400">Estado</p>
                <div className="flex items-center gap-2 mt-1">
                  {selectedNotification.estado === 'enviado' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className={selectedNotification.estado === 'enviado' ? 'text-emerald-400' : 'text-red-400'}>
                    {selectedNotification.estado === 'enviado' ? 'Enviado' : 'Error'}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-sm text-gray-400">Fecha</p>
                <p className="text-white mt-1">{formatDate(selectedNotification.fecha_envio)}</p>
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl">
              <p className="text-sm text-gray-400">Mensaje</p>
              <code className="block mt-2 p-3 bg-black/30 rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
                {selectedNotification.mensaje}
              </code>
            </div>
            {selectedNotification.error_message && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-sm text-red-400 font-medium">Error</p>
                <p className="text-sm text-red-300 mt-1">{selectedNotification.error_message}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Shutdown */}
      <AnimatePresence>
        {isShutdownModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsShutdownModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Confirmar Apagado Global</h3>
                <button onClick={() => setIsShutdownModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-400">¡Atención!</p>
                    <p className="text-sm text-amber-300 mt-1">
                      Esta acción desactivará el bot en TODOS los grupos. Solo el administrador podrá reactivarlo.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-gray-400 mb-6">¿Estás seguro de que quieres desactivar el bot globalmente?</p>
              <div className="flex gap-3">
                <Button onClick={() => setIsShutdownModalOpen(false)} variant="secondary" className="flex-1">Cancelar</Button>
                <Button onClick={handleShutdownGlobally} variant="danger" className="flex-1" loading={isShuttingDown}>
                  Desactivar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
