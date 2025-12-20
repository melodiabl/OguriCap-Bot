import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Power,
  Bell,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  ToggleRight,
  AlertTriangle,
  Loader2,
  X,
  Radio,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiService } from '../services/api';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton, IconButton, ToggleButton } from '../components/ui/AnimatedButton';
import { useSocketGrupos } from '../hooks/useSocketEvents';
import { useSocket } from '../contexts/SocketContext';
import dayjs from 'dayjs';

interface Group {
  id: string;
  jid: string;
  nombre: string;
  descripcion?: string;
  bot_activo: boolean;
  desactivado_por?: string;
  fecha_desactivacion?: string;
  created_at?: string;
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

export const GruposManagement: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<GlobalNotification | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isShutdownModalOpen, setIsShutdownModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const queryClient = useQueryClient();

  // Socket.IO para actualizaciones en tiempo real
  const { isConnected: isSocketConnected } = useSocket();
  useSocketGrupos();

  const { data: groupsData, isLoading: groupsLoading, refetch: refetchGroups } = useQuery('groupsManagement', apiService.getGroupsManagement);
  const { data: notificationsData, isLoading: notificationsLoading } = useQuery('globalNotifications', () => apiService.getGlobalNotifications(1, 50));
  const { data: notificationStats } = useQuery('globalNotificationStats', apiService.getGlobalNotificationStats);

