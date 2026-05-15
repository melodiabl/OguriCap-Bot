'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Users, Search, RefreshCw, Shield, UserCheck, Mail, Phone,
  CheckCircle, Edit, Plus, Trash2, Key, User as UserIcon, Activity,
  EyeOff, Eye, Crown, Star, Clock, UserPlus, ShieldCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { notify } from '@/lib/notif';
import { User } from '@/types';
import { cn } from '@/lib/utils';

const ROLES = ['usuario', 'moderador', 'admin', 'owner'] as const;

const ROLE_META: Record<string, { variant: any; icon: React.ReactNode; label: string; glowClass: string; chipClass: string }> = {
  owner: {
    variant: 'danger',
    icon: <Crown className="h-3 w-3" />,
    label: 'Owner',
    glowClass: 'from-danger/20 via-danger/5 to-transparent',
    chipClass: 'bg-danger/15 border-danger/30 text-danger',
  },
  admin: {
    variant: 'danger',
    icon: <Shield className="h-3 w-3" />,
    label: 'Admin',
    glowClass: 'from-danger/15 via-danger/5 to-transparent',
    chipClass: 'bg-danger/15 border-danger/30 text-danger',
  },
  administrador: {
    variant: 'danger',
    icon: <Shield className="h-3 w-3" />,
    label: 'Admin',
    glowClass: 'from-danger/15 via-danger/5 to-transparent',
    chipClass: 'bg-danger/15 border-danger/30 text-danger',
  },
  moderador: {
    variant: 'info',
    icon: <UserCheck className="h-3 w-3" />,
    label: 'Mod',
    glowClass: 'from-info/15 via-info/5 to-transparent',
    chipClass: 'bg-info/15 border-info/30 text-info',
  },
  usuario: {
    variant: 'success',
    icon: <UserIcon className="h-3 w-3" />,
    label: 'Usuario',
    glowClass: 'from-success/10 via-success/5 to-transparent',
    chipClass: 'bg-success/15 border-success/30 text-success',
  },
};

function getRoleMeta(role: string) {
  return ROLE_META[role?.toLowerCase()] ?? ROLE_META.usuario;
}

