'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Bell, Search, RefreshCw, CheckCircle, AlertCircle, Info, AlertTriangle, Trash2, Check, CheckCheck, Plus } from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SimpleSelect as Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { SOCKET_EVENTS, useSocket } from '@/contexts/SocketContext';
import { useFlashTokens } from '@/hooks/useFlashTokens';
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
  const reduceMotion = useReducedMotion();
  const flash = useFlashTokens({ ttlMs: 1200 });
  const hasLoadedOnceRef = useRef(false);
  const prevSigRef = useRef<Record<number, string>>({});

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

  useEffect(() => {
    loadNotifications();
    loadStats();
  }, [page, typeFilter, readFilter, searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps -- load fns are defined below

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
  }, [socket, page, typeFilter, readFilter, searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps -- scheduleReload uses load fns

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await api.getNotificaciones(page, 20, {
        search: searchTerm || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        read: readFilter !== 'all' ? readFilter : undefined
      });
      const list = data?.notificaciones || [];
      const nextSig: Record<number, string> = {};

      if (hasLoadedOnceRef.current) {
        let flashed = 0;
        for (const n of list) {
          const sig = `${n.leida ? 1 : 0}|${n.tipo}|${n.titulo}|${n.mensaje}|${n.fecha_creacion}`;
          nextSig[n.id] = sig;

          const prevSig = prevSigRef.current[n.id];
          if ((!prevSig || prevSig !== sig) && flashed < 10) {
            flash.trigger(String(n.id));
            flashed += 1;
          }
        }
      } else {
        for (const n of list) {
          nextSig[n.id] = `${n.leida ? 1 : 0}|${n.tipo}|${n.titulo}|${n.mensaje}|${n.fecha_creacion}`;
        }
        hasLoadedOnceRef.current = true;
      }

      prevSigRef.current = nextSig;
      setNotifications(list);
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

  const listVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.04,
      },
    },
  };

  const itemVariants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.99 },
    show: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.99 },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Notificaciones"
        description="Gestiona las notificaciones del sistema"
        icon={<Bell className="w-6 h-6 text-primary-400" />}
        actions={
          <>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              Nueva Notificaci?n
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="success"
                size="sm"
                icon={<CheckCheck className="w-4 h-4" />}
                onClick={markAllAsRead}
              >
                Marcar todas le?das
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={loadNotifications}
              loading={loading}
            >
              Actualizar
            </Button>
          </>
        }
      />

      {/* Stats */}
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4" delay={0.06} stagger={0.06}>
        <StaggerItem>
          <StatCard title="Total" value={stats?.total || notifications.length} icon={<Bell className="w-6 h-6" />} color="primary" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Sin Leer" value={stats?.unread || unreadCount} icon={<AlertCircle className="w-6 h-6" />} color="warning" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Hoy" value={stats?.today || 0} icon={<Info className="w-6 h-6" />} color="info" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Esta Semana" value={stats?.thisWeek || 0} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0} />
        </StaggerItem>
      </Stagger>

      {/* Filters */}      {/* Filters */}
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
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <SkeletonCircle className="h-9 w-9" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                  <div className="flex items-center gap-3 pt-1">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Bell className="w-6 h-6 text-gray-400" />}
              title="No hay notificaciones"
              description="No tienes notificaciones pendientes"
              action={
                <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={() => { loadNotifications(); loadStats(); }}>
                  Recargar
                </Button>
              }
            />
          </div>
        ) : (
          <div>
            <motion.div variants={listVariants} initial="hidden" animate="show" className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout">
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    layout="position"
                    variants={itemVariants}
                    exit="exit"
                    className={`relative overflow-hidden p-4 hover:bg-white/5 transition-colors ${!notification.leida ? 'bg-primary-500/5' : ''}`}
                  >
                    {flash.tokens[String(notification.id)] && (
                      <div
                        key={flash.tokens[String(notification.id)]}
                        className="flash-update pointer-events-none absolute inset-0"
                      />
                    )}
                    <div className="flex items-start gap-4 relative">
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
            </motion.div>
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
