import { useAuth } from '../contexts/AuthContext';

export interface Permission {
  page: string;
  roles: string[];
  description: string;
}

// Definición de permisos por página
export const PERMISSIONS: Permission[] = [
  { page: 'dashboard', roles: ['owner', 'admin', 'moderador', 'usuario'], description: 'Acceso al dashboard principal' },
  { page: 'bot-status', roles: ['owner', 'admin', 'moderador'], description: 'Ver estado del bot' },
  { page: 'usuarios', roles: ['owner', 'admin'], description: 'Gestión de usuarios' },
  { page: 'subbots', roles: ['owner', 'admin'], description: 'Gestión de subbots' },
  { page: 'grupos', roles: ['owner', 'admin', 'moderador'], description: 'Ver grupos' },
  { page: 'grupos-management', roles: ['owner', 'admin'], description: 'Gestión avanzada de grupos' },
  { page: 'aportes', roles: ['owner', 'admin', 'moderador', 'usuario'], description: 'Crear y ver aportes' },
  { page: 'pedidos', roles: ['owner', 'admin', 'moderador', 'usuario'], description: 'Crear y ver pedidos' },
  { page: 'proveedores', roles: ['owner', 'admin'], description: 'Gestión de proveedores' },
  { page: 'logs', roles: ['owner', 'admin'], description: 'Ver logs del sistema' },
  { page: 'notificaciones', roles: ['owner', 'admin', 'moderador'], description: 'Gestión de notificaciones' },
  { page: 'analytics', roles: ['owner', 'admin'], description: 'Ver analytics' },
  { page: 'multimedia', roles: ['owner', 'admin', 'moderador', 'usuario'], description: 'Gestión multimedia' },
  { page: 'settings', roles: ['owner', 'admin'], description: 'Configuración del sistema' },
  { page: 'ai-chat', roles: ['owner', 'admin', 'moderador', 'usuario'], description: 'Chat con IA' },
  { page: 'bot-commands', roles: ['owner', 'admin'], description: 'Comandos del bot' },
];

export const usePermissions = () => {
  const { user } = useAuth();

  const hasPermission = (page: string): boolean => {
    if (!user) return false;
    
    const permission = PERMISSIONS.find(p => p.page === page);
    if (!permission) return false;
    
    return permission.roles.includes(user.rol);
  };

  const canAccess = (pages: string[]): boolean => {
    return pages.some(page => hasPermission(page));
  };

  const getUserPermissions = (): Permission[] => {
    if (!user) return [];
    
    return PERMISSIONS.filter(p => p.roles.includes(user.rol));
  };

  const getRoleLevel = (role: string): number => {
    const levels: Record<string, number> = {
      'usuario': 1,
      'moderador': 2,
      'admin': 3,
      'owner': 4
    };
    return levels[role] || 0;
  };

  const canManageUser = (targetUserRole: string): boolean => {
    if (!user) return false;
    
    const currentLevel = getRoleLevel(user.rol);
    const targetLevel = getRoleLevel(targetUserRole);
    
    // Owner puede gestionar a todos
    if (user.rol === 'owner') return true;
    
    // Admin puede gestionar a usuarios y moderadores, pero no a otros admins u owners
    if (user.rol === 'admin') {
      return targetLevel < 3; // Menor que admin
    }
    
    return false;
  };

  const canCreateRole = (role: string): boolean => {
    if (!user) return false;
    
    // Solo owner puede crear otros owners
    if (role === 'owner') return user.rol === 'owner';
    
    // Admin puede crear usuarios, moderadores y otros admins
    if (user.rol === 'admin') return ['usuario', 'moderador', 'admin'].includes(role);
    
    // Owner puede crear cualquier rol
    if (user.rol === 'owner') return true;
    
    return false;
  };

  return {
    hasPermission,
    canAccess,
    getUserPermissions,
    canManageUser,
    canCreateRole,
    userRole: user?.rol || 'usuario',
    isOwner: user?.rol === 'owner',
    isAdmin: user?.rol === 'admin' || user?.rol === 'owner',
    isModerator: ['moderador', 'admin', 'owner'].includes(user?.rol || ''),
  };
};

export default usePermissions;