'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Search, RefreshCw, CheckCircle, XCircle, Power, PowerOff,
  Star, X, Plus, Radio,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { useGroupsSmartRefresh } from '@/hooks/useSmartRefresh';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import api from '@/services/api';
import { notify } from '@/lib/notify';
import { Group } from '@/types';

export default function GruposPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [botFilter, setBotFilter] = useState<string>('all');
  const [proveedorFilter, setProveedorFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  
  // Usar el contexto global del bot
  const { isGloballyOn: globalBotState } = useBotGlobalState();

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getGroups(page, 20, searchTerm, botFilter !== 'all' ? botFilter : undefined, proveedorFilter !== 'all' ? proveedorFilter : undefined);
      setGroups(response?.items || response?.grupos || response?.data || []);
      setPagination(response?.pagination);
    } catch (err) {
      notify.error('Error al cargar grupos');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, botFilter, proveedorFilter]);

  // Auto-refresh cuando cambia el estado global del bot
  useEffect(() => {
    // Recargar grupos cuando cambie el estado global
    loadGroups();
  }, [globalBotState, loadGroups]);

  // Auto-refresh automático - DISABLED to prevent resource exhaustion
  // useAutoRefresh(loadGroups, { 
  //   interval: 30000, 
  //   dependencies: [searchTerm, botFilter, proveedorFilter, page] 
  // });

  const checkConnectionStatus = useCallback(async () => {
    try {
      const response = await api.getMainBotStatus();
      setConnectionStatus(response);
    } catch (err) {
      console.error('Error checking connection status:', err);
    }
  }, []);

  // Usar smart refresh para grupos
  const { isRefreshing, manualRefresh, isSocketConnected } = useGroupsSmartRefresh(
    useCallback(async () => {
      await Promise.all([loadGroups(), checkConnectionStatus()]);
    }, [loadGroups, checkConnectionStatus])
  );

  useEffect(() => {
    loadGroups();
    checkConnectionStatus();
  }, [loadGroups, checkConnectionStatus]);

  const toggleBot = async (group: Group) => {
    try {
      const action = group.bot_enabled ? 'off' : 'on';
      await api.toggleGroupBot(group.wa_jid, action);
      setGroups(prev => prev.map(g =>
        g.wa_jid === group.wa_jid ? { ...g, bot_enabled: !g.bot_enabled } : g
      ));
      notify.success(`Bot ${action === 'on' ? 'activado' : 'desactivado'} en ${group.nombre}`);
    } catch (err) {
      notify.error('Error al cambiar estado del bot');
    }
  };

  const toggleProveedor = async (group: Group) => {
    try {
      await api.toggleProvider(group.wa_jid, !group.es_proveedor);
      setGroups(prev => prev.map(g =>
        g.wa_jid === group.wa_jid ? { ...g, es_proveedor: !g.es_proveedor } : g
      ));
      notify.success(`Grupo ${!group.es_proveedor ? 'marcado como' : 'desmarcado de'} proveedor`);
    } catch (err) {
      notify.error('Error al cambiar estado de proveedor');
    }
  };

  const syncWhatsAppGroups = async () => {
    if (!connectionStatus?.connected) {
      notify.error('El bot debe estar conectado para sincronizar grupos.');
      return;
    }

    try {
      setSyncing(true);
      const res = await api.syncWhatsAppGroups();
      notify.success(res?.message || 'Grupos sincronizados');
      setShowSyncModal(false);
      await manualRefresh();
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error al sincronizar grupos');
    } finally {
      setSyncing(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadGroups();
  };

  const stats = {
    total: pagination?.total || groups.length,
    botActivo: globalBotState ? groups.filter(g => g.bot_enabled).length : 0,
    botInactivo: globalBotState ? groups.filter(g => !g.bot_enabled).length : groups.length,
    proveedores: groups.filter(g => g.es_proveedor).length,
  };

  const groupLanes = [
    {
      label: 'Sincronizacion',
      value: connectionStatus?.connected ? 'Lista para leer WhatsApp' : 'Bloqueada por desconexion',
      description: connectionStatus?.connected ? 'Puedes traer grupos reales desde la sesion activa.' : 'Necesitas reconectar el bot antes de sincronizar.',
      icon: <RefreshCw className="w-4 h-4" />,
      badge: connectionStatus?.connected ? 'ready' : 'locked',
      badgeClassName: connectionStatus?.connected ? 'border-[#25d366]/20 bg-[#25d366]/10 text-[#c7f9d8]' : 'border-rose-400/20 bg-rose-500/10 text-rose-300',
      glowClassName: 'from-[#25d366]/18 via-[#2dd4bf]/10 to-transparent',
    },
    {
      label: 'Cobertura del bot',
      value: `${stats.botActivo}/${stats.total || 0}`,
      description: globalBotState ? 'Grupos con el bot encendido dentro de la red actual.' : 'El estado global mantiene toda la red en pausa.',
      icon: <Power className="w-4 h-4" />,
      badge: globalBotState ? 'activo' : 'global off',
      badgeClassName: globalBotState ? 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan' : 'border-amber-400/20 bg-amber-500/10 text-amber-300',
      glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
    },
    {
      label: 'Modo de lectura',
      value: isSocketConnected ? 'Tiempo real' : 'Fallback',
      description: isSocketConnected ? 'El panel recibe cambios de grupos en vivo.' : 'Sigue operativo, pero depende de recargas.',
      icon: <Radio className="w-4 h-4" />,
      badge: isSocketConnected ? 'live' : 'http',
      badgeClassName: isSocketConnected ? 'border-violet-400/20 bg-violet-500/10 text-violet-300' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-violet-400/18 via-oguri-lavender/10 to-transparent',
    },
    {
      label: 'Proveedores',
      value: `${stats.proveedores}`,
      description: 'Grupos marcados como fuente operativa o proveedor confiable.',
      icon: <Star className="w-4 h-4" />,
      badge: 'catalogo',
      badgeClassName: 'border-amber-400/20 bg-amber-500/10 text-amber-300',
      glowClassName: 'from-amber-400/18 via-yellow-400/10 to-transparent',
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[440px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-oguri-cyan/18 blur-3xl"
          animate={{ x: [0, 18, 0], y: [0, 14, 0], opacity: [0.18, 0.38, 0.18] }}
          transition={{ repeat: Infinity, duration: 11.2, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-lavender/18 blur-3xl"
          animate={{ x: [0, -18, 0], y: [0, 18, 0], opacity: [0.18, 0.4, 0.18] }}
          transition={{ repeat: Infinity, duration: 10.6, ease: 'easeInOut', delay: 0.6 }}
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
              <MessageSquare className="h-3.5 w-3.5 text-oguri-cyan" />
              Red de grupos
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Malla activa de WhatsApp</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Organiza los grupos conectados, el alcance del bot y la sincronizacion de la comunidad desde una sola vista.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Grupos</p>
              <p className="mt-2 text-lg font-black text-white">{stats.total}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Cobertura</p>
              <p className="mt-2 text-lg font-black text-white">{stats.botActivo}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Live</p>
              <p className="mt-2 text-lg font-black text-white">{isSocketConnected ? 'On' : 'Fallback'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Banner de estado global */}
      {!globalBotState && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4"
        >
          <div className="flex items-center gap-3">
            <PowerOff className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-red-400 font-medium">Bot Apagado Globalmente</p>
              <p className="text-red-300/70 text-sm">
                El bot está desactivado en todos los grupos. Los toggles individuales no funcionarán hasta que se reactive globalmente.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <PageHeader
        title="Gestión de Grupos"
        description="Administra los grupos de WhatsApp conectados"
        icon={<MessageSquare className="w-6 h-6 text-primary-400" />}
        actions={
          <>
            {connectionStatus && (
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  connectionStatus.connected
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus.connected ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                {connectionStatus.connected ? 'Bot Conectado' : 'Bot Desconectado'}
              </div>
            )}

            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                isSocketConnected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
              {isSocketConnected ? 'Tiempo Real' : 'Modo Fallback'}
            </div>

            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowSyncModal(true)}
              loading={syncing}
            >
              Sincronizar WhatsApp
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {groupLanes.map((lane, index) => (
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
          <StatCard title="Total Grupos" value={stats.total} icon={<MessageSquare className="w-6 h-6" />} color="primary" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Bot Activo" value={stats.botActivo} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Bot Inactivo" value={stats.botInactivo} icon={<XCircle className="w-6 h-6" />} color="danger" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Proveedores" value={stats.proveedores} icon={<Star className="w-6 h-6" />} color="warning" delay={0} />
        </StaggerItem>
      </Stagger>

      {/* Filters */}      {/* Filters */}
      <Card animated delay={0.2} className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="text"
              placeholder="Buscar por nombre o JID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input-search w-full"
            />
          </div>
          <Select value={botFilter} onValueChange={setBotFilter}>
            <SelectTrigger className="w-full xl:w-44">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Bot Activo</SelectItem>
              <SelectItem value="false">Bot Inactivo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={proveedorFilter} onValueChange={setProveedorFilter}>
            <SelectTrigger className="w-full xl:w-44">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Proveedores</SelectItem>
              <SelectItem value="false">No Proveedores</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="primary" onClick={handleSearch} className="xl:min-w-[120px]">Buscar</Button>
        </div>
      </Card>

      {/* Groups Grid */}
      <Card animated delay={0.3}>
        <div className="border-b border-border/15 p-5 text-center sm:p-6 sm:text-left">
          <h2 className="text-lg font-semibold text-foreground">Lista de Grupos</h2>
          <p className="mt-1 text-sm text-muted">{groups.length} grupos mostrados</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="panel-surface-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-4 w-40 rounded" />
                      <Skeleton className="h-3 w-52 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border/15 pt-4">
                  <Skeleton className="h-4 w-24 rounded" />
                  <div className="flex items-center gap-2">
                    <SkeletonCircle className="h-9 w-9" />
                    <SkeletonCircle className="h-9 w-9" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<MessageSquare className="w-6 h-6 text-muted" />}
              title="No hay grupos"
              description="No se encontraron grupos con los filtros aplicados"
              action={
                <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={() => manualRefresh()}>
                  Recargar
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {groups.map((group, index) => (
                <motion.div
                  key={group.wa_jid || group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="panel-surface-soft p-5 transition-all hover:border-primary/25 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        group.bot_enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate font-semibold text-foreground">{group.nombre}</h3>
                        <p className="truncate text-xs text-muted">{group.wa_jid}</p>
                      </div>
                    </div>
                    {group.es_proveedor && (
                      <span className="badge badge-warning">
                        <Star className="w-3 h-3 mr-1" />
                        Proveedor
                      </span>
                    )}
                  </div>

                  {group.descripcion && (
                    <p className="mb-4 line-clamp-2 text-sm text-muted">{group.descripcion}</p>
                  )}

                  <div className="space-y-3">
                    <div className="panel-data-row">
                      <span className="panel-data-row__label">JID</span>
                      <span className="panel-data-row__value truncate">{group.wa_jid}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/15 pt-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${
                        globalBotState && group.bot_enabled 
                          ? 'text-emerald-400' 
                          : 'text-red-400'
                      }`}>
                        {globalBotState 
                          ? (group.bot_enabled ? 'Bot Activo' : 'Bot Inactivo')
                          : 'Bot Apagado (Global)'
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleProveedor(group)}
                        className={`p-2 rounded-lg transition-colors ${
                          group.es_proveedor
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-muted hover:bg-white/5'
                        }`}
                        title={group.es_proveedor ? 'Quitar proveedor' : 'Marcar como proveedor'}
                      >
                        <Star className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: globalBotState ? 1.1 : 1 }}
                        whileTap={{ scale: globalBotState ? 0.9 : 1 }}
                        onClick={() => globalBotState ? toggleBot(group) : notify.error('El bot está apagado globalmente')}
                        disabled={!globalBotState}
                        className={`p-2 rounded-lg transition-colors ${
                          !globalBotState
                            ? 'cursor-not-allowed bg-gray-500/10 text-gray-500 opacity-50'
                            : group.bot_enabled
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-red-400 bg-red-500/10'
                        }`}
                        title={
                          !globalBotState 
                            ? 'Bot apagado globalmente' 
                            : group.bot_enabled 
                            ? 'Desactivar bot' 
                            : 'Activar bot'
                        }
                      >
                        {!globalBotState ? (
                          <PowerOff className="w-4 h-4" />
                        ) : group.bot_enabled ? (
                          <Power className="w-4 h-4" />
                        ) : (
                          <PowerOff className="w-4 h-4" />
                        )}
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
          <div className="flex flex-col gap-3 border-t border-border/15 p-5 text-center sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:text-left">
            <p className="text-sm text-muted">
              Página {pagination.page} de {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Anterior
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Sync Modal */}
      <Modal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} title="Sincronizar Grupos de WhatsApp">
        <div className="space-y-4">
          {connectionStatus && (
            <div className={`rounded-2xl border p-4 ${
              connectionStatus.connected 
                ? 'bg-emerald-500/10 border-emerald-500/20' 
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  connectionStatus.connected ? 'bg-emerald-400' : 'bg-red-400'
                }`} />
                <span className={`text-sm font-medium ${
                  connectionStatus.connected ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  Estado: {connectionStatus.connected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              {!connectionStatus.connected && (
                <p className="text-xs text-red-400">
                  El bot debe estar conectado para sincronizar grupos.
                </p>
              )}
            </div>
          )}
          
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">¿Qué hace la sincronización?</span>
            </div>
              <p className="text-xs text-muted">
                Obtiene la lista actual de grupos de WhatsApp y actualiza la base de datos.
              </p>
          </div>

          <div className="panel-modal-actions">
            <Button
              variant="primary"
              className="flex-1"
              loading={syncing}
              disabled={syncing || !connectionStatus?.connected}
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={syncWhatsAppGroups}
            >
              Sincronización Simple
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setShowSyncModal(false)} disabled={syncing}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
