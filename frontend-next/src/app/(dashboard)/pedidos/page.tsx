'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, RefreshCw, Clock, CheckCircle, XCircle, Loader2, Eye, Plus, X,
  ArrowUp, ArrowDown, Minus, Radio, Heart, Sparkles, Bot,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { usePedidosSmartRefresh } from '@/hooks/useSmartRefresh';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { Pedido } from '@/types';

export default function PedidosPage() {
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
  const [creatingPedido, setCreatingPedido] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const { isConnected: isSocketConnected } = useSocket();

  const loadPedidos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getPedidos(page, 20, searchTerm, estadoFilter !== 'all' ? estadoFilter : undefined, prioridadFilter !== 'all' ? prioridadFilter : undefined);
      setPedidos(response?.pedidos || response?.data || []);
      setPagination(response?.pagination);
    } catch (err) {
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, estadoFilter, prioridadFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.getPedidoStats();
      setStats(response);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, []);

  // Usar smart refresh para pedidos
  const { isRefreshing, manualRefresh, isSocketConnected: smartRefreshConnected } = usePedidosSmartRefresh(
    useCallback(async () => {
      await Promise.all([loadPedidos(), loadStats()]);
    }, [loadPedidos, loadStats])
  );

  useEffect(() => {
    loadPedidos();
    loadStats();
  }, [loadPedidos, loadStats]);

  const updateEstado = async (id: number, estado: string) => {
    try {
      await api.updatePedido(id, { estado } as any);
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: estado as any } : p));
      
      // Crear notificación automática
      const pedido = pedidos.find(p => p.id === id);
      await api.createNotification({
        title: `Pedido ${estado.replace('_', ' ')}`,
        message: `El pedido "${pedido?.titulo}" ha cambiado a estado: ${estado.replace('_', ' ')}`,
        type: estado === 'completado' ? 'success' : estado === 'cancelado' ? 'error' : 'info',
        category: 'pedidos'
      });
      
      toast.success(`Pedido actualizado a ${estado}`);
      loadStats();
    } catch (err) {
      toast.error('Error al actualizar pedido');
    }
  };

  const voteForPedido = async (id: number) => {
    try {
      // Usar API real de votos
      const response = await api.votePedido(id);
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, votos: response.votos || ((p as any).votos || 0) + 1 } as any : p));
      toast.success('Voto registrado');
    } catch (err) {
      toast.error('Error al votar');
    }
  };
  const createPedido = async () => {
    try {
      if (!newPedido.titulo.trim()) {
        toast.error('El título es requerido');
        return;
      }
      setCreatingPedido(true);
      const pedidoData = { ...newPedido, usuario: user?.username || 'Anónimo' };
      const result = await api.createPedido(pedidoData as any);
      
      // Crear notificación automática
      await api.createNotification({
        title: 'Nuevo Pedido Creado',
        message: `Se ha creado el pedido "${newPedido.titulo}" con prioridad ${newPedido.prioridad}`,
        type: 'info',
        category: 'pedidos'
      });
      
      toast.success('Pedido creado correctamente');
      setShowCreateModal(false);
      setNewPedido({ titulo: '', descripcion: '', tipo: 'manhwa', prioridad: 'media' });
      loadPedidos();
      loadStats();
    } catch (err) {
      toast.error('Error al crear pedido');
    } finally {
      setCreatingPedido(false);
    }
  };

  const improveWithAI = async () => {
    try {
      const titulo = newPedido.titulo.trim();
      if (!titulo) {
        toast.error('El título es requerido');
        return;
      }

      setAiProcessing(true);
      const prompt = [
        'Mejora y amplía la descripción de este pedido para que sea clara y útil.',
        'Devuelve solo el texto final (sin comillas, sin markdown).',
        '',
        `Título: ${titulo}`,
        newPedido.descripcion?.trim() ? `Descripción actual: ${newPedido.descripcion.trim()}` : '',
      ].filter(Boolean).join('\n');

      const res = await api.sendAIMessage({ message: prompt });
      const improved = String((res as any)?.response || '').trim();
      if (!improved) {
        toast.error('La IA no devolvió contenido');
        return;
      }
      setNewPedido(prev => ({ ...prev, descripcion: improved }));
      toast.success('Descripción mejorada');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error usando IA');
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
    return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
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
          {/* Indicador de conexión Socket.IO */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            smartRefreshConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            <Radio className={`w-3 h-3 ${smartRefreshConnected ? 'animate-pulse' : ''}`} />
            {smartRefreshConnected ? 'Tiempo Real' : 'Modo Fallback'}
          </div>
          
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            Nuevo Pedido
          </Button>
          <Button 
            variant="secondary" 
            icon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />} 
            onClick={manualRefresh} 
            loading={isRefreshing}
            title={smartRefreshConnected ? 'Actualización manual (automática por eventos)' : 'Actualización manual'}
          >
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </motion.div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Pedidos" value={stats?.total || 0} icon={<ShoppingCart className="w-6 h-6" />} color="primary" delay={0} />
        <StatCard title="Pendientes" value={stats?.pendientes || 0} icon={<Clock className="w-6 h-6" />} color="warning" delay={0.1} />
        <StatCard title="En Proceso" value={stats?.en_proceso || 0} icon={<Loader2 className="w-6 h-6" />} color="info" delay={0.2} />
        <StatCard title="Completados" value={stats?.completados || 0} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0.3} />
      </div>

      {/* Filters */}
      <Card animated delay={0.2} className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Buscar pedidos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadPedidos()} className="input-search w-full" />
          </div>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="md:w-40"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="en_proceso">En Proceso</SelectItem>
              <SelectItem value="completado">Completados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={prioridadFilter} onValueChange={setPrioridadFilter}>
            <SelectTrigger className="md:w-40"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Pedidos Table */}
      <Card animated delay={0.3} className="overflow-hidden">
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
                    <motion.tr key={pedido.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: index * 0.03 }}>
                      <td>
                        <div className="max-w-xs">
                          <p className="font-medium text-white truncate">{pedido.titulo}</p>
                          <p className="text-xs text-gray-500 truncate">{pedido.contenido_solicitado || (pedido as any).descripcion}</p>
                        </div>
                      </td>
                      <td>{getPrioridadBadge(pedido.prioridad)}</td>
                      <td><span className="text-gray-300">{pedido.usuario?.username || (pedido as any).usuario || '-'}</span></td>
                      <td>{getEstadoBadge(pedido.estado)}</td>
                      <td><span className="text-white font-medium">{(pedido as any).votos || 0}</span></td>
                      <td><span className="text-gray-400 text-sm">{formatDate(pedido.created_at)}</span></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setSelectedPedido(pedido)} className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors" title="Ver detalles">
                            <Eye className="w-4 h-4" />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => voteForPedido(pedido.id)} className="p-2 rounded-lg text-pink-400 hover:bg-pink-500/10 transition-colors" title="Votar pedido">
                            <Heart className="w-4 h-4" />
                          </motion.button>
                          {(isAdmin || isModerator) && pedido.estado === 'pendiente' && (
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => updateEstado(pedido.id, 'en_proceso')} className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors" title="Marcar en proceso">
                              <Loader2 className="w-4 h-4" />
                            </motion.button>
                          )}
                          {(isAdmin || isModerator) && pedido.estado === 'en_proceso' && (
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => updateEstado(pedido.id, 'completado')} className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Marcar completado">
                              <CheckCircle className="w-4 h-4" />
                            </motion.button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

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

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuevo Pedido">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Título del Pedido</label>
            <input type="text" value={newPedido.titulo} onChange={(e) => setNewPedido({ ...newPedido, titulo: e.target.value })} className="input-glass w-full" placeholder="Ej: Manhwa Solo Leveling completo" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-400">Descripción</label>
              <Button
                variant="secondary"
                size="sm"
                icon={aiProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                disabled={aiProcessing || creatingPedido || !newPedido.titulo.trim()}
                onClick={improveWithAI}
              >
                {aiProcessing ? 'Procesando...' : 'Mejorar con IA'}
              </Button>
            </div>
            <textarea value={newPedido.descripcion} onChange={(e) => setNewPedido({ ...newPedido, descripcion: e.target.value })} className="input-glass w-full h-24 resize-none" placeholder="Describe tu pedido..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Tipo de Contenido</label>
              <Select value={newPedido.tipo} onValueChange={(value) => setNewPedido({ ...newPedido, tipo: value })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manhwa">📚 Manhwa</SelectItem>
                  <SelectItem value="manga">🎌 Manga</SelectItem>
                  <SelectItem value="novela">📖 Novela</SelectItem>
                  <SelectItem value="anime">🎬 Anime</SelectItem>
                  <SelectItem value="juego">🎮 Juego</SelectItem>
                  <SelectItem value="software">💻 Software</SelectItem>
                  <SelectItem value="otro">🔧 Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Prioridad</label>
              <Select value={newPedido.prioridad} onValueChange={(value) => setNewPedido({ ...newPedido, prioridad: value })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">🟢 Baja</SelectItem>
                  <SelectItem value="media">🟡 Media</SelectItem>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {aiProcessing && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-5 h-5 text-blue-400 animate-pulse" />
                <span className="text-sm font-medium text-blue-400">IA Procesando</span>
              </div>
              <p className="text-xs text-gray-400">La IA está analizando tu pedido...</p>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button variant="primary" className="flex-1" onClick={createPedido} loading={creatingPedido} disabled={creatingPedido || aiProcessing}>
              Crear Pedido
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setShowCreateModal(false)} disabled={creatingPedido || aiProcessing}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedPedido} onClose={() => setSelectedPedido(null)} title="Detalle del Pedido">
        {selectedPedido && (
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
              <p className="text-gray-400 text-sm">{selectedPedido.contenido_solicitado || (selectedPedido as any).descripcion}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-gray-500">Usuario</p>
                <p className="text-white">{selectedPedido.usuario?.username || (selectedPedido as any).usuario || '-'}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-gray-500">Votos</p>
                <p className="text-white">{(selectedPedido as any).votos || 0}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="secondary" className="flex-1" icon={<Heart className="w-4 h-4" />} onClick={() => { voteForPedido(selectedPedido.id); setSelectedPedido(null); }}>
                Votar ({(selectedPedido as any).votos || 0})
              </Button>
              {(isAdmin || isModerator) && selectedPedido.estado === 'pendiente' && (
                <Button variant="primary" className="flex-1" onClick={() => { updateEstado(selectedPedido.id, 'en_proceso'); setSelectedPedido(null); }}>
                  Iniciar Proceso
                </Button>
              )}
              {(isAdmin || isModerator) && selectedPedido.estado === 'en_proceso' && (
                <Button variant="primary" className="flex-1" onClick={() => { updateEstado(selectedPedido.id, 'completado'); setSelectedPedido(null); }}>
                  Completar
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