function RoleBadge({ role }: { role: string }) {
  const meta = getRoleMeta(role);
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest', meta.chipClass)}>
      {meta.icon} {role}
    </span>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-11 text-foreground text-sm focus:border-primary/50 outline-none transition-all"
      />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function UserAvatar({ username, role }: { username: string; role: string }) {
  const meta = getRoleMeta(role);
  const letter = username?.charAt(0)?.toUpperCase() || '?';
  return (
    <div className={cn(
      'relative h-11 w-11 rounded-2xl flex items-center justify-center font-black text-lg border shadow-inner-glow shrink-0',
      meta.chipClass,
    )}>
      {letter}
      {(role === 'owner' || role === 'admin') && (
        <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-danger flex items-center justify-center shadow">
          <Crown className="h-2.5 w-2.5 text-white" />
        </span>
      )}
    </div>
  );
}

export default function UsuariosPage() {
  const { user: currentUser } = useAuth();
  const reduceMotion = useReducedMotion();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [editRole, setEditRole] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWhatsApp, setEditWhatsApp] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [newUser, setNewUser] = useState({ username: '', password: '', rol: 'usuario', email: '', whatsapp_number: '' });
  const [createSaving, setCreateSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getUsuarios(1, 200, '', roleFilter !== 'all' ? roleFilter : undefined);
      setUsers(Array.isArray(response) ? response : response.usuarios || response.data || []);
    } catch {
      notify.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.whatsapp_number?.includes(searchTerm)
  );

  const openEdit = (u: User) => {
    setSelectedUser(u);
    setEditRole(u.rol || 'usuario');
    setEditEmail(u.email || '');
    setEditWhatsApp(u.whatsapp_number || '');
    setShowEditModal(true);
  };

  const openPassword = (u: User) => {
    setSelectedUser(u);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const saveEdit = async () => {
    if (!selectedUser) return;
    setEditSaving(true);
    try {
      await api.updateUsuario(selectedUser.id, { rol: editRole, email: editEmail || undefined, whatsapp_number: editWhatsApp || undefined });
      notify.success('Usuario actualizado');
      setShowEditModal(false);
      loadUsers();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Error al actualizar');
    } finally {
      setEditSaving(false);
    }
  };

  const saveCreate = async () => {
    if (!newUser.username.trim() || !newUser.password.trim() || !newUser.rol) {
      notify.error('Usuario, contraseña y rol son requeridos');
      return;
    }
    setCreateSaving(true);
    try {
      await api.createUsuario(newUser as any);
      notify.success(`Usuario "${newUser.username}" creado`);
      setShowCreateModal(false);
      setNewUser({ username: '', password: '', rol: 'usuario', email: '', whatsapp_number: '' });
      loadUsers();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Error al crear usuario');
    } finally {
      setCreateSaving(false);
    }
  };

  const savePassword = async () => {
    if (!selectedUser) return;
    if (newPassword.length < 6) { notify.error('La contraseña debe tener al menos 6 caracteres'); return; }
    setPasswordSaving(true);
    try {
      await api.changeUsuarioPassword(selectedUser.id, newPassword);
      notify.success('Contraseña actualizada');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Error al cambiar contraseña');
    } finally {
      setPasswordSaving(false);
    }
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`¿Eliminar usuario "${u.username}"? Esta acción es irreversible.`)) return;
    try {
      await api.deleteUsuario(u.id);
      notify.success('Usuario eliminado');
      loadUsers();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-foreground text-sm focus:border-primary/50 outline-none transition-all';
  const labelCls = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';

  const ownerCount = users.filter(u => u.rol === 'owner').length;
  const adminCount = users.filter(u => u.rol === 'admin' || u.rol === 'administrador').length;
  const modCount = users.filter(u => u.rol === 'moderador').length;
  const activeCount = users.filter(u => u.last_login).length;

  const userLanes = [
    {
      label: 'Directorio total',
      value: `${users.length}`,
      description: 'Miembros registrados con acceso al ecosistema del panel.',
      icon: <Users className="w-4 h-4" />,
      badge: 'total',
      badgeClassName: 'border-primary/20 bg-primary/10 text-primary',
      glowClassName: 'from-primary/18 via-primary/5 to-transparent',
    },
    {
      label: 'Con acceso reciente',
      value: `${activeCount}`,
      description: 'Usuarios que han iniciado sesión al menos una vez en el sistema.',
      icon: <Activity className="w-4 h-4" />,
      badge: 'activos',
      badgeClassName: 'border-success/20 bg-success/10 text-success',
      glowClassName: 'from-success/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Privilegios elevados',
      value: `${ownerCount + adminCount}`,
      description: ownerCount + adminCount > 0 ? 'Admins y owners con control total del sistema.' : 'Sin usuarios con rol de administración.',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: ownerCount + adminCount > 0 ? 'admin' : 'ok',
      badgeClassName: ownerCount + adminCount > 0 ? 'border-danger/20 bg-danger/10 text-danger/80' : 'border-success/20 bg-success/10 text-success',
      glowClassName: 'from-danger/16 via-danger/5 to-transparent',
    },
    {
      label: 'Moderadores',
      value: `${modCount}`,
      description: modCount > 0 ? 'Moderadores con permisos de gestión parcial.' : 'Sin moderadores configurados.',
      icon: <Star className="w-4 h-4" />,
      badge: 'mod',
      badgeClassName: 'border-info/20 bg-info/10 text-info',
      glowClassName: 'from-info/18 via-accent/10 to-transparent',
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden">
      {/* Ambient atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-primary/16 blur-3xl"
          animate={reduceMotion ? { opacity: 0.22 } : { x: [0, 16, 0], y: [0, 14, 0], opacity: [0.18, 0.38, 0.18] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 10.8, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-lavender/16 blur-3xl"
          animate={reduceMotion ? { opacity: 0.18 } : { x: [0, -16, 0], y: [0, 18, 0], opacity: [0.16, 0.36, 0.16] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 11.4, ease: 'easeInOut', delay: 0.6 }}
        />
      </div>

      {/* Hero banner */}
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
              <Users className="h-3.5 w-3.5 text-primary" />
              Control de acceso
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Directorio de usuarios del sistema</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Gestión centralizada de credenciales, roles y permisos del ecosistema OguriCap.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Total</p>
              <p className="mt-2 text-lg font-black text-white">{users.length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Admins</p>
              <p className="mt-2 text-lg font-black text-white">{ownerCount + adminCount}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Activos</p>
              <p className="mt-2 text-lg font-black text-white">{activeCount}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lane cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {userLanes.map((lane, index) => (
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

      {/* PageHeader */}
      <PageHeader
        title="Directorio de Usuarios"
        description="Gestión centralizada de credenciales, roles y acceso al ecosistema OguriCap."
        icon={<Users className="h-6 w-6 text-primary" />}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={loadUsers} disabled={loading} icon={<RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />}>
              Sincronizar
            </Button>
            <Button variant="primary" onClick={() => setShowCreateModal(true)} icon={<UserPlus className="h-4 w-4" />}>
              Nuevo Usuario
            </Button>
          </div>
        }
      />

      {/* Search + Filter */}
      <Card className="overflow-hidden border-white/10 bg-card/30 backdrop-blur-xl">
        <div className="p-5 border-b border-white/10 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por usuario, email o teléfono..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all"
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="bg-white/5 border-white/10 rounded-2xl">
                <SelectValue placeholder="Todos los roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="owner">Owners</SelectItem>
                <SelectItem value="admin">Administradores</SelectItem>
                <SelectItem value="moderador">Moderadores</SelectItem>
                <SelectItem value="usuario">Usuarios</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User grid — cards layout instead of plain table */}
        <div className="p-5">
          {loading && users.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-white/10 rounded" />
                      <div className="h-3 w-20 bg-white/5 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No se encontraron usuarios</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredUsers.map((u, i) => {
                  const meta = getRoleMeta(u.rol);
                  return (
                    <motion.div
                      key={u.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
                    >
                      {/* Subtle role glow */}
                      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500', meta.glowClass)} />

                      <div className="relative z-10">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <UserAvatar username={u.username} role={u.rol} />
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{u.username}</p>
                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">ID #{u.id}</p>
                            </div>
                          </div>
                          <RoleBadge role={u.rol} />
                        </div>

                        {/* Contact info */}
                        <div className="space-y-1.5 mb-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{u.email || 'Sin email'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{u.whatsapp_number || 'Sin teléfono'}</span>
                          </div>
                          {u.last_login && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {new Date(u.last_login).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                          <button
                            onClick={() => openEdit(u)}
                            title="Editar usuario"
                            className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Edit className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button
                            onClick={() => openPassword(u)}
                            title="Cambiar contraseña"
                            className="p-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-warning hover:border-warning/40 transition-all"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                          {currentUser?.id !== u.id && (
                            <button
                              onClick={() => deleteUser(u)}
                              title="Eliminar usuario"
                              className="p-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-danger hover:border-danger/40 transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer count */}
        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filteredUsers.length} usuarios mostrados</p>
          <p className="text-xs text-muted-foreground">{users.length} en total</p>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuevo Miembro">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Usuario *</label>
            <input
              value={newUser.username}
              onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
              className={inputCls}
              placeholder="nombre_usuario"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Contraseña *</label>
            <PasswordInput value={newUser.password} onChange={v => setNewUser(p => ({ ...p, password: v }))} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Rol *</label>
            <Select value={newUser.rol} onValueChange={v => setNewUser(p => ({ ...p, rol: v }))}>
              <SelectTrigger className="bg-white/5 border-white/10 rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Email</label>
            <input value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} className={inputCls} placeholder="opcional" type="email" />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>WhatsApp</label>
            <input value={newUser.whatsapp_number} onChange={e => setNewUser(p => ({ ...p, whatsapp_number: e.target.value }))} className={inputCls} placeholder="ej. 5491123456789" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button variant="primary" className="flex-1" loading={createSaving} onClick={saveCreate}>Crear Acceso</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={`Editar — ${selectedUser?.username}`}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Rol</label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger className="bg-white/5 border-white/10 rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Email</label>
            <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className={inputCls} placeholder="opcional" type="email" />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>WhatsApp</label>
            <input value={editWhatsApp} onChange={e => setEditWhatsApp(e.target.value)} className={inputCls} placeholder="ej. 5491123456789" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button variant="primary" className="flex-1" loading={editSaving} onClick={saveEdit}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* Password Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title={`Contraseña — ${selectedUser?.username}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Establece una nueva contraseña para este usuario.</p>
          <div className="space-y-1.5">
            <label className={labelCls}>Nueva Contraseña</label>
            <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowPasswordModal(false)}>Cancelar</Button>
            <Button variant="primary" className="flex-1" loading={passwordSaving} onClick={savePassword}>Cambiar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
