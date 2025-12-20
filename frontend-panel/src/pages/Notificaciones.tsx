import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  Trash2,
  Check,
  CheckCheck,
  X,
  Filter,
} from 'lucide-react';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { NotificationItem } from '../components/ui/AnimatedList';
import { CustomSelect } from '../components/ui/CustomSelect';
import toast from 'react-hot-toast';
import api from '../config/api';

interface Notification {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'success' | 'warning' | 'error';
  categoria: string;
  leida: boolean;
  fecha_creacion: string;
  metadata?: any;
}

const Notificaciones: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadNotifications();
    loadStats();
  }, [page, typeFilter, readFilter]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (searchTerm) params.append('search', searchTerm);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (readFilter !== 'all') params.append('read', readFilter);

      const response = await api.get(`/api/notificaciones?${params}`);
      setNotifications(response.data?.notificaciones || []);
      setPagination(response.data?.pagination);
    } catch (err) {
      toast.error('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/api/notificaciones/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Error loading stats');
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.patch(`/api/notificaciones/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
      loadStats();
    } catch (err) {
      toast.error('Error al marcar como leída');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/api/notificaciones/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
      toast.success('Todas las notificaciones marcadas como leídas');
      loadStats();
    } catch (err) {
      toast.error('Error al marcar todas como leídas');
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await api.delete(`/api/notificaciones/${id}`);
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
          {unreadCount > 0 && (
            <AnimatedButton variant="primary" size="sm" icon={<CheckCheck className="w-4 h-4" />} onClick={markAllAsRead}>
              Marcar todas leídas
            </AnimatedButton>
          )}
          <AnimatedButton variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadNotifications} loading={loading}>
            Actualizar
          </AnimatedButton>
        </motion.div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total"
          value={stats?.total || notifications.length}
          icon={<Bell className="w-6 h-6" />}
          color="primary"
          delay={0}
        />
        <StatCard
          title="Sin Leer"
          value={stats?.unread || unreadCount}
          icon={<AlertCircle className="w-6 h-6" />}
          color="warning"
          delay={0.1}
        />
        <StatCard
          title="Hoy"
          value={stats?.today || 0}
          icon={<Info className="w-6 h-6" />}
          color="info"
          delay={0.2}
        />
        <StatCard
          title="Esta Semana"
          value={stats?.thisWeek || 0}
          icon={<CheckCircle className="w-6 h-6" />}
          color="success"
          delay={0.3}
        />
      </div>

      {/* Filters */}
      <AnimatedCard delay={0.2} className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar notificaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadNotifications()}
              className="input-search w-full"
            />
          </div>
          <CustomSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: 'all', label: 'Todos los tipos' },
              { value: 'info', label: 'Info' },
              { value: 'success', label: 'Éxito' },
              { value: 'warning', label: 'Advertencia' },
              { value: 'error', label: 'Error' }
            ]}
            className="md:w-40"
          />
          <CustomSelect
            value={readFilter}
            onChange={setReadFilter}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'false', label: 'Sin leer' },
              { value: 'true', label: 'Leídas' }
            ]}
            className="md:w-40"
          />
        </div>
      </AnimatedCard>

      {/* Notifications List */}
      <AnimatedCard delay={0.3} className="overflow-hidden">
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
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.03 }}
                  className={`p-4 hover:bg-white/5 transition-colors ${!notification.leida ? 'bg-primary-500/5' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-white/5">
                      {getTypeIcon(notification.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-medium ${!notification.leida ? 'text-white' : 'text-gray-400'}`}>
                          {notification.titulo}
                        </h4>
                        {!notification.leida && (
                          <span className="w-2 h-2 rounded-full bg-primary-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{notification.mensaje}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500">{formatDate(notification.fecha_creacion)}</span>
                        {notification.categoria && (
                          <span className="badge bg-white/5 text-gray-400 border-white/10">
                            {notification.categoria}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.leida && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => markAsRead(notification.id)}
                          className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          title="Marcar como leída"
                        >
                          <Check className="w-4 h-4" />
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Eliminar"
                      >
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

export default Notificaciones;
