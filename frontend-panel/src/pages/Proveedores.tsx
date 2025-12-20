import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Search,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Star,
  Activity,
  Users,
  Trash2
} from 'lucide-react';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton, IconButton } from '../components/ui/AnimatedButton';

interface Proveedor {
  id: number;
  jid: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  estado: 'activo' | 'inactivo' | 'suspendido';
  contacto: string;
  telefono?: string;
  email?: string;
  website?: string;
  fecha_registro: string;
  fecha_actualizacion?: string;
  total_aportes: number;
  total_pedidos: number;
  rating: number;
  grupo_id?: number;
  grupo_nombre?: string;
  grupos_monitoreados?: string[];
  generos_captura?: string[];
  tipos_archivo?: string[];
  auto_procesar_pedidos?: boolean;
}

interface ProveedorStats {
  total: number;
  activos: number;
  inactivos: number;
  suspendidos: number;
}

interface Grupo {
  id: number;
  wa_jid: string;
  nombre: string;
  descripcion: string;
  es_proveedor: boolean;
}

const Proveedores: React.FC = () => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [stats, setStats] = useState<ProveedorStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newProveedor, setNewProveedor] = useState<Partial<Proveedor>>({});

  useEffect(() => {
    loadProveedores();
    loadStats();
    loadGrupos();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadProveedores = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/proveedores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProveedores(data || []);
        setError(null);
      } else {
        setError('Error al cargar proveedores');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const loadGrupos = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Loading grupos from /api/grupos/available...');
      const response = await fetch('/api/grupos/available', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Grupos data received:', data);
        setGrupos(data?.grupos || []);
        
        // Si no hay grupos, mostrar mensaje informativo
        if (!data?.grupos || data.grupos.length === 0) {
          setError('No hay grupos disponibles. Asegúrate de que el bot esté conectado a WhatsApp y sincroniza los grupos desde la página de Grupos.');
        } else {
          setError(null); // Limpiar error si hay grupos
        }
      } else {
        console.error('Error response:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error data:', errorData);
        setError(`Error al cargar grupos: ${response.status} - ${errorData.error || 'Error desconocido'}`);
      }
    } catch (err) {
      console.error('Error loading grupos:', err);
      setError('Error de conexión al cargar grupos. Verifica que el servidor esté funcionando.');
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/proveedores/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const createProveedor = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/proveedores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newProveedor)
      });

      if (response.ok) {
        const createdProveedor = await response.json();
        setProveedores(prev => [createdProveedor, ...prev]);
        setSuccess('Proveedor creado correctamente');
        setShowCreateModal(false);
        setNewProveedor({});
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al crear proveedor');
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const updateProveedorStatus = async (jid: string, estado: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/proveedores/${jid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estado })
      });

      if (response.ok) {
        setProveedores(prev => prev.map(proveedor =>
          proveedor.jid === jid ? { ...proveedor, estado: estado as 'activo' | 'inactivo' | 'suspendido' } : proveedor
        ));
        setSuccess('Estado actualizado correctamente');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al actualizar estado');
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const updateProveedorConfig = async (jid: string, config: Partial<Proveedor>) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/proveedores/${jid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        setProveedores(prev => prev.map(proveedor =>
          proveedor.jid === jid ? { ...proveedor, ...config } : proveedor
        ));
        setSuccess('Configuración actualizada correctamente');
        setShowConfigModal(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al actualizar configuración');
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const deleteProveedor = async (jid: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proveedor?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/proveedores/${jid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setProveedores(prev => prev.filter(proveedor => proveedor.jid !== jid));
        setSuccess('Proveedor eliminado correctamente');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al eliminar proveedor');
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'activo': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'inactivo': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'suspendido': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTypeColor = (tipo: string) => {
    switch (tipo) {
      case 'manhwa': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
      case 'manga': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'anime': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'novela': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const filteredProveedores = proveedores.filter(proveedor => {
    const matchesSearch = proveedor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         proveedor.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         proveedor.contacto.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || proveedor.tipo === typeFilter;
    const matchesStatus = statusFilter === 'all' || proveedor.estado === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

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
              <div className="p-2 bg-purple-500/20 rounded-xl">
                <Building2 className="w-8 h-8 text-purple-400" />
              </div>
              Gestión de Proveedores
            </h1>
            <p className="text-gray-400 mt-2">Administra los proveedores de contenido</p>
          </div>
          <div className="flex items-center gap-3">
            <AnimatedButton
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
            >
              Nuevo Proveedor
            </AnimatedButton>
            <AnimatedButton
              onClick={loadProveedores}
              variant="secondary"
              loading={loading}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Actualizar
            </AnimatedButton>
          </div>
        </motion.div>

        {/* Alertas */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-4 border-red-500/30 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                <XCircle className="w-4 h-4" />
              </button>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-4 border-emerald-500/30 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Proveedores"
            value={stats?.total || 0}
            icon={<Building2 className="w-6 h-6" />}
            color="violet"
            delay={0}
          />
          <StatCard
            title="Activos"
            value={stats?.activos || 0}
            icon={<CheckCircle className="w-6 h-6" />}
            color="success"
            delay={0.1}
          />
          <StatCard
            title="Inactivos"
            value={stats?.inactivos || 0}
            icon={<Clock className="w-6 h-6" />}
            color="warning"
            delay={0.2}
          />
          <StatCard
            title="Suspendidos"
            value={stats?.suspendidos || 0}
            icon={<XCircle className="w-6 h-6" />}
            color="danger"
            delay={0.3}
          />
        </div>

        {/* Filtros */}
        <AnimatedCard delay={0.2} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar proveedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:border-purple-500/50 transition-all"
            >
              <option value="all">Todos los tipos</option>
              <option value="manhwa">Manhwa</option>
              <option value="manga">Manga</option>
              <option value="anime">Anime</option>
              <option value="novela">Novela</option>
              <option value="general">General</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:border-purple-500/50 transition-all"
            >
              <option value="all">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>
        </AnimatedCard>

        {/* Lista */}
        <AnimatedCard delay={0.3} className="overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">Lista de Proveedores</h2>
            <p className="text-gray-400 mt-1">{filteredProveedores.length} de {proveedores.length} proveedores</p>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Cargando proveedores...</p>
            </div>
          ) : filteredProveedores.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No hay proveedores</h3>
              <p className="text-gray-400">No se encontraron proveedores con los filtros aplicados</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredProveedores.map((proveedor, index) => (
                <motion.div
                  key={proveedor.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{proveedor.nombre}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(proveedor.estado)}`}>
                          {proveedor.estado.charAt(0).toUpperCase() + proveedor.estado.slice(1)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(proveedor.tipo)}`}>
                          {proveedor.tipo.charAt(0).toUpperCase() + proveedor.tipo.slice(1)}
                        </span>
                        <div className="flex items-center gap-1 text-amber-400">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="text-sm">{proveedor.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <p className="text-gray-400 mb-3 line-clamp-2">{proveedor.descripcion}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {proveedor.contacto}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(proveedor.fecha_registro)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="w-4 h-4" />
                          {proveedor.total_aportes} aportes
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          {proveedor.total_pedidos} pedidos
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <IconButton
                        icon={<Eye className="w-4 h-4" />}
                        onClick={() => { setSelectedProveedor(proveedor); setShowViewModal(true); }}
                        variant="ghost"
                        tooltip="Ver detalles"
                      />
                      <IconButton
                        icon={<Users className="w-4 h-4" />}
                        onClick={() => { setSelectedProveedor(proveedor); setShowConfigModal(true); }}
                        variant="ghost"
                        tooltip="Configurar grupos"
                      />
                      {proveedor.estado === 'activo' ? (
                        <IconButton
                          icon={<XCircle className="w-4 h-4" />}
                          onClick={() => updateProveedorStatus(proveedor.jid, 'suspendido')}
                          variant="ghost"
                          tooltip="Suspender"
                        />
                      ) : (
                        <IconButton
                          icon={<CheckCircle className="w-4 h-4" />}
                          onClick={() => updateProveedorStatus(proveedor.jid, 'activo')}
                          variant="ghost"
                          tooltip="Activar"
                        />
                      )}
                      <IconButton
                        icon={<Trash2 className="w-4 h-4" />}
                        onClick={() => deleteProveedor(proveedor.jid)}
                        variant="danger"
                        tooltip="Eliminar"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatedCard>

        {/* Modal Ver */}
        <AnimatePresence>
          {showViewModal && selectedProveedor && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowViewModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold text-white mb-6">{selectedProveedor.nombre}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400">Estado</label>
                      <span className={`mt-1 inline-flex px-3 py-1 rounded-full text-sm border ${getStatusColor(selectedProveedor.estado)}`}>
                        {selectedProveedor.estado}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Tipo</label>
                      <span className={`mt-1 inline-flex px-3 py-1 rounded-full text-sm border ${getTypeColor(selectedProveedor.tipo)}`}>
                        {selectedProveedor.tipo}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Descripción</label>
                    <p className="mt-1 text-white bg-white/5 p-3 rounded-xl">{selectedProveedor.descripcion}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400">Contacto</label>
                      <p className="mt-1 text-white">{selectedProveedor.contacto}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Rating</label>
                      <div className="mt-1 flex items-center gap-1 text-amber-400">
                        <Star className="w-5 h-5 fill-current" />
                        <span className="text-white">{selectedProveedor.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Total Aportes</label>
                      <p className="mt-1 text-white">{selectedProveedor.total_aportes}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Total Pedidos</label>
                      <p className="mt-1 text-white">{selectedProveedor.total_pedidos}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <AnimatedButton onClick={() => setShowViewModal(false)} variant="secondary">
                    Cerrar
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Crear */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-md"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold text-white mb-6">Crear Nuevo Proveedor</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Nombre</label>
                    <input
                      type="text"
                      value={newProveedor.nombre || ''}
                      onChange={(e) => setNewProveedor(prev => ({ ...prev, nombre: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 transition-all"
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Descripción</label>
                    <textarea
                      value={newProveedor.descripcion || ''}
                      onChange={(e) => setNewProveedor(prev => ({ ...prev, descripcion: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 transition-all"
                      rows={3}
                      placeholder="Descripción"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Tipo</label>
                    <select
                      value={newProveedor.tipo || ''}
                      onChange={(e) => setNewProveedor(prev => ({ ...prev, tipo: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:border-purple-500/50 transition-all"
                    >
                      <option value="">Seleccionar tipo</option>
                      <option value="manhwa">Manhwa</option>
                      <option value="manga">Manga</option>
                      <option value="anime">Anime</option>
                      <option value="novela">Novela</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Contacto</label>
                    <input
                      type="text"
                      value={newProveedor.contacto || ''}
                      onChange={(e) => setNewProveedor(prev => ({ ...prev, contacto: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 transition-all"
                      placeholder="Contacto"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">JID (WhatsApp)</label>
                    <input
                      type="text"
                      value={newProveedor.jid || ''}
                      onChange={(e) => setNewProveedor(prev => ({ ...prev, jid: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 transition-all"
                      placeholder="jid@c.us"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <AnimatedButton onClick={createProveedor} variant="primary" fullWidth>
                    Crear
                  </AnimatedButton>
                  <AnimatedButton onClick={() => { setShowCreateModal(false); setNewProveedor({}); }} variant="secondary" fullWidth>
                    Cancelar
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Configurar Grupos */}
        <AnimatePresence>
          {showConfigModal && selectedProveedor && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowConfigModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">
                    Configurar Captura de Media - {selectedProveedor.nombre}
                  </h3>
                  <button
                    onClick={loadGrupos}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Recargar grupos"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-6">
                  {/* Grupos Monitoreados */}
                  <div>
                    <label className="text-sm text-gray-400 mb-3 block">Grupos a Monitorear</label>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto bg-white/5 p-4 rounded-xl border border-white/10">
                      {grupos.length === 0 ? (
                        <div className="text-center py-8">
                          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                          <p className="text-gray-400 mb-2">No hay grupos disponibles</p>
                          <p className="text-xs text-gray-500 mb-4">
                            Asegúrate de que el bot esté conectado a WhatsApp y tenga grupos activos
                          </p>
                          <div className="space-y-2">
                            <button
                              onClick={loadGrupos}
                              className="block mx-auto px-3 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                            >
                              Recargar Grupos
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem('token');
                                  const response = await fetch('/api/grupos/sync', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ clearOld: false })
                                  });
                                  
                                  if (response.ok) {
                                    setSuccess('Grupos sincronizados exitosamente');
                                    loadGrupos();
                                  } else {
                                    const errorData = await response.json();
                                    setError(errorData.error || 'Error al sincronizar grupos');
                                  }
                                } catch (err) {
                                  setError('Error de conexión al sincronizar grupos');
                                }
                              }}
                              className="block mx-auto px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                            >
                              Sincronizar desde WhatsApp
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem('token');
                                  const response = await fetch('/api/grupos/debug', {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                  });
                                  
                                  if (response.ok) {
                                    const debugData = await response.json();
                                    console.log('Debug data:', debugData);
                                    alert(`Debug Info:
Connection: ${debugData.connection.hasConnection ? 'OK' : 'NO'}
Status: ${debugData.connection.connectionStatus}
Groups from WhatsApp: ${debugData.groups.fromWhatsApp}
Groups in DB: ${debugData.groups.inDatabase}
User JID: ${debugData.connection.userJid || 'None'}`);
                                  }
                                } catch (err) {
                                  console.error('Debug error:', err);
                                }
                              }}
                              className="block mx-auto px-3 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                            >
                              Debug Conexión
                            </button>
                          </div>
                        </div>
                      ) : (
                        grupos.map((grupo) => (
                          <label key={grupo.wa_jid} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedProveedor.grupos_monitoreados?.includes(grupo.wa_jid) || false}
                              onChange={(e) => {
                                const grupos_monitoreados = selectedProveedor.grupos_monitoreados || [];
                                if (e.target.checked) {
                                  setSelectedProveedor({
                                    ...selectedProveedor,
                                    grupos_monitoreados: [...grupos_monitoreados, grupo.wa_jid]
                                  });
                                } else {
                                  setSelectedProveedor({
                                    ...selectedProveedor,
                                    grupos_monitoreados: grupos_monitoreados.filter(g => g !== grupo.wa_jid)
                                  });
                                }
                              }}
                              className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 rounded focus:ring-purple-500/50"
                            />
                            <div className="flex-1">
                              <div className="text-white font-medium">{grupo.nombre}</div>
                              <div className="text-xs text-gray-500">{grupo.wa_jid.split('@')[0]}</div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Géneros de Captura */}
                  <div>
                    <label className="text-sm text-gray-400 mb-3 block">Géneros a Capturar</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {['BL', 'GL', 'Romance', 'Acción', 'Drama', 'Comedia', 'Horror', 'Fantasía', 'Sci-Fi', 'Slice of Life'].map((genero) => (
                        <label key={genero} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                          <input
                            type="checkbox"
                            checked={selectedProveedor.generos_captura?.includes(genero) || false}
                            onChange={(e) => {
                              const generos_captura = selectedProveedor.generos_captura || [];
                              if (e.target.checked) {
                                setSelectedProveedor({
                                  ...selectedProveedor,
                                  generos_captura: [...generos_captura, genero]
                                });
                              } else {
                                setSelectedProveedor({
                                  ...selectedProveedor,
                                  generos_captura: generos_captura.filter(g => g !== genero)
                                });
                              }
                            }}
                            className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 rounded focus:ring-purple-500/50"
                          />
                          <span className="text-sm text-white">{genero}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Tipos de Archivo */}
                  <div>
                    <label className="text-sm text-gray-400 mb-3 block">Tipos de Archivo a Capturar</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['PDF', 'EPUB', 'CBZ', 'CBR', 'ZIP', 'RAR', 'JPG', 'PNG'].map((tipo) => (
                        <label key={tipo} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                          <input
                            type="checkbox"
                            checked={selectedProveedor.tipos_archivo?.includes(tipo) || false}
                            onChange={(e) => {
                              const tipos_archivo = selectedProveedor.tipos_archivo || [];
                              if (e.target.checked) {
                                setSelectedProveedor({
                                  ...selectedProveedor,
                                  tipos_archivo: [...tipos_archivo, tipo]
                                });
                              } else {
                                setSelectedProveedor({
                                  ...selectedProveedor,
                                  tipos_archivo: tipos_archivo.filter(t => t !== tipo)
                                });
                              }
                            }}
                            className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 rounded focus:ring-purple-500/50"
                          />
                          <span className="text-sm text-white">{tipo}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Auto-procesar Pedidos */}
                  <div>
                    <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10">
                      <input
                        type="checkbox"
                        checked={selectedProveedor.auto_procesar_pedidos || false}
                        onChange={(e) => {
                          setSelectedProveedor({
                            ...selectedProveedor,
                            auto_procesar_pedidos: e.target.checked
                          });
                        }}
                        className="w-5 h-5 text-purple-500 bg-white/10 border-white/20 rounded focus:ring-purple-500/50"
                      />
                      <div>
                        <div className="text-white font-medium">Auto-procesar Pedidos</div>
                        <div className="text-sm text-gray-400">
                          Marcar automáticamente como "procesado" los pedidos cuando se encuentre contenido coincidente
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <AnimatedButton 
                    onClick={() => updateProveedorConfig(selectedProveedor.jid, {
                      grupos_monitoreados: selectedProveedor.grupos_monitoreados,
                      generos_captura: selectedProveedor.generos_captura,
                      tipos_archivo: selectedProveedor.tipos_archivo,
                      auto_procesar_pedidos: selectedProveedor.auto_procesar_pedidos
                    })} 
                    variant="primary" 
                    fullWidth
                  >
                    Guardar Configuración
                  </AnimatedButton>
                  <AnimatedButton 
                    onClick={() => setShowConfigModal(false)} 
                    variant="secondary" 
                    fullWidth
                  >
                    Cancelar
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

export default Proveedores;
