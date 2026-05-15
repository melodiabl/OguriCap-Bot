'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Users, Search, MessageSquare, Activity, Crown, Shield, User, Ban,
  CheckCircle, Clock, TrendingUp, RefreshCw, Radio, Zap,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { notify } from '@/lib/notif';

interface CommunityUser {
  jid: string;
  name?: string;
  pushName?: string;
  lastSeen?: string;
  messageCount: number;
  commandCount: number;
  joinDate?: string;
  isActive: boolean;
  isBanned: boolean;
  role: 'member' | 'admin' | 'owner';
  groups: string[];
}

interface CommunityStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  newUsersToday: number;
  messagesTotal: number;
  commandsTotal: number;
  topUsers: CommunityUser[];
}

function formatLastSeen(lastSeen?: string) {
  if (!lastSeen) return 'Nunca';
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem.`;
  return `Hace ${Math.floor(diffDays / 30)} mes.`;
}

function getRoleMeta(role: string) {
  switch (role) {
    case 'owner': return { icon: <Crown className="w-3 h-3" />, chipClass: 'bg-warning/15 border-warning/30 text-warning', label: 'Owner' };
    case 'admin': return { icon: <Shield className="w-3 h-3" />, chipClass: 'bg-info/15 border-info/30 text-info', label: 'Admin' };
    default: return { icon: <User className="w-3 h-3" />, chipClass: 'bg-white/10 border-white/15 text-white/60', label: 'Miembro' };
  }
}

function UserCard({ user, onBan, onPromote }: { user: CommunityUser; onBan: (jid: string, banned: boolean) => void; onPromote: (jid: string, role: string) => void }) {
  const roleMeta = getRoleMeta(user.role);
  const displayName = user.name || user.pushName || 'Sin nombre';
  const phone = user.jid.split('@')[0];
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={cn(
            'h-11 w-11 rounded-2xl flex items-center justify-center font-black text-base border',
            user.isBanned ? 'bg-danger/15 border-danger/30 text-danger' :
            user.isActive ? 'bg-success/15 border-success/30 text-success' :
            'bg-white/[0.06] border-white/10 text-white/60'
          )}>
            {initial}
          </div>
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card',
            user.isBanned ? 'bg-danger' : user.isActive ? 'bg-success' : 'bg-gray-500'
          )} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-bold text-foreground truncate">{displayName}</p>
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest', roleMeta.chipClass)}>
              {roleMeta.icon} {roleMeta.label}
            </span>
            {user.isBanned && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-danger/30 bg-danger/15 text-danger text-[9px] font-black uppercase tracking-widest">
                <Ban className="w-2.5 h-2.5" /> Baneado
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground font-mono mb-2">{phone}</p>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {user.messageCount} msgs
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> {user.commandCount} cmds
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatLastSeen(user.lastSeen)}
            </span>
          </div>

          {user.groups.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {user.groups.slice(0, 2).map((g, i) => (
                <span key={i} className="px-2 py-0.5 bg-white/[0.06] rounded-lg text-[10px] text-white/50 border border-white/5">{g}</span>
              ))}
              {user.groups.length > 2 && (
                <span className="px-2 py-0.5 bg-white/[0.04] rounded-lg text-[10px] text-white/40 border border-white/5">+{user.groups.length - 2}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex flex-col gap-1.5">
          {!user.isBanned ? (
            <>
              {user.role === 'member' && (
                <button
                  onClick={() => onPromote(user.jid, 'admin')}
                  className="px-3 py-1.5 rounded-xl bg-info/10 border border-info/20 text-info text-[10px] font-black uppercase tracking-widest hover:bg-info/20 transition-all flex items-center gap-1"
                >
                  <Shield className="w-3 h-3" /> Promover
                </button>
              )}
              {user.role === 'admin' && (
                <button
                  onClick={() => onPromote(user.jid, 'member')}
                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-1"
                >
                  <User className="w-3 h-3" /> Degradar
                </button>
              )}
              <button
                onClick={() => onBan(user.jid, true)}
                className="px-3 py-1.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-[10px] font-black uppercase tracking-widest hover:bg-danger/20 transition-all flex items-center gap-1"
              >
                <Ban className="w-3 h-3" /> Banear
              </button>
            </>
          ) : (
            <button
              onClick={() => onBan(user.jid, false)}
              className="px-3 py-1.5 rounded-xl bg-success/10 border border-success/20 text-success text-[10px] font-black uppercase tracking-widest hover:bg-success/20 transition-all flex items-center gap-1"
            >
              <CheckCircle className="w-3 h-3" /> Desbanear
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function CommunityUsersPage() {
  const reduceMotion = useReducedMotion();
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getCommunityUsers(page, 20, searchTerm, statusFilter, roleFilter);
      setUsers(response.data || []);
      setPagination(response.pagination);
    } catch {
      notify.error('Error al cargar usuarios de la comunidad');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, statusFilter, roleFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.getCommunityStats();
      setStats(response);
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([loadUsers(), loadStats()]);
  }, [loadUsers, loadStats]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (page === 1) loadUsers(); else setPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBanUser = async (jid: string, banned: boolean) => {
    try {
      await api.banCommunityUser(jid, banned);
      notify.success(banned ? 'Usuario baneado' : 'Usuario desbaneado');
      loadUsers();
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error al cambiar estado');
    }
  };

  const handlePromoteUser = async (jid: string, role: string) => {
    try {
      await api.promoteCommunityUser(jid, role);
      notify.success(role === 'admin' ? 'Promovido a admin' : 'Degradado a miembro');
      loadUsers();
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error al cambiar rol');
    }
  };

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term || u.name?.toLowerCase().includes(term) || u.pushName?.toLowerCase().includes(term) || u.jid.includes(term);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && u.isActive) || (statusFilter === 'banned' && u.isBanned) || (statusFilter === 'inactive' && !u.isActive && !u.isBanned);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchStatus && matchRole;
  });

  const communityLanes = [
    {
      label: 'Total de miembros',
      value: `${stats?.totalUsers || 0}`,
      description: 'Usuarios únicos detectados en la red de grupos de WhatsApp.',
      icon: <Users className="w-4 h-4" />,
      badge: 'total',
      badgeClassName: 'border-primary/20 bg-primary/10 text-primary',
      glowClassName: 'from-primary/18 via-primary/5 to-transparent',
    },
    {
      label: 'Activos recientes',
      value: `${stats?.activeUsers || 0}`,
      description: 'Miembros con actividad en los últimos 7 días de la comunidad.',
      icon: <Activity className="w-4 h-4" />,
      badge: 'live',
      badgeClassName: 'border-success/20 bg-success/10 text-success',
      glowClassName: 'from-success/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Mensajes procesados',
      value: `${stats?.messagesTotal || 0}`,
      description: `${stats?.commandsTotal || 0} comandos ejecutados en toda la red.`,
      icon: <MessageSquare className="w-4 h-4" />,
      badge: 'msgs',
      badgeClassName: 'border-accent/20 bg-accent/10 text-accent',
      glowClassName: 'from-accent/18 via-oguri-lavender/10 to-transparent',
    },
    {
      label: 'Acceso restringido',
      value: `${stats?.bannedUsers || 0}`,
      description: 'Usuarios con acceso bloqueado por moderación activa.',
      icon: <Ban className="w-4 h-4" />,
      badge: stats?.bannedUsers ? 'ban' : 'ok',
      badgeClassName: stats?.bannedUsers ? 'border-danger/20 bg-danger/10 text-danger/80' : 'border-success/20 bg-success/10 text-success',
      glowClassName: stats?.bannedUsers ? 'from-danger/16 via-danger/5 to-transparent' : 'from-success/10 via-transparent to-transparent',
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden">
      {/* Atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-success/14 blur-3xl"
          animate={reduceMotion ? { opacity: 0.18 } : { x: [0, 18, 0], y: [0, 14, 0], opacity: [0.16, 0.34, 0.16] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 11, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-info/14 blur-3xl"
          animate={reduceMotion ? { opacity: 0.16 } : { x: [0, -16, 0], y: [0, 18, 0], opacity: [0.14, 0.32, 0.14] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 10.6, ease: 'easeInOut', delay: 0.7 }}
        />
      </div>

      {/* Hero Banner */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(var(--page-a),0.18),rgba(var(--page-b),0.10),rgba(var(--page-c),0.12))] p-5 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6"
      >
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit">
              <Radio className="h-3.5 w-3.5 text-success" />
              Comunidad WhatsApp
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Red de miembros de la comunidad</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Moderación, actividad y roles de los usuarios detectados en los grupos de WhatsApp conectados.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Usuarios</p>
              <p className="mt-2 text-lg font-black text-white">{stats?.totalUsers || 0}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Activos</p>
              <p className="mt-2 text-lg font-black text-white">{stats?.activeUsers || 0}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Nuevos hoy</p>
              <p className="mt-2 text-lg font-black text-white">{stats?.newUsersToday || 0}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lane cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {communityLanes.map((lane, index) => (
          <motion.div
            key={lane.label}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
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

      {/* Header */}
      <PageHeader
        title="Usuarios de la Comunidad"
        description="Moderación y gestión de miembros de los grupos de WhatsApp."
        icon={<Users className="w-6 h-6 text-primary" />}
        actions={
          <Button variant="secondary" onClick={loadData} disabled={isLoading} icon={<RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />}>
            Actualizar
          </Button>
        }
      />

      {/* Filters */}
      <Card className="p-5 border-white/10 bg-card/30 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre o número..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all"
            />
          </div>
          <div className="w-full md:w-44">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white/5 border-white/10 rounded-2xl"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
                <SelectItem value="banned">Baneados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-44">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="bg-white/5 border-white/10 rounded-2xl"><SelectValue placeholder="Rol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="owner">Propietarios</SelectItem>
                <SelectItem value="admin">Administradores</SelectItem>
                <SelectItem value="member">Miembros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Users List */}
      <Card className="overflow-hidden border-white/10 bg-card/30 backdrop-blur-xl">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Lista de Usuarios</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredUsers.length} usuarios mostrados</p>
          </div>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || roleFilter !== 'all'
                  ? 'No se encontraron usuarios con los filtros aplicados'
                  : 'No hay usuarios registrados en la comunidad'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user) => (
                  <UserCard key={user.jid} user={user} onBan={handleBanUser} onPromote={handlePromoteUser} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Pág. {pagination.page} de {pagination.totalPages} · {pagination.total} total
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Top Users */}
      {stats?.topUsers && stats.topUsers.length > 0 && (
        <Card className="p-6 border-white/10 bg-card/30 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-oguri-gold" />
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Usuarios Más Activos</h3>
          </div>
          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-4" delay={0.02} stagger={0.06}>
            {stats.topUsers.slice(0, 3).map((user, index) => {
              const name = user.name || user.pushName || 'Usuario';
              const phone = user.jid.split('@')[0];
              const rankColors = ['text-warning bg-warning/15 border-warning/30', 'text-white/60 bg-white/5 border-white/10', 'text-oguri-gold/80 bg-oguri-gold/10 border-oguri-gold/20'];
              return (
                <StaggerItem key={user.jid}>
                  <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black border', rankColors[index])}>
                        #{index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">{name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{phone}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Mensajes</span>
                        <span className="text-foreground font-bold"><AnimatedNumber value={user.messageCount} /></span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Comandos</span>
                        <span className="text-foreground font-bold"><AnimatedNumber value={user.commandCount} /></span>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </Card>
      )}
    </div>
  );
}
