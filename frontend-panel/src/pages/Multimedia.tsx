import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image,
  Video,
  Music,
  File,
  Trash2,
  Download,
  Eye,
  Upload,
  Search,
  Loader2,
  X,
  AlertTriangle,
  FileText,
  Images
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiService } from '../services/api';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton, IconButton } from '../components/ui/AnimatedButton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { RUNTIME_CONFIG } from '../config/runtime-config';

interface MultimediaItem {
  id: number;
  name: string;
  description: string;
  type: 'image' | 'video' | 'audio' | 'document';
  format: string;
  size: number;
  url: string;
  thumbnail?: string;
  duration?: number;
  tags: string[];
  category: string;
  uploadedBy: string;
  uploadedAt: string;
  downloads: number;
  views: number;
}

interface MultimediaResponse {
  items: MultimediaItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface MultimediaStats {
  total: number;
  totalFiles: number;
  images: number;
  videos: number;
  audio: number;
  documents: number;
}

export const Multimedia: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<MultimediaItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  
  // Preview state
  const [previewFiles, setPreviewFiles] = useState<Array<{
    file: File;
    preview: string;
    type: 'image' | 'video' | 'audio' | 'document';
    name: string;
    size: number;
  }>>([]);

  const queryClient = useQueryClient();

  const { data: multimediaData, isLoading, error } = useQuery<MultimediaResponse>(
    ['multimedia', currentPage, searchTerm, typeFilter],
    () => apiService.getMultimediaItems({
      page: currentPage,
      limit: 12,
      search: searchTerm,
      type: typeFilter === 'all' ? undefined : typeFilter,
    })
  );

  const { data: multimediaStats } = useQuery<MultimediaStats>('multimediaStats', apiService.getMultimediaStats);

