'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Power, Bell, CheckCircle, XCircle, Eye, RefreshCw,
  ToggleRight, AlertTriangle, X
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useLoadingOverlay } from '@/contexts/LoadingOverlayContext';
import { notify } from '@/lib/notif';
import { cn, formatDateTime } from '@/lib/utils';
import api from '@/services/api';
import { useGroups } from '@/contexts/GroupsContext';

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
  const [activeTab, setActiveTab] = useState<'groups' | 'notifications'>('groups');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<GlobalNotification | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [recentGroupJid, setRecentGroupJid] = useState<string | null>(null);
  
  // Usar el contexto global del bot
  const { isGloballyOn: globalBotState, setGlobalState } = useBotGlobalState();
  const [isShutdownModalOpen, setIsShutdownModalOpen] = useState(false);
  const [togglingGroup, setTogglingGroup] = useState<string | null>(null);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [isStartingUp, setIsStartingUp] = useState(false);

  const { isConnected: isSocketConnected } = useSocketConnection();
  const { withLoading } = useLoadingOverlay();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshGroups();
      // Solo cargar notificaciones, los grupos vienen del context
      const [notifRes, statsRes] = await Promise.all([
        api.getNotificaciones(1, 50).catch(() => ({ data: [] })),
        api.getNotificationStats().catch(() => ({ total: 0 }))
      ]);
      setNotifications(notifRes.data || []);
      setNotificationStats(statsRes);
    } catch (error) {
      notify.error('Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  }, [refreshGroups]);

  useEffect(() => { 
    setGroups(contextGroups); // Actualizar cuando cambien los grupos del context
  }, [contextGroups]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleGroup = async (group: Group) => {
    if (!globalBotState) {
      notify.error('El bot está apagado globalmente');
      return;
    }
    
    const isActive = group.bot_enabled;
    setTogglingGroup(group.wa_jid);
    try {
      await api.toggleGroupBot(group.wa_jid, isActive ? 'off' : 'on');
      setGroups(prev => prev.map(g => 
        g.wa_jid === group.wa_jid ? { ...g, bot_enabled: !isActive } : g
      ));
      setRecentGroupJid(group.wa_jid);
      window.setTimeout(() => setRecentGroupJid(null), 1200);
      void refreshGroups();
      
      // Crear notificación automática
      void api
        .createNotification({
          title: `Bot ${isActive ? 'Desactivado' : 'Activado'} en Grupo`,
          message: `El bot ha sido ${isActive ? 'desactivado' : 'activado'} en el grupo "${group.nombre}"`,
          type: isActive ? 'warning' : 'success',
          category: 'bot',
        })
        .catch(() => {});
      
      notify.success(`Bot ${isActive ? 'desactivado' : 'activado'} en ${group.nombre}`);
    } catch (error) {
      notify.error('Error al cambiar estado');
    } finally {
      setTogglingGroup(null);
    }
  };

  const handleShutdownGlobally = async () => {
    setIsShuttingDown(true);
    try {
      await withLoading(
        async () => {
          await setGlobalState(false); // Usar el contexto
          void api
            .createNotification({
              title: 'Bot Desactivado Globalmente',
              message: 'El bot ha sido desactivado en todos los grupos por el administrador',
              type: 'warning',
              category: 'bot',
            })
            .catch(() => {});
          await refreshGroups();
        },
        { message: 'Apagando bot global…', details: 'Aplicando cambios en todos los grupos.' }
      );

      notify.success('Bot desactivado globalmente');
      setIsShutdownModalOpen(false);
      fetchData();
    } catch (error) {
      notify.error('Error al desactivar');
    } finally {
      setIsShuttingDown(false);
    }
  };

  const handleStartupGlobally = async () => {
    setIsStartingUp(true);
    try {
      await withLoading(
        async () => {
          await setGlobalState(true); // Usar el contexto
          void api
            .createNotification({
              title: 'Bot Activado Globalmente',
              message: 'El bot ha sido activado globalmente y está respondiendo en todos los grupos habilitados',
              type: 'success',
              category: 'bot',
            })
            .catch(() => {});
          await refreshGroups();
        },
        { message: 'Encendiendo bot global…', details: 'Inicializando conexiones.' }
      );

      notify.success('Bot activado globalmente');
      fetchData();
    } catch (error) {
      notify.error('Error al activar');
    } finally {
      setIsStartingUp(false);
    }
  };

  const activeGroups = globalBotState ? groups.filter(g => g.bot_enabled).length : 0;
  const inactiveGroups = globalBotState ? groups.length - activeGroups : groups.length;

  const formatDate = (date: string) => {
    return formatDateTime(date);
  };

  return (
    <div className="panel-page relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-oguri-cyan/18 blur-3xl"
          animate={{ x: [0, 18, 0], y: [0, 14, 0], opacity: [0.18, 0.38, 0.18] }}
          transition={{ repeat: Infinity, duration: 10.8, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-gold/18 blur-3xl"
          animate={{ x: [0, -18, 0], y: [0, 18, 0], opacity: [0.18, 0.4, 0.18] }}
          transition={{ repeat: Infinity, duration: 11.2, ease: 'easeInOut', delay: 0.5 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(var(--page-a),0.18),rgba(var(--page-b),0.10),rgba(var(--page-c),0.12))] p-5 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6"
      >
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit">
              <Users className="h-3.5 w-3.5 text-oguri-cyan" />
              Control por grupo
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Gestión global con ambiente operativo</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Estado del bot por grupo y tablero de notificaciones con mejor jerarquía visual.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Grupos</p>
              <p className="mt-2 text-lg font-black text-white">{groups.length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Activos</p>
              <p className="mt-2 text-lg font-black text-white">{activeGroups}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Alertas</p>
              <p className="mt-2 text-lg font-black text-white">{notificationStats?.total || notifications.length}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <PageHeader
        title="Gestión de Grupos"
        description="Administra el estado del bot en cada grupo"
        icon={<Users className="w-5 h-5 text-indigo-400" />}
        actions={
          <>
            <RealTimeBadge isActive={isSocketConnected} />
            <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchData}>
              Actualizar
            </Button>
            <Button variant="danger" size="sm" icon={<Power className="w-4 h-4" />} onClick={() => setIsShutdownModalOpen(true)}>
              Apagar Global
            </Button>
            <Button
              variant="success"
              size="sm"
              icon={<ToggleRight className="w-4 h-4" />}
              onClick={handleStartupGlobally}
              loading={isStartingUp}
            >
              Encender Global
            </Button>
          </>
        }
      />

      {/* Stats */}
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4" delay={0.02} stagger={0.07}>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Total Grupos" value={groups.length} icon={<Users className="w-6 h-6" />} color="primary" delay={0} loading={isLoading} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Bot Activo" value={activeGroups} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0} loading={isLoading} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Bot Inactivo" value={inactiveGroups} icon={<XCircle className="w-6 h-6" />} color="danger" delay={0} loading={isLoading} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Notificaciones" value={notificationStats?.total || 0} icon={<Bell className="w-6 h-6" />} color="warning" delay={0} loading={isLoading} animated={false} />
        </StaggerItem>
      </Stagger>

      {/* Tabs */}
      <Card animated delay={0.2} className="overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="px-6 pt-4">
            <TabsList className="border-b-0">
              <TabsTrigger value="groups" className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Grupos
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notificaciones Globales
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="groups" className="mt-0">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="skeleton h-10 w-1/3" />
                  <div className="skeleton h-12 w-full" />
                  <div className="skeleton h-12 w-full" />
                  <div className="skeleton h-12 w-full" />
                </div>
              ) : groups.length === 0 ? (
                <EmptyState
                  icon={<Users className="w-6 h-6 text-gray-400" />}
                  title="No hay grupos registrados"
                  description="Sin datos para mostrar en gestión global."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-glass w-full">
                    <thead>
                      <tr>
                        <th>Grupo</th>
                        <th>Estado Bot</th>
                        <th>Última Actividad</th>
                        <th className="text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group, index) => {
                        const isActive = !!group.bot_enabled;
                        const isUpdating = togglingGroup === group.wa_jid;
                        return (
                          <motion.tr
                            key={group.wa_jid}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className={cn(recentGroupJid === group.wa_jid && 'highlight-change')}
                          >
                            <td>
                              <p className="font-semibold text-white">{group.nombre}</p>
                              <p className="text-xs text-gray-500 truncate max-w-[260px]">{group.wa_jid}</p>
                            </td>
                            <td>
                              <span className={isActive ? 'badge-success' : 'badge-danger'}>
                                {isActive ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td>
                              <span className="text-sm text-gray-400">
                                {group.updated_at ? new Date(group.updated_at).toLocaleDateString() : 'N/A'}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  aria-label={isActive ? 'Desactivar bot en grupo' : 'Activar bot en grupo'}
                                  aria-pressed={isActive}
                                  onClick={() => handleToggleGroup(group)}
                                  disabled={isUpdating}
                                  className={cn(
                                    'relative w-12 h-6 rounded-full border border-white/10 bg-white/5 transition-colors hover:bg-white/10',
                                    'press-scale focus-ring-animated',
                                    isActive && 'bg-gradient-to-r from-accent-emerald to-accent-cyan border-transparent shadow-glow-emerald',
                                    isUpdating && 'is-updating opacity-70'
                                  )}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      'absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform duration-300',
                                      isActive && 'translate-x-6'
                                    )}
                                  />
                                </button>
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  aria-label="Ver detalles del grupo"
                                  icon={<Eye className="w-4 h-4" />}
                                  onClick={() => {
                                    setSelectedGroup(group);
                                    setIsGroupModalOpen(true);
                                  }}
                                  className="hover-outline-gradient hover-glass-bright"
                                />
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="skeleton h-10 w-1/2" />
                  <div className="skeleton h-12 w-full" />
                  <div className="skeleton h-12 w-full" />
                  <div className="skeleton h-12 w-full" />
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={<Bell className="w-6 h-6 text-gray-400" />}
                  title="No hay notificaciones globales"
                  description="Cuando se envíen notificaciones, aparecerán aquí."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-glass w-full">
                    <thead>
                      <tr>
                        <th>Grupo</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th className="text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.map((notif, index) => (
                        <motion.tr
                          key={notif.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <td>
                            <p className="font-semibold text-white">{notif.grupo_nombre || 'Global'}</p>
                          </td>
                          <td>
                            <span className="badge-info">{notif.tipo || 'info'}</span>
                          </td>
                          <td>
                            <span className={notif.estado === 'enviado' ? 'badge-success' : 'badge-danger'}>
                              {notif.estado === 'enviado' ? 'Enviado' : 'Error'}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm text-gray-400">{formatDate(notif.fecha_envio)}</span>
                          </td>
                          <td>
                            <div className="flex justify-end">
                              <Button
                                variant="secondary"
                                size="icon"
                                aria-label="Ver detalles de la notificación"
                                icon={<Eye className="w-4 h-4" />}
                                onClick={() => {
                                  setSelectedNotification(notif);
                                  setIsNotificationModalOpen(true);
                                }}
                                className="hover-outline-gradient hover-glass-bright"
                              />
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
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
                      ? 'bg-success/20 text-success border-success/30'
                      : 'bg-danger/20 text-danger border-danger/30'
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
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-danger" />
                  )}
                  <span className={selectedNotification.estado === 'enviado' ? 'text-success' : 'text-danger'}>
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
              <code className="block mt-2 p-3 code-surface rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
                {selectedNotification.mensaje}
              </code>
            </div>
            {selectedNotification.error_message && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl">
                <p className="text-sm text-danger font-medium">Error</p>
                <p className="text-sm text-danger/80 mt-1">{selectedNotification.error_message}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Shutdown */}
      {/* Legacy shutdown modal (deprecated)
      <AnimatePresence>
        {isShutdownModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => (isShuttingDown ? null : setIsShutdownModalOpen(false))}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-content max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Confirmar Apagado Global</h3>
                <button onClick={() => setIsShutdownModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                  <div>
                    <p className="font-semibold text-warning">¡Atención!</p>
                    <p className="text-sm text-warning/80 mt-1">
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
      */}

      <Modal
        isOpen={isShutdownModalOpen}
        onClose={() => {
          if (isShuttingDown) return;
          setIsShutdownModalOpen(false);
        }}
        title="Confirmar Apagado Global"
        className="max-w-md"
      >
        <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-warning font-semibold mb-1">¡Atención!</p>
              <p className="text-sm text-warning/90">
                Esta acción desactivará el bot en TODOS los grupos. Solo el administrador podrá reactivarlo.
              </p>
            </div>
          </div>
        </div>

        <p className="text-muted mb-6">¿Estás seguro de que quieres desactivar el bot globalmente?</p>

        <div className="flex gap-3">
          <Button
            onClick={() => setIsShutdownModalOpen(false)}
            variant="secondary"
            className="flex-1"
            disabled={isShuttingDown}
          >
            Cancelar
          </Button>
          <Button onClick={handleShutdownGlobally} variant="danger" className="flex-1" loading={isShuttingDown}>
            Desactivar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
