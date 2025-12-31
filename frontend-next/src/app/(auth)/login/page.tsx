'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal';
import { Bot, Eye, EyeOff, Lock, User, Sparkles, Zap, Shield, Crown, UserCheck, Users, Wrench, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const roles = [
    { 
      value: 'owner', 
      label: 'Owner', 
      icon: Crown, 
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/20',
      borderColor: 'border-violet-500/30',
      description: 'Acceso completo al sistema'
    },
    { 
      value: 'admin', 
      label: 'Administrador', 
      icon: Shield, 
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30',
      description: 'Gestión avanzada del bot'
    },
    { 
      value: 'moderador', 
      label: 'Moderador', 
      icon: UserCheck, 
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30',
      description: 'Moderación de contenido'
    },
    { 
      value: 'usuario', 
      label: 'Usuario', 
      icon: Users, 
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      borderColor: 'border-emerald-500/30',
      description: 'Acceso básico al panel'
    }
  ];

  // Verificar modo de mantenimiento al cargar la página
  useEffect(() => {
    checkMaintenanceStatus();
  }, []);

  // Si ya hay sesión (por token en cookie/localStorage), no mostrar login
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, router]);

  const checkMaintenanceStatus = async () => {
    try {
      setIsCheckingMaintenance(true);
      const response = await fetch('/api/health');
      const data = await response.json();
      
      if (data.maintenanceMode) {
        setIsMaintenanceMode(true);
        toast.error('El sistema está en modo de mantenimiento');
      } else {
        setIsMaintenanceMode(false);
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error);
      // Si hay error al verificar, asumir que no está en mantenimiento
      setIsMaintenanceMode(false);
    } finally {
      setIsCheckingMaintenance(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar modo de mantenimiento antes de proceder
    if (isMaintenanceMode) {
      toast.error('El sistema está en modo de mantenimiento. Solo los administradores pueden acceder.');
      return;
    }
    
    // Validaciones mejoradas
    if (!username.trim()) {
      toast.error('El nombre de usuario es requerido');
      return;
    }

    if (username.trim().length < 3) {
      toast.error('El usuario debe tener al menos 3 caracteres');
      return;
    }

    if (!password.trim()) {
      toast.error('La contraseña es requerida');
      return;
    }

    if (password.length < 4) {
      toast.error('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    if (!selectedRole) {
      toast.error('Debes seleccionar un rol para continuar');
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim(), password, selectedRole);
      const selectedRoleData = roles.find(r => r.value === selectedRole);
      toast.success(`¡Bienvenido como ${selectedRoleData?.label}!`);
      router.push('/');
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Manejo de errores mejorado
      let errorMessage = 'Error al iniciar sesión';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.status === 401) {
        errorMessage = 'Credenciales incorrectas';
      } else if (error?.response?.status === 403) {
        errorMessage = 'No tienes permisos para este rol';
      } else if (error?.response?.status === 503) {
        // Modo de mantenimiento activado durante el login
        if (error?.response?.data?.maintenanceMode) {
          setIsMaintenanceMode(true);
          errorMessage = 'El sistema está en modo de mantenimiento';
        } else {
          errorMessage = 'Servicio temporalmente no disponible';
        }
      } else if (error?.response?.status >= 500) {
        errorMessage = 'Error del servidor. Inténtalo más tarde';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regEmail.trim() || !regEmail.includes('@')) {
      toast.error('Email inválido');
      return;
    }
    if (!regUsername.trim() || regUsername.trim().length < 3) {
      toast.error('El usuario debe tener al menos 3 caracteres');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (regPassword !== regPassword2) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setIsRegistering(true);
    try {
      await api.registerPublic({
        email: regEmail.trim(),
        username: regUsername.trim(),
        password: regPassword,
      });
      toast.success('Cuenta creada. Iniciando sesión…');
      await login(regUsername.trim(), regPassword, 'usuario');
      router.push('/');
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Error registrando usuario';
      toast.error(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  const features = [
    { icon: Zap, text: 'Gestión de SubBots', color: 'text-amber-400' },
    { icon: Shield, text: 'Control Total', color: 'text-emerald-400' },
    { icon: Sparkles, text: 'Tiempo Real', color: 'text-cyan-400' },
  ];

  // Mostrar pantalla de carga mientras se verifica el mantenimiento
  if (isCheckingMaintenance) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow mb-4">
            <Bot className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-gray-400">Verificando estado del sistema...</p>
        </div>
      </div>
    );
  }

  // Mostrar pantalla de mantenimiento si está activo
  if (isMaintenanceMode) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="glass-card p-8">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-glow mb-6">
              <Wrench className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-4">
              Sistema en Mantenimiento
            </h1>
            
            <div className="flex items-center justify-center gap-2 mb-4 text-orange-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">Acceso Temporalmente Restringido</span>
            </div>
            
            <p className="text-gray-400 mb-6 leading-relaxed">
              El sistema está temporalmente fuera de servicio por mantenimiento programado. 
              Solo los administradores pueden acceder durante este período.
            </p>
            
            <div className="space-y-3">
              <Button 
                onClick={checkMaintenanceStatus}
                variant="primary" 
                className="w-full"
                loading={isCheckingMaintenance}
              >
                Verificar Estado
              </Button>
              
              <p className="text-xs text-gray-500">
                Si eres administrador y necesitas acceso urgente, contacta al equipo técnico.
              </p>
            </div>
          </div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-sm text-gray-500 mt-6"
          >
            © 2025 Oguri Bot. Todos los derechos reservados.
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
          transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -100, 0], y: [0, 50, 0] }}
          transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl"
        />
      </div>

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 relative z-10">
        {/* Left side - Branding */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex flex-col justify-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-8"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow mb-6">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold mb-4">
              <span className="gradient-text-animated">Oguri Bot</span>
            </h1>
            <p className="text-xl text-gray-400">Panel de Control Avanzado</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <div className={`p-2 rounded-lg bg-white/10 ${feature.color}`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <span className="text-gray-300">{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right side - Login Form */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center"
        >
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="lg:hidden text-center mb-8"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow mb-4">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold gradient-text">Oguri Bot</h1>
            </motion.div>

            {/* Login card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-8"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Bienvenido</h2>
                <p className="text-gray-400">Inicia sesión para continuar</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Usuario</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ingresa tu usuario"
                      className="input-glass pl-12"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingresa tu contraseña"
                      className="input-glass pl-12 pr-12"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    Rol de Acceso <span className="text-red-400">*</span>
                  </label>
                  {!selectedRole && (
                    <p className="text-xs text-amber-400 mb-3 flex items-center gap-1">
                      <span>⚠️</span> Selecciona el rol con el que deseas acceder
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {roles.map((role) => {
                      const IconComponent = role.icon;
                      const isSelected = selectedRole === role.value;
                      
                      return (
                        <motion.button
                          key={role.value}
                          type="button"
                          onClick={() => setSelectedRole(role.value)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                            isSelected 
                              ? `${role.bgColor} ${role.borderColor} shadow-lg` 
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <IconComponent className={`w-4 h-4 ${isSelected ? role.color : 'text-gray-400'}`} />
                            <span className={`font-medium text-sm ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                              {role.label}
                            </span>
                          </div>
                          <p className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                            {role.description}
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                  {selectedRole && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-emerald-400 mt-2 flex items-center gap-1"
                    >
                      <span>✓</span> Accederás como {roles.find(r => r.value === selectedRole)?.label}
                    </motion.p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-600 bg-white/5 text-primary-500 focus:ring-primary-500"
                    />
                    Recordarme
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <Button 
                  type="submit" 
                  variant="primary" 
                  className={`w-full ${!selectedRole ? 'opacity-75 cursor-not-allowed' : ''}`}
                  loading={isLoading}
                  disabled={!selectedRole || isLoading}
                >
                  {!selectedRole ? 'Selecciona un rol para continuar' : 'Iniciar Sesión'}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowRegister((v) => !v)}
                  className="w-full text-sm text-primary-400 hover:text-primary-300 transition-colors"
                >
                  {showRegister ? 'Cerrar registro' : 'Crear cuenta (rol usuario)'}
                </button>

                {showRegister && (
                  <div className="mt-4 space-y-4">
                    <div className="text-xs text-gray-400">
                      La cuenta se crea con rol <span className="text-emerald-400 font-medium">Usuario</span>.
                    </div>

                    <form onSubmit={handleRegister} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                        <input
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          type="email"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                          placeholder="tu@email.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Usuario</label>
                        <input
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                          placeholder="usuario"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Contraseña</label>
                        <input
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          type="password"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                          placeholder="••••••••"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Repetir contraseña</label>
                        <input
                          value={regPassword2}
                          onChange={(e) => setRegPassword2(e.target.value)}
                          type="password"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                          placeholder="••••••••"
                        />
                      </div>

                      <Button type="submit" variant="primary" className="w-full" loading={isRegistering} disabled={isRegistering}>
                        Crear cuenta
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center text-sm text-gray-500 mt-6"
            >
              © 2025 Oguri Bot. Todos los derechos reservados.
            </motion.p>
          </div>
        </motion.div>
      </div>

      <ForgotPasswordModal 
        isOpen={showForgotPassword} 
        onClose={() => setShowForgotPassword(false)} 
      />
    </div>
  );
}
