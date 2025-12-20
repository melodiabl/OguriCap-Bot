import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Key, Lock, CheckCircle, Copy } from 'lucide-react';
import { AnimatedButton } from './ui/AnimatedButton';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';

interface User {
  id: number;
  username: string;
  rol: string;
}

interface UserPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const UserPasswordModal: React.FC<UserPasswordModalProps> = ({ isOpen, onClose, user }) => {
  const [mode, setMode] = useState<'view' | 'change'>('view');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordData, setPasswordData] = useState<{
    username: string;
    password: string;
    hasPassword: boolean;
    isDefault?: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (isOpen && user) {
      loadPassword();
    }
  }, [isOpen, user]);

  const loadPassword = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      console.log('Loading password for user:', user.id, user.username);
      const data = await apiService.viewUsuarioPassword(user.id);
      console.log('Password data received:', data);
      setPasswordData(data);
    } catch (error: any) {
      console.error('Error loading password:', error);
      let errorMessage = 'Error al cargar información de contraseña';
      
      if (error?.response?.status === 404) {
        errorMessage = `Usuario con ID ${user.id} no encontrado en la base de datos`;
      } else if (error?.response?.status === 401) {
        errorMessage = 'No tienes permisos para ver esta información';
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async () => {
    if (!user) return;
    
    if (!newPassword.trim()) {
      toast.error('Ingresa la nueva contraseña');
      return;
    }

    if (newPassword.length < 4) {
      toast.error('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);
    try {
      await apiService.changeUsuarioPassword(user.id, newPassword);
      
      toast.success('Contraseña actualizada exitosamente');
      setNewPassword('');
      setConfirmPassword('');
      setMode('view');
      loadPassword(); // Recargar para mostrar la nueva contraseña
    } catch (error: any) {
      console.error('Error changing password:', error);
      const errorMessage = error?.response?.data?.error || 'Error al cambiar contraseña';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyPassword = () => {
    if (passwordData?.password) {
      navigator.clipboard.writeText(passwordData.password);
      toast.success('Contraseña copiada al portapapeles');
    }
  };

  const handleClose = () => {
    setMode('view');
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    setPasswordData(null);
    onClose();
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass-card p-6 w-full max-w-md relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                Gestión de Contraseña
              </h2>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <span className="text-primary-400 font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-white">{user.username}</p>
                  <p className="text-sm text-gray-400">Rol: {user.rol}</p>
                </div>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex rounded-lg bg-white/5 p-1 mb-6">
              <button
                onClick={() => setMode('view')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === 'view'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Ver Contraseña
              </button>
              <button
                onClick={() => setMode('change')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === 'change'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Cambiar
              </button>
            </div>

            {/* View Password Mode */}
            {mode === 'view' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Cargando...</p>
                  </div>
                ) : passwordData ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Contraseña Actual
                      </label>
                      <div className="relative">
                        <div className="input-glass pr-20 flex items-center">
                          <span className={`flex-1 ${showPassword ? 'font-mono' : ''}`}>
                            {showPassword ? passwordData.password : '••••••••'}
                          </span>
                        </div>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                          <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={copyPassword}
                            className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-400">Estado</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {passwordData.hasPassword 
                          ? 'Usuario tiene contraseña personalizada configurada' 
                          : 'Usuario usa contraseña por defecto (admin123)'}
                      </p>
                      {passwordData.isDefault && (
                        <p className="text-xs text-amber-400 mt-1">
                          ⚠️ Se recomienda cambiar la contraseña por defecto
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Key className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No se pudo cargar la información</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Change Password Mode */}
            {mode === 'change' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Nueva Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Ingresa la nueva contraseña"
                        className="input-glass pl-12"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Confirmar Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirma la nueva contraseña"
                        className="input-glass pl-12"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {/* Password requirements */}
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-400 mb-1 font-medium">Requisitos:</p>
                    <ul className="text-xs text-gray-400 space-y-0.5">
                      <li className={newPassword.length >= 4 ? 'text-green-400' : ''}>
                        • Mínimo 4 caracteres
                      </li>
                      <li className={newPassword === confirmPassword && confirmPassword ? 'text-green-400' : ''}>
                        • Las contraseñas deben coincidir
                      </li>
                    </ul>
                  </div>

                  <AnimatedButton
                    onClick={changePassword}
                    variant="primary"
                    fullWidth
                    loading={isLoading}
                    className="mt-6"
                  >
                    Cambiar Contraseña
                  </AnimatedButton>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserPasswordModal;