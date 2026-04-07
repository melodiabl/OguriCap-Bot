'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Users, Search, RefreshCw, Shield, UserCheck, Mail, Phone, Calendar,
  CheckCircle, Edit, Plus, Trash2, X, Key, Eye,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { notify } from '@/lib/notify';
import { User } from '@/types';

export default function UsuariosPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showViewPasswordModal, setShowViewPasswordModal] = useState(false);
  const [viewPasswordData, setViewPasswordData] = useState<{
    username: string;
    password: string | null;
    reset?: boolean;
    delivered?: 'whatsapp' | 'email' | null;
    deliveredTo?: string | null;
    message?: string;
  } | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [editEmail, setEditEmail] = useState('');
  const [editWhatsApp, setEditWhatsApp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    rol: '', // Sin rol por defecto
    email: '',
    whatsapp_number: '' 
  });
  const reduceMotion = useReducedMotion();

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getUsuarios(1, 100, searchTerm, roleFilter !== 'all' ? roleFilter : undefined);
      let usersData = [];
      if (response) {
        if (Array.isArray(response)) {
          usersData = response;
        } else if (response.usuarios && Array.isArray(response.usuarios)) {
          usersData = response.usuarios;
        } else if (response.data && Array.isArray(response.data)) {
          usersData = response.data;
        }
      }
      setUsers(usersData);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      notify.error('Error al cargar usuarios');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const saveUserEdits = async () => {
    if (!selectedUser) return;

    const emailStr = editEmail.trim();
    const whatsappStr = editWhatsApp.trim();
    if (emailStr && !emailStr.includes('@')) {
      notify.error('Email inválido');
      return;
    }

    try {
      const updated = await api.updateUsuario(selectedUser.id, {
        rol: newRole,
        email: emailStr,
        whatsapp_number: whatsappStr,
      } as any);

      setUsers(prev =>
        prev.map(u => (u.id === selectedUser.id ? { ...u, ...updated } : u))
      );
      notify.success('Usuario actualizado');
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (err) {
      notify.error('Error al actualizar usuario');
    }
  };

  const createUser = async () => {
    try {
      // Validaciones mejoradas
      if (!newUser.username.trim()) {
        notify.error('El nombre de usuario es requerido');
        return;
      }

      if (newUser.username.trim().length < 3) {
        notify.error('El usuario debe tener al menos 3 caracteres');
        return;
      }

      if (!newUser.password.trim()) {
        notify.error('La contraseña es requerida');
        return;
      }

      if (newUser.password.length < 4) {
        notify.error('La contraseña debe tener al menos 4 caracteres');
        return;
      }

      if (!newUser.rol) {
        notify.error('Debes seleccionar un rol para el usuario');
        return;
      }

      const emailStr = newUser.email?.trim?.() || '';
      const whatsappStr = newUser.whatsapp_number?.trim?.() || '';
      if (emailStr && !emailStr.includes('@')) {
        notify.error('Email inválido');
        return;
      }

      // Verificar permisos para crear el rol seleccionado
      const currentUserRole = currentUser?.rol || 'usuario';
      const roleHierarchy = { owner: 4, admin: 3, administrador: 3, moderador: 2, usuario: 1 };
      const currentUserLevel = roleHierarchy[currentUserRole] || 1;
      const newUserLevel = roleHierarchy[newUser.rol] || 1;

      if (newUserLevel > currentUserLevel) {
        notify.error(`No tienes permisos para crear usuarios con rol ${newUser.rol}`);
        return;
      }

      const created = await api.createUsuario(newUser as any);
      notify.success(`Usuario creado correctamente como ${newUser.rol}`);

      const delivery = created?.credentialsDelivery;
      if (delivery?.delivered === 'whatsapp') {
        notify.success('Credenciales enviadas por WhatsApp');
      } else if (delivery?.delivered === 'email') {
        notify.success('Credenciales enviadas por Email');
      }

      const warnings = Array.isArray(created?.warnings) ? created.warnings : [];
      if (warnings.length > 0) {
        notify.warning((warnings[0] || 'Usuario creado, pero no se pudieron enviar credenciales automáticamente.').toString());
      }

      setShowCreateModal(false);
      setNewUser({ username: '', password: '', rol: '', email: '', whatsapp_number: '' });
      loadUsers();
    } catch (err: any) {
      console.error('Error al crear usuario:', err);
      
      // Manejo de errores mejorado
      let errorMessage = 'Error al crear usuario';
      
      if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      notify.error(errorMessage);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
      await api.deleteUsuario(userId);
      notify.success('Usuario eliminado');
      loadUsers();
    } catch (err) {
      notify.error('Error al eliminar usuario');
    }
  };

  const changePassword = async () => {
    if (!selectedUser || !newPassword) {
      notify.error('Ingresa una nueva contraseña');
      return;
    }
    try {
      await api.changeUsuarioPassword(selectedUser.id, newPassword);
      notify.success('Contraseña actualizada');
      setShowPasswordModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      notify.error('Error al cambiar contraseña');
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.rol);
    setEditEmail(user.email || '');
    setEditWhatsApp(user.whatsapp_number || '');
    setShowEditModal(true);
  };

  const handlePasswordUser = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewUser({ username: '', password: '', rol: '', email: '', whatsapp_number: '' });
  };

  const handleViewPassword = async (user: User) => {
    try {
      // 1) Intentar ver la contraseña guardada (si existe)
      const existing = await api.viewUsuarioPassword(user.id);
      if (existing?.password) {
        setViewPasswordData(existing);
        setShowViewPasswordModal(true);
        return;
      }

      // 2) Fallback: generar temporal
      const ok = confirm(
        'No hay contraseña en texto disponible para este usuario. Esto restablecerá la contraseña y generará una temporal (se enviará al Email/WhatsApp del usuario si existe). ¿Continuar?'
      );
      if (!ok) return;
      const response = await api.viewUsuarioPassword(user.id, { reset: true, deliver: true });
      setViewPasswordData(response);
      setShowViewPasswordModal(true);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        notify.error('Solo los owners pueden ver contraseñas');
      } else {
        notify.error('Error al obtener contraseña');
      }
    }
  };

  const canCreateOwner = () => currentUser?.rol === 'owner';
  const canViewPasswords = () => currentUser?.rol === 'owner';
  const canEditUser = (user: User) => {
    if (currentUser?.rol === 'owner') return true;
    if (currentUser?.rol === 'admin' && user.rol !== 'owner') return true;
    return false;
  };
  const canDeleteUser = (user: User) => {
    if (currentUser?.id === user.id) return false;
    if (currentUser?.rol === 'owner') return true;
    if (currentUser?.rol === 'admin' && user.rol !== 'owner') return true;
    return false;
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      owner: { bg: 'bg-violet-500/20 border-violet-500/30', text: 'text-violet-400', icon: <Shield className="w-3 h-3" /> },
      admin: { bg: 'bg-red-500/20 border-red-500/30', text: 'text-red-400', icon: <Shield className="w-3 h-3" /> },
      moderador: { bg: 'bg-cyan-500/20 border-cyan-500/30', text: 'text-cyan-400', icon: <UserCheck className="w-3 h-3" /> },
      usuario: { bg: 'bg-emerald-500/20 border-emerald-500/30', text: 'text-emerald-400', icon: <Users className="w-3 h-3" /> },
    };
    const c = config[role] || config.usuario;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text}`}>
        {c.icon}
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const filteredUsers = Array.isArray(users) ? users.filter(user => {
    const matchesSearch = user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.whatsapp_number?.includes(searchTerm);
    const matchesRole = roleFilter === 'all' || user.rol === roleFilter;
    return matchesSearch && matchesRole;
  }) : [];

  const stats = {
    total: Array.isArray(users) ? users.length : 0,
    admins: Array.isArray(users) ? users.filter(u => u.rol === 'admin' || u.rol === 'owner').length : 0,
    moderadores: Array.isArray(users) ? users.filter(u => u.rol === 'moderador').length : 0,
    usuarios: Array.isArray(users) ? users.filter(u => u.rol === 'usuario').length : 0,
    activos: Array.isArray(users) ? users.filter(u => (u as any).activo !== false).length : 0
  };

  const tbodyVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.02,
      },
    },
  };

  const rowVariants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    show: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 },
  };

  const actionButtonClass = 'flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] transition-all hover:border-white/20 hover:bg-white/[0.08]';

  const renderUserActions = (user: User) => (
    <div className="flex flex-wrap items-center gap-2">
      {canViewPasswords() && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleViewPassword(user)}
          className={`${actionButtonClass} text-green-400`}
          title="Ver / generar contraseña"
        >
          <Eye className="w-4 h-4" />
        </motion.button>
      )}
      {canEditUser(user) && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handlePasswordUser(user)}
          className={`${actionButtonClass} text-amber-400`}
          title="Cambiar contraseña"
        >
          <Key className="w-4 h-4" />
        </motion.button>
      )}
      {canEditUser(user) && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleEditUser(user)}
          className={`${actionButtonClass} text-cyan-400`}
          title="Editar usuario"
        >
          <Edit className="w-4 h-4" />
        </motion.button>
      )}
      {canDeleteUser(user) && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => deleteUser(user.id)}
          className={`${actionButtonClass} text-red-400`}
          title="Eliminar usuario"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );

  return (
    <div className="panel-page relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-oguri-blue/18 blur-3xl"
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
              <Users className="h-3.5 w-3.5 text-oguri-cyan" />
              Control de acceso
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Centro operativo de usuarios</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Roles, permisos y cuentas del panel en una vista más clara y con más presencia visual.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Total</p>
              <p className="mt-2 text-lg font-black text-white">{stats.total}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Admins</p>
              <p className="mt-2 text-lg font-black text-white">{stats.admins}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Activos</p>
              <p className="mt-2 text-lg font-black text-white">{stats.activos}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <PageHeader
        title="Gestión de Usuarios"
        description="Administra usuarios, roles y permisos del sistema"
        icon={<Users className="w-6 h-6 text-primary-400" />}
        actions={
          <>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
              Nuevo Usuario
            </Button>
            <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={loadUsers} loading={loading}>
              Actualizar
            </Button>
          </>
        }
      />

      {/* Stats */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" delay={0.06} stagger={0.06}>
        <StaggerItem>
          <StatCard title="Total" value={stats.total} icon={<Users className="w-6 h-6" />} color="primary" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Admins" value={stats.admins} icon={<Shield className="w-6 h-6" />} color="danger" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Moderadores" value={stats.moderadores} icon={<UserCheck className="w-6 h-6" />} color="info" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Usuarios" value={stats.usuarios} icon={<Users className="w-6 h-6" />} color="success" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Activos" value={stats.activos} icon={<CheckCircle className="w-6 h-6" />} color="violet" delay={0} />
        </StaggerItem>
      </Stagger>

      {/* Filters */}
      <Card animated delay={0.2} className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-search w-full"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full lg:w-56">
              <SelectValue placeholder="Todos los roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Administradores</SelectItem>
              <SelectItem value="moderador">Moderadores</SelectItem>
              <SelectItem value="usuario">Usuarios</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Users Table */}
      <Card animated delay={0.3} className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-white/10 p-5 text-center sm:p-6 sm:text-left">
          <h2 className="text-lg font-semibold text-white">Lista de Usuarios</h2>
          <p className="text-gray-400 text-sm">{filteredUsers.length} de {users.length} usuarios</p>
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="table-glass w-full">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Contacto</th>
                  <th>Rol</th>
                  <th>Registro</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-3">
                        <SkeletonCircle className="h-9 w-9" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32 rounded" />
                          <Skeleton className="h-3 w-20 rounded" />
                        </div>
                      </div>
                    </td>
                    <td>
                      <Skeleton className="h-4 w-36 rounded" />
                    </td>
                    <td>
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td>
                      <Skeleton className="h-4 w-28 rounded" />
                    </td>
                    <td>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <Skeleton className="h-9 w-9 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="panel-empty-state">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No hay usuarios</h3>
            <p className="text-gray-400">No se encontraron usuarios con los filtros aplicados</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {filteredUsers.map((user) => (
                <motion.div
                  key={user.id}
                  layout
                  variants={rowVariants}
                  initial="hidden"
                  animate="show"
                  className="panel-surface-soft p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="avatar">{user.username?.charAt(0).toUpperCase()}</div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{user.username}</p>
                        <p className="text-xs text-gray-500">ID: {user.id}</p>
                      </div>
                    </div>
                    {getRoleBadge(user.rol)}
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="panel-data-row">
                      <span className="panel-data-row__label">Email</span>
                      <span className="panel-data-row__value break-all">{user.email || '-'}</span>
                    </div>
                    <div className="panel-data-row">
                      <span className="panel-data-row__label">WhatsApp</span>
                      <span className="panel-data-row__value">{user.whatsapp_number || '-'}</span>
                    </div>
                    <div className="panel-data-row">
                      <span className="panel-data-row__label">Registro</span>
                      <span className="panel-data-row__value">{formatDate(user.created_at || new Date().toISOString())}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={`badge ${(user as any).activo !== false ? 'badge-success' : 'badge-danger'}`}>
                        {(user as any).activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                      {renderUserActions(user)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="table-glass w-full">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Contacto</th>
                    <th>Rol</th>
                    <th>Registro</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <motion.tbody variants={tbodyVariants} initial="hidden" animate="show">
                  <AnimatePresence mode="popLayout">
                    {filteredUsers.map((user) => (
                      <motion.tr
                        key={user.id}
                        layout="position"
                        variants={rowVariants}
                        exit="exit"
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar">{user.username?.charAt(0).toUpperCase()}</div>
                            <div>
                              <p className="font-medium text-white">{user.username}</p>
                              <p className="text-xs text-gray-500">ID: {user.id}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-4 h-4 text-gray-500" />
                              <span className="text-gray-300">{user.email || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-gray-500" />
                              <span className="text-gray-300">{user.whatsapp_number || '-'}</span>
                            </div>
                          </div>
                        </td>
                        <td>{getRoleBadge(user.rol)}</td>
                        <td>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Calendar className="w-4 h-4" />
                            {formatDate(user.created_at || new Date().toISOString())}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${(user as any).activo !== false ? 'badge-success' : 'badge-danger'}`}>
                            {(user as any).activo !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>{renderUserActions(user)}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </motion.tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Edit User Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Usuario">
        <div className="space-y-5">
          <div className="panel-readonly-block">
            <p className="text-sm text-gray-400">Usuario</p>
            <p className="text-white font-medium">{selectedUser?.username}</p>
          </div>
          <div className="panel-form-grid">
            <div className="panel-field">
              <label className="panel-field-label">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="input-glass w-full"
                placeholder="Email (opcional si hay WhatsApp)"
              />
            </div>
            <div className="panel-field">
              <label className="panel-field-label">WhatsApp</label>
              <input
                type="text"
                value={editWhatsApp}
                onChange={(e) => setEditWhatsApp(e.target.value)}
                className="input-glass w-full"
                placeholder="Número de WhatsApp (opcional si hay Email)"
              />
            </div>
            <div className="panel-field sm:col-span-2">
              <label className="panel-field-label">Nuevo Rol</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuario</SelectItem>
                  <SelectItem value="moderador">Moderador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  {canCreateOwner() && <SelectItem value="owner">Owner</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="panel-modal-actions">
            <Button variant="primary" className="flex-1" onClick={saveUserEdits}>
              Guardar
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create User Modal */}
      <Modal isOpen={showCreateModal} onClose={handleCloseCreateModal} title="Crear Nuevo Usuario">
        <div className="space-y-5">
          <div className="panel-form-grid">
            <div className="panel-field">
              <label className="panel-field-label">Usuario</label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="input-glass w-full"
                placeholder="Nombre de usuario (mín. 3 caracteres)"
                data-autofocus
              />
            </div>
            <div className="panel-field">
              <label className="panel-field-label">Contraseña</label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="input-glass w-full"
                placeholder="Contraseña (mín. 4 caracteres)"
              />
              <p className="panel-field-hint text-blue-400">El usuario usará esta contraseña para hacer login.</p>
            </div>
            <div className="panel-field">
              <label className="panel-field-label">WhatsApp</label>
              <input
                type="text"
                value={newUser.whatsapp_number}
                onChange={(e) => setNewUser({ ...newUser, whatsapp_number: e.target.value })}
                className="input-glass w-full"
                placeholder="5491123456789 (opcional)"
              />
              <p className="panel-field-hint">Opcional. Se guarda como contacto de WhatsApp del usuario.</p>
            </div>
            <div className="panel-field">
              <label className="panel-field-label">Email</label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="input-glass w-full"
                placeholder="Email (opcional)"
              />
              <p className="panel-field-hint">Opcional. Si no ingresas Email/WhatsApp, no se podrán enviar credenciales automáticamente.</p>
            </div>
            <div className="panel-field sm:col-span-2">
              <label className="panel-field-label">
              Rol <span className="text-red-400">*</span>
              </label>
              {!newUser.rol && (
                <p className="panel-field-hint text-amber-400">Selecciona el rol para el nuevo usuario.</p>
              )}
              <Select value={newUser.rol} onValueChange={(value) => setNewUser({ ...newUser, rol: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuario</SelectItem>
                  <SelectItem value="moderador">Moderador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  {canCreateOwner() && <SelectItem value="owner">Owner</SelectItem>}
                </SelectContent>
              </Select>
              {newUser.rol && (
                <p className="panel-field-hint text-emerald-400">El usuario será creado como {newUser.rol}.</p>
              )}
            </div>
          </div>
          <div className="panel-modal-actions">
            <Button 
              variant="primary" 
              className={`flex-1 ${!newUser.rol ? 'opacity-75 cursor-not-allowed' : ''}`}
              onClick={createUser}
              disabled={!newUser.rol}
            >
              {!newUser.rol ? 'Selecciona un rol' : 'Crear Usuario'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={handleCloseCreateModal}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Password Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Cambiar Contraseña">
        <div className="space-y-5">
          <div className="panel-readonly-block">
            <p className="text-sm text-gray-400">Usuario</p>
            <p className="text-white font-medium">{selectedUser?.username}</p>
          </div>
          <div className="panel-field">
            <label className="panel-field-label">Nueva Contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-glass w-full"
              placeholder="Nueva contraseña"
            />
          </div>
          <div className="panel-modal-actions">
            <Button variant="primary" className="flex-1" onClick={changePassword}>
              Cambiar Contraseña
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setShowPasswordModal(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Password Modal */}
      <Modal
        isOpen={showViewPasswordModal}
        onClose={() => setShowViewPasswordModal(false)}
        title={viewPasswordData?.reset ? 'Contraseña Temporal' : 'Contraseña'}
      >
        <div className="space-y-5">
          <div className="panel-readonly-block">
            <p className="text-sm text-gray-400">Usuario</p>
            <p className="text-white font-medium">{viewPasswordData?.username}</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm text-gray-400 mb-2">
              {viewPasswordData?.reset ? 'Resultado' : 'Contraseña (guardada encriptada para owner)'}
            </p>
            {viewPasswordData?.password ? (
              <div className="flex items-center justify-between">
                <p className="text-white font-mono text-lg">{viewPasswordData?.password}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(viewPasswordData?.password || '');
                    notify.success('Contraseña copiada al portapapeles');
                  }}
                >
                  Copiar
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-white text-sm">
                  {viewPasswordData?.delivered
                    ? `Enviado por ${viewPasswordData.delivered === 'whatsapp' ? 'WhatsApp' : 'Email'}${viewPasswordData.deliveredTo ? ` a ${viewPasswordData.deliveredTo}` : ''}.`
                    : 'No se pudo enviar automáticamente. Agrega Email/WhatsApp al usuario e intenta de nuevo.'}
                </p>
                {viewPasswordData?.message && <p className="text-gray-400 text-xs">{viewPasswordData.message}</p>}
              </div>
            )}
          </div>
          {viewPasswordData?.reset && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-400">
                Esta acción invalida la contraseña anterior. El usuario deberá iniciar sesión con esta contraseña temporal y cambiarla.
              </p>
            </div>
          )}
          <div className="panel-modal-actions">
            <Button variant="secondary" className="w-full" onClick={() => setShowViewPasswordModal(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
