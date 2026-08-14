'use client';
import { notify } from '@/lib/notif';
import { getErrorMessage } from '@/lib/utils';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, RefreshCw, CheckCircle, XCircle, Clock, Eye, ThumbsUp, ThumbsDown,
  FileText, Image as ImageIcon, Video, Music, Radio, Plus, Upload, File, Trash2,
  Sparkles, Tag, Download, Layers, MessageSquare, Globe, Bot, Star,
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

import { Aporte } from '@/types';

// ── helpers ────────────────────────────────────────────────────────────────────

function cleanUsuario(usuario: any): string {
  if (!usuario) return '-';
  if (typeof usuario === 'object') return usuario.username || '-';
  return String(usuario)
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@c\.us$/, '')
    .replace(/@.*$/, '');
}

function getSmartSubtitle(aporte: any): string {
  const adjunto = !aporte.contenido || aporte.contenido === '(adjunto)';
  if (adjunto && aporte.archivoNombre) return aporte.archivoNombre;
  if (aporte.descripcion) return aporte.descripcion;
  if (!adjunto) return aporte.contenido;
  return '';
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function isFuenteWa(aporte: any): boolean {
  return !!(aporte.usuario_jid || aporte.fecha || (aporte.fuente && aporte.fuente !== 'web'));
}

// ── component ─────────────────────────────────────────────────────────────────

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
      notify.error('Error al cargar aportes');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, estadoFilter, tipoFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.getAporteStats();
      setStats(response);
    } catch (err) {
      console.error('Error loading stats:', getErrorMessage(err));
    }
  }, []);

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
    if (!canModerate) { notify.error('Permisos insuficientes'); return; }
    try {
      await api.approveAporte(id, estado, motivo);
      setAportes(prev => prev.map(a => a.id === id ? { ...a, estado: estado as any } : a));
      const aporte = aportes.find(a => a.id === id);
      void api.createNotification({
        title: `Aporte ${estado}`,
        message: `El aporte "${aporte?.titulo}" ha sido ${estado}${motivo ? `: ${motivo}` : ''}`,
        type: estado === 'aprobado' ? 'success' : estado === 'rechazado' ? 'error' : 'info',
        category: 'aportes',
      }).catch(() => {});
      notify.success(`Aporte ${estado}`);
      setSelectedAporte(null);
      loadStats();
    } catch (err) {
      notify.error('Error al actualizar estado');
    }
  };

  const deleteAporte = async (aporte: Aporte) => {
    if (!canModerate) { notify.error('Permisos insuficientes'); return; }
    try {
      setDeleting(true);
      await api.deleteAporte(aporte.id);
      notify.success('Aporte eliminado');
      setAportes(prev => prev.filter(a => a.id !== aporte.id));
      if (selectedAporte?.id === aporte.id) setSelectedAporte(null);
      setDeleteTarget(null);
      loadStats();
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error al eliminar aporte');
    } finally {
      setDeleting(false);
    }
  };

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
      pendiente:  { cls: 'border-amber-500/25 bg-amber-500/10 text-amber-300',    icon: <Clock className="w-3 h-3" />,        label: 'Pendiente' },
      aprobado:   { cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300', icon: <CheckCircle className="w-3 h-3" />, label: 'Aprobado' },
      rechazado:  { cls: 'border-rose-500/25 bg-rose-500/10 text-rose-300',       icon: <XCircle className="w-3 h-3" />,      label: 'Rechazado' },
    };
    const c = config[estado] ?? config.pendiente;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${c.cls}`}>
        {c.icon}{c.label}
      </span>
    );
  };

  const getTipoIcon = (tipo: string, size = 'w-4 h-4') => {
    const icons: Record<string, React.ReactNode> = {
      imagen:    <ImageIcon className={size} />,
      video:     <Video className={size} />,
      audio:     <Music className={size} />,
      documento: <FileText className={size} />,
      extra:     <Sparkles className={size} />,
      general:   <Package className={size} />,
    };
    return icons[tipo] ?? <Package className={size} />;
  };

  const getTipoColor = (tipo: string) => {
    const colors: Record<string, string> = {
      imagen:    'text-sky-400',
      video:     'text-violet-400',
      audio:     'text-pink-400',
      documento: 'text-blue-400',
      extra:     'text-amber-400',
      general:   'text-gray-400',
    };
    return colors[tipo] ?? 'text-gray-400';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files));
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      if (file.size > 50 * 1024 * 1024) { notify.error(`${file.name} es demasiado grande (máximo 50MB)`); return false; }
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

  const createAporte = async () => {
    if (!newAporte.titulo.trim()) { notify.error('El título es requerido'); return; }
    setUploading(true);
    try {
      await api.createAporte(newAporte as any);
      void api.createNotification({
        title: 'Nuevo Aporte Creado',
        message: `Se ha creado el aporte "${newAporte.titulo}" y está pendiente de revisión`,
        type: 'info', category: 'aportes',
      }).catch(() => {});
      notify.success('Aporte creado exitosamente');
      setShowCreateModal(false);
      setNewAporte({ titulo: '', descripcion: '', tipo: 'documento', contenido: '' });
      setSelectedFiles([]);
      loadAportes(); loadStats();
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error al crear aporte');
    } finally {
      setUploading(false);
    }
  };

  const aporteLanes = [
    {
      label: 'Moderacion', value: canModerate ? 'Permisos activos' : 'Solo lectura',
      description: canModerate ? 'Puedes aprobar, rechazar y limpiar aportes del flujo.' : 'Puedes revisar el estado, pero no moderar cambios.',
      icon: <Eye className="w-4 h-4" />, badge: canModerate ? 'mod' : 'view',
      badgeClassName: canModerate ? 'border-[rgb(var(--success))]/20 bg-[rgb(var(--success))]/10 text-[#c7f9d8]' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-[rgb(var(--success))]/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Canal de refresh', value: smartRefreshConnected ? 'Tiempo real' : 'Fallback',
      description: smartRefreshConnected ? 'Los cambios llegan por eventos sin esperar recarga manual.' : 'La vista sigue operativa con refresh manual.',
      icon: <Radio className="w-4 h-4" />, badge: smartRefreshConnected ? 'live' : 'manual',
      badgeClassName: smartRefreshConnected ? 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan' : 'border-warning/20 bg-warning/10 text-warning/80',
      glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
    },
    {
      label: 'Bandeja actual', value: `${stats?.pendientes || 0}`,
      description: (stats?.pendientes || 0) > 0 ? 'Aportes pendientes esperando una decisión de moderación.' : 'No hay cola pendiente en este momento.',
      icon: <Clock className="w-4 h-4" />, badge: (stats?.pendientes || 0) > 0 ? 'queue' : 'clean',
      badgeClassName: (stats?.pendientes || 0) > 0 ? 'border-warning/20 bg-warning/10 text-warning/80' : 'border-accent/20 bg-accent/10 text-accent',
      glowClassName: 'from-amber-400/18 via-oguri-gold/10 to-transparent',
    },
    {
      label: 'Carga nueva', value: `${selectedFiles.length}`,
      description: selectedFiles.length > 0 ? 'Archivos preparados para el próximo aporte.' : 'No hay archivos en cola para subir ahora mismo.',
      icon: <Upload className="w-4 h-4" />, badge: selectedFiles.length > 0 ? 'ready' : 'empty',
      badgeClassName: selectedFiles.length > 0 ? 'border-success/20 bg-success/10 text-success/80' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-emerald-400/18 via-oguri-cyan/10 to-transparent',
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden">
      {/* atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-success/18 blur-3xl" animate={{ x: [0, 18, 0], y: [0, 14, 0], opacity: [0.18, 0.38, 0.18] }} transition={{ repeat: Infinity, duration: 10.8, ease: 'easeInOut' }} />
        <motion.div className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-cyan/18 blur-3xl" animate={{ x: [0, -18, 0], y: [0, 18, 0], opacity: [0.18, 0.4, 0.18] }} transition={{ repeat: Infinity, duration: 11.2, ease: 'easeInOut', delay: 0.5 }} />
      </div>

      {/* hero banner */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(var(--page-a),0.18),rgba(var(--page-b),0.10),rgba(var(--page-c),0.12))] p-5 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6">
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit"><Package className="h-3.5 w-3.5 text-success/80" />Flujo de aportes</div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Moderación de aportes</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">Archivos de WhatsApp y web, validación y acciones rápidas en una vista unificada.</p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Items</p>
              <p className="mt-2 text-lg font-black text-white">{aportes.length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Pendientes</p>
              <p className="mt-2 text-lg font-black text-white">{aportes.filter(a => a.estado === 'pendiente').length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Canal</p>
              <p className="mt-2 text-lg font-black text-white">{smartRefreshConnected ? 'LIVE' : 'FALLBACK'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <PageHeader
        title="Gestión de Aportes"
        description="Revisa y modera los aportes de la comunidad"
        icon={<Package className="w-5 h-5 text-primary-400" />}
        actions={
          <>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${smartRefreshConnected ? 'bg-success/20 text-success border border-success/30' : 'bg-warning/20 text-warning border border-warning/30'}`}>
              <Radio className={`w-3 h-3 ${smartRefreshConnected ? 'animate-pulse' : ''}`} />
              {smartRefreshConnected ? 'Tiempo Real' : 'Modo Fallback'}
            </div>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>Nuevo Aporte</Button>
            <Button variant="secondary" icon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />} onClick={manualRefresh} loading={isRefreshing}>
              {isRefreshing ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </>
        }
      />

      {/* lane cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {aporteLanes.map((lane, index) => (
          <motion.div key={lane.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 + index * 0.05, duration: 0.3 }} className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#101512]/86 p-4 shadow-[0_22px_70px_-36px_rgba(0,0,0,0.4)]">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${lane.glowClassName}`} />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">{lane.icon}</div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${lane.badgeClassName}`}>{lane.badge}</span>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">{lane.label}</p>
                <p className="mt-1 text-base font-black text-white">{lane.value}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">{lane.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* stats */}
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

      {/* filters */}
      <Reveal>
        <Card animated delay={0.2} className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Buscar por título, descripción..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadAportes()} className="input-search w-full" />
            </div>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="md:w-40"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="aprobado">Aprobados</SelectItem>
                <SelectItem value="rechazado">Rechazados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="md:w-44"><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="imagen">Imágenes</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="documento">Documentos</SelectItem>
                <SelectItem value="extra">Extra</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
      </Reveal>

      {/* aportes list */}
      <Card animated delay={0.3} className="overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Lista de Aportes</h2>
            <p className="text-gray-400 text-sm mt-0.5"><AnimatedNumber value={aportes.length} /> aportes mostrados</p>
          </div>
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
          <div className="divide-y divide-white/[0.06]">
            <AnimatePresence>
              {aportes.map((aporte, index) => {
                const a = aporte as any;
                const subtitle = getSmartSubtitle(a);
                const isWa = isFuenteWa(a);
                const hasFile = !!(a.archivoNombre || a.archivo);
                const tags: string[] = Array.isArray(a.tags) ? a.tags : (typeof a.tags === 'string' ? a.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);

                return (
                  <motion.div
                    key={aporte.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ delay: index * 0.025 }}
                    className="group flex items-start gap-4 p-4 sm:p-5 hover:bg-white/[0.025] transition-colors cursor-pointer"
                    onClick={() => setSelectedAporte(aporte)}
                  >
                    {/* tipo icon */}
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] ${getTipoColor(a.tipo)}`}>
                      {getTipoIcon(a.tipo)}
                    </div>

                    {/* main info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-sm">{aporte.titulo}</span>
                        {isWa && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#25d366]/20 bg-[#25d366]/8 px-2 py-0.5 text-[10px] font-bold text-[#25d366]/90">
                            <MessageSquare className="w-2.5 h-2.5" />WA
                          </span>
                        )}
                        {!isWa && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/8 px-2 py-0.5 text-[10px] font-bold text-sky-400/90">
                            <Globe className="w-2.5 h-2.5" />Web
                          </span>
                        )}
                        {hasFile && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/8 px-2 py-0.5 text-[10px] font-bold text-violet-400/90">
                            <Download className="w-2.5 h-2.5" />Archivo
                          </span>
                        )}
                      </div>

                      {subtitle && (
                        <p className="mt-0.5 text-[13px] text-gray-400 truncate max-w-xs sm:max-w-lg">{subtitle}</p>
                      )}

                      {/* chips: temporada, capitulo, categoria, tags */}
                      {(a.temporada || a.capitulo || a.categoria || tags.length > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {a.temporada && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                              <Layers className="w-2.5 h-2.5" />T{a.temporada}
                            </span>
                          )}
                          {a.capitulo && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                              Cap.{a.capitulo}
                            </span>
                          )}
                          {a.categoria && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                              {a.categoria}
                            </span>
                          )}
                          {tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-gray-500">
                              <Tag className="w-2 h-2" />{tag}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="text-[10px] text-gray-600">+{tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* right meta */}
                    <div className="shrink-0 flex flex-col items-end gap-2 min-w-[90px]">
                      {getEstadoBadge(aporte.estado)}
                      <span className="text-[11px] text-gray-500">{cleanUsuario(a.usuario)}</span>
                      <span className="text-[11px] text-gray-600">{formatDate(aporte.created_at)}</span>
                    </div>

                    {/* action buttons — always visible */}
                    {canModerate && (
                      <div className="shrink-0 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                        {a.estado === 'pendiente' && (
                          <>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => updateEstado(aporte.id, 'aprobado')} className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Aprobar">
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => updateEstado(aporte.id, 'rechazado')} className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors" title="Rechazar">
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </motion.button>
                          </>
                        )}
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setDeleteTarget(aporte)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-gray-500 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 transition-colors" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    )}
                    {!canModerate && <div className="w-7 shrink-0" />}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {pagination && (pagination.totalPages ?? pagination.pages) > 1 && (
          <div className="p-6 border-t border-white/10 flex items-center justify-between">
            <p className="text-sm text-gray-400">Página {pagination.page} de {pagination.totalPages ?? pagination.pages}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={page >= (pagination.totalPages ?? pagination.pages)} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Detail Modal ───────────────────────────────────────────────────── */}
      <Modal isOpen={!!selectedAporte} onClose={() => setSelectedAporte(null)} title="Detalle del Aporte" className="max-w-lg">
        {selectedAporte && (() => {
          const a = selectedAporte as any;
          const isWa = isFuenteWa(a);
          const tags: string[] = Array.isArray(a.tags) ? a.tags : (typeof a.tags === 'string' ? a.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
          const hasFile = !!(a.archivoNombre || a.archivo);
          const aiData = a.ai && typeof a.ai === 'object' ? a.ai : null;

          return (
            <div className="space-y-4">
              {/* header row */}
              <div className="flex flex-wrap items-center gap-2">
                {getEstadoBadge(selectedAporte.estado)}
                <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold capitalize ${getTipoColor(a.tipo)}`}>
                  {getTipoIcon(a.tipo, 'w-3 h-3')}{a.tipo}
                </span>
                {isWa ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#25d366]/20 bg-[#25d366]/8 px-2.5 py-1 text-[11px] font-bold text-[#25d366]/90">
                    <MessageSquare className="w-3 h-3" />WhatsApp
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/8 px-2.5 py-1 text-[11px] font-bold text-sky-400">
                    <Globe className="w-3 h-3" />Web
                  </span>
                )}
              </div>

              {/* title + description */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <h4 className="font-bold text-white text-base mb-1">{selectedAporte.titulo}</h4>
                {a.titulo_normalizado && a.titulo_normalizado !== selectedAporte.titulo && (
                  <p className="text-[12px] text-gray-500 mb-2">Normalizado: {a.titulo_normalizado}</p>
                )}
                {selectedAporte.descripcion && (
                  <p className="text-gray-300 text-sm mt-2">{selectedAporte.descripcion}</p>
                )}
              </div>

              {/* contenido (only if not "(adjunto)") */}
              {a.contenido && a.contenido !== '(adjunto)' && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 mb-2">Contenido</p>
                  <p className="text-white text-sm whitespace-pre-wrap">{a.contenido}</p>
                </div>
              )}

              {/* meta grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500 mb-1">Usuario</p>
                  <p className="text-white text-sm font-semibold">{cleanUsuario(a.usuario)}</p>
                  {a.usuario_jid && a.usuario_jid !== a.usuario && (
                    <p className="text-[10px] text-gray-600 mt-0.5 truncate">{a.usuario_jid}</p>
                  )}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500 mb-1">Grupo</p>
                  <p className="text-white text-sm">{a.grupo || (selectedAporte.grupo as any)?.nombre || '-'}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500 mb-1">Creado</p>
                  <p className="text-white text-sm">{formatDate(selectedAporte.created_at)}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500 mb-1">Actualizado</p>
                  <p className="text-white text-sm">{formatDate(selectedAporte.updated_at)}</p>
                </div>
              </div>

              {/* classification: temporada / capitulo / categoria / tags */}
              {(a.temporada || a.capitulo || a.categoria || tags.length > 0) && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 mb-3">Clasificación</p>
                  <div className="flex flex-wrap gap-2">
                    {a.temporada && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-gray-300">
                        <Layers className="w-3 h-3 text-sky-400" />Temporada {a.temporada}
                      </span>
                    )}
                    {a.capitulo && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-gray-300">
                        Capítulo {a.capitulo}
                      </span>
                    )}
                    {a.categoria && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-gray-300">
                        <Star className="w-3 h-3 text-amber-400" />{a.categoria}
                      </span>
                    )}
                    {tags.map((tag: string) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-xs text-gray-400">
                        <Tag className="w-2.5 h-2.5" />{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI classification */}
              {aiData && (
                <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
                  <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-violet-400/80 mb-3">
                    <Bot className="w-3.5 h-3.5" />Clasificación IA
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {aiData.titulo_sugerido && (
                      <div className="col-span-2">
                        <span className="text-gray-500 text-xs">Título sugerido:</span>
                        <p className="text-white font-medium">{aiData.titulo_sugerido}</p>
                      </div>
                    )}
                    {aiData.categoria && (
                      <div>
                        <span className="text-gray-500 text-xs">Categoría:</span>
                        <p className="text-gray-200">{aiData.categoria}</p>
                      </div>
                    )}
                    {aiData.confianza !== undefined && (
                      <div>
                        <span className="text-gray-500 text-xs">Confianza:</span>
                        <p className="text-gray-200">{(aiData.confianza * 100).toFixed(0)}%</p>
                      </div>
                    )}
                    {Array.isArray(aiData.tags) && aiData.tags.length > 0 && (
                      <div className="col-span-2 flex flex-wrap gap-1.5 mt-1">
                        {aiData.tags.map((t: string) => (
                          <span key={t} className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* archivo */}
              {hasFile && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 mb-3">Archivo adjunto</p>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] ${getTipoColor(a.tipo)}`}>
                      {getTipoIcon(a.tipo)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-sm truncate">{a.archivoNombre || a.archivo}</p>
                      <div className="flex gap-3 mt-0.5 text-[11px] text-gray-500">
                        {a.archivoSize > 0 && <span>{formatBytes(a.archivoSize)}</span>}
                        {a.archivoMime && <span>{a.archivoMime}</span>}
                      </div>
                    </div>
                    {a.archivoPath && (
                      <a
                        href={`/${a.archivoPath.replace(/^storage\/media\//, 'media/')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-gray-400 hover:border-white/20 hover:text-white transition-colors"
                        title="Descargar"
                        onClick={e => e.stopPropagation()}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* motivo rechazo */}
              {selectedAporte.estado === 'rechazado' && selectedAporte.motivo_rechazo && (
                <div className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-400/80 mb-2">Motivo de rechazo</p>
                  <p className="text-rose-200 text-sm">{selectedAporte.motivo_rechazo}</p>
                </div>
              )}

              {/* actions */}
              {canModerate && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => setDeleteTarget(selectedAporte)}>Eliminar</Button>
                  {selectedAporte.estado === 'pendiente' && (
                    <>
                      <Button variant="primary" className="flex-1" icon={<ThumbsUp className="w-4 h-4" />} onClick={() => updateEstado(selectedAporte.id, 'aprobado')}>Aprobar</Button>
                      <Button variant="danger" className="flex-1" icon={<ThumbsDown className="w-4 h-4" />} onClick={() => updateEstado(selectedAporte.id, 'rechazado')}>Rechazar</Button>
                    </>
                  )}
                  {selectedAporte.estado === 'aprobado' && (
                    <Button variant="secondary" icon={<XCircle className="w-4 h-4" />} onClick={() => updateEstado(selectedAporte.id, 'rechazado')}>Rechazar</Button>
                  )}
                  {selectedAporte.estado === 'rechazado' && (
                    <Button variant="secondary" icon={<CheckCircle className="w-4 h-4" />} onClick={() => updateEstado(selectedAporte.id, 'aprobado')}>Aprobar</Button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ── Delete confirm Modal ────────────────────────────────────────────── */}
      <Modal isOpen={!!deleteTarget} onClose={() => (deleting ? null : setDeleteTarget(null))} title="Eliminar aporte">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              ¿Seguro que quieres eliminar el aporte <span className="text-white font-medium">&quot;{deleteTarget.titulo}&quot;</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
              <Button variant="danger" className="flex-1" icon={<Trash2 className="w-4 h-4" />} onClick={() => deleteAporte(deleteTarget)} loading={deleting}>Eliminar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Modal ────────────────────────────────────────────────────── */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Crear Nuevo Aporte">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Título *</label>
              <input type="text" value={newAporte.titulo} onChange={e => setNewAporte(prev => ({ ...prev, titulo: e.target.value }))} className="input-glass w-full" placeholder="Título del aporte" data-autofocus />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Tipo</label>
              <Select value={newAporte.tipo} onValueChange={v => setNewAporte(prev => ({ ...prev, tipo: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="documento">Documento</SelectItem>
                  <SelectItem value="imagen">Imagen</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="extra">Extra</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Descripción</label>
            <textarea value={newAporte.descripcion} onChange={e => setNewAporte(prev => ({ ...prev, descripcion: e.target.value }))} className="input-glass w-full" rows={3} placeholder="Descripción del aporte" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Contenido adicional</label>
            <textarea value={newAporte.contenido} onChange={e => setNewAporte(prev => ({ ...prev, contenido: e.target.value }))} className="input-glass w-full" rows={4} placeholder="Información adicional, enlaces, notas..." />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Archivos</label>
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive ? 'border-accent bg-accent/10' : 'border-white/20 hover:border-white/40'}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
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
                      <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                    </div>
                    <button onClick={() => removeFile(index)} className="text-danger hover:text-danger/80 p-1"><Trash2 className="w-4 h-4" /></button>
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
