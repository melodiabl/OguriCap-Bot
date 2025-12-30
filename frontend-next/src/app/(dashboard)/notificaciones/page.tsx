'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, RefreshCw, CheckCircle, AlertCircle, Info, AlertTriangle, Trash2, Check, CheckCheck, Plus } from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SimpleSelect as Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { SOCKET_EVENTS, useSocket } from '@/contexts/SocketContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface Notification {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'success' | 'warning' | 'error';
  categoria: string;
  leida: boolean;
  fecha_creacion: string;
}

export default function NotificacionesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNotification, setNewNotification] = useState({
    titulo: '',
    mensaje: '',
    tipo: 'info' as 'info' | 'success' | 'warning' | 'error',
    categoria: 'sistema'
  });
  const { socket } = useSocket();

  const createNotification = async () => {
    if (!newNotification.titulo.trim() || !newNotification.mensaje.trim()) {
      toast.error('Título y mensaje son requeridos');
      return;
    }
    
    try {
      await api.createNotification({
        title: newNotification.titulo,
        message: newNotification.mensaje,
        type: newNotification.tipo,
        category: newNotification.categoria
      });
      toast.success('Notificación creada');
      setShowCreateModal(false);
      setNewNotification({ titulo: '', mensaje: '', tipo: 'info', categoria: 'sistema' });
      loadNotifications();
      loadStats();
    } catch (err) {
      toast.error('Error al crear notificación');
    }
  };

  useEffect(() => { loadNotifications(); loadStats(); }, [page, typeFilter, readFilter]);

  useEffect(() => {
    if (!socket) return;

    let timer: any;
    const scheduleReload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadNotifications();
        loadStats();
      }, 750);
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION, scheduleReload);
    socket.on('notification:created', scheduleReload);

    return () => {
      clearTimeout(timer);
      socket.off(SOCKET_EVENTS.NOTIFICATION, scheduleReload);
      socket.off('notification:created', scheduleReload);
    };
  }, [socket, page, typeFilter, readFilter, searchTerm]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await api.getNotificaciones(page, 20, {
        search: searchTerm || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        read: readFilter !== 'all' ? readFilter : undefined
      });
      setNotifications(data?.notificaciones || []);
      setPagination(data?.pagination);
    } catch (err) {
      toast.error('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.getNotificationStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats');
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
      loadStats();
    } catch (err) {
      toast.error('Error al marcar como leída');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
      toast.success('Todas las notificaciones marcadas como leídas');
      loadStats();
    } catch (err) {
      toast.error('Error al marcar todas como leídas');
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notificación eliminada');
      loadStats();
    } catch (err) {
      toast.error('Error al eliminar notificación');
    }
  };

  const getTypeIcon = (tipo: string) => {
    const icons: Record<string, React.ReactNode> = {
      info: <Info className="w-5 h-5 text-cyan-400" />,
      success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
      warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      error: <AlertCircle className="w-5 h-5 text-red-400" />,
    };
    return icons[tipo] || icons.info;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;
    return date.toLocaleDateString('es-ES');
  };

  const unreadCount = notifications.filter(n => !n.leida).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">Notificaciones</h1>
          <p className="text-gray-400 mt-1">Gestiona las notificaciones del sistema</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3">
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            Nueva Notificación
          </Button>
          {unreadCount > 0 && (
            <Button variant="success" size="sm" icon={<CheckCheck className="w-4 h-4" />} onClick={markAllAsRead}>
              Marcar todas leídas
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadNotifications} loading={loading}>
            Actualizar
          </Button>
        </motion.div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total" value={stats?.total || notifications.length} icon={<Bell className="w-6 h-6" />} color="primary" delay={0} />
        <StatCard title="Sin Leer" value={stats?.unread || unreadCount} icon={<AlertCircle className="w-6 h-6" />} color="warning" delay={0.1} />
        <StatCard title="Hoy" value={stats?.today || 0} icon={<Info className="w-6 h-6" />} color="info" delay={0.2} />
        <StatCard title="Esta Semana" value={stats?.thisWeek || 0} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0.3} />
      </div>

      {/* Filters */}
      <Card animated delay={0.2} className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Buscar notificaciones..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadNotifications()}
              className="input-glass w-full pl-12" />
          </div>
          <Select value={typeFilter} onChange={setTypeFilter} options={[
            { value: 'all', label: 'Todos los tipos' },
            { value: 'info', label: 'Info' },
            { value: 'success', label: 'Éxito' },
            { value: 'warning', label: 'Advertencia' },
            { value: 'error', label: 'Error' }
          ]} className="md:w-40" />
          <Select value={readFilter} onChange={setReadFilter} options={[
            { value: 'all', label: 'Todas' },
            { value: 'false', label: 'Sin leer' },
            { value: 'true', label: 'Leídas' }
          ]} className="md:w-40" />
        </div>
      </Card>

      {/* Notifications List */}
      <Card animated delay={0.3} className="overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Lista de Notificaciones</h2>
          <p className="text-gray-400 text-sm mt-1">{notifications.length} notificaciones</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Cargando notificaciones...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No hay notificaciones</h3>
            <p className="text-gray-400">No tienes notificaciones pendientes</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence>
              {notifications.map((notification, index) => (
                <motion.div key={notification.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }} transition={{ delay: index * 0.03 }}
                  className={`p-4 hover:bg-white/5 transition-colors ${!notification.leida ? 'bg-primary-500/5' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-white/5">{getTypeIcon(notification.tipo)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-medium ${!notification.leida ? 'text-white' : 'text-gray-400'}`}>
                          {notification.titulo}
                        </h4>
                        {!notification.leida && <span className="w-2 h-2 rounded-full bg-primary-500" />}
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{notification.mensaje}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500">{formatDate(notification.fecha_creacion)}</span>
                        {notification.categoria && (
                          <span className="badge bg-white/5 text-gray-400 border-white/10">{notification.categoria}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.leida && (
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                          onClick={() => markAsRead(notification.id)}
                          className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Marcar como leída">
                          <Check className="w-4 h-4" />
                        </motion.button>
                      )}
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
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
            <p className="text-sm text-gray-400">Página {pagination.page} de {pagination.totalPages}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Notification Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nueva Notificación">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Título</label>
            <input
              type="text"
              value={newNotification.titulo}
              onChange={(e) => setNewNotification(prev => ({ ...prev, titulo: e.target.value }))}
              className="input-glass w-full"
              placeholder="Título de la notificación"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Mensaje</label>
            <textarea
              value={newNotification.mensaje}
              onChange={(e) => setNewNotification(prev => ({ ...prev, mensaje: e.target.value }))}
              className="input-glass w-full h-24 resize-none"
              placeholder="Contenido de la notificación"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Tipo</label>
              <Select
                value={newNotification.tipo}
                onChange={(value) => setNewNotification(prev => ({ ...prev, tipo: value as any }))}
                options={[
                  { value: 'info', label: 'Información' },
                  { value: 'success', label: 'Éxito' },
                  { value: 'warning', label: 'Advertencia' },
                  { value: 'error', label: 'Error' }
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Categoría</label>
              <Select
                value={newNotification.categoria}
                onChange={(value) => setNewNotification(prev => ({ ...prev, categoria: value }))}
                options={[
                  { value: 'sistema', label: 'Sistema' },
                  { value: 'bot', label: 'Bot' },
                  { value: 'usuarios', label: 'Usuarios' },
                  { value: 'contenido', label: 'Contenido' }
                ]}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={createNotification}
            >
              Crear Notificación
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
