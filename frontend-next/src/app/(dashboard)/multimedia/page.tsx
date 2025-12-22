'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Image, Video, Music, File, Trash2, Download, Eye, Upload, Search, Loader2, FileText, ImageIcon } from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SimpleSelect as Select } from '@/components/ui/Select';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface MultimediaItem {
  id: number;
  name: string;
  description: string;
  type: 'image' | 'video' | 'audio' | 'document';
  format: string;
  size: number;
  url: string;
  thumbnail?: string;
  tags: string[];
  category: string;
  uploadedBy: string;
  uploadedAt: string;
  downloads: number;
  views: number;
}

export default function MultimediaPage() {
  const [items, setItems] = useState<MultimediaItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<MultimediaItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  useEffect(() => { 
    loadData(); 
  }, [currentPage, typeFilter]);

  // Auto-refresh cada 2 minutos para multimedia
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 120000);
    return () => clearInterval(interval);
  }, [currentPage, typeFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsData, statsData] = await Promise.all([
        api.getMultimediaItems({ page: currentPage, limit: 12, search: searchTerm, type: typeFilter === 'all' ? undefined : typeFilter }),
        api.getMultimediaStats().catch(() => ({}))
      ]);
      
      // Normalizar datos del backend
      let normalizedItems = [];
      if (itemsData) {
        const rawItems = itemsData.items || itemsData.data || itemsData || [];
        
        normalizedItems = rawItems.map((item: any, index: number) => {
          // Construir URL completa para archivos multimedia
          let imageUrl = item.url || item.path || item.src || '';
          if (imageUrl && !imageUrl.startsWith('http')) {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
            imageUrl = `${baseUrl}${imageUrl}`;
          }
          
          return {
            id: item.id || Math.random(),
            name: item.name || item.filename || item.originalName || `Archivo ${index + 1}`,
            description: item.description || item.desc || '',
            type: item.type || getTypeFromMime(item.mimetype) || 'document',
            format: item.format || item.extension || item.mimetype?.split('/')[1] || 'unknown',
            size: item.size || 0,
            url: imageUrl,
            thumbnail: item.thumbnail || item.thumb || imageUrl,
            tags: item.tags || [],
            category: item.category || 'general',
            uploadedBy: item.uploadedBy || item.uploader || 'admin',
            uploadedAt: item.uploadedAt || item.createdAt || item.created_at || new Date().toISOString(),
            downloads: item.downloads || 0,
            views: item.views || 0,
          };
        });
      }
      
      setItems(normalizedItems);
      setPagination(itemsData?.pagination);
      setStats(statsData);
    } catch (err) {
      console.error('Error loading multimedia:', err);
      toast.error('Error al cargar multimedia');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este archivo?')) return;
    try {
      await api.deleteMultimedia(id);
      toast.success('Archivo eliminado');
      loadData();
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  const handleUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(file => api.uploadMultimedia(file));
      await Promise.all(uploadPromises);
      
      // Crear notificación de éxito
      await api.createNotification({
        title: 'Archivos Multimedia Subidos',
        message: `Se subieron ${files.length} archivo(s) multimedia correctamente`,
        type: 'success',
        category: 'multimedia'
      });
      
      toast.success(`${files.length} archivo(s) subido(s) correctamente`);
      setShowUploadModal(false);
      loadData();
    } catch (err: any) {
      // Crear notificación de error
      await api.createNotification({
        title: 'Error al Subir Archivos',
        message: err?.response?.data?.error || 'Error al subir archivos multimedia',
        type: 'error',
        category: 'multimedia'
      });
      
      toast.error(err?.response?.data?.error || 'Error al subir archivos');
    } finally {
      setUploading(false);
    }
  };

  const getTypeFromMime = (mimetype: string) => {
    if (!mimetype) return 'document';
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Music;
      default: return File;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'text-blue-400 bg-blue-500/20';
      case 'video': return 'text-purple-400 bg-purple-500/20';
      case 'audio': return 'text-emerald-400 bg-emerald-500/20';
      default: return 'text-amber-400 bg-amber-500/20';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading && items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary-400" />
          <h2 className="text-xl font-semibold text-white">Cargando multimedia...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 rounded-xl">
              <ImageIcon className="w-8 h-8 text-pink-400" />
            </div>
            Gestión de Multimedia
          </h1>
          <p className="text-gray-400 mt-2">Administra archivos multimedia del sistema</p>
        </div>
        <Button onClick={() => setShowUploadModal(true)} variant="primary" icon={<Upload className="w-4 h-4" />}>
          Subir Archivos
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard title="Total Archivos" value={stats?.totalFiles || 0} icon={<ImageIcon className="w-6 h-6" />} color="info" delay={0} />
        <StatCard title="Videos" value={stats?.videos || 0} icon={<Video className="w-6 h-6" />} color="violet" delay={0.1} />
        <StatCard title="Imágenes" value={stats?.images || 0} icon={<Image className="w-6 h-6" />} color="success" delay={0.2} />
        <StatCard title="Audio" value={stats?.audio || 0} icon={<Music className="w-6 h-6" />} color="warning" delay={0.3} />
        <StatCard title="Documentos" value={stats?.documents || 0} icon={<FileText className="w-6 h-6" />} color="cyan" delay={0.4} />
      </div>

      {/* Filters */}
      <Card animated delay={0.2} className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Buscar archivos..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadData()}
              className="input-glass w-full pl-10" />
          </div>
          <Select value={typeFilter} onChange={setTypeFilter} options={[
            { value: 'all', label: 'Todos los tipos' },
            { value: 'image', label: 'Imágenes' },
            { value: 'video', label: 'Videos' },
            { value: 'audio', label: 'Audio' },
            { value: 'document', label: 'Documentos' }
          ]} />
        </div>
      </Card>

      {/* Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.length === 0 ? (
          <div className="col-span-full">
            <Card className="p-8 text-center">
              <ImageIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No se encontraron archivos multimedia.</p>
            </Card>
          </div>
        ) : (
          items.map((item, index) => {
            const TypeIcon = getTypeIcon(item.type);
            const typeColor = getTypeColor(item.type);
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                <Card className="overflow-hidden hover:border-pink-500/30 transition-all cursor-pointer">
                  <div className="aspect-video bg-white/5 relative overflow-hidden rounded-t-xl" onClick={() => { setSelectedItem(item); setShowViewModal(true); }}>
                    {item.type === 'image' ? (
                      <div className="w-full h-full relative bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                        <img 
                          src={item.url} 
                          alt={item.name} 
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && parent.querySelector('.fallback-icon') === null) {
                              const fallback = document.createElement('div');
                              fallback.className = 'fallback-icon absolute inset-0 flex items-center justify-center';
                              fallback.innerHTML = `
                                <div class="text-center p-4">
                                  <div class="w-16 h-16 mx-auto mb-3 rounded-xl bg-red-500/20 flex items-center justify-center">
                                    <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                    </svg>
                                  </div>
                                  <p class="text-sm text-red-400 font-medium">Error al cargar</p>
                                  <p class="text-xs text-gray-500 mt-1 break-all">${item.name}</p>
                                </div>
                              `;
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className={`p-4 rounded-xl ${typeColor}`}><TypeIcon className="w-12 h-12" /></div>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border backdrop-blur-sm ${typeColor}`}>
                        {item.format?.toUpperCase() || 'FILE'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white truncate mb-1" title={item.name}>
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-gray-400 line-clamp-2 mb-3">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <span>{formatFileSize(item.size)}</span>
                      <span>{item.views || 0} vistas</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setShowViewModal(true); }}
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); item.url && window.open(item.url, '_blank'); }}
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                          title="Descargar"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} variant="secondary">Anterior</Button>
          <span className="px-4 py-2 text-gray-400">Página {pagination.page} de {pagination.totalPages}</span>
          <Button onClick={() => setCurrentPage(p => Math.min(p + 1, pagination.totalPages))} disabled={currentPage === pagination.totalPages} variant="secondary">Siguiente</Button>
        </div>
      )}

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Subir Archivos Multimedia">
        <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-pink-500/50 transition-colors">
          <Upload className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-lg font-semibold text-white mb-2">Arrastra archivos aquí o haz clic para seleccionar</p>
          <p className="text-sm text-gray-400 mb-4">Soporta imágenes, videos, audio y documentos</p>
          <input type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            onChange={(e) => e.target.files && handleUpload(e.target.files)} className="hidden" id="file-upload" />
          <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => document.getElementById('file-upload')?.click()} loading={uploading}>
            {uploading ? 'Subiendo...' : 'Seleccionar Archivos'}
          </Button>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={showViewModal && !!selectedItem} onClose={() => setShowViewModal(false)} title="Detalles del Archivo">
        {selectedItem && (
          <div className="space-y-4">
            {/* Preview */}
            {selectedItem.type === 'image' && (
              <div className="w-full max-h-96 overflow-hidden rounded-xl bg-white/5 flex items-center justify-center">
                <img 
                  src={selectedItem.url} 
                  alt={selectedItem.name}
                  className="max-w-full max-h-96 object-contain rounded-xl"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && parent.querySelector('.modal-fallback') === null) {
                      const fallback = document.createElement('div');
                      fallback.className = 'modal-fallback text-center p-8';
                      fallback.innerHTML = `
                        <div class="w-24 h-24 mx-auto mb-4 rounded-xl bg-red-500/20 flex items-center justify-center">
                          <svg class="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                          </svg>
                        </div>
                        <p class="text-red-400 font-medium">No se pudo cargar la imagen</p>
                        <p class="text-gray-500 text-sm mt-2 break-all">${selectedItem.url}</p>
                      `;
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
            )}
            
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${getTypeColor(selectedItem.type)}`}>
                {React.createElement(getTypeIcon(selectedItem.type), { className: 'w-8 h-8' })}
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-semibold text-white break-words">{selectedItem.name}</h4>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border mt-1 ${getTypeColor(selectedItem.type)}`}>
                  {selectedItem.format?.toUpperCase() || 'FILE'}
                </span>
              </div>
            </div>
            
            {selectedItem.description && (
              <p className="text-gray-400">{selectedItem.description}</p>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-sm text-gray-400">Tamaño</p>
                <p className="text-lg font-semibold text-white">{formatFileSize(selectedItem.size)}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-sm text-gray-400">Descargas</p>
                <p className="text-lg font-semibold text-white">{selectedItem.downloads || 0}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-sm text-gray-400">Vistas</p>
                <p className="text-lg font-semibold text-white">{selectedItem.views || 0}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-sm text-gray-400">Categoría</p>
                <p className="text-lg font-semibold text-white">{selectedItem.category || 'General'}</p>
              </div>
            </div>
            
            <div className="text-sm text-gray-500">
              <p>Subido por: {selectedItem.uploadedBy}</p>
              <p>Fecha: {new Date(selectedItem.uploadedAt).toLocaleDateString('es-ES')}</p>
            </div>
            
            {selectedItem.url && (
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-sm text-gray-400 mb-1">URL del archivo</p>
                <code className="text-xs text-gray-300 break-all">{selectedItem.url}</code>
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4">
              <Button onClick={() => setShowViewModal(false)} variant="secondary">
                Cerrar
              </Button>
              <Button 
                onClick={() => selectedItem.url && window.open(selectedItem.url, '_blank')} 
                variant="primary" 
                icon={<Download className="w-4 h-4" />}
              >
                Descargar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}