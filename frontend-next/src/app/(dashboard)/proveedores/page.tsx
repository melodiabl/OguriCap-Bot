'use client';
import { getErrorMessage } from '@/lib/utils';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Search, Plus, Eye, CheckCircle, XCircle, Clock, User, Calendar,
  MessageSquare, AlertCircle, RefreshCw, Star, Activity, Users, Trash2, FolderOpen
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SimpleSelect as Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import api from '@/services/api';
import { notify } from '@/lib/notif';

interface Proveedor {
  id: number;
  jid: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  estado: 'activo' | 'inactivo' | 'suspendido';
  contacto: string;
  fecha_registro: string;
  total_aportes: number;
  total_pedidos: number;
  rating: number;
  grupos_monitoreados?: string[];
}

interface ProveedorStats {
  total: number;
  activos: number;
  inactivos: number;
  suspendidos: number;
}

export default function ProveedoresPage() {
  const router = useRouter();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [stats, setStats] = useState<ProveedorStats | null>(null);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProveedor, setNewProveedor] = useState<Partial<Proveedor>>({});
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);

  useEffect(() => {
    loadProveedores();
    loadStats();
    loadAvailableGroups();
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
      const data = await api.getProveedores();
      const list = Array.isArray(data) ? data : (data?.proveedores || []);
      setProveedores(list);
      setError(null);
    } catch (err) {
      setError('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.getProviderStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats');
    }
  };

  const loadAvailableGroups = async (opts?: { sync?: boolean }) => {
    try {
      setLoadingGroups(true);
      if (opts?.sync) {
        try {
          await api.syncWhatsAppGroups();
        } catch (err) {
          console.error('Error syncing WhatsApp groups', err);
        }
      }
      const data = await api.getAvailableGrupos();
      const groups = Array.isArray(data) ? data : (data?.grupos || []);
      setAvailableGroups(groups);
    } catch (err) {
      console.error('Error loading available groups', err);
      notify.error('No pude cargar la lista de grupos (revisá sesión/token del panel).');
    } finally {
      setLoadingGroups(false);
    }
  };

  const createProveedor = async () => {
    if (!newProveedor.jid?.trim() || newProveedor.jid === 'none') { setError('Debe seleccionar un grupo'); return; }
    if (!newProveedor.tipo?.trim() || newProveedor.tipo === 'none') { setError('El tipo es requerido'); return; }

    try {
      const group = availableGroups.find((g) => (g?.jid || g?.wa_jid || g?.id) === newProveedor.jid) || null;
      const fallbackNombre = (group?.nombre || group?.name || '').trim();
      const nombre = (newProveedor.nombre || fallbackNombre || newProveedor.jid || '').trim();
      if (!nombre) { setError('El nombre es requerido'); return; }
      const data = await api.createProveedor({
        ...newProveedor,
        nombre,
        estado: 'activo'
      } as any);
      setProveedores(prev => [data, ...prev]);
      setSuccess('Proveedor creado correctamente');
      setShowCreateModal(false);
      setNewProveedor({});
      setShowAdvancedCreate(false);
      notify.success('Proveedor creado');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al crear proveedor');
    }
  };

  const updateProveedorStatus = async (jid: string, estado: string) => {
    try {
      await api.updateProveedor(parseInt(jid) || 0, { estado } as any);
      setProveedores(prev => prev.map(p => p.jid === jid ? { ...p, estado: estado as any } : p));
      setSuccess('Estado actualizado');
      notify.success('Estado actualizado');
    } catch (err) {
      setError('Error al actualizar estado');
    }
  };

  const deleteProveedor = async (jid: string) => {
    if (!confirm('¿Eliminar este proveedor?')) return;
    try {
      await api.deleteProvider(jid);
      setProveedores(prev => prev.filter(p => p.jid !== jid));
      setSuccess('Proveedor eliminado');
      notify.success('Proveedor eliminado');
    } catch (err) {
      setError('Error al eliminar proveedor');
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'activo': return 'bg-success/20 text-success border-success/30';
      case 'inactivo': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'suspendido': return 'bg-danger/20 text-danger border-danger/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTypeColor = (tipo: string) => {
    switch (tipo) {
      case 'manhwa': return 'bg-teal-500/20 text-info border-teal-500/30';
      case 'manga': return 'bg-accent/20 text-accent border-accent/30';
      case 'anime': return 'bg-info/20 text-info border-info/30';
      case 'novela': return 'bg-success/20 text-success border-success/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-ES');

  const filteredProveedores = proveedores.filter(p => {
    if (!p) return false;
    const matchesSearch = (p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || p.tipo === typeFilter;
    const matchesStatus = statusFilter === 'all' || p.estado === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="panel-page">
      {/* Header */}
      <PageHeader
        title="Gestión de Proveedores"
        description="Administra los proveedores de contenido"
        icon={<Building2 className="w-5 h-5 text-accent" />}
        actions={
          <>
            <Button onClick={() => setShowCreateModal(true)} variant="primary" icon={<Plus className="w-4 h-4" />}>
              Nuevo Proveedor
            </Button>
            <Button onClick={loadProveedores} variant="secondary" loading={loading} icon={<RefreshCw className="w-4 h-4" />}>
              Actualizar
            </Button>
          </>
        }
      />

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="panel-note-card flex items-center gap-3 border-danger/30 text-danger">
            <AlertCircle className="w-5 h-5 text-danger" />
            <span className="text-danger">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-danger hover:text-danger/80">
              <XCircle className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="panel-note-card flex items-center gap-3 border-success/30 text-success">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="text-success">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" delay={0.02} stagger={0.07}>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Total Proveedores" value={stats?.total || 0} icon={<Building2 className="w-6 h-6" />} color="violet" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Activos" value={stats?.activos || 0} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Inactivos" value={stats?.inactivos || 0} icon={<Clock className="w-6 h-6" />} color="warning" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Suspendidos" value={stats?.suspendidos || 0} icon={<XCircle className="w-6 h-6" />} color="danger" delay={0} animated={false} />
        </StaggerItem>
      </Stagger>

      {/* Filters */}
      <Reveal>
        <Card animated delay={0.2} className="p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar proveedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-glass w-full pl-10"
              />
            </div>
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'Todos los tipos' },
                { value: 'manhwa', label: 'Manhwa' },
                { value: 'manga', label: 'Manga' },
                { value: 'anime', label: 'Anime' },
                { value: 'novela', label: 'Novela' },
                { value: 'general', label: 'General' },
              ]}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Todos los estados' },
                { value: 'activo', label: 'Activo' },
                { value: 'inactivo', label: 'Inactivo' },
                { value: 'suspendido', label: 'Suspendido' },
              ]}
            />
          </div>
        </Card>
      </Reveal>

      {/* List */}
      <Card animated delay={0.3} className="overflow-hidden">
        <div className="border-b border-border/15 p-5 text-center sm:p-6 sm:text-left">
          <h2 className="text-xl font-semibold text-foreground">Lista de Proveedores</h2>
          <p className="mt-1 text-muted">
            <AnimatedNumber value={filteredProveedores.length} /> de <AnimatedNumber value={proveedores.length} /> proveedores
          </p>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start justify-between gap-4 rounded-xl border border-border/15 bg-card/60 p-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-56 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <div className="flex items-center gap-3 pt-1">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProveedores.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Building2 className="w-6 h-6 text-muted" />}
              title="No hay proveedores"
              description="No se encontraron proveedores con los filtros aplicados"
              action={
                proveedores.length === 0 ? (
                  <Button onClick={() => setShowCreateModal(true)} variant="primary" icon={<Plus className="w-4 h-4" />}>
                    Crear Primer Proveedor
                  </Button>
                ) : (
                  <Button onClick={loadProveedores} variant="secondary" icon={<RefreshCw className="w-4 h-4" />}>
                    Recargar
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {filteredProveedores.map((proveedor, index) => (
              <motion.div key={proveedor.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }} className="p-5 transition-colors hover:bg-card/55 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-foreground">{proveedor.nombre || 'Sin nombre'}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(proveedor.estado || 'inactivo')}`}>
                        {(proveedor.estado || 'inactivo').charAt(0).toUpperCase() + (proveedor.estado || 'inactivo').slice(1)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(proveedor.tipo || 'general')}`}>
                        {(proveedor.tipo || 'general').charAt(0).toUpperCase() + (proveedor.tipo || 'general').slice(1)}
                      </span>
                        <div className="flex items-center gap-1 text-warning">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="text-sm">{(proveedor.rating || 0).toFixed(1)}</span>
                        </div>
                      </div>
                    <p className="mb-3 line-clamp-2 text-muted">{proveedor.descripcion || 'Sin descripción'}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
                      <div className="flex items-center gap-1"><User className="w-4 h-4" />{proveedor.contacto || 'Sin contacto'}</div>
                      <div className="flex items-center gap-1"><Calendar className="w-4 h-4" />{proveedor.fecha_registro ? formatDate(proveedor.fecha_registro) : 'N/A'}</div>
                      <div className="flex items-center gap-1"><Activity className="w-4 h-4" />{proveedor.total_aportes || 0} aportes</div>
                      <div className="flex items-center gap-1"><MessageSquare className="w-4 h-4" />{proveedor.total_pedidos || 0} pedidos</div>
                    </div>
                  </div>
                  <div className="panel-actions-wrap xl:justify-end">
                    <button
                      onClick={() => proveedor.jid && router.push(`/proveedores/${encodeURIComponent(proveedor.jid)}`)}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                      title="Biblioteca del proveedor"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setSelectedProveedor(proveedor); setShowViewModal(true); }}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-foreground" title="Ver detalles">
                      <Eye className="w-4 h-4" />
                    </button>
                    {proveedor.estado === 'activo' ? (
                      <button onClick={() => proveedor.jid && updateProveedorStatus(proveedor.jid, 'suspendido')}
                        className="p-2 rounded-lg text-gray-400 hover:text-danger hover:bg-danger/10 transition-colors" title="Suspender">
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => proveedor.jid && updateProveedorStatus(proveedor.jid, 'activo')}
                        className="p-2 rounded-lg text-gray-400 hover:text-success hover:bg-success/10 transition-colors" title="Activar">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => proveedor.jid && deleteProveedor(proveedor.jid)}
                      className="p-2 rounded-lg text-gray-400 hover:text-danger hover:bg-danger/10 transition-colors" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* View Modal */}
      <Modal isOpen={showViewModal && !!selectedProveedor} onClose={() => setShowViewModal(false)} title={selectedProveedor?.nombre || ''}>
        {selectedProveedor && (
          <div className="space-y-5">
            <div className="panel-form-grid">
              <div className="panel-field">
                <label className="panel-field-label">Estado</label>
                <span className={`mt-1 inline-flex px-3 py-1 rounded-full text-sm border ${getStatusColor(selectedProveedor.estado)}`}>
                  {selectedProveedor.estado}
                </span>
              </div>
              <div className="panel-field">
                <label className="panel-field-label">Tipo</label>
                <span className={`mt-1 inline-flex px-3 py-1 rounded-full text-sm border ${getTypeColor(selectedProveedor.tipo)}`}>
                  {selectedProveedor.tipo}
                </span>
              </div>
            </div>
            <div className="panel-field">
              <label className="panel-field-label">Descripción</label>
              <p className="panel-readonly-block mt-1">{selectedProveedor.descripcion}</p>
            </div>
            <div className="panel-form-grid">
              <div><label className="panel-field-label">Contacto</label><p className="mt-1 text-foreground">{selectedProveedor.contacto}</p></div>
              <div><label className="panel-field-label">Rating</label>
                <div className="mt-1 flex items-center gap-1 text-warning">
                  <Star className="w-5 h-5 fill-current" /><span className="text-foreground">{selectedProveedor.rating.toFixed(1)}</span>
                </div>
              </div>
              <div><label className="panel-field-label">Total Aportes</label><p className="mt-1 text-foreground">{selectedProveedor.total_aportes}</p></div>
              <div><label className="panel-field-label">Total Pedidos</label><p className="mt-1 text-foreground">{selectedProveedor.total_pedidos}</p></div>
            </div>
            <div className="panel-modal-actions justify-end">
              <Button onClick={() => setShowViewModal(false)} variant="secondary">Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuevo Proveedor">
        <div className="space-y-5">
          <p className="panel-field-hint">
            El proveedor se asocia al grupo. El nombre se toma automáticamente del grupo (podés editarlo en opciones avanzadas).
          </p>
          <div className="panel-field">
            <div className="flex items-center justify-between mb-1">
              <label className="panel-field-label">Grupo de WhatsApp *</label>
              <button 
                onClick={() => loadAvailableGroups({ sync: true })}
                disabled={loadingGroups}
                className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
                title="Refrescar lista de grupos"
              >
                <RefreshCw className={`w-3 h-3 ${loadingGroups ? 'animate-spin' : ''}`} />
                Refrescar
              </button>
            </div>
            {loadingGroups ? (
              <div className="input-glass w-full flex items-center justify-center py-3">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                <span className="text-muted">Cargando grupos...</span>
              </div>
            ) : (
              <Select 
                value={newProveedor.jid || 'none'} 
                onChange={(v) => {
                  const jid = v === 'none' ? '' : v
                  const group = availableGroups.find((g) => (g?.jid || g?.wa_jid || g?.id) === jid) || null
                  const groupName = String(group?.nombre || group?.name || '').trim()
                  setNewProveedor((p) => {
                    const next: any = { ...p, jid }
                    if (!p?.nombre && groupName) next.nombre = groupName
                    return next
                  })
                }} 
                options={[
                  { value: 'none', label: 'Seleccionar grupo' },
                  ...availableGroups.map(group => ({
                    value: group.jid || group.id,
                    label: `${group.nombre || group.name || 'Grupo sin nombre'} (${group.participantes ?? group.participants ?? group.size ?? 0} miembros)`
                  }))
                ]} 
              />
            )}
            {availableGroups.length === 0 && !loadingGroups && (
              <div className="panel-field-hint mt-2 space-y-2">
                <p>No hay grupos disponibles. Asegúrate de que el bot esté conectado a grupos.</p>
                <button
                  type="button"
                  onClick={() => loadAvailableGroups({ sync: true })}
                  className="text-xs text-primary hover:text-primary/80 transition-colors underline"
                >
                  Sincronizar grupos ahora
                </button>
              </div>
            )}
          </div>
          <div className="panel-field">
            <label className="panel-field-label mb-1 block">Tipo *</label>
            <Select value={newProveedor.tipo || 'none'} onChange={(v) => setNewProveedor(p => ({ ...p, tipo: v === 'none' ? '' : v }))} options={[
              { value: 'none', label: 'Seleccionar tipo' },
              { value: 'manhwa', label: 'Manhwa' },
              { value: 'manga', label: 'Manga' },
              { value: 'anime', label: 'Anime' },
              { value: 'novela', label: 'Novela' },
              { value: 'general', label: 'General' }
            ]} />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedCreate((v) => !v)}
            className="text-xs text-muted hover:text-foreground transition-colors underline"
          >
            {showAdvancedCreate ? 'Ocultar opciones avanzadas' : 'Mostrar opciones avanzadas'}
          </button>

          {showAdvancedCreate && (
            <>
              <div className="panel-field">
                <label className="panel-field-label mb-1 block">Nombre (opcional)</label>
                <input
                  type="text"
                  value={newProveedor.nombre || ''}
                  onChange={(e) => setNewProveedor(p => ({ ...p, nombre: e.target.value }))}
                  className="input-glass w-full"
                  placeholder="Si lo dejás vacío, usa el nombre del grupo"
                />
              </div>
              <div className="panel-field">
                <label className="panel-field-label mb-1 block">Descripción</label>
                <textarea
                  value={newProveedor.descripcion || ''}
                  onChange={(e) => setNewProveedor(p => ({ ...p, descripcion: e.target.value }))}
                  className="input-glass w-full"
                  rows={3}
                  placeholder="Descripción del proveedor"
                />
              </div>
              <div className="panel-field">
                <label className="panel-field-label mb-1 block">Contacto</label>
                <input
                  type="text"
                  value={newProveedor.contacto || ''}
                  onChange={(e) => setNewProveedor(p => ({ ...p, contacto: e.target.value }))}
                  className="input-glass w-full"
                  placeholder="Nombre de contacto"
                />
              </div>
            </>
          )}
          <div className="panel-modal-actions">
            <Button onClick={() => setShowCreateModal(false)} variant="secondary" className="flex-1">Cancelar</Button>
            <Button onClick={createProveedor} variant="primary" className="flex-1">Crear Proveedor</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
