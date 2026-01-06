'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, RefreshCw, CheckCircle, XCircle, Clock, Eye, ThumbsUp, ThumbsDown,
  FileText, Image as ImageIcon, Video, Music, Radio, Plus, Upload, File, Trash2,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useSocketConnection } from '@/contexts/SocketContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAportesSmartRefresh } from '@/hooks/useSmartRefresh';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { Aporte } from '@/types';

export default function AportesPage() {
  const { isModerator: isModeratorFn } = usePermissions();
  const canModerate = isModeratorFn();
  const [aportes, setAportes] = useState<Aporte[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [selectedAporte, setSelectedAporte] = useState<Aporte | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAporte, setNewAporte] = useState({ titulo: '', descripcion: '', tipo: 'documento', contenido: '' });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isConnected: isSocketConnected } = useSocketConnection();
  const [deleteTarget, setDeleteTarget] = useState<Aporte | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAportes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getAportes(page, 20, searchTerm, estadoFilter !== 'all' ? estadoFilter : undefined, undefined, tipoFilter !== 'all' ? tipoFilter : undefined);
      setAportes(response?.aportes || response?.data || []);
      setPagination(response?.pagination);
    } catch (err) {
      toast.error('Error al cargar aportes');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, estadoFilter, tipoFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.getAporteStats();
      setStats(response);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, []);

  // Usar smart refresh para aportes
  const { isRefreshing, manualRefresh, isSocketConnected: smartRefreshConnected } = useAportesSmartRefresh(
    useCallback(async () => {
      await Promise.all([loadAportes(), loadStats()]);
    }, [loadAportes, loadStats])
  );

  useEffect(() => {
    loadAportes();
    loadStats();
  }, [loadAportes, loadStats]);

  const updateEstado = async (id: number, estado: string, motivo?: string) => {
    if (!canModerate) {
      toast.error('Permisos insuficientes');
      return;
    }
    try {
      await api.approveAporte(id, estado, motivo);
      setAportes(prev => prev.map(a => a.id === id ? { ...a, estado: estado as any } : a));
      
      // Crear notificación automática
      const aporte = aportes.find(a => a.id === id);
      await api.createNotification({
        title: `Aporte ${estado}`,
        message: `El aporte "${aporte?.titulo}" ha sido ${estado}${motivo ? `: ${motivo}` : ''}`,
        type: estado === 'aprobado' ? 'success' : estado === 'rechazado' ? 'error' : 'info',
        category: 'aportes'
      });
      
      toast.success(`Aporte ${estado}`);
      setSelectedAporte(null);
      loadStats();
    } catch (err) {
      toast.error('Error al actualizar estado');
    }
  };

  const deleteAporte = async (aporte: Aporte) => {
    if (!canModerate) {
      toast.error('Permisos insuficientes');
      return;
    }
    try {
      setDeleting(true);
      await api.deleteAporte(aporte.id);
      toast.success('Aporte eliminado');
      setAportes(prev => prev.filter(a => a.id !== aporte.id));
      if (selectedAporte?.id === aporte.id) setSelectedAporte(null);
      setDeleteTarget(null);
      loadStats();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al eliminar aporte');
    } finally {
      setDeleting(false);
    }
  };

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { class: string; icon: React.ReactNode }> = {
      pendiente: { class: 'badge-warning', icon: <Clock className="w-3 h-3" /> },
      aprobado: { class: 'badge-success', icon: <CheckCircle className="w-3 h-3" /> },
      rechazado: { class: 'badge-danger', icon: <XCircle className="w-3 h-3" /> },
    };
    const c = config[estado] || config.pendiente;
    return (
      <span className={`badge ${c.class}`}>
        {c.icon}
        <span className="ml-1">{estado.charAt(0).toUpperCase() + estado.slice(1)}</span>
      </span>
    );
  };

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, React.ReactNode> = {
      imagen: <ImageIcon className="w-4 h-4" />,
      video: <Video className="w-4 h-4" />,
      audio: <Music className="w-4 h-4" />,
      documento: <FileText className="w-4 h-4" />,
    };
    return icons[tipo] || <Package className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files));
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} es demasiado grande (máximo 50MB)`);
        return false;
      }
      return true;
    });
    setSelectedFiles(prev => [...prev, ...validFiles]);
    if (validFiles.length > 0) {
      const file = validFiles[0];
      let tipo = 'documento';
      if (file.type.startsWith('image/')) tipo = 'imagen';
      else if (file.type.startsWith('video/')) tipo = 'video';
      else if (file.type.startsWith('audio/')) tipo = 'audio';
      setNewAporte(prev => ({ ...prev, tipo }));
    }
  };

  const removeFile = (index: number) => setSelectedFiles(prev => prev.filter((_, i) => i !== index));

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (file.type.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (file.type.startsWith('audio/')) return <Music className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const createAporte = async () => {
    if (!newAporte.titulo.trim()) {
      toast.error('El título es requerido');
      return;
    }
    setUploading(true);
    try {
      const result = await api.createAporte(newAporte as any);
      
      // Crear notificación automática
      await api.createNotification({
        title: 'Nuevo Aporte Creado',
        message: `Se ha creado el aporte "${newAporte.titulo}" y está pendiente de revisión`,
        type: 'info',
        category: 'aportes'
      });
      
      toast.success('Aporte creado exitosamente');
      setShowCreateModal(false);
      setNewAporte({ titulo: '', descripcion: '', tipo: 'documento', contenido: '' });
      setSelectedFiles([]);
      loadAportes();
      loadStats();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear aporte');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Gestión de Aportes"
        description="Revisa y modera los aportes de la comunidad"
        icon={<Package className="w-5 h-5 text-primary-400" />}
        actions={
          <>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                smartRefreshConnected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <Radio className={`w-3 h-3 ${smartRefreshConnected ? 'animate-pulse' : ''}`} />
              {smartRefreshConnected ? 'Tiempo Real' : 'Modo Fallback'}
            </div>

            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
              Nuevo Aporte
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
          </>
        }
      />

      {/* Stats */}
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4" delay={0.02} stagger={0.07}>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Total Aportes" value={stats?.total || 0} icon={<Package className="w-6 h-6" />} color="primary" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Pendientes" value={stats?.pendientes || 0} icon={<Clock className="w-6 h-6" />} color="warning" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Aprobados" value={stats?.aprobados || 0} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Rechazados" value={stats?.rechazados || 0} icon={<XCircle className="w-6 h-6" />} color="danger" delay={0} animated={false} />
        </StaggerItem>
      </Stagger>

      {/* Filters */}
      <Reveal>
        <Card animated delay={0.2} className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar aportes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadAportes()}
                className="input-search w-full"
              />
            </div>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="md:w-40">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="aprobado">Aprobados</SelectItem>
                <SelectItem value="rechazado">Rechazados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="md:w-40">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="imagen">Imágenes</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="documento">Documentos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
      </Reveal>

      {/* Aportes Table */}
      <Card animated delay={0.3} className="overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Lista de Aportes</h2>
          <p className="text-gray-400 text-sm mt-1">
            <AnimatedNumber value={aportes.length} /> aportes mostrados
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Cargando aportes...</p>
          </div>
        ) : aportes.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No hay aportes</h3>
            <p className="text-gray-400">No se encontraron aportes con los filtros aplicados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-glass w-full">
              <thead>
                <tr>
                  <th>Aporte</th>
                  <th>Tipo</th>
                  <th>Usuario</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {aportes.map((aporte, index) => (
                    <motion.tr key={aporte.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: index * 0.03 }}>
                      <td>
                        <div className="max-w-xs">
                          <p className="font-medium text-white truncate">{aporte.titulo}</p>
                          <p className="text-xs text-gray-500 truncate">{aporte.descripcion || aporte.contenido}</p>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-gray-400">
                          {getTipoIcon(aporte.tipo)}
                          <span className="text-sm capitalize">{aporte.tipo}</span>
                        </div>
                      </td>
                      <td><span className="text-gray-300">{(aporte as any).usuario || '-'}</span></td>
                      <td>{getEstadoBadge(aporte.estado)}</td>
                      <td><span className="text-gray-400 text-sm">{formatDate(aporte.created_at)}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setSelectedAporte(aporte)} className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                            <Eye className="w-4 h-4" />
                          </motion.button>
                          {canModerate && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setDeleteTarget(aporte)}
                              className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Eliminar aporte"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          )}
                          {canModerate && aporte.estado === 'pendiente' && (
                            <>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => updateEstado(aporte.id, 'aprobado')} className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                                <ThumbsUp className="w-4 h-4" />
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => updateEstado(aporte.id, 'rechazado')} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                                <ThumbsDown className="w-4 h-4" />
                              </motion.button>
                            </>
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

      {/* Detail Modal */}
      <Modal isOpen={!!selectedAporte} onClose={() => setSelectedAporte(null)} title="Detalle del Aporte">
        {selectedAporte && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Estado</span>
              {getEstadoBadge(selectedAporte.estado)}
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <h4 className="font-medium text-white mb-2">{selectedAporte.titulo}</h4>
              <p className="text-gray-400 text-sm">{selectedAporte.descripcion}</p>
            </div>
            {selectedAporte.contenido && (
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-sm text-gray-400 mb-2">Contenido</p>
                <p className="text-white whitespace-pre-wrap">{selectedAporte.contenido}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-gray-500">Usuario</p>
                <p className="text-white">{(selectedAporte as any).usuario || '-'}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-gray-500">Tipo</p>
                <p className="text-white capitalize">{selectedAporte.tipo}</p>
              </div>
            </div>
            {canModerate && (
              <div className="flex gap-3 pt-4">
                <Button
                  variant="danger"
                  className="flex-1"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => setDeleteTarget(selectedAporte)}
                >
                  Eliminar
                </Button>
                {selectedAporte.estado === 'pendiente' && (
                  <>
                    <Button variant="primary" className="flex-1" icon={<ThumbsUp className="w-4 h-4" />} onClick={() => updateEstado(selectedAporte.id, 'aprobado')}>Aprobar</Button>
                    <Button variant="danger" className="flex-1" icon={<ThumbsDown className="w-4 h-4" />} onClick={() => updateEstado(selectedAporte.id, 'rechazado')}>Rechazar</Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Eliminar aporte"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              ¿Seguro que quieres eliminar el aporte <span className="text-white font-medium">#{deleteTarget.id}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => deleteAporte(deleteTarget)}
                loading={deleting}
              >
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Crear Nuevo Aporte">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Título *</label>
              <input type="text" value={newAporte.titulo} onChange={(e) => setNewAporte(prev => ({ ...prev, titulo: e.target.value }))} className="input-glass w-full" placeholder="Título del aporte" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Tipo</label>
              <Select value={newAporte.tipo} onValueChange={(value) => setNewAporte(prev => ({ ...prev, tipo: value }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="documento">Documento</SelectItem>
                  <SelectItem value="imagen">Imagen</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Descripción</label>
            <textarea value={newAporte.descripcion} onChange={(e) => setNewAporte(prev => ({ ...prev, descripcion: e.target.value }))} className="input-glass w-full" rows={3} placeholder="Descripción del aporte" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Contenido adicional</label>
            <textarea value={newAporte.contenido} onChange={(e) => setNewAporte(prev => ({ ...prev, contenido: e.target.value }))} className="input-glass w-full" rows={4} placeholder="Información adicional, enlaces, notas..." />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Archivos</label>
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-white/20 hover:border-white/40'}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-white mb-2">Arrastra archivos aquí o haz clic para seleccionar</p>
              <p className="text-sm text-gray-500 mb-4">Máximo 50MB por archivo</p>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<File className="w-4 h-4" />}>Seleccionar Archivos</Button>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar" />
            </div>
          </div>
          {selectedFiles.length > 0 && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Archivos seleccionados ({selectedFiles.length})</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    <div className="text-gray-400">{getFileIcon(file)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                    <button onClick={() => removeFile(index)} className="text-red-400 hover:text-red-300 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button variant="primary" className="flex-1" onClick={createAporte} loading={uploading} disabled={!newAporte.titulo.trim()} icon={<Upload className="w-4 h-4" />}>{uploading ? 'Subiendo...' : 'Crear Aporte'}</Button>
            <Button variant="secondary" className="flex-1" onClick={() => { setShowCreateModal(false); setNewAporte({ titulo: '', descripcion: '', tipo: 'documento', contenido: '' }); setSelectedFiles([]); }}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
