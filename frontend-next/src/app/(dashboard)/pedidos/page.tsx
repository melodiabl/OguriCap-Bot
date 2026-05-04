'use client';
import { getErrorMessage } from '@/lib/utils';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, RefreshCw, Clock, CheckCircle, XCircle, Loader2, Eye, Plus, X,
  ArrowUp, ArrowDown, Minus, Radio, Heart, Sparkles, Bot, Download, Send, Trash2,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { usePedidosSmartRefresh } from '@/hooks/useSmartRefresh';
import api from '@/services/api';
import { notify } from '@/lib/notif';
import { Pedido } from '@/types';

const PENDING_LIBRARY_PROCESS_STORAGE_KEY = 'panel:pedidos:pending-library-process:v1';

export default function PedidosPage() {
  const { user } = useAuth();
  const { isAdmin: isAdminFn, isModerator: isModeratorFn } = usePermissions();
  const isAdmin = isAdminFn();
  const isModerator = isModeratorFn();
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
  const [libraryMatches, setLibraryMatches] = useState<any>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [providerGroupJid, setProviderGroupJid] = useState('');
  const [sendToJid, setSendToJid] = useState('');
  const [sendingItemId, setSendingItemId] = useState<number | null>(null);
  const [markCompletedOnSend, setMarkCompletedOnSend] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Pedido | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingLibraryProcessIds, setPendingLibraryProcessIds] = useState<Set<number>>(() => new Set());
  const lastAutoLibraryAttemptRef = React.useRef<string>('');

  const loadPedidos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getPedidos(page, 20, searchTerm, estadoFilter !== 'all' ? estadoFilter : undefined, prioridadFilter !== 'all' ? prioridadFilter : undefined);
      setPedidos(response?.pedidos || response?.data || []);
      setPagination(response?.pagination);
    } catch (err) {
      notify.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, estadoFilter, prioridadFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.getPedidoStats();
      setStats(response);
    } catch (err) {
      console.error('Error loading stats:', getErrorMessage(err));
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PENDING_LIBRARY_PROCESS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const ids = parsed.map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0);
      setPendingLibraryProcessIds(new Set(ids));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PENDING_LIBRARY_PROCESS_STORAGE_KEY,
        JSON.stringify(Array.from(pendingLibraryProcessIds.values()))
      );
    } catch {
      // ignore
    }
  }, [pendingLibraryProcessIds]);

  useEffect(() => {
    if (!selectedPedido) {
      setLibraryMatches(null);
      setProviderGroupJid('');
      setSendToJid('');
      return;
    }

    const possibleGroup = String((selectedPedido as any)?.grupo_id || (selectedPedido as any)?.groupJid || '').trim();
    if (possibleGroup.endsWith('@g.us')) {
      setProviderGroupJid(possibleGroup);
      setSendToJid(possibleGroup);
    }

    const hasBot = Boolean((selectedPedido as any)?.bot?.matches?.length);
    if (hasBot) {
      void (async () => {
        try {
          setLibraryLoading(true);
          const data = await api.getPedidoLibraryMatches(selectedPedido.id);
          setLibraryMatches(data);
        } catch {
          setLibraryMatches(null);
        } finally {
          setLibraryLoading(false);
        }
      })();
    } else {
      setLibraryMatches(null);
    }
  }, [selectedPedido]);

  const markPendingLibraryProcess = useCallback((pedidoId: number, message: string) => {
    setPendingLibraryProcessIds(prev => {
      if (prev.has(pedidoId)) return prev;
      const next = new Set(prev);
      next.add(pedidoId);
      return next;
    });
    notify.info(message);
  }, []);

  const clearPendingLibraryProcess = useCallback((pedidoId: number) => {
    setPendingLibraryProcessIds(prev => {
      if (!prev.has(pedidoId)) return prev;
      const next = new Set(prev);
      next.delete(pedidoId);
      return next;
    });
  }, []);

  const processPedido = useCallback(async (pedido: Pedido) => {
    const providerOverride = providerGroupJid.trim();
    const baseGroup = String((pedido as any)?.grupo_id || '').trim();
    const groupJid =
      providerOverride && providerOverride.endsWith('@g.us') ? providerOverride : baseGroup;

    if (!groupJid || !groupJid.endsWith('@g.us')) {
      markPendingLibraryProcess(
        pedido.id,
        'No disponible: falta configurar un grupo proveedor. Pedido pasó a "En espera" y se reintentará al configurarlo.'
      );
      return;
    }

    try {
      setLibraryLoading(true);
      await api.processPedidoWithLibrary(pedido.id, groupJid);
      const data = await api.getPedidoLibraryMatches(pedido.id);
      setLibraryMatches(data);
      notify.success('Pedido procesado y listado');
      clearPendingLibraryProcess(pedido.id);
    } catch (err: any) {
      const status = Number(err?.response?.status || 0);
      const apiError = String(err?.response?.data?.error || '').trim();

      if (status === 404 && apiError.toLowerCase().includes('proveedor')) {
        markPendingLibraryProcess(
          pedido.id,
          'Proveedor no configurado para este grupo. Pedido pasó a "En espera". Configurá el proveedor y reintentá.'
        );
        return;
      }

      notify.error(apiError || 'Error procesando pedido');
    } finally {
      setLibraryLoading(false);
    }
  }, [clearPendingLibraryProcess, markPendingLibraryProcess, providerGroupJid]);

  useEffect(() => {
    if (!selectedPedido?.id) return;
    if (!pendingLibraryProcessIds.has(selectedPedido.id)) return;
    if (libraryLoading) return;

    const providerOverride = providerGroupJid.trim();
    const baseGroup = String((selectedPedido as any)?.grupo_id || '').trim();
    const groupJid =
      providerOverride && providerOverride.endsWith('@g.us') ? providerOverride : baseGroup;
    if (!groupJid.endsWith('@g.us')) return;

    const attemptKey = `${selectedPedido.id}:${groupJid}`;
    if (lastAutoLibraryAttemptRef.current === attemptKey) return;
    lastAutoLibraryAttemptRef.current = attemptKey;
    void processPedido(selectedPedido);
  }, [libraryLoading, pendingLibraryProcessIds, processPedido, providerGroupJid, selectedPedido]);

  const sendItemToWhatsApp = async (itemId: number) => {
    const jid = sendToJid.trim();
    if (!jid) {
      notify.error('Ingresa un JID destino (ej: 1203630...@g.us)');
      return;
    }
    try {
      setSendingItemId(itemId);
      const res = await api.sendLibraryItem(itemId, jid, { pedidoId: selectedPedido?.id, markCompleted: markCompletedOnSend });
      notify.success('Enviado por WhatsApp');
      if (markCompletedOnSend && res?.pedido) {
        setPedidos(prev => prev.map(p => p.id === res.pedido.id ? { ...(p as any), ...(res.pedido as any) } : p));
        setSelectedPedido(prev => prev ? ({ ...(prev as any), ...(res.pedido as any) } as any) : prev);
      }
    } catch (err: any) {
      const link = err?.response?.data?.link;
      if (link) {
        notify.warning('Archivo muy grande. Usa el link de descarga.');
        window.open(link, '_blank', 'noopener,noreferrer');
        if (markCompletedOnSend) {
          const updated = err?.response?.data?.pedido
          if (updated?.id) {
            setPedidos(prev => prev.map(p => p.id === updated.id ? { ...(p as any), ...(updated as any) } : p));
            setSelectedPedido(prev => prev ? ({ ...(prev as any), ...(updated as any) } as any) : prev);
          }
        }
        return;
      }
      notify.error(err?.response?.data?.error || 'Error enviando');
    } finally {
      setSendingItemId(null);
    }
  };

  const updateEstado = async (id: number, estado: string) => {
    try {
      await api.updatePedido(id, { estado } as any);
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: estado as any } : p));
      
      // Crear notificación automática
      const pedido = pedidos.find(p => p.id === id);
      void api
        .createNotification({
          title: `Pedido ${estado.replace('_', ' ')}`,
          message: `El pedido "${pedido?.titulo}" ha cambiado a estado: ${estado.replace('_', ' ')}`,
          type: estado === 'completado' ? 'success' : estado === 'cancelado' ? 'error' : 'info',
          category: 'pedidos',
        })
        .catch(() => {});
      
      notify.success(`Pedido actualizado a ${estado}`);
      loadStats();
    } catch (err) {
      notify.error('Error al actualizar pedido');
    }
  };

  const voteForPedido = async (id: number) => {
    try {
      // Usar API real de votos
      const response = await api.votePedido(id);
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, votos: response.votos || ((p as any).votos || 0) + 1 } as any : p));
      notify.success('Voto registrado');
    } catch (err) {
      notify.error('Error al votar');
    }
  };
  
  const deletePedido = async (pedido: Pedido) => {
    try {
      setDeleting(true);
      await api.deletePedido(pedido.id);
      notify.success('Pedido eliminado');
      setPedidos(prev => prev.filter(p => p.id !== pedido.id));
      if (selectedPedido?.id === pedido.id) setSelectedPedido(null);
      setDeleteTarget(null);
      loadStats();
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error al eliminar pedido');
    } finally {
      setDeleting(false);
    }
  };
  const createPedido = async () => {
    try {
      if (!newPedido.titulo.trim()) {
        notify.error('El título es requerido');
        return;
      }
      setCreatingPedido(true);
      const pedidoData = { ...newPedido, usuario: user?.username || 'Anónimo' };
      const result = await api.createPedido(pedidoData as any);
      
      // Crear notificación automática
      void api
        .createNotification({
          title: 'Nuevo Pedido Creado',
          message: `Se ha creado el pedido "${newPedido.titulo}" con prioridad ${newPedido.prioridad}`,
          type: 'info',
          category: 'pedidos',
        })
        .catch(() => {});
      
      notify.success('Pedido creado correctamente');
      setShowCreateModal(false);
      setNewPedido({ titulo: '', descripcion: '', tipo: 'manhwa', prioridad: 'media' });
      loadPedidos();
      loadStats();
    } catch (err) {
      notify.error('Error al crear pedido');
    } finally {
      setCreatingPedido(false);
    }
  };

  const improveWithAI = async () => {
    try {
      const titulo = newPedido.titulo.trim();
      if (!titulo) {
        notify.error('El título es requerido');
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
        notify.error('La IA no devolvió contenido');
        return;
      }
      setNewPedido(prev => ({ ...prev, descripcion: improved }));
      notify.success('Descripción mejorada');
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error usando IA');
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
      alta: { class: 'bg-danger/20 text-danger border-danger/30', icon: <ArrowUp className="w-3 h-3" /> },
      media: { class: 'bg-warning/20 text-warning border-warning/30', icon: <Minus className="w-3 h-3" /> },
      baja: { class: 'bg-success/20 text-success border-success/30', icon: <ArrowDown className="w-3 h-3" /> },
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

  const actionButtonClass = 'flex h-10 w-10 items-center justify-center rounded-xl border border-border/15 bg-card/60 transition-all hover:border-border/25 hover:bg-card/80';

  const renderPedidoActions = (pedido: Pedido) => (
    <div className="flex flex-wrap items-center gap-2">
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSelectedPedido(pedido)} className={`${actionButtonClass} text-info`} title="Ver detalles">
        <Eye className="w-4 h-4" />
      </motion.button>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => voteForPedido(pedido.id)} className={`${actionButtonClass} text-pink-400`} title="Votar pedido">
        <Heart className="w-4 h-4" />
      </motion.button>
      {(isAdmin || isModerator) && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setDeleteTarget(pedido)}
          className={`${actionButtonClass} text-danger`}
          title="Eliminar pedido"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>
      )}
      {(isAdmin || isModerator) && pedido.estado === 'pendiente' && (
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => updateEstado(pedido.id, 'en_proceso')} className={`${actionButtonClass} text-warning`} title="Marcar en proceso">
          <Loader2 className="w-4 h-4" />
        </motion.button>
      )}
      {(isAdmin || isModerator) && pedido.estado === 'en_proceso' && (
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => updateEstado(pedido.id, 'completado')} className={`${actionButtonClass} text-success`} title="Marcar completado">
          <CheckCircle className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );

  const pedidoLanes = [
    {
      label: 'Refresh del flujo',
      value: smartRefreshConnected ? 'Tiempo real activo' : 'Fallback',
      description: smartRefreshConnected ? 'Los cambios de estado llegan al panel sin recargar manualmente.' : 'La vista sigue operativa, pero depende de refresh manual.',
      icon: <Radio className="w-4 h-4" />,
      badge: smartRefreshConnected ? 'live' : 'manual',
      badgeClassName: smartRefreshConnected ? 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan' : 'border-warning/20 bg-warning/10 text-warning/80',
      glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
    },
    {
      label: 'Pendientes de biblioteca',
      value: `${pendingLibraryProcessIds.size}`,
      description: pendingLibraryProcessIds.size > 0 ? 'Pedidos en espera por grupo proveedor o reproceso.' : 'No hay procesos de biblioteca colgados ahora mismo.',
      icon: <Bot className="w-4 h-4" />,
      badge: pendingLibraryProcessIds.size > 0 ? 'queue' : 'ok',
      badgeClassName: pendingLibraryProcessIds.size > 0 ? 'border-warning/20 bg-warning/10 text-warning/80' : 'border-accent/20 bg-accent/10 text-accent',
      glowClassName: 'from-amber-400/18 via-oguri-gold/10 to-transparent',
    },
    {
      label: 'Permisos de gestion',
      value: isAdmin ? 'Admin total' : isModerator ? 'Moderacion' : 'Usuario',
      description: isAdmin || isModerator ? 'Puedes intervenir estados y limpiar pedidos del flujo.' : 'Puedes crear, ver y votar pedidos de la comunidad.',
      icon: <Sparkles className="w-4 h-4" />,
      badge: isAdmin ? 'admin' : isModerator ? 'mod' : 'user',
      badgeClassName: isAdmin || isModerator ? 'border-[rgb(var(--success))]/20 bg-[rgb(var(--success))]/10 text-[#c7f9d8]' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-[rgb(var(--success))]/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Prioridad alta',
      value: `${stats?.alta || pedidos.filter((pedido) => pedido.prioridad === 'alta').length || 0}`,
      description: 'Pedidos urgentes que conviene mirar antes que el resto de la cola.',
      icon: <ArrowUp className="w-4 h-4" />,
      badge: 'urgent',
      badgeClassName: 'border-danger/20 bg-danger/10 text-danger/80',
      glowClassName: 'from-rose-400/18 via-oguri-purple/10 to-transparent',
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-oguri-gold/18 blur-3xl"
          animate={{ x: [0, 16, 0], y: [0, 14, 0], opacity: [0.18, 0.38, 0.18] }}
          transition={{ repeat: Infinity, duration: 10.8, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-purple/18 blur-3xl"
          animate={{ x: [0, -18, 0], y: [0, 18, 0], opacity: [0.18, 0.4, 0.18] }}
          transition={{ repeat: Infinity, duration: 11.2, ease: 'easeInOut', delay: 0.5 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(var(--page-a),0.18),rgba(var(--page-b),0.10),rgba(var(--page-c),0.12))] p-5 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6"
      >
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit">
              <ShoppingCart className="h-3.5 w-3.5 text-oguri-gold" />
              Cola operativa
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Gestión de pedidos con lectura táctica</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Solicitudes, prioridad y seguimiento de la comunidad en una vista más intensa y fácil de escanear.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Items</p>
              <p className="mt-2 text-lg font-black text-white">{pedidos.length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Pendientes</p>
              <p className="mt-2 text-lg font-black text-white">{pedidos.filter((pedido) => pedido.estado === 'pendiente').length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Canal</p>
              <p className="mt-2 text-lg font-black text-white">{smartRefreshConnected ? 'LIVE' : 'FALLBACK'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <PageHeader
        title="Gestión de Pedidos"
        description="Administra las solicitudes de la comunidad"
        icon={<ShoppingCart className="w-6 h-6 text-primary-400" />}
        actions={
          <>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                smartRefreshConnected
                  ? 'bg-success/20 text-success border border-success/30'
                  : 'bg-warning/20 text-warning border border-warning/30'
              }`}
            >
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
              title={smartRefreshConnected ? 'Actualizaci?n manual (autom?tica por eventos)' : 'Actualizaci?n manual'}
            >
              {isRefreshing ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {pedidoLanes.map((lane, index) => (
          <motion.div
            key={lane.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 + index * 0.05, duration: 0.3 }}
            className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#101512]/86 p-4 shadow-[0_22px_70px_-36px_rgba(0,0,0,0.4)]"
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${lane.glowClassName}`} />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
                  {lane.icon}
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${lane.badgeClassName}`}>
                  {lane.badge}
                </span>
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

      {/* Stats */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" delay={0.06} stagger={0.06}>
        <StaggerItem>
          <StatCard title="Total Pedidos" value={stats?.total || 0} icon={<ShoppingCart className="w-6 h-6" />} color="primary" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Pendientes" value={stats?.pendientes || 0} icon={<Clock className="w-6 h-6" />} color="warning" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="En Proceso" value={stats?.en_proceso || 0} icon={<Loader2 className="w-6 h-6" />} color="info" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Completados" value={stats?.completados || 0} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0} />
        </StaggerItem>
      </Stagger>

      {/* Filters */}      {/* Filters */}
      <Card animated delay={0.2} className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input type="text" placeholder="Buscar pedidos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadPedidos()} className="input-search w-full" />
          </div>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-full xl:w-44"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="en_proceso">En Proceso</SelectItem>
              <SelectItem value="completado">Completados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={prioridadFilter} onValueChange={setPrioridadFilter}>
            <SelectTrigger className="w-full xl:w-44"><SelectValue placeholder="Todas" /></SelectTrigger>
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
        <div className="border-b border-border/15 p-5 text-center sm:p-6 sm:text-left">
          <h2 className="text-lg font-semibold text-foreground">Lista de Pedidos</h2>
          <p className="mt-1 text-sm text-muted">{pedidos.length} pedidos mostrados</p>
        </div>

        {loading ? (
          <div className="panel-empty-state">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-muted">Cargando pedidos...</p>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="panel-empty-state">
            <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-muted" />
            <h3 className="mb-2 text-lg font-medium text-foreground">No hay pedidos</h3>
            <p className="text-muted">No se encontraron pedidos con los filtros aplicados</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {pedidos.map((pedido, index) => (
                <motion.div
                  key={pedido.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="panel-surface-soft p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{pedido.titulo}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{pedido.contenido_solicitado || (pedido as any).descripcion}</p>
                    </div>
                    {getEstadoBadge(pedido.estado)}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {getPrioridadBadge(pedido.prioridad)}
                    <span className="badge badge-info">{(pedido as any).votos || 0} votos</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="panel-data-row">
                      <span className="panel-data-row__label">Usuario</span>
                      <span className="panel-data-row__value">{pedido.usuario?.username || (pedido as any).usuario || '-'}</span>
                    </div>
                    <div className="panel-data-row">
                      <span className="panel-data-row__label">Fecha</span>
                      <span className="panel-data-row__value">{formatDate(pedido.created_at)}</span>
                    </div>
                  </div>

                  <div className="panel-actions-wrap mt-4 border-t border-border/15 pt-4">
                    {renderPedidoActions(pedido)}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
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
                  <AnimatePresence mode="popLayout" initial={false}>
                    {pedidos.map((pedido, index) => (
                      <motion.tr
                        key={pedido.id}
                        layout="position"
                        initial={{ opacity: 0, y: 16, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.99 }}
                        transition={{
                          delay: index * 0.03,
                          opacity: { duration: 0.18, ease: 'easeOut' },
                          filter: { duration: 0.22, ease: 'easeOut' },
                          y: { type: 'spring', stiffness: 420, damping: 34, mass: 0.85 },
                          scale: { type: 'spring', stiffness: 420, damping: 34, mass: 0.85 },
                        }}
                      >
                        <td>
                          <div className="max-w-xs">
                            <p className="truncate font-medium text-foreground">{pedido.titulo}</p>
                            <p className="truncate text-xs text-muted">{pedido.contenido_solicitado || (pedido as any).descripcion}</p>
                          </div>
                        </td>
                        <td>{getPrioridadBadge(pedido.prioridad)}</td>
                        <td><span className="text-[rgb(var(--text-secondary))]">{pedido.usuario?.username || (pedido as any).usuario || '-'}</span></td>
                        <td>{getEstadoBadge(pedido.estado)}</td>
                        <td><span className="font-medium text-foreground">{(pedido as any).votos || 0}</span></td>
                        <td><span className="text-sm text-muted">{formatDate(pedido.created_at)}</span></td>
                        <td>{renderPedidoActions(pedido)}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-border/15 p-5 text-center sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:text-left">
            <p className="text-sm text-muted">Página {pagination.page} de {pagination.totalPages}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuevo Pedido">
        <div className="space-y-5">
          <div className="panel-field">
            <label className="panel-field-label">Título del Pedido</label>
            <input
              type="text"
              value={newPedido.titulo}
              onChange={(e) => setNewPedido({ ...newPedido, titulo: e.target.value })}
              className="input-glass w-full"
              placeholder="Ej: Manhwa Solo Leveling completo"
              data-autofocus
            />
          </div>
          <div className="panel-field">
            <div className="flex items-center justify-between mb-2">
              <label className="panel-field-label">Descripción</label>
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
          <div className="panel-form-grid">
            <div className="panel-field">
              <label className="panel-field-label">Tipo de Contenido</label>
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
            <div className="panel-field">
              <label className="panel-field-label">Prioridad</label>
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
            <div className="rounded-2xl border border-info/20 bg-info/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-5 h-5 text-info animate-pulse" />
                <span className="text-sm font-medium text-info">IA Procesando</span>
              </div>
              <p className="text-xs text-muted">La IA está analizando tu pedido...</p>
            </div>
          )}
          <div className="panel-modal-actions">
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
          <div className="space-y-5">
            <div className="panel-data-row">
              <span className="text-muted">Estado</span>
              {getEstadoBadge(selectedPedido.estado)}
            </div>
            <div className="panel-data-row">
              <span className="text-muted">Prioridad</span>
              {getPrioridadBadge(selectedPedido.prioridad)}
            </div>
            <div className="panel-readonly-block">
              <h4 className="mb-2 font-medium text-foreground">{selectedPedido.titulo}</h4>
              <p className="text-sm text-muted">{selectedPedido.contenido_solicitado || (selectedPedido as any).descripcion}</p>
            </div>
            <div className="panel-form-grid">
              <div className="panel-mini-tile">
                <p className="text-xs text-muted">Usuario</p>
                <p className="text-foreground">{selectedPedido.usuario?.username || (selectedPedido as any).usuario || '-'}</p>
              </div>
              <div className="panel-mini-tile">
                <p className="text-xs text-muted">Votos</p>
                <p className="text-foreground">{(selectedPedido as any).votos || 0}</p>
              </div>
            </div>

            {/* Delivery / Matches */}
            <div className="panel-readonly-block">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Entrega de contenido</p>
                  <p className="text-xs text-muted">Lista de capítulos/archivos encontrados en la biblioteca del proveedor.</p>
                </div>
                <div className="flex items-center gap-2">
                  {pendingLibraryProcessIds.has(selectedPedido.id) && (
                    <span className="badge-warning">
                      <Clock className="w-3 h-3" />
                      <span className="ml-1">En espera</span>
                    </span>
                  )}
                  {(isAdmin || isModerator) && (
                    <Button
                      variant="secondary"
                      icon={<Bot className={`w-4 h-4 ${libraryLoading ? 'animate-spin' : ''}`} />}
                      onClick={() => processPedido(selectedPedido)}
                      disabled={libraryLoading}
                    >
                      Procesar
                    </Button>
                  )}
                </div>
              </div>

              <div className="panel-form-grid mb-3">
                <div className="panel-field">
                  <label className="panel-field-label text-xs">Grupo proveedor (para buscar)</label>
                  <input
                    value={providerGroupJid}
                    onChange={(e) => setProviderGroupJid(e.target.value)}
                    placeholder="Ej: 1203630...@g.us"
                    className="input-glass w-full"
                  />
                </div>
                <div className="panel-field">
                  <label className="panel-field-label text-xs">Enviar a (JID)</label>
                  <input
                    value={sendToJid}
                    onChange={(e) => setSendToJid(e.target.value)}
                    placeholder="Ej: 1203630...@g.us o 521234...@s.whatsapp.net"
                    className="input-glass w-full"
                  />
                </div>
              </div>

              <label className="mb-3 flex select-none items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={markCompletedOnSend}
                  onChange={(e) => setMarkCompletedOnSend(e.target.checked)}
                  className="accent-emerald-500"
                />
                Marcar pedido como completado al entregar
              </label>

              {libraryLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando coincidencias...
                </div>
              ) : (libraryMatches?.matches?.length ? (
                <div className="space-y-2">
                  {libraryMatches.matches.slice(0, 8).map((m: any) => (
                    <div key={m.id} className="panel-data-row">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {m.item?.title || m.item?.originalName || `Archivo #${m.id}`}
                            {m.item?.chapter ? ` · Cap ${m.item.chapter}` : ''}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted">
                            {String(m.item?.category || 'other').toUpperCase()} · {String(m.item?.format || 'file').toUpperCase()} · score {Math.round(Number(m.score || 0))}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.item?.url && (
                            <a
                              href={m.item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                              title="Descargar"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {(isAdmin || isModerator) && (
                            <button
                              onClick={() => sendItemToWhatsApp(Number(m.id))}
                               className="rounded-lg p-2 text-muted transition-colors hover:bg-success/10 hover:text-success/80 disabled:opacity-60"
                              title="Enviar por WhatsApp"
                              disabled={sendingItemId === Number(m.id)}
                            >
                              <Send className={`w-4 h-4 ${sendingItemId === Number(m.id) ? 'animate-pulse' : ''}`} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Aún no hay resultados. Procesa el pedido para buscar en la biblioteca.</p>
              ))}
            </div>

            <div className="panel-modal-actions">
              <Button variant="secondary" className="flex-1" icon={<Heart className="w-4 h-4" />} onClick={() => { voteForPedido(selectedPedido.id); setSelectedPedido(null); }}>
                Votar ({(selectedPedido as any).votos || 0})
              </Button>
              {(isAdmin || isModerator) && (
                <Button
                  variant="danger"
                  className="flex-1"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => setDeleteTarget(selectedPedido)}
                >
                  Eliminar
                </Button>
              )}
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

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Eliminar pedido"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[rgb(var(--text-secondary))]">
              ¿Seguro que quieres eliminar el pedido <span className="font-medium text-foreground">#{deleteTarget.id}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="panel-modal-actions">
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
                onClick={() => deletePedido(deleteTarget)}
                loading={deleting}
              >
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