  const toggleGroupMutation = useMutation(
    ({ groupId, action }: { groupId: string; action: 'on' | 'off' }) =>
      apiService.toggleGroupBot(groupId, action),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('groupsManagement');
      },
    }
  );

  const shutdownBotMutation = useMutation(
    () => apiService.shutdownBotGlobally(),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('groupsManagement');
        queryClient.invalidateQueries('globalNotifications');
        setIsShutdownModalOpen(false);
      },
    }
  );

  const startupBotMutation = useMutation(
    () => apiService.startupBotGlobally(),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('groupsManagement');
        queryClient.invalidateQueries('globalNotifications');
      },
    }
  );

  const handleToggleGroup = (group: Group) => {
    const action = group.bot_activo ? 'off' : 'on';
    toggleGroupMutation.mutate({ groupId: group.jid, action });
  };

  const handleViewGroup = (group: Group) => {
    setSelectedGroup(group);
    setIsGroupModalOpen(true);
  };

  const handleViewNotification = (notification: GlobalNotification) => {
    setSelectedNotification(notification);
    setIsNotificationModalOpen(true);
  };

  const groups = groupsData?.grupos || [];
  const notifications = notificationsData?.notificaciones || [];
  const activeGroups = groups.filter((g: Group) => g.bot_activo).length;
  const inactiveGroups = groups.filter((g: Group) => !g.bot_activo).length;

  if (groupsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary-400" />
          <h2 className="text-xl font-semibold text-white">Cargando gestión de grupos...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-xl">
                <Users className="w-8 h-8 text-indigo-400" />
              </div>
              Gestión de Grupos
            </h1>
            <p className="text-gray-400 mt-2">Administra el estado del bot en cada grupo</p>
          </div>
          <div className="flex items-center gap-3">
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
              onClick={() => refetchGroups()}
              variant="secondary"
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Actualizar
            </AnimatedButton>
            <AnimatedButton
              onClick={() => setIsShutdownModalOpen(true)}
              loading={shutdownBotMutation.isLoading}
              variant="danger"
              icon={<Power className="w-4 h-4" />}
            >
              Apagar Globalmente
            </AnimatedButton>
            <AnimatedButton
              onClick={() => startupBotMutation.mutate()}
              loading={startupBotMutation.isLoading}
              variant="success"
              icon={<ToggleRight className="w-4 h-4" />}
            >
              Encender Globalmente
            </AnimatedButton>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Grupos"
            value={groups.length}
            subtitle="Grupos registrados"
            icon={<Users className="w-6 h-6" />}
            color="info"
            delay={0}
          />
          <StatCard
            title="Bot Activo"
            value={activeGroups}
            subtitle="Grupos con bot activo"
            icon={<CheckCircle className="w-6 h-6" />}
            color="success"
            delay={0.1}
          />
          <StatCard
            title="Bot Inactivo"
            value={inactiveGroups}
            subtitle="Grupos con bot inactivo"
            icon={<XCircle className="w-6 h-6" />}
            color="danger"
            delay={0.2}
          />
          <StatCard
            title="Notificaciones"
            value={notificationStats?.total || 0}
            subtitle="Notificaciones enviadas"
            icon={<Bell className="w-6 h-6" />}
            color="warning"
            delay={0.3}
          />
        </div>

        {/* Tabs */}
        <AnimatedCard delay={0.2} className="overflow-hidden">
          <div className="border-b border-white/10">
            <nav className="flex space-x-1 px-6">
              {[
                { id: 0, name: 'Grupos', icon: Users },
                { id: 1, name: 'Notificaciones Globales', icon: Bell },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-4 border-b-2 font-medium text-sm transition-all ${
                      activeTab === tab.id
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Tab Grupos */}
            {activeTab === 0 && (
              <div className="space-y-4">
                {groups.length === 0 ? (
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
                        {groups.map((group: Group, index: number) => (
                          <motion.tr
                            key={group.jid}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-4 px-4">
                              <div>
                                <p className="font-semibold text-white">{group.nombre}</p>
                                <p className="text-xs text-gray-500">{group.jid}</p>
                                {group.descripcion && (
                                  <p className="text-xs text-gray-600 mt-1">{group.descripcion}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                  group.bot_activo
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                                }`}>
                                  {group.bot_activo ? 'Activo' : 'Inactivo'}
                                </span>
                                {!group.bot_activo && group.desactivado_por && (
                                  <span className="text-xs text-gray-500">por {group.desactivado_por}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-gray-400">
                                {group.fecha_desactivacion
                                  ? dayjs(group.fecha_desactivacion).format('DD/MM/YYYY HH:mm')
                                  : 'N/A'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-end gap-2">
                                <ToggleButton
                                  isOn={group.bot_activo}
                                  onToggle={() => handleToggleGroup(group)}
                                  disabled={toggleGroupMutation.isLoading}
                                  size="sm"
                                />
                                <IconButton
                                  icon={<Eye className="w-4 h-4" />}
                                  onClick={() => handleViewGroup(group)}
                                  variant="ghost"
                                  tooltip="Ver detalles"
                                />
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

            {/* Tab Notificaciones */}
            {activeTab === 1 && (
              <div className="space-y-4">
                {notificationsLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-400" />
                    <p className="text-gray-400">Cargando notificaciones...</p>
                  </div>
                ) : notifications.length === 0 ? (
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
                        {notifications.map((notification: GlobalNotification, index: number) => (
                          <motion.tr
                            key={notification.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-4 px-4">
                              <p className="font-semibold text-white">{notification.grupo_nombre}</p>
                              <p className="text-xs text-gray-500">{notification.grupo_jid}</p>
                            </td>
                            <td className="py-4 px-4">
                              <span className="px-2 py-1 text-xs font-medium text-indigo-400 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                                {notification.tipo}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                {notification.estado === 'enviado' ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400" />
                                )}
                                <span className={`text-sm ${notification.estado === 'enviado' ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {notification.estado === 'enviado' ? 'Enviado' : 'Error'}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-gray-400">
                                {dayjs(notification.fecha_envio).format('DD/MM/YYYY HH:mm')}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex justify-end">
                                <IconButton
                                  icon={<Eye className="w-4 h-4" />}
                                  onClick={() => handleViewNotification(notification)}
                                  variant="ghost"
                                  tooltip="Ver detalles"
                                />
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
        </AnimatedCard>

        {/* Modal Grupo */}
        <AnimatePresence>
          {isGroupModalOpen && selectedGroup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setIsGroupModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-lg"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">Detalles del Grupo</h3>
                  <button onClick={() => setIsGroupModalOpen(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/20 rounded-xl">
                      <Users className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white">{selectedGroup.nombre}</h4>
                      <p className="text-sm text-gray-500">{selectedGroup.jid}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-gray-400">Estado del Bot</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                          selectedGroup.bot_activo
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          {selectedGroup.bot_activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <ToggleButton
                          isOn={selectedGroup.bot_activo}
                          onToggle={() => handleToggleGroup(selectedGroup)}
                          disabled={toggleGroupMutation.isLoading}
                          size="sm"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-gray-400">Última Actividad</p>
                      <p className="text-white mt-1">
                        {selectedGroup.fecha_desactivacion
                          ? dayjs(selectedGroup.fecha_desactivacion).format('DD/MM/YYYY HH:mm')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {selectedGroup.descripcion && (
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-gray-400">Descripción</p>
                      <p className="text-white mt-1">{selectedGroup.descripcion}</p>
                    </div>
                  )}

                  {!selectedGroup.bot_activo && selectedGroup.desactivado_por && (
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-gray-400">Desactivado por</p>
                      <p className="text-white mt-1">{selectedGroup.desactivado_por}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end mt-6">
                  <AnimatedButton onClick={() => setIsGroupModalOpen(false)} variant="secondary">
                    Cerrar
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Notificación */}
        <AnimatePresence>
          {isNotificationModalOpen && selectedNotification && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setIsNotificationModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-lg"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">Detalles de Notificación</h3>
                  <button onClick={() => setIsNotificationModalOpen(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/20 rounded-xl">
                      <Bell className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white">{selectedNotification.grupo_nombre}</h4>
                      <p className="text-sm text-gray-500">{selectedNotification.grupo_jid}</p>
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
                      <p className="text-white mt-1">
                        {dayjs(selectedNotification.fecha_envio).format('DD/MM/YYYY HH:mm')}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-sm text-gray-400">Mensaje Enviado</p>
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

                <div className="flex justify-end mt-6">
                  <AnimatedButton onClick={() => setIsNotificationModalOpen(false)} variant="secondary">
                    Cerrar
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                        Esta acción desactivará el bot en TODOS los grupos y enviará una notificación global.
                        Solo el administrador podrá reactivarlo.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-gray-400 mb-6">
                  ¿Estás seguro de que quieres desactivar el bot globalmente?
                </p>

                <div className="flex gap-3">
                  <AnimatedButton onClick={() => setIsShutdownModalOpen(false)} variant="secondary" fullWidth>
                    Cancelar
                  </AnimatedButton>
                  <AnimatedButton
                    onClick={() => shutdownBotMutation.mutate()}
                    loading={shutdownBotMutation.isLoading}
                    variant="danger"
                    fullWidth
                  >
                    Desactivar Globalmente
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GruposManagement;
