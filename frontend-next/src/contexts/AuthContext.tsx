'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface User {
  id: number;
  username: string;
  rol: string;
  whatsapp_number?: string;
  temp_password?: string;
  require_password_change?: boolean;
  last_login?: string;
}

interface AuthError {
  type: 'user_not_found' | 'invalid_password' | 'insufficient_role' | 'temp_password_expired' | 'password_change_required' | 'system_error';
  message: string;
  suggestions?: string[];
  recoveryOptions?: Array<{
    action: string;
    description: string;
    endpoint?: string;
  }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  resetPassword: (username: string, whatsappNumber: string) => Promise<{ tempPassword: string }>;
  refreshUser: () => Promise<void>;
  syncUserData: () => Promise<void>;
  getSyncStatus: () => Promise<any>;
  migrateUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setTokenCookie = (newToken: string) => {
    try {
      const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `token=${encodeURIComponent(newToken)}; Path=/; SameSite=Lax${secure}`;
    } catch {}
  };

  const clearTokenCookie = () => {
    try {
      const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `token=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    } catch {}
  };

  const getTokenCookie = () => {
    try {
      const parts = (typeof document !== 'undefined' ? document.cookie : '').split(';').map(s => s.trim());
      const found = parts.find(p => p.startsWith('token='));
      if (!found) return null;
      return decodeURIComponent(found.slice('token='.length));
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      const cookieToken = getTokenCookie();
      const effectiveToken = storedToken || cookieToken;

      if (!effectiveToken) {
        setIsLoading(false);
        return;
      }

      try {
        if (!storedToken) localStorage.setItem('token', effectiveToken);
        setToken(effectiveToken);
        setTokenCookie(effectiveToken);

        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setIsLoading(false);
          return;
        }

        // Token existe pero no hay user guardado: reconstruir sesión antes de declarar "no autenticado"
        const userData = await api.getMe();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        clearTokenCookie();
        setToken(null);
        setUser(null);
        setIsLoading(false);
      }
    };

    void init();
  }, []);

  const login = async (username: string, password: string, role?: string) => {
    try {
      const response = await api.login(username, password, role);
      const { 
        token: newToken, 
        user: newUser, 
        isTemporaryPassword, 
        requirePasswordChange,
        message 
      } = response;

      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      setTokenCookie(newToken);

      setToken(newToken);
      setUser(newUser);

      // Manejar contraseñas temporales y primer login
      if (isTemporaryPassword || requirePasswordChange) {
        toast.success(
          message || 'Login exitoso. Se requiere cambio de contraseña.',
          { 
            duration: 5000,
            icon: '🔑'
          }
        );
      } else if (message) {
        toast.success(message, { duration: 3000 });
      }

    } catch (error: any) {
      // Manejo mejorado de errores
      const errorData = error?.response?.data;
      
      if (errorData && typeof errorData === 'object') {
        const authError: AuthError = {
          type: errorData.error?.type || 'system_error',
          message: errorData.error?.message || errorData.error || 'Error al iniciar sesión',
          suggestions: errorData.error?.suggestions || [],
          recoveryOptions: errorData.error?.recoveryOptions || []
        };

        // Mostrar mensaje de error específico
        let errorMessage = authError.message;
        
        if (authError.suggestions && authError.suggestions.length > 0) {
          errorMessage += '\n\nSugerencias:\n' + authError.suggestions.join('\n');
        }

        // Mostrar opciones de recuperación si están disponibles
        if (authError.recoveryOptions && authError.recoveryOptions.length > 0) {
          const recoveryText = authError.recoveryOptions
            .map(option => `• ${option.description}`)
            .join('\n');
          errorMessage += '\n\nOpciones de recuperación:\n' + recoveryText;
        }

        throw new Error(errorMessage);
      } else {
        throw new Error(error?.message || 'Error al iniciar sesión');
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearTokenCookie();
    setToken(null);
    setUser(null);
    toast.success('Sesión cerrada correctamente');
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      // Usar el endpoint del sistema JWT
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cambiar contraseña');
      }

      // Actualizar usuario para indicar que ya no requiere cambio de contraseña
      if (user) {
        const updatedUser = {
          ...user,
          require_password_change: false,
          temp_password: undefined,
          password_changed_at: new Date().toISOString()
        };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      toast.success('Contraseña cambiada correctamente', {
        icon: '✅',
        duration: 4000
      });

      return data;
    } catch (error: any) {
      const errorMessage = error?.message || 'Error al cambiar contraseña';
      toast.error(errorMessage);
      throw error;
    }
  };

  const resetPassword = async (username: string, whatsappNumber: string) => {
    try {
      // Usar el endpoint del sistema JWT
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          whatsapp_number: whatsappNumber
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al restablecer contraseña');
      }

      toast.success(
        `Contraseña temporal generada: ${data.tempPassword}\nVálida por 24 horas.`,
        {
          icon: '🔑',
          duration: 8000
        }
      );

      return {
        tempPassword: data.tempPassword,
        username: data.username,
        message: data.message
      };
    } catch (error: any) {
      const errorMessage = error?.message || 'Error al restablecer contraseña';
      toast.error(errorMessage);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      if (!token) return;
      
      const userData = await api.getMe();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error refreshing user data:', error);
      // Si hay error al refrescar, mantener datos locales
    }
  };

  const syncUserData = async () => {
    try {
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al sincronizar datos');
      }

      toast.success('Sincronización de usuarios completada', {
        icon: '🔄',
        duration: 4000
      });

      return data.results;
    } catch (error: any) {
      const errorMessage = error?.message || 'Error al sincronizar datos de usuarios';
      toast.error(errorMessage);
      throw error;
    }
  };

  const getSyncStatus = async () => {
    try {
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch('/api/auth/sync/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener estado de sincronización');
      }

      return data.integrity;
    } catch (error: any) {
      const errorMessage = error?.message || 'Error al obtener estado de sincronización';
      toast.error(errorMessage);
      throw error;
    }
  };

  const migrateUsers = async () => {
    try {
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch('/api/auth/migrate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al migrar usuarios');
      }

      toast.success(`Migración completada: ${data.results.migrated} usuarios migrados`, {
        icon: '📦',
        duration: 4000
      });

      return data.results;
    } catch (error: any) {
      const errorMessage = error?.message || 'Error al migrar usuarios';
      toast.error(errorMessage);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        changePassword,
        resetPassword,
        refreshUser,
        syncUserData,
        getSyncStatus,
        migrateUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};
