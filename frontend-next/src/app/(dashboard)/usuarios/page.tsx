'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, RefreshCw, Shield, UserCheck, Mail, Phone, Calendar,
  CheckCircle, Edit, Plus, Trash2, X, Key, Eye,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
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
  const [viewPasswordData, setViewPasswordData] = useState<{ username: string; password: string | null; reset?: boolean } | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    rol: '', // Sin rol por defecto
    whatsapp_number: '' 
  });

  useEffect(() => {
    loadUsers();
  }, [searchTerm, roleFilter]);

  const loadUsers = async () => {
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
      toast.error('Error al cargar usuarios');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: number, role: string) => {
    try {
      await api.updateUsuario(userId, { rol: role } as any);
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, rol: role as any } : user
      ));
      toast.success('Rol actualizado correctamente');
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (err) {
      toast.error('Error al actualizar rol');
    }
  };

  const createUser = async () => {
    try {
      // Validaciones mejoradas
      if (!newUser.username.trim()) {
        toast.error('El nombre de usuario es requerido');
        return;
      }

      if (newUser.username.trim().length < 3) {
        toast.error('El usuario debe tener al menos 3 caracteres');
        return;
      }

      if (!newUser.password.trim()) {
        toast.error('La contraseña es requerida');
        return;
      }

      if (newUser.password.length < 4) {
        toast.error('La contraseña debe tener al menos 4 caracteres');
        return;
      }

      if (!newUser.rol) {
        toast.error('Debes seleccionar un rol para el usuario');
        return;
      }

      // Verificar permisos para crear el rol seleccionado
      const currentUserRole = currentUser?.rol || 'usuario';
      const roleHierarchy = { owner: 4, admin: 3, administrador: 3, moderador: 2, usuario: 1 };
      const currentUserLevel = roleHierarchy[currentUserRole] || 1;
      const newUserLevel = roleHierarchy[newUser.rol] || 1;

      if (newUserLevel > currentUserLevel) {
        toast.error(`No tienes permisos para crear usuarios con rol ${newUser.rol}`);
        return;
      }

      await api.createUsuario(newUser as any);
      toast.success(`Usuario creado correctamente como ${newUser.rol}`);
      setShowCreateModal(false);
      setNewUser({ username: '', password: '', rol: '', whatsapp_number: '' });
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
      
      toast.error(errorMessage);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
      await api.deleteUsuario(userId);
      toast.success('Usuario eliminado');
      loadUsers();
    } catch (err) {
      toast.error('Error al eliminar usuario');
    }
  };

  const changePassword = async () => {
    if (!selectedUser || !newPassword) {
      toast.error('Ingresa una nueva contraseña');
      return;
    }
    try {
      await api.changeUsuarioPassword(selectedUser.id, newPassword);
      toast.success('Contraseña actualizada');
      setShowPasswordModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      toast.error('Error al cambiar contraseña');
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.rol);
    setShowEditModal(true);
  };

  const handlePasswordUser = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewUser({ username: '', password: '', rol: '', whatsapp_number: '' });
  };

  const handleViewPassword = async (user: User) => {
    try {
      const ok = confirm('Esto restablecerá la contraseña del usuario y generará una contraseña temporal. ¿Continuar?');
      if (!ok) return;
      const response = await api.viewUsuarioPassword(user.id, { reset: true });
      setViewPasswordData(response);
      setShowViewPasswordModal(true);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        toast.error('Solo los owners pueden ver contraseñas');
      } else {
        toast.error('Error al obtener contraseña');
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

  if (loading && users.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-primary-400" />
          <h2 className="text-xl font-semibold text-white">Cargando usuarios...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">Gestión de Usuarios</h1>
          <p className="text-gray-400 mt-1">Administra usuarios, roles y permisos del sistema</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3">
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            Nuevo Usuario
          </Button>
          <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={loadUsers} loading={loading}>
            Actualizar
          </Button>
        </motion.div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total" value={stats.total} icon={<Users className="w-6 h-6" />} color="primary" delay={0} />
        <StatCard title="Admins" value={stats.admins} icon={<Shield className="w-6 h-6" />} color="danger" delay={0.1} />
        <StatCard title="Moderadores" value={stats.moderadores} icon={<UserCheck className="w-6 h-6" />} color="info" delay={0.2} />
        <StatCard title="Usuarios" value={stats.usuarios} icon={<Users className="w-6 h-6" />} color="success" delay={0.3} />
        <StatCard title="Activos" value={stats.activos} icon={<CheckCircle className="w-6 h-6" />} color="violet" delay={0.4} />
      </div>

      {/* Filters */}
      <Card animated delay={0.2} className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
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
            <SelectTrigger className="md:w-48">
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
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Lista de Usuarios</h2>
          <p className="text-gray-400 text-sm mt-1">{filteredUsers.length} de {users.length} usuarios</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Cargando usuarios...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No hay usuarios</h3>
            <p className="text-gray-400">No se encontraron usuarios con los filtros aplicados</p>
          </div>
        ) : (
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
                <AnimatePresence>
                  {filteredUsers.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.03 }}
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
                      <td>
                        <div className="flex items-center gap-2">
                          {canViewPasswords() && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleViewPassword(user)}
                              className="p-2 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors"
                              title="Generar contraseña temporal"
                            >
                              <Eye className="w-4 h-4" />
                            </motion.button>
                          )}
                          {canEditUser(user) && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handlePasswordUser(user)}
                              className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors"
                              title="Cambiar contraseña"
                            >
                              <Key className="w-4 h-4" />
                            </motion.button>
                          )}
                          {canEditUser(user) && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleEditUser(user)}
                              className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                              title="Editar usuario"
                            >
                              <Edit className="w-4 h-4" />
                            </motion.button>
                          )}
                          {canDeleteUser(user) && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => deleteUser(user.id)}
                              className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
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
      </Card>

      {/* Edit Role Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Rol de Usuario">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-sm text-gray-400">Usuario</p>
            <p className="text-white font-medium">{selectedUser?.username}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Nuevo Rol</label>
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
          <div className="flex gap-3 pt-4">
            <Button variant="primary" className="flex-1" onClick={() => selectedUser && updateUserRole(selectedUser.id, newRole)}>
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
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Usuario</label>
            <input
              type="text"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="input-glass w-full"
              placeholder="Nombre de usuario (mín. 3 caracteres)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Contraseña</label>
            <input
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="input-glass w-full"
              placeholder="Contraseña (mín. 4 caracteres)"
            />
            <p className="text-xs text-blue-400 mt-1">
              💡 El usuario usará esta contraseña para hacer login
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">WhatsApp</label>
            <input
              type="text"
              value={newUser.whatsapp_number}
              onChange={(e) => setNewUser({ ...newUser, whatsapp_number: e.target.value })}
              className="input-glass w-full"
              placeholder="Número de WhatsApp (opcional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Rol <span className="text-red-400">*</span>
            </label>
            {!newUser.rol && (
              <p className="text-xs text-amber-400 mb-2 flex items-center gap-1">
                <span>⚠️</span> Selecciona el rol para el nuevo usuario
              </p>
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
              <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                <span>✓</span> El usuario será creado como {newUser.rol}
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-4">
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
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-sm text-gray-400">Usuario</p>
            <p className="text-white font-medium">{selectedUser?.username}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Nueva Contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-glass w-full"
              placeholder="Nueva contraseña"
            />
          </div>
          <div className="flex gap-3 pt-4">
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
      <Modal isOpen={showViewPasswordModal} onClose={() => setShowViewPasswordModal(false)} title="Contraseña Temporal">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-sm text-gray-400">Usuario</p>
            <p className="text-white font-medium">{viewPasswordData?.username}</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm text-gray-400 mb-2">Contraseña Temporal (se acaba de generar)</p>
            <div className="flex items-center justify-between">
              <p className="text-white font-mono text-lg">{viewPasswordData?.password}</p>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(viewPasswordData?.password || '');
                  toast.success('Contraseña copiada al portapapeles');
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-xs text-yellow-400">
              Esta acción invalida la contraseña anterior. El usuario deberá iniciar sesión con esta contraseña temporal y cambiarla.
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="w-full" onClick={() => setShowViewPasswordModal(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