  const deleteMultimediaMutation = useMutation(
    (id: number) => apiService.deleteMultimedia(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('multimedia');
        queryClient.invalidateQueries('multimediaStats');
      },
    }
  );

  const uploadMultimediaMutation = useMutation(
    (file: File) => apiService.uploadMultimedia(file),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('multimedia');
        queryClient.invalidateQueries('multimediaStats');
      },
    }
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Music;
      case 'document': return File;
      default: return File;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'text-blue-400 bg-blue-500/20';
      case 'video': return 'text-purple-400 bg-purple-500/20';
      case 'audio': return 'text-emerald-400 bg-emerald-500/20';
      case 'document': return 'text-amber-400 bg-amber-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const items = multimediaData?.items || [];
  const pagination = multimediaData?.pagination;

  useEffect(() => {
    if (!RUNTIME_CONFIG.ENABLE_REAL_TIME) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const baseUrl = RUNTIME_CONFIG.API_BASE_URL && RUNTIME_CONFIG.API_BASE_URL.trim().length > 0
      ? RUNTIME_CONFIG.API_BASE_URL
      : window.location.origin;

    let eventSource: EventSource | null = null;
    try {
      const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const url = new URL('api/aportes/stream', normalizedBase);
      url.searchParams.set('token', token);
      eventSource = new EventSource(url.toString());
    } catch {
      return;
    }

    eventSource.onmessage = (event) => {
      if (!event.data) return;
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'aporteChanged') {
          queryClient.invalidateQueries('multimedia');
          queryClient.invalidateQueries('multimediaStats');
        }
      } catch {}
    };

    return () => eventSource?.close();
  }, [queryClient]);

  const handleDeleteItem = (id: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este archivo?')) {
      deleteMultimediaMutation.mutate(id);
    }
  };

  const handleViewItem = (item: MultimediaItem) => {
    setSelectedItem(item);
    setIsViewOpen(true);
  };

  const handleDownload = (item: MultimediaItem) => {
    if (!item.url) return;
    const link = document.createElement('a');
    link.href = item.url;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    try {
      setUploading(true);
      let done = 0;
      for (const file of Array.from(files)) {
        await uploadMultimediaMutation.mutateAsync(file);
        done += 1;
        setUploadCount(done);
      }
      setIsUploadOpen(false);
      setPreviewFiles([]);
    } catch {}
    finally {
      setUploading(false);
      setUploadCount(0);
    }
  };

  // Handle file selection for preview
  const handleFileSelect = (files: FileList) => {
    const newPreviews = Array.from(files).map(file => {
      let type: 'image' | 'video' | 'audio' | 'document' = 'document';
      let preview = '';
      
      if (file.type.startsWith('image/')) {
        type = 'image';
        preview = URL.createObjectURL(file);
      } else if (file.type.startsWith('video/')) {
        type = 'video';
        preview = URL.createObjectURL(file);
      } else if (file.type.startsWith('audio/')) {
        type = 'audio';
      }
      
      return {
        file,
        preview,
        type,
        name: file.name,
        size: file.size
      };
    });
    
    setPreviewFiles(prev => [...prev, ...newPreviews]);
  };

  // Remove file from preview
  const removePreviewFile = (index: number) => {
    setPreviewFiles(prev => {
      const newFiles = [...prev];
      // Revoke object URL to free memory
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  // Upload all preview files
  const uploadPreviewFiles = async () => {
    if (!previewFiles.length) return;
    try {
      setUploading(true);
      let done = 0;
      for (const item of previewFiles) {
        await uploadMultimediaMutation.mutateAsync(item.file);
        done += 1;
        setUploadCount(done);
      }
      // Clean up previews
      previewFiles.forEach(item => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
      setPreviewFiles([]);
      setIsUploadOpen(false);
    } catch {}
    finally {
      setUploading(false);
      setUploadCount(0);
    }
  };

  // Clear all previews
  const clearPreviews = () => {
    previewFiles.forEach(item => {
      if (item.preview) URL.revokeObjectURL(item.preview);
    });
    setPreviewFiles([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(e.dataTransfer.files);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary-400" />
          <h2 className="text-xl font-semibold text-white">Cargando multimedia...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <AnimatedCard className="p-6 border-red-500/30">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">Error al cargar multimedia: {(error as any).message}</span>
          </div>
        </AnimatedCard>
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
              <div className="p-2 bg-pink-500/20 rounded-xl">
                <Images className="w-8 h-8 text-pink-400" />
              </div>
              Gestión de Multimedia
            </h1>
            <p className="text-gray-400 mt-2">Administra archivos multimedia del sistema</p>
          </div>
          <AnimatedButton
            onClick={() => setIsUploadOpen(true)}
            variant="primary"
            icon={<Upload className="w-4 h-4" />}
          >
            Subir Archivos
          </AnimatedButton>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard
            title="Total Archivos"
            value={multimediaStats?.totalFiles || 0}
            icon={<Images className="w-6 h-6" />}
            color="info"
            delay={0}
          />
          <StatCard
            title="Videos"
            value={multimediaStats?.videos || 0}
            icon={<Video className="w-6 h-6" />}
            color="violet"
            delay={0.1}
          />
          <StatCard
            title="Imágenes"
            value={multimediaStats?.images || 0}
            icon={<Image className="w-6 h-6" />}
            color="success"
            delay={0.2}
          />
          <StatCard
            title="Audio"
            value={multimediaStats?.audio || 0}
            icon={<Music className="w-6 h-6" />}
            color="warning"
            delay={0.3}
          />
          <StatCard
            title="Documentos"
            value={multimediaStats?.documents || 0}
            icon={<FileText className="w-6 h-6" />}
            color="cyan"
            delay={0.4}
          />
        </div>

        {/* Filtros */}
        <AnimatedCard delay={0.2} className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar archivos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-white/10 rounded-xl text-gray-100 placeholder-gray-400 focus:border-pink-500/50 transition-all"
              />
            </div>
            <CustomSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'Todos los tipos' },
                { value: 'image', label: 'Imágenes' },
                { value: 'video', label: 'Videos' },
                { value: 'audio', label: 'Audio' },
                { value: 'document', label: 'Documentos' }
              ]}
              placeholder="Filtrar por tipo"
            />
          </div>
        </AnimatedCard>

        {/* Galería */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {items.length === 0 ? (
            <div className="col-span-full">
              <AnimatedCard className="p-8 text-center">
                <Images className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No se encontraron archivos multimedia.</p>
              </AnimatedCard>
            </div>
          ) : (
            items.map((item, index) => {
              const TypeIcon = getTypeIcon(item.type);
              const typeColor = getTypeColor(item.type);

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <AnimatedCard className="overflow-hidden hover:border-pink-500/30 transition-all cursor-pointer">
                    <div className="aspect-video bg-white/5 relative" onClick={() => handleViewItem(item)}>
                      {item.type === 'image' ? (
                        <img
                          src={item.thumbnail || item.url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className={`p-4 rounded-xl ${typeColor}`}>
                            <TypeIcon className="w-12 h-12" />
                          </div>
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColor}`}>
                          {item.format.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="font-semibold text-white truncate mb-1">{item.name}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2 mb-3">{item.description}</p>

                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span>{formatFileSize(item.size)}</span>
                        <span>{item.views} vistas</span>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {item.tags.slice(0, 2).map((tag, i) => (
                          <span key={i} className="px-2 py-1 text-xs font-medium text-pink-400 bg-pink-500/20 rounded-full">
                            {tag}
                          </span>
                        ))}
                        {item.tags.length > 2 && (
                          <span className="px-2 py-1 text-xs font-medium text-gray-400 bg-gray-500/20 rounded-full">
                            +{item.tags.length - 2}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IconButton
                            icon={<Eye className="w-4 h-4" />}
                            onClick={() => handleViewItem(item)}
                            variant="ghost"
                            size="sm"
                          />
                          <IconButton
                            icon={<Download className="w-4 h-4" />}
                            onClick={() => handleDownload(item)}
                            variant="ghost"
                            size="sm"
                          />
                        </div>
                        <IconButton
                          icon={<Trash2 className="w-4 h-4" />}
                          onClick={() => handleDeleteItem(item.id)}
                          variant="danger"
                          size="sm"
                        />
                      </div>
                    </div>
                  </AnimatedCard>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Paginación */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <AnimatedButton
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              variant="secondary"
            >
              Anterior
            </AnimatedButton>
            <span className="px-4 py-2 text-gray-400">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <AnimatedButton
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages))}
              disabled={currentPage === pagination.totalPages}
              variant="secondary"
            >
              Siguiente
            </AnimatedButton>
          </div>
        )}

        {/* Modal Upload */}
        <AnimatePresence>
          {isUploadOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => { setIsUploadOpen(false); clearPreviews(); }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">Subir Archivos Multimedia</h3>
                  <button onClick={() => { setIsUploadOpen(false); clearPreviews(); }} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drop Zone */}
                <div
                  className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-pink-500/50 transition-colors mb-6"
                  onDragOver={handleDragOver}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileSelect(e.dataTransfer.files); }}
                >
                  <Upload className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-white mb-2">
                    Arrastra archivos aquí o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-gray-400 mb-4">
                    Soporta imágenes, videos, audio y documentos
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                    className="hidden"
                    id="file-upload"
                  />
                  <AnimatedButton
                    variant="secondary"
                    icon={<Upload className="w-4 h-4" />}
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    Seleccionar Archivos
                  </AnimatedButton>
                </div>

                {/* Preview Grid */}
                {previewFiles.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-white">
                        Archivos seleccionados ({previewFiles.length})
                      </h4>
                      <button
                        onClick={clearPreviews}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        Limpiar todo
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {previewFiles.map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative group"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10">
                            {item.type === 'image' && item.preview ? (
                              <img
                                src={item.preview}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : item.type === 'video' && item.preview ? (
                              <video
                                src={item.preview}
                                className="w-full h-full object-cover"
                                muted
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className={`p-4 rounded-xl ${getTypeColor(item.type)}`}>
                                  {item.type === 'audio' ? (
                                    <Music className="w-8 h-8" />
                                  ) : (
                                    <FileText className="w-8 h-8" />
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Remove button */}
                            <button
                              onClick={() => removePreviewFile(index)}
                              className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            
                            {/* Type badge */}
                            <div className="absolute bottom-2 left-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(item.type)}`}>
                                {item.type.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          
                          {/* File info */}
                          <div className="mt-2">
                            <p className="text-sm text-white truncate" title={item.name}>
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatFileSize(item.size)}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Upload button */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                      <AnimatedButton
                        variant="secondary"
                        onClick={() => { setIsUploadOpen(false); clearPreviews(); }}
                      >
                        Cancelar
                      </AnimatedButton>
                      <AnimatedButton
                        variant="primary"
                        loading={uploading}
                        icon={<Upload className="w-4 h-4" />}
                        onClick={uploadPreviewFiles}
                      >
                        {uploading 
                          ? `Subiendo ${uploadCount}/${previewFiles.length}...` 
                          : `Subir ${previewFiles.length} archivo${previewFiles.length > 1 ? 's' : ''}`
                        }
                      </AnimatedButton>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal View */}
        <AnimatePresence>
          {isViewOpen && selectedItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setIsViewOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">Detalles del Archivo</h3>
                  <button onClick={() => setIsViewOpen(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${getTypeColor(selectedItem.type)}`}>
                      {React.createElement(getTypeIcon(selectedItem.type), { className: 'w-8 h-8' })}
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-white">{selectedItem.name}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(selectedItem.type)}`}>
                        {selectedItem.format.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-400">{selectedItem.description}</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-gray-400">Tamaño</p>
                      <p className="text-lg font-semibold text-white">{formatFileSize(selectedItem.size)}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-gray-400">Descargas</p>
                      <p className="text-lg font-semibold text-white">{selectedItem.downloads}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-gray-400">Vistas</p>
                      <p className="text-lg font-semibold text-white">{selectedItem.views}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-gray-400">Categoría</p>
                      <p className="text-lg font-semibold text-white">{selectedItem.category}</p>
                    </div>
                  </div>

                  <div className="text-sm text-gray-500">
                    <p>Subido por: {selectedItem.uploadedBy}</p>
                    <p>Fecha: {new Date(selectedItem.uploadedAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex justify-end mt-6 gap-3">
                  <AnimatedButton onClick={() => setIsViewOpen(false)} variant="secondary">
                    Cerrar
                  </AnimatedButton>
                  <AnimatedButton
                    onClick={() => handleDownload(selectedItem)}
                    variant="primary"
                    icon={<Download className="w-4 h-4" />}
                  >
                    Descargar
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

export default Multimedia;
