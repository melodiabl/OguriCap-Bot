import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  Minus,
  Radio,
  Zap,
  Bot,
  Sparkles,
  FileText,
  Heart,
} from 'lucide-react';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { AnimatedTableRow } from '../components/ui/AnimatedList';
import { useSocketPedidos } from '../hooks/useSocketEvents';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import toast from 'react-hot-toast';
import api from '../config/api';

interface Pedido {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: string;
  estado: 'pendiente' | 'en_proceso' | 'completado' | 'cancelado';
  prioridad: 'baja' | 'media' | 'alta';
  usuario: string;
  fecha_creacion: string;
  votos: number;
  grupo_nombre?: string;
}

const Pedidos: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin, isModerator } = usePermissions();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [prioridadFilter, setPrioridadFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPedido, setNewPedido] = useState({ titulo: '', descripcion: '', tipo: 'manhwa', prioridad: 'media' });
  const [stats, setStats] = useState<any>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [showMyPedidos, setShowMyPedidos] = useState(false);

  // Socket.IO para actualizaciones en tiempo real
  const { isConnected: isSocketConnected } = useSocket();
  useSocketPedidos();

  useEffect(() => {
    loadPedidos();
    loadStats();
  }, [page, estadoFilter, prioridadFilter]);

  const loadPedidos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (searchTerm) params.append('search', searchTerm);
      if (estadoFilter !== 'all') params.append('estado', estadoFilter);
      if (prioridadFilter !== 'all') params.append('prioridad', prioridadFilter);
      if (showMyPedidos && user) params.append('usuario', user.username);

      const response = await api.get(`/api/pedidos?${params}`);
      setPedidos(response.data?.pedidos || []);
      setPagination(response.data?.pagination);
    } catch (err) {
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/api/pedidos/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Error loading stats');
    }
  };

  const updateEstado = async (id: number, estado: string) => {
    try {
      await api.patch(`/api/pedidos/${id}`, { estado });
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: estado as any } : p));
      toast.success(`Pedido actualizado a ${estado}`);
      loadStats();
    } catch (err) {
      toast.error('Error al actualizar pedido');
    }
  };

  const createPedido = async () => {
    try {
      if (!newPedido.titulo.trim()) {
        toast.error('El título es requerido');
        return;
      }
      
      setAiProcessing(true);
      
      // Agregar usuario actual al pedido
      const pedidoData = {
        ...newPedido,
        usuario: user?.username || 'Anónimo'
      };
      
      await api.post('/api/pedidos', pedidoData);
      toast.success('Pedido creado correctamente');
      setShowCreateModal(false);
      setNewPedido({ titulo: '', descripcion: '', tipo: 'manhwa', prioridad: 'media' });
      loadPedidos();
      loadStats();
    } catch (err) {
      toast.error('Error al crear pedido');
    } finally {
      setAiProcessing(false);
    }
  };

  const votePedido = async (id: number) => {
    try {
      await api.post(`/api/pedidos/${id}/vote`);
      setPedidos(prev => prev.map(p => 
        p.id === id ? { ...p, votos: (p.votos || 0) + 1 } : p
      ));
      toast.success('Voto registrado');
    } catch (err) {
      toast.error('Error al votar');
    }
  };

  const enhanceWithAI = async () => {
    if (!newPedido.titulo.trim()) {
      toast.error('Ingresa un título primero');
      return;
    }

    setAiProcessing(true);
    try {
      const response = await api.post('/api/ai/enhance-pedido', {
        titulo: newPedido.titulo,
        descripcion: newPedido.descripcion,
        tipo: newPedido.tipo
      });

      if (response.data.success) {
        setNewPedido(prev => ({
          ...prev,
          descripcion: response.data.descripcion,
          tipo: response.data.tipo || prev.tipo
        }));
        toast.success('Descripción mejorada con IA');
      }
    } catch (err) {
      toast.error('Error al procesar con IA');
    } finally {
      setAiProcessing(false);
    }
  };

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { class: string; icon: React.ReactNode }> = {
      pendiente: { class: 'badge-warning', icon: <Clock className="w-3 h-3" /> },
      en_proceso: { class: 'badge-info', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
      completado: { class: 'badge-success', icon: <CheckCircle className="w-3 h-3" /> },
      cancelado: { class: 'badge-danger', icon: <XCircle className="w-3 h-3" /> },
    };
    const c = config[estado] || config.pendiente;
    return (
      <span className={`badge ${c.class}`}>
        {c.icon}
        <span className="ml-1">{estado.replace('_', ' ').charAt(0).toUpperCase() + estado.slice(1).replace('_', ' ')}</span>
      </span>
    );
  };

  const getPrioridadBadge = (prioridad: string) => {
    const config: Record<string, { class: string; icon: React.ReactNode }> = {
      alta: { class: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <ArrowUp className="w-3 h-3" /> },
      media: { class: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: <Minus className="w-3 h-3" /> },
      baja: { class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <ArrowDown className="w-3 h-3" /> },
    };
    const c = config[prioridad] || config.media;
    return (
      <span className={`badge border ${c.class}`}>
        {c.icon}
        <span className="ml-1 capitalize">{prioridad}</span>
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">Gestión de Pedidos</h1>
          <p className="text-gray-400 mt-1">Administra las solicitudes de la comunidad</p>
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
          
          {/* Toggle Mis Pedidos */}
          <AnimatedButton 
            variant={showMyPedidos ? "primary" : "secondary"} 
            size="sm"
            onClick={() => setShowMyPedidos(!showMyPedidos)}
          >
            {showMyPedidos ? 'Todos' : 'Mis Pedidos'}
          </AnimatedButton>
          
          <AnimatedButton variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            Nuevo Pedido
          </AnimatedButton>
          <AnimatedButton variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={loadPedidos} loading={loading}>
            Actualizar
          </AnimatedButton>
        </motion.div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Pedidos"
          value={stats?.total || 0}
          icon={<ShoppingCart className="w-6 h-6" />}
          color="primary"
          delay={0}
        />
        <StatCard
          title="Pendientes"
          value={stats?.pendientes || 0}
          icon={<Clock className="w-6 h-6" />}
          color="warning"
          delay={0.1}
        />
        <StatCard
          title="En Proceso"
          value={stats?.en_proceso || 0}
          icon={<Loader2 className="w-6 h-6" />}
          color="info"
          delay={0.2}
        />
        <StatCard
          title="Completados"
          value={stats?.completados || 0}
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
              placeholder="Buscar pedidos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPedidos()}
              className="input-search w-full"
            />
          </div>
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="input-glass md:w-40">
            <option value="all">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="en_proceso">En Proceso</option>
            <option value="completado">Completados</option>
            <option value="cancelado">Cancelados</option>
          </select>
          <select value={prioridadFilter} onChange={(e) => setPrioridadFilter(e.target.value)} className="input-glass md:w-40">
            <option value="all">Todas</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
      </AnimatedCard>

      {/* Pedidos Table */}
      <AnimatedCard delay={0.3} className="overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Lista de Pedidos</h2>
          <p className="text-gray-400 text-sm mt-1">{pedidos.length} pedidos mostrados</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Cargando pedidos...</p>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No hay pedidos</h3>
            <p className="text-gray-400">No se encontraron pedidos con los filtros aplicados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-glass w-full">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Prioridad</th>
                  <th>Usuario</th>
                  <th>Estado</th>
                  <th>Votos</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {pedidos.map((pedido, index) => (
                    <AnimatedTableRow key={pedido.id} index={index}>
                      <td>
                        <div className="max-w-xs">
                          <p className="font-medium text-white truncate">{pedido.titulo}</p>
                          <p className="text-xs text-gray-500 truncate">{pedido.descripcion}</p>
                        </div>
                      </td>
                      <td>{getPrioridadBadge(pedido.prioridad)}</td>
                      <td>
                        <span className="text-gray-300">{pedido.usuario || '-'}</span>
                      </td>
                      <td>{getEstadoBadge(pedido.estado)}</td>
                      <td>
                        <span className="text-white font-medium">{pedido.votos || 0}</span>
                      </td>
                      <td>
                        <span className="text-gray-400 text-sm">{formatDate(pedido.fecha_creacion)}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setSelectedPedido(pedido)}
                            className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </motion.button>
                          
                          {/* Botón de votar para todos los usuarios */}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => votePedido(pedido.id)}
                            className="p-2 rounded-lg text-pink-400 hover:bg-pink-500/10 transition-colors"
                            title="Votar pedido"
                          >
                            <Heart className="w-4 h-4" />
                          </motion.button>
                          
                          {/* Acciones de gestión solo para admins/moderadores */}
                          {(isAdmin || isModerator) && pedido.estado === 'pendiente' && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateEstado(pedido.id, 'en_proceso')}
                              className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors"
                              title="Marcar en proceso"
                            >
                              <Loader2 className="w-4 h-4" />
                            </motion.button>
                          )}
                          {(isAdmin || isModerator) && pedido.estado === 'en_proceso' && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateEstado(pedido.id, 'completado')}
                              className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              title="Marcar completado"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </motion.button>
                          )}
                        </div>
                      </td>
                    </AnimatedTableRow>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
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

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="modal-content p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Nuevo Pedido</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Título del Pedido</label>
                  <input
                    type="text"
                    value={newPedido.titulo}
                    onChange={(e) => setNewPedido({ ...newPedido, titulo: e.target.value })}
                    className="input-glass w-full"
                    placeholder="Ej: Manhwa Solo Leveling completo"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-400">Descripción</label>
                    <AnimatedButton
                      variant="secondary"
                      size="sm"
                      icon={aiProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      onClick={enhanceWithAI}
                      disabled={aiProcessing || !newPedido.titulo.trim()}
                    >
                      {aiProcessing ? 'Procesando...' : 'Mejorar con IA'}
                    </AnimatedButton>
                  </div>
                  <textarea
                    value={newPedido.descripcion}
                    onChange={(e) => setNewPedido({ ...newPedido, descripcion: e.target.value })}
                    className="input-glass w-full h-24 resize-none"
                    placeholder="Describe tu pedido... (o usa IA para generar automáticamente)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Tip: La IA puede generar una descripción detallada basada en el título
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Tipo de Contenido</label>
                    <select
                      value={newPedido.tipo}
                      onChange={(e) => setNewPedido({ ...newPedido, tipo: e.target.value })}
                      className="input-glass w-full"
                    >
                      <option value="manhwa">📚 Manhwa</option>
                      <option value="manga">🎌 Manga</option>
                      <option value="novela">📖 Novela</option>
                      <option value="anime">🎬 Anime</option>
                      <option value="juego">🎮 Juego</option>
                      <option value="software">💻 Software</option>
                      <option value="otro">🔧 Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Prioridad</label>
                    <select
                      value={newPedido.prioridad}
                      onChange={(e) => setNewPedido({ ...newPedido, prioridad: e.target.value })}
                      className="input-glass w-full"
                    >
                      <option value="baja">🟢 Baja - Cuando sea posible</option>
                      <option value="media">🟡 Media - Prioridad normal</option>
                      <option value="alta">🔴 Alta - Urgente</option>
                    </select>
                  </div>
                </div>

                {/* AI Enhancement Info */}
                {aiProcessing && (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-5 h-5 text-blue-400 animate-pulse" />
                      <span className="text-sm font-medium text-blue-400">IA Procesando</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      La IA está analizando tu pedido para generar una descripción detallada...
                    </p>
                  </div>
                )}

                {/* Tips for users */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Consejos para un buen pedido</span>
                  </div>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>• Sé específico con el título (nombre completo, autor, etc.)</li>
                    <li>• Indica el idioma preferido si es relevante</li>
                    <li>• Menciona si buscas una versión específica o formato</li>
                    <li>• La IA puede ayudarte a mejorar la descripción automáticamente</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-3">
                <AnimatedButton variant="primary" fullWidth onClick={createPedido}>
                  Crear Pedido
                </AnimatedButton>
                <AnimatedButton variant="secondary" fullWidth onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </AnimatedButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPedido && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setSelectedPedido(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="modal-content p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Detalle del Pedido</h3>
                <button onClick={() => setSelectedPedido(null)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Estado</span>
                  {getEstadoBadge(selectedPedido.estado)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Prioridad</span>
                  {getPrioridadBadge(selectedPedido.prioridad)}
                </div>

                <div className="p-4 rounded-xl bg-white/5">
                  <h4 className="font-medium text-white mb-2">{selectedPedido.titulo}</h4>
                  <p className="text-gray-400 text-sm">{selectedPedido.descripcion}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-gray-500">Usuario</p>
                    <p className="text-white">{selectedPedido.usuario || '-'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-gray-500">Votos</p>
                    <p className="text-white">{selectedPedido.votos || 0}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  {/* Botón de votar para todos */}
                  <AnimatedButton
                    variant="secondary"
                    fullWidth
                    icon={<Heart className="w-4 h-4" />}
                    onClick={() => {
                      votePedido(selectedPedido.id);
                      setSelectedPedido(null);
                    }}
                  >
                    Votar ({selectedPedido.votos || 0})
                  </AnimatedButton>

                  {/* Acciones de gestión solo para admins/moderadores */}
                  {(isAdmin || isModerator) && selectedPedido.estado === 'pendiente' && (
                    <AnimatedButton
                      variant="primary"
                      fullWidth
                      onClick={() => {
                        updateEstado(selectedPedido.id, 'en_proceso');
                        setSelectedPedido(null);
                      }}
                    >
                      Iniciar Proceso
                    </AnimatedButton>
                  )}
                  {(isAdmin || isModerator) && selectedPedido.estado === 'en_proceso' && (
                    <AnimatedButton
                      variant="success"
                      fullWidth
                      onClick={() => {
                        updateEstado(selectedPedido.id, 'completado');
                        setSelectedPedido(null);
                      }}
                    >
                      Marcar Completado
                    </AnimatedButton>
                  )}
                  {(isAdmin || isModerator) && (selectedPedido.estado === 'pendiente' || selectedPedido.estado === 'en_proceso') && (
                    <AnimatedButton
                      variant="danger"
                      fullWidth
                      onClick={() => {
                        updateEstado(selectedPedido.id, 'cancelado');
                        setSelectedPedido(null);
                      }}
                    >
                      Cancelar
                    </AnimatedButton>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Pedidos;
