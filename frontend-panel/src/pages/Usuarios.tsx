import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  RefreshCw,
  Shield,
  UserCheck,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  Edit,
  Plus,
  Trash2,
  X,
  Key,
} from 'lucide-react';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { AnimatedTableRow } from '../components/ui/AnimatedList';
import { UserPasswordModal } from '../components/UserPasswordModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import api from '../config/api';

interface User {
  id: number;
  username: string;
  email: string;
  whatsapp_number: string;
  rol: 'owner' | 'admin' | 'moderador' | 'usuario';
  fecha_registro: string;
  activo: boolean;
}

const Usuarios: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newRole, setNewRole] = useState<string>('');
  const [newUser, setNewUser] = useState({ username: '', password: '', rol: 'usuario', whatsapp_number: '' });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando usuarios...');
      const response = await api.get('/api/usuarios');
      console.log('📥 Respuesta del servidor:', response.data);
      
      // Asegurar que siempre tengamos un array
      let usersData = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          usersData = response.data;
        } else if (response.data.usuarios && Array.isArray(response.data.usuarios)) {
          usersData = response.data.usuarios;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          usersData = response.data.data;
        }
      }
      
      console.log('👥 Usuarios procesados:', usersData);
      setUsers(usersData);
    } catch (err) {
      console.error('❌ Error al cargar usuarios:', err);
      toast.error('Error al cargar usuarios');
      setUsers([]); // Asegurar que users sea un array vacío en caso de error
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: number, role: string) => {
    try {
      await api.patch(`/api/usuarios/${userId}`, { rol: role });
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
      if (!newUser.username || !newUser.password) {
        toast.error('Usuario y contraseña son requeridos');
        return;
      }
      console.log('🆕 Creando usuario:', newUser);
      const response = await api.post('/api/usuarios', newUser);
      console.log('✅ Usuario creado:', response.data);
      toast.success('Usuario creado correctamente');
      setShowCreateModal(false);
      setNewUser({ username: '', password: '', rol: 'usuario', whatsapp_number: '' });
      console.log('🔄 Recargando lista de usuarios...');
      loadUsers();
    } catch (err) {
      console.error('❌ Error al crear usuario:', err);
      toast.error('Error al crear usuario');
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
      await api.delete(`/api/usuarios/${userId}`);
      toast.success('Usuario eliminado');
      loadUsers();
    } catch (err) {
      toast.error('Error al eliminar usuario');
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.rol);
    setShowEditModal(true);
  };

  const handlePasswordUser = (user: User) => {
    setSelectedUser(user);
    setShowPasswordModal(true);
  };

  const canCreateOwner = () => {
    return currentUser?.rol === 'owner';
  };

  const canEditUser = (user: User) => {
    if (currentUser?.rol === 'owner') return true;
    if (currentUser?.rol === 'admin' && user.rol !== 'owner') return true;
    return false;
  };

  const canDeleteUser = (user: User) => {
    if (currentUser?.id === user.id) return false; // No puede eliminarse a sí mismo
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
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.whatsapp_number?.includes(searchTerm);
    const matchesRole = roleFilter === 'all' || user.rol === roleFilter;
    return matchesSearch && matchesRole;
  }) : [];

  const stats = {
    total: Array.isArray(users) ? users.length : 0,
    admins: Array.isArray(users) ? users.filter(u => u.rol === 'admin' || u.rol === 'owner').length : 0,
    moderadores: Array.isArray(users) ? users.filter(u => u.rol === 'moderador').length : 0,
    usuarios: Array.isArray(users) ? users.filter(u => u.rol === 'usuario').length : 0,
    activos: Array.isArray(users) ? users.filter(u => u.activo).length : 0
  };

  // Mostrar loading si está cargando los usuarios
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

  // Si no hay usuario autenticado, mostrar mensaje
  if (!currentUser) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white">Acceso denegado</h2>
          <p className="text-gray-400">No tienes permisos para ver esta página</p>
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
          <AnimatedButton variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            Nuevo Usuario
          </AnimatedButton>
          <AnimatedButton variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={loadUsers} loading={loading}>
            Actualizar
          </AnimatedButton>
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
      <AnimatedCard delay={0.2} className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-search w-full"
            />
          </div>
          <CustomSelect
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: 'all', label: 'Todos los roles' },
              { value: 'owner', label: 'Owner' },
              { value: 'admin', label: 'Administradores' },
              { value: 'moderador', label: 'Moderadores' },
              { value: 'usuario', label: 'Usuarios' }
            ]}
            className="md:w-48"
          />
        </div>
      </AnimatedCard>

      {/* Users Table */}
      <AnimatedCard delay={0.3} className="overflow-hidden">
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
                    <AnimatedTableRow key={user.id} index={index}>
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
                          {formatDate(user.fecha_registro)}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${user.activo ? 'badge-success' : 'badge-danger'}`}>
                          {user.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {canEditUser(user) && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handlePasswordUser(user)}
                              className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors"
                              title="Gestionar contraseña"
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
                          {!canEditUser(user) && !canDeleteUser(user) && (
                            <span className="text-xs text-gray-500 px-2 py-1">Sin permisos</span>
                          )}
                        </div>
                      </td>
                    </AnimatedTableRow>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </AnimatedCard>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="modal-content p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Editar Rol de Usuario</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5">
                  <p className="text-sm text-gray-400">Usuario</p>
                  <p className="text-white font-medium">{selectedUser.username}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Nuevo Rol</label>
                  <CustomSelect
                    value={newRole}
                    onChange={setNewRole}
                    options={[
                      { value: 'usuario', label: 'Usuario' },
                      { value: 'moderador', label: 'Moderador' },
                      { value: 'admin', label: 'Administrador' },
                      ...(canCreateOwner() ? [{ value: 'owner', label: 'Owner' }] : [])
                    ]}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <AnimatedButton variant="primary" fullWidth onClick={() => updateUserRole(selectedUser.id, newRole)}>
                  Guardar
                </AnimatedButton>
                <AnimatedButton variant="secondary" fullWidth onClick={() => setShowEditModal(false)}>
                  Cancelar
                </AnimatedButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="modal-content p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Crear Nuevo Usuario</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Usuario</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="input-glass w-full"
                    placeholder="Nombre de usuario"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Contraseña</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="input-glass w-full"
                    placeholder="Contraseña"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">WhatsApp</label>
                  <input
                    type="text"
                    value={newUser.whatsapp_number}
                    onChange={(e) => setNewUser({ ...newUser, whatsapp_number: e.target.value })}
                    className="input-glass w-full"
                    placeholder="Número de WhatsApp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Rol</label>
                  <CustomSelect
                    value={newUser.rol}
                    onChange={(value) => setNewUser({ ...newUser, rol: value })}
                    options={[
                      { value: 'usuario', label: 'Usuario' },
                      { value: 'moderador', label: 'Moderador' },
                      { value: 'admin', label: 'Administrador' },
                      ...(canCreateOwner() ? [{ value: 'owner', label: 'Owner' }] : [])
                    ]}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <AnimatedButton variant="primary" fullWidth onClick={createUser}>
                  Crear Usuario
                </AnimatedButton>
                <AnimatedButton variant="secondary" fullWidth onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </AnimatedButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Management Modal */}
      <UserPasswordModal 
        isOpen={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)}
        user={selectedUser}
      />
    </div>
  );
};

export default Usuarios;
